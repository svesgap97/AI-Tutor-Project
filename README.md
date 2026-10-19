# Laboratorio de Utopías: Chat con "Clara"

Este repositorio contiene el código fuente de "Clara", un agente de IA conversacional diseñado como parte de un proyecto de investigación-creación para una maestría en Humanidades Digitales. El proyecto explora cómo las interacciones con modelos de lenguaje generativo pueden ser diseñadas para fomentar la Alfabetización en Inteligencia Artificial (AI Literacy).

## Descripción del Proyecto

"Clara" no es un asistente convencional. Su rol es el de una "asistente creativa" diseñada para co-crear narrativas hipertextuales con los usuarios. A través de una personalidad curiosa y colaborativa, Clara guía a los estudiantes en la exploración de futuros posibles para la IA.

El núcleo pedagógico del proyecto reside en el **System Prompt** del modelo, que instruye a Clara a generar "momentos pedagógicos" programados. Estos momentos están diseñados para que el usuario reflexione sobre las capacidades y limitaciones de la IA, como la ventana de contexto, los sesgos, la simulación de empatía y su naturaleza de "caja negra".

## Características Principales

  * **Chat Conversacional Avanzado**: La interacción principal se realiza a través de un chat con **Google Gemini 1.5 Flash**, configurado con un prompt de sistema detallado que define la personalidad y los objetivos pedagógicos de "Clara".
  * **Autenticación de Usuarios**: Integración segura con **Google OAuth** para gestionar las sesiones de los usuarios y guardar su progreso.
  * **Historial de Conversación**: Cada conversación es almacenada en una base de datos **SQLite**, permitiendo a los usuarios continuar sus narrativas en futuras sesiones.
  * **OCR con Gemini Vision**: Funcionalidad avanzada para leer texto a través de la cámara del celular. El flujo incluye:
    1.  **Captura y Recorte**: El usuario puede capturar una imagen y recortar el área de interés para mejorar la precisión.
    2.  **Análisis con IA**: La imagen recortada se envía al backend para ser procesada por la API de Gemini Vision.
    3.  **Modo de Verificación**: El texto reconocido se presenta al usuario en una pantalla de verificación donde puede corregir cualquier error antes de usarlo en el chat.

## Estructura del Repositorio

  * `app.py`: Contiene toda la lógica del backend, incluyendo el servidor **Flask**, las rutas de la API, la conexión con la base de datos, la autenticación y la interacción con la API de Gemini.
  * `requirements.txt`: Lista todas las dependencias de Python necesarias para ejecutar el proyecto.
  * `/templates`:
      * `index.html`: Es el "plano" de la aplicación. Contiene toda la estructura HTML de la interfaz.
  * `/static`:
      * `style.css`: Contiene todos los estilos que definen la apariencia visual de la aplicación.
      * `script.js`: Contiene toda la lógica del frontend, manejando la interactividad, las llamadas a la API del backend y la funcionalidad de la cámara y el recorte.

## Instalación y Ejecución Local

Para ejecutar este proyecto en tu propia máquina, sigue estos pasos:

1.  **Clonar el Repositorio**

    ```bash
    git clone https://URL_DE_TU_REPOSITORIO.git
    cd NOMBRE_DE_LA_CARPETA
    ```

2.  **Crear y Activar un Entorno Virtual** (Recomendado)

    ```bash
    # Crear el entorno
    python -m venv venv
    # Activar en Windows
    .\venv\Scripts\activate
    # Activar en macOS/Linux
    source venv/bin/activate
    ```

3.  **Instalar Dependencias**

    ```bash
    pip install -r requirements.txt
    ```

4.  **Configurar Variables de Entorno**

      * Crea un archivo llamado `.env` en la raíz del proyecto.
      * Añade las siguientes claves con tus propios valores:
        ```
        API_KEY="TU_API_KEY_DE_GOOGLE"
        APP_SECRET_KEY="UNA_CLAVE_SECRETA_LARGA_Y_ALEATORIA"
        GOOGLE_CLIENT_ID="TU_CLIENT_ID_DE_GOOGLE"
        GOOGLE_CLIENT_SECRET="TU_CLIENT_SECRET_DE_GOOGLE"
        ```

5.  **Iniciar la Aplicación**

    ```bash
    python app.py
    ```

    La aplicación estará disponible en `http://localhost:5000`. La primera vez que se ejecute, se creará automáticamente el archivo de base de datos `database.db`.
