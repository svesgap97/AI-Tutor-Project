# inspect_db.py
from app import app, db, User, ConversationHistory

with app.app_context():
    # Mostrar todos los usuarios
    users = User.query.all()
    print("\n=== Usuarios registrados ===")
    for u in users:
        print(f"ID: {u.id}, Nombre: {u.name}, Email: {u.email}, Consentimiento: {u.consent_given}")

    # Mostrar historiales de conversación
    histories = ConversationHistory.query.all()
    print("\n=== Historiales de conversación ===")
    for h in histories:
        print(f"Usuario ID: {h.user_id}")
        print(f"Creado en: {h.created_at}, Última actualización: {h.updated_at}")
        print(f"Historial JSON: {h.history_json}\n")
