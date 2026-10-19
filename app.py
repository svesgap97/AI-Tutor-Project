import os
import json
import base64
import google.generativeai as genai
from google.generativeai.types import HarmCategory, HarmBlockThreshold
from flask import Flask, request, jsonify, redirect, url_for, session, render_template
from flask_cors import CORS
from dotenv import load_dotenv
from flask_sqlalchemy import SQLAlchemy
from authlib.integrations.flask_client import OAuth
from werkzeug.middleware.proxy_fix import ProxyFix
from datetime import datetime

# --- CONFIGURACIÓN DE LA APLICACIÓN ---
app = Flask(__name__, static_folder='static')
app.wsgi_app = ProxyFix(app.wsgi_app, x_proto=1, x_host=1)
CORS(app)
load_dotenv()

app.secret_key = os.getenv("APP_SECRET_KEY", os.urandom(24))
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///database.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['SESSION_COOKIE_SECURE'] = True
app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'
db = SQLAlchemy(app)

api_key = os.getenv("API_KEY")
if not api_key:
    raise ValueError("No se encontró la API_KEY en el archivo .env")
genai.configure(api_key=api_key)

# --- MODELOS DE LA BASE DE DATOS ---
class User(db.Model):
    id = db.Column(db.String, primary_key=True)
    name = db.Column(db.String, nullable=False)
    email = db.Column(db.String, unique=True, nullable=False)
    conversation = db.relationship('ConversationHistory', backref='user', uselist=False, lazy=True)
    consent_given = db.Column(db.Boolean, default=False)
class ConversationHistory(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.String, db.ForeignKey('user.id'), nullable=False, unique=True)
    history_json = db.Column(db.Text, nullable=False, default='[]')
    created_at = db.Column(db.DateTime, default=datetime.utcnow)       
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow) 

# --- CONFIGURACIÓN DE AUTENTICACIÓN ---
oauth = OAuth(app)
google = oauth.register(
    name='google',
    client_id=os.getenv("GOOGLE_CLIENT_ID"),
    client_secret=os.getenv("GOOGLE_CLIENT_SECRET"),
    server_metadata_url='https://accounts.google.com/.well-known/openid-configuration',
    client_kwargs={'scope': 'openid email profile'}
)

# --- LÓGICA DEL BOT ---
SYSTEM_PROMPT = """
1. IDENTITY & PEDAGOGICAL ROLE
- You are "Clara", a supportive, inquisitive AI creative writing guide for secondary school ESL students.
- Your primary objective is to build the student's creative self-efficacy and guide them through writing an original short story.
- You are a SOCRATIC DIALOGUE PARTNER, not a co-writer or ghostwriter. The student must write 100% of the story text.

2. ABSOLUTE GUARDRAILS (STRICT CONSTRAINTS)
- NEVER write story sentences, paragraphs, or plot continuations for the student.
- NEVER generate full story drafts or rewrite student paragraphs.
- IF a student asks "Write the next paragraph for me" OR "Give me a story opening":
  --> Politely decline and pivot back to questioning. Example: "I'm here to help you brainstorm, but the storytelling is all yours! What do you want your character to see when they open that door?"
- Keep all AI responses under 100 words to ensure cognitive load remains on the student.

3. INTERACTION & QUESTIONING STRATEGY
- Always structure your responses in three parts:
  a) AFFIRMATION: Briefly validate the student's idea or progress (1 sentence).
  b) SOCRATIC PROMPT: Ask 1 (maximum 2) open-ended questions about narrative elements (sensory details, character motives, plot conflict, or emotional depth).
  c) L2 WRITING SUPPORT (OPTIONAL): Offer 2-3 target vocabulary words or literary devices if the student seems stuck on language expression.

4. NARRATIVE GUIDANCE STAGES
Adapt your questions depending on where the student is in their writing process:
- STAGE 1 (Ideation & Brainstorming): Focus on character motivation, setting details, and central conflict. Ask "Why" and "What if" questions.
- STAGE 2 (Drafting): Help the student expand scenes using sensory language (sight, sound, touch) and internal character thoughts.
- STAGE 3 (Reflection & Revision): Encourage the student to evaluate narrative pacing, character arc, and vocabulary choices.

5. TONAL GUIDANCE
- Tone: Encouraging, curious, age-appropriate, and pedagogically patient.
- Language: Clear English appropriate for B1-B2 secondary ESL learners. Avoid overly complex academic jargon.
"""

# Define las reglas de seguridad.
safety_settings = [
    {
        "category": HarmCategory.HARM_CATEGORY_HARASSMENT,
        "threshold": HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
    },
    {
        "category": HarmCategory.HARM_CATEGORY_HATE_SPEECH,
        "threshold": HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
    },
    {
        "category": HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
        "threshold": HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
    },
    {
        "category": HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
        "threshold": HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
    },
]
model = genai.GenerativeModel(
    'gemini-2.5-flash',
    system_instruction=SYSTEM_PROMPT,
    safety_settings=safety_settings  # <-- Parámetro añadido
)
# --- RUTAS DE LA APLICACIÓN ---
@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/me')
def get_current_user():
    if 'user_id' in session:
        user = User.query.get(session['user_id'])
        if user:
            return jsonify({'id': user.id, 'name': user.name, 'email': user.email})
    return jsonify({'error': 'No active session'}), 401

