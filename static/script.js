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

    // Camera workflow: capture -> crop -> review. Closing cancels pending work.
    const captureActions = document.getElementById('capture-actions');
    const cropActions = document.getElementById('cropper-actions');
    const reviewActions = document.getElementById('verification-actions');
    const cameraRetry = document.getElementById('camera-retry-button');
    const cameraGuide = document.getElementById('camera-guide');
    const cameraInstruction = document.getElementById('camera-instruction');
    let cameraSession = 0;
    let ocrRequest = null;
    let previousFocus = null;

    function stopCamera() {
        videoStream?.getTracks().forEach(track => track.stop());
        videoStream = null;
        ocrVideo.srcObject = null;
    }
    function cameraStatus(message = '', error = false) {
        ocrStatus.textContent = message;
        ocrStatus.hidden = !message;
        ocrStatus.dataset.error = String(error);
    }
    function cameraStep(step) {
        ocrModal.dataset.step = step;
        ocrVideo.hidden = step !== 'capture';
        cameraGuide.hidden = step !== 'capture';
        captureActions.hidden = step !== 'capture';
        cropperContainer.hidden = step !== 'crop';
        cropActions.hidden = step !== 'crop';
        verificationContainer.hidden = step !== 'review';
        reviewActions.hidden = step !== 'review';
        document.querySelectorAll('.camera-steps li').forEach(item => {
            if (item.dataset.step === step) item.setAttribute('aria-current', 'step');
            else item.removeAttribute('aria-current');
        });
        cameraInstruction.textContent = {
            capture: 'Place your page in good light. Keep the writing inside the frame and hold steady.',
            crop: 'Drag the corners to keep only the writing you want Clara to read.',
            review: 'Your voice matters. Check the recognized text before adding it to your message.'
        }[step];
    }
    function cleanupOcr() {
        cameraSession++;
        ocrRequest?.abort();
        ocrRequest = null;
        stopCamera();
        cropper?.destroy();
        cropper = null;
        cropperImage.removeAttribute('src');
        verificationTextarea.value = '';
        ocrModal.hidden = true;
        ocrModal.removeAttribute('aria-busy');
        document.getElementById('cancel-crop-button').disabled = false;
        appContainer.inert = false;
        confirmCropButton.disabled = false;
        cameraStatus();
        (previousFocus || ocrButton).focus();
    }
    async function startCamera() {
        const session = ++cameraSession;
        stopCamera();
        cropper?.destroy();
        cropper = null;
        cameraStep('capture');
        ocrCaptureButton.disabled = true;
        cameraRetry.hidden = true;
        cameraStatus('Opening your camera…');
        try {
            if (!navigator.mediaDevices?.getUserMedia) {
                throw new Error(window.isSecureContext ? 'Camera unsupported' : 'Camera requires HTTPS');
            }
            let stream;
            try {
                stream = await navigator.mediaDevices.getUserMedia({
                    // Desktop browsers use the default webcam; phones prefer the rear camera.
                    video: {
                        ...(/Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
                            ? { facingMode: { ideal: 'environment' } } : {}),
                        width: { ideal: 1920 }, height: { ideal: 1080 }
                    },
                    audio: false
                });
            } catch (error) {
                if (!['OverconstrainedError', 'NotFoundError'].includes(error.name)) throw error;
                stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
            }
            if (session !== cameraSession || ocrModal.hidden) {
                stream.getTracks().forEach(track => track.stop());
                return;
            }
            videoStream = stream;
            ocrVideo.srcObject = stream;
            await ocrVideo.play();
            if (session !== cameraSession) return;
            ocrCaptureButton.disabled = false;
            cameraStatus();
            ocrCaptureButton.focus();
        } catch (error) {
            if (session !== cameraSession) return;
            stopCamera();
            cameraGuide.hidden = true;
            cameraStatus(error.message === 'Camera requires HTTPS'
                ? 'Camera access needs HTTPS or localhost. Open Clara using a secure address.'
                : error.message === 'Camera unsupported'
                ? 'This browser cannot open the camera. Try opening this address in Chrome, Edge, Firefox or Safari.'
                : error.name === 'NotFoundError'
                ? 'No webcam was found. Connect or enable your laptop camera, then try again.'
                : error.name === 'NotReadableError'
                ? 'Your webcam is busy or blocked by the system. Close other camera apps and check your laptop privacy settings.'
                : error.name === 'NotAllowedError'
                ? 'Camera access is blocked. Allow camera access in your browser, then try again.'
                : 'The camera could not open. Check that it is connected and not in use, then try again.', true);
            cameraRetry.hidden = false;
            cameraRetry.focus();
        }
    }
    ocrButton.addEventListener('click', () => {
        if (!ocrModal.hidden) return;
        previousFocus = document.activeElement;
        ocrModal.hidden = false;
        appContainer.inert = true;
        ocrCloseButton.focus();
        startCamera();
    });
    cameraRetry.addEventListener('click', startCamera);
    document.getElementById('cancel-crop-button').addEventListener('click', startCamera);

    ocrCaptureButton.addEventListener('click', () => {
        if (!ocrVideo.videoWidth || !ocrVideo.videoHeight || !videoStream) {
            cameraStatus('The camera is still getting ready. Please try again.', true);
            return;
        }
        if (typeof Cropper === 'undefined') {
            cameraStatus('The photo editor could not load. Close the camera and reload the page to try again.', true);
            return;
        }
        const canvas = document.createElement('canvas');
        canvas.width = ocrVideo.videoWidth;
        canvas.height = ocrVideo.videoHeight;
        canvas.getContext('2d').drawImage(ocrVideo, 0, 0);
        cropperImage.src = canvas.toDataURL('image/jpeg', 0.92);
        stopCamera();
        cameraStatus();
        cameraStep('crop');
        cropper?.destroy();
        cropper = new Cropper(cropperImage, {
            viewMode: 1, background: false, autoCropArea: 0.9,
            responsive: true, ready() { confirmCropButton.focus(); }
        });
    });
    confirmCropButton.addEventListener('click', async () => {
        if (!cropper || confirmCropButton.disabled) return;
        const canvas = cropper.getCroppedCanvas({ maxWidth: 2400, maxHeight: 2400 });
        if (!canvas || !canvas.width || !canvas.height) {
            cameraStatus('Select an area of your photo first.', true);
            return;
        }
        const session = cameraSession;
        const request = new AbortController();
        ocrRequest = request;
        confirmCropButton.disabled = true;
        document.getElementById('cancel-crop-button').disabled = true;
        ocrModal.setAttribute('aria-busy', 'true');
        cameraStatus('Clara is reading your writing…');
        try {
            const response = await fetch('/api/ocr', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ image: canvas.toDataURL('image/jpeg', 0.9) }),
                signal: request.signal
            });
            if (!response.ok) throw new Error('OCR request failed');
            const data = await response.json();
            if (session !== cameraSession) return;
            if (typeof data.text !== 'string' || !data.text.trim()) {
                cameraStatus('No text was found. Adjust the crop or retake the photo with better lighting.', true);
                return;
            }
            verificationTextarea.value = data.text;
            cameraStep('review');
            cameraStatus();
            verificationTextarea.focus();
        } catch (error) {
            if (session === cameraSession && error.name !== 'AbortError') {
                cameraStatus('Clara could not read the photo. Your photo is still here: try again or adjust the crop.', true);
            }
        } finally {
            if (session === cameraSession) {
                ocrRequest = null;
                confirmCropButton.disabled = false;
                document.getElementById('cancel-crop-button').disabled = false;
                ocrModal.removeAttribute('aria-busy');
            }
        }
    });
    acceptTextButton.addEventListener('click', () => {
        const text = verificationTextarea.value.trim();
        if (!text) {
            cameraStatus('Add some text or go back to crop before continuing.', true);
            verificationTextarea.focus();
            return;
        }
        userInput.value = [userInput.value.trim(), text].filter(Boolean).join('\n\n');
        cleanupOcr();
        userInput.dispatchEvent(new Event('input'));
        userInput.focus();
    });
    goBackButton.addEventListener('click', () => {
        cameraStep('crop');
        cameraStatus();
        confirmCropButton.focus();
    });
    ocrCloseButton.addEventListener('click', cleanupOcr);
    ocrModal.addEventListener('keydown', event => {
        if (event.key === 'Escape') { event.preventDefault(); cleanupOcr(); }
        if (event.key === 'Tab') {
            const elements = [...ocrModal.querySelectorAll('button:not(:disabled), textarea')].filter(el => el.getClientRects().length);
            const first = elements[0], last = elements[elements.length - 1];
            if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
            else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
        }
    });
    window.addEventListener('pagehide', cleanupOcr);

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