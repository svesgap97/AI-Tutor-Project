document.addEventListener('DOMContentLoaded', () => {
    // --- CONSTANTES DE ELEMENTOS ---
    const chatBox = document.getElementById('chat-box');
    const userInput = document.getElementById('user-input');
    const sendButton = document.getElementById('send-button');
    const userStatusDiv = document.getElementById('user-status');
    const inputArea = document.getElementById('input-area');
    const appContainer = document.getElementById('app-container');
    const mobileLoginScreen = document.getElementById('mobile-login-screen');
    const chatContainer = document.getElementById('chat-container');
    const sidebarContainer = document.getElementById('sidebar-container');
    const sidebarOpenHandle = document.getElementById('sidebar-open-handle');

    // Consentimiento
    const consentContainer = document.getElementById('consent-container');
    const acceptConsentBtn = document.getElementById('accept-consent-btn');

    // Constantes para OCR y Cropper
    const ocrButton = document.getElementById('ocr-button');
    const ocrModal = document.getElementById('ocr-modal');
    const ocrVideo = document.getElementById('ocr-video');
    const ocrCaptureButton = document.getElementById('ocr-capture-button');
    const ocrCloseButton = document.getElementById('ocr-close-button');
    const ocrStatus = document.getElementById('ocr-status');
    const cropperContainer = document.getElementById('cropper-container');
    const cropperImage = document.getElementById('cropper-image');
    const confirmCropButton = document.getElementById('confirm-crop-button');
    const verificationContainer = document.getElementById('verification-container');
    const verificationTextarea = document.getElementById('verification-textarea');
    const acceptTextButton = document.getElementById('accept-text-button');
    const goBackButton = document.getElementById('go-back-button');

    // --- VARIABLES GLOBALES ---
    let videoStream = null;
    let cropper = null;

    // --------------------
    // Consentimiento informado
    // --------------------
    async function checkConsent() {
        try {
            const res = await fetch('/api/consent/status');
            if (!res.ok) throw new Error("Could not verify consent.");
            const data = await res.json();

            if (data.consent_given) {
                consentContainer.style.display = 'none';
                appContainer.style.display = 'flex';
                inputArea.style.display = 'flex';
                await loadConversationHistory();
            } else {
                consentContainer.style.display = 'block';
                appContainer.style.display = 'none';
            }
        } catch (err) {
            console.error("Error verificando consentimiento:", err);
            consentContainer.style.display = 'block';
            appContainer.style.display = 'none';
        }
    }

    async function acceptConsent() {
        try {
            const res = await fetch('/api/consent/accept', { method: "POST" });
            if (!res.ok) throw new Error("Could not record consent.");
            consentContainer.style.display = 'none';
            appContainer.style.display = 'flex';
            inputArea.style.display = 'flex';
            await loadConversationHistory();
        } catch (err) {
            console.error("Error al aceptar consentimiento:", err);
            alert("There was a problem recording your consent.");
        }
    }

    function setupConsentHandlers() {
        if (acceptConsentBtn) {
            acceptConsentBtn.addEventListener('click', acceptConsent);
        }
    }

    // --------------------
    // LÓGICA PRINCIPAL DE LA APLICACIÓN
    // --------------------
    async function checkLoginStatus() {
        const isMobile = window.innerWidth <= 768;
        try {
            const response = await fetch('/api/me');
            if (!response.ok) throw new Error(`Respuesta no exitosa: ${response.status}`);

            const user = await response.json();
            if (!user || !user.name) throw new Error('Invalid user despite a successful response.');

            // Pantalla de usuario conectado
            sidebarContainer.style.display = 'block';

            if (isMobile) {
                document.body.classList.remove('sidebar-open');
            } else {
                document.body.classList.add('sidebar-open');
            }

            const oldLogoutButton = document.querySelector('.logout-button');
            if (oldLogoutButton) oldLogoutButton.remove();

            userStatusDiv.innerHTML = `
                <p>Welcome, <strong>${user.name}</strong></p>
                <button id="new-conversation-button">New Conversation</button>
            `;
            const logoutLink = document.createElement('a');
            logoutLink.href = '/logout';
            logoutLink.className = 'logout-button';
            logoutLink.innerText = 'Sign Out';
            document.getElementById('sidebar').appendChild(logoutLink);

            document.getElementById('new-conversation-button')?.addEventListener('click', async () => {
                if (confirm("Are you sure you want to delete the conversation history?")) {
                    try {
                        const deleteResponse = await fetch('/api/history/delete', { method: 'POST' });
                        if (deleteResponse.ok) await loadConversationHistory();
                        else alert("Could not delete the conversation history.");
                    } catch (error) {
                        alert("Connection error.");
                    }
                }
            });

            // 👇 En vez de cargar directo el historial, verificamos consentimiento
            await checkConsent();

        } catch (error) {
            // Pantalla de usuario desconectado (login)
            console.error("Mostrando pantalla de login:", error);

            if (isMobile) {
                appContainer.style.display = 'none';
                mobileLoginScreen.style.display = 'flex';
                document.body.classList.remove('sidebar-open');
            } else {
                appContainer.style.display = 'flex';
                userStatusDiv.innerHTML = '<h4>Welcome</h4><p>To get started, please sign in.</p><a href="/login"><button>Sign in with Google</button></a>';
                document.body.classList.add('sidebar-open');
            }
            
            const oldLogoutButton = document.querySelector('.logout-button');
            if (oldLogoutButton) oldLogoutButton.remove();
            inputArea.style.display = 'none';
            chatBox.innerHTML = '';
        }
    }

    async function loadConversationHistory() {
        chatBox.innerHTML = '';
        try {
            const response = await fetch('/api/history');
            if (!response.ok) {
                addMessage("I couldn't retrieve your previous conversation, but we can start a new one.", "bot");
                return;
            }
            const history = await response.json();
            if (history.length === 0) {
                addMessage("Hi, I'm Clara. What would you like to think through today?", "bot");
            } else {
                history.forEach(message => {
                    const role = message.role === 'model' ? 'bot' : 'user';
                    addMessage(message.parts[0], role);
                });
            }
        } catch (error) {
            console.error("Error al cargar el historial:", error);
            addMessage("There was a connection problem. I couldn't load our conversation.", "bot");
        }
    }

    function addMessage(text, sender) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${sender}`;
        messageDiv.innerHTML = marked.parse(text);
        chatBox.appendChild(messageDiv);
        chatContainer.scrollTop = chatContainer.scrollHeight;
    }

    function showLoading(isLoading) {
        let loadingDiv = document.getElementById('loading-indicator');
        if (isLoading) {
            if (!loadingDiv) {
                loadingDiv = document.createElement('div');
                loadingDiv.className = 'message bot loading';
                loadingDiv.id = 'loading-indicator';
                loadingDiv.innerHTML = '<div class="loading-container"><div class="loading-dot"></div><div class="loading-dot"></div><div class="loading-dot"></div></div>';
                chatBox.appendChild(loadingDiv);
                chatContainer.scrollTop = chatContainer.scrollHeight;
            }
        } else {
            loadingDiv?.remove();
        }
    }

    async function sendMessage() {
        const message = userInput.value.trim();
        if (message === '') return;

        addMessage(message, 'user');
        userInput.value = '';
        userInput.style.height = 'auto';
        sendButton.disabled = true;
        showLoading(true);

        try {
            const response = await fetch('/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: message })
            });
            showLoading(false);
            if (!response.ok) throw new Error(`Server error: ${response.statusText}`);
            const data = await response.json();
            addMessage(data.reply, 'bot');
        } catch (error) {
            console.error('Error:', error);
            showLoading(false);
            addMessage("I'm sorry, there was a connection problem.", 'bot');
        } finally {
            sendButton.disabled = false;
            userInput.focus();
        }
    }

    // --- LÓGICA DE OCR (SIN CAMBIOS) ---
    function cleanupOcr() {
        if (videoStream) {
            videoStream.getTracks().forEach(track => track.stop());
            videoStream = null;
        }
        if (cropper) {
            cropper.destroy();
            cropper = null;
        }
        ocrModal.style.display = 'none';
    }
    
    ocrButton.addEventListener('click', async () => {
        try {
            videoStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { exact: "environment" } } });
            ocrVideo.srcObject = videoStream;
            await ocrVideo.play();
            ocrModal.style.display = 'flex';
            cropperContainer.style.display = 'none';
            verificationContainer.style.display = 'none';
            ocrVideo.style.display = 'block';
            ocrCaptureButton.style.display = 'block';
        } catch (err) {
            console.error("Error al acceder a la cámara:", err);
            alert("Could not access the camera.");
        }
    });
    
    ocrCaptureButton.addEventListener('click', () => {
        const canvas = document.createElement('canvas');
        canvas.width = ocrVideo.videoWidth;
        canvas.height = ocrVideo.videoHeight;
        canvas.getContext('2d').drawImage(ocrVideo, 0, 0);
        cropperImage.src = canvas.toDataURL('image/jpeg');

        ocrVideo.style.display = 'none';
        ocrCaptureButton.style.display = 'none';
        cropperContainer.style.display = 'block';
        if (cropper) cropper.destroy();
        cropper = new Cropper(cropperImage, { viewMode: 1, background: false });
    });

    confirmCropButton.addEventListener('click', async () => {
        ocrStatus.innerText = 'Processing...';
        ocrStatus.style.display = 'block';
        try {
            const croppedCanvas = cropper.getCroppedCanvas();
            const imageDataURL = croppedCanvas.toDataURL('image/jpeg', 0.9);
            const response = await fetch('/api/ocr', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ image: imageDataURL })
            });
            if (!response.ok) throw new Error('The server request failed.');
            const data = await response.json();
            verificationTextarea.value = data.text;
            cropperContainer.style.display = 'none';
            verificationContainer.style.display = 'flex';
        } catch (err) {
            console.error("Error en OCR:", err);
            alert("Could not recognize the text.");
            cleanupOcr();
        } finally {
            ocrStatus.style.display = 'none';
        }
    });

    acceptTextButton.addEventListener('click', () => {
        userInput.value = verificationTextarea.value;
        userInput.style.height = 'auto';
        userInput.style.height = userInput.scrollHeight + 'px';
        cleanupOcr();
    });

    goBackButton.addEventListener('click', () => {
        verificationContainer.style.display = 'none';
        cropperContainer.style.display = 'block';
    });

    ocrCloseButton.addEventListener('click', cleanupOcr);

    // --- LISTENERS ---
    setupConsentHandlers();
    checkLoginStatus();

    sendButton.addEventListener('click', sendMessage);

    userInput.addEventListener('keypress', (event) => {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            sendMessage();
        }
    });

    userInput.addEventListener('input', () => {
        userInput.style.height = 'auto';
        userInput.style.height = `${userInput.scrollHeight}px`;
    });

    // Listener de la flecha del sidebar
    sidebarOpenHandle.addEventListener('click', () => {
        document.body.classList.toggle('sidebar-open');
    });

    // Listener del acordeón
    document.querySelectorAll('.accordion-header').forEach(header => {
        header.addEventListener('click', () => {
            const content = header.nextElementSibling;
            const isActive = header.classList.contains('active');
            document.querySelectorAll('.accordion-header').forEach(h => {
                h.classList.remove('active');
                h.nextElementSibling.style.maxHeight = null;
            });
            if (!isActive) {
                header.classList.add('active');
            }
        });
    });
});