@app.route('/api/history')
def get_history():
    if 'user_id' not in session:
        return jsonify({'error': 'Usuario no autenticado'}), 401
    user_id = session['user_id']
    conversation = ConversationHistory.query.filter_by(user_id=user_id).first()
    if conversation:
        history = json.loads(conversation.history_json)
        return jsonify(history)
    return jsonify([])

@app.route('/login')
def login():
    redirect_uri = url_for('authorize', _external=True)
    session['nonce'] = os.urandom(16).hex()
    return google.authorize_redirect(redirect_uri, nonce=session['nonce'])

@app.route('/api/history/delete', methods=['POST'])
def delete_history():
    if 'user_id' not in session:
        return jsonify({'error': 'Usuario no autenticado'}), 401

    user_id = session['user_id']
    conversation = ConversationHistory.query.filter_by(user_id=user_id).first()
    
    if conversation:
        conversation.history_json = '[]'
        db.session.commit()
    
    return jsonify({'success': True})

@app.route('/authorize')
def authorize():
    token = google.authorize_access_token()
    nonce = session.pop('nonce', None)
    user_info = oauth.google.parse_id_token(token, nonce=nonce)

    user = User.query.get(user_info['sub'])
    if not user:
        user = User(id=user_info['sub'], name=user_info.get('name', 'Anonymous User'), email=user_info['email'])
        db.session.add(user)
        new_history = ConversationHistory(user_id=user.id, history_json='[]')
        db.session.add(new_history)
        db.session.commit()

    session['user_id'] = user.id
    return redirect(url_for('index'))

@app.route('/logout')
def logout():
    session.pop('user_id', None)
    session.pop('nonce', None)
    return redirect(url_for('index'))

@app.route('/chat', methods=['POST'])
def handle_chat():
    if 'user_id' not in session:
        return jsonify({'error': 'Usuario no autenticado'}), 401

    user_id = session['user_id']
    user_message = request.json['message']

    conversation = ConversationHistory.query.filter_by(user_id=user_id).first()
    
    if not conversation:
        conversation = ConversationHistory(user_id=user_id, history_json='[]')
        db.session.add(conversation)
        db.session.commit()

    history = json.loads(conversation.history_json)
    
    chat = model.start_chat(history=history)
    response = chat.send_message(user_message)

    updated_history_list = []
    for message in chat.history:
        updated_history_list.append({"role": message.role, "parts": [part.text for part in message.parts]})
    
    conversation.history_json = json.dumps(updated_history_list)
    db.session.commit()

    return jsonify({'reply': response.text})

@app.route('/api/ocr', methods=['POST'])
def handle_ocr():
    if 'user_id' not in session:
        return jsonify({'error': 'Usuario no autenticado'}), 401

    # 1. Recibe la imagen del frontend
    # La imagen vendrá como un string largo de texto (en formato Base64)
    image_data_url = request.json.get('image')
    if not image_data_url:
        return jsonify({'error': 'No image was received'}), 400

    # 2. Prepara la imagen para Gemini
    # Quitamos el prefijo "data:image/jpeg;base64," para quedarnos solo con los datos
    header, encoded = image_data_url.split(",", 1)
    image_data = base64.b64decode(encoded)

    image_part = {
        "mime_type": "image/jpeg",
        "data": image_data
    }

    generation_config = genai.types.GenerationConfig(
        temperature=0.1 # Muy baja para que no sea creativo
    )

    # 4. Envía la imagen a la API de Gemini con una instrucción MUY específica
    prompt_parts = [
        "Extract and transcribe all text visible in this image, preserving line breaks where possible. Your only task is to transcribe the image verbatim. Do not add, translate, interpret, or comment on anything. Return only the text exactly as it appears.",
        image_part
    ]
    try:
        # Añadimos la configuración de baja temperatura a la llamada
        response = model.generate_content(
            prompt_parts,
            generation_config=generation_config
        )
        return jsonify({'text': response.text})
    except Exception as e:
        print(f"Error en la API de Gemini: {e}")
        return jsonify({'error': 'Could not process the image'}), 500
@app.route('/api/consent/status')
def consent_status():
    # 1. Verifica que el usuario haya iniciado sesión
    if 'user_id' not in session:
        return jsonify({'error': 'Usuario no autenticado'}), 401

    # 2. Busca al usuario en la base de datos
    user = User.query.get(session['user_id'])
    if not user:
        return jsonify({'error': 'Usuario no encontrado'}), 404

    # 3. Devuelve el estado actual de su consentimiento
    return jsonify({'consent_given': user.consent_given})

@app.route('/api/consent/accept', methods=['POST'])
def accept_consent():
    # 1. Verifica que el usuario haya iniciado sesión
    if 'user_id' not in session:
        return jsonify({'error': 'Usuario no autenticado'}), 401
    
    # 2. Busca al usuario en la base de datos
    user = User.query.get(session['user_id'])
    if not user:
        return jsonify({'error': 'Usuario no encontrado'}), 404

    # 3. Actualiza el campo y guarda los cambios
    user.consent_given = True
    db.session.commit()
    
    return jsonify({'success': True, 'message': 'Consentimiento aceptado.'})

# --- INICIO DE LA APLICACIÓN ---
if __name__ == '__main__':
    with app.app_context():
        db.create_all()
    app.run(port=5000, debug=True)