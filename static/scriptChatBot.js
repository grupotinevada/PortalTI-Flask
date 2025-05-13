document.addEventListener('DOMContentLoaded', () => {
    const sendButton = document.getElementById('sendButton');
    const userMessageInput = document.getElementById('userMessage');
    const chatMessages = document.querySelector('.chat-messages');
    const textStatusElement = document.querySelector('.text-muted.small em'); // Referencia al estado del bot
    const statusElement = document.querySelector('.status-indicator'); // Referencia al estado del bot
    const bienvenidaCard = document.getElementById('bienvenida');
    const faqQuestions = document.getElementById('faqQuestions'); 
    const presetQuestionsContainer = document.getElementById('presetQuestions');
    if (!presetQuestionsContainer) {
        console.error('Error: No se encontró el contenedor de preguntas preestablecidas.');
        return;
    }

    


    let questions = []; // Lista completa de preguntas
    let currentIndex = 0; // Índice de la pregunta actual

    // Función para cargar preguntas desde el JSON
    async function loadQuestions() {
        try {
            const response = await fetch('/faq'); // Cambia por la ruta de tu archivo JSON
            const data = await response.json();
            questions = Array.isArray(data) ? data.map(item => item.question) : [];
            if (questions.length > 0) {
                renderQuestions();
            } else {
                console.error('Error: No se encontraron preguntas en el JSON.');
            }
        } catch (error) {
            console.error('Error al cargar las preguntas:', error);
        }
    }

    // Renderizar las preguntas actuales
    function renderQuestions() {
        presetQuestionsContainer.innerHTML = ''; // Limpia el contenedor
        const maxButtons = 3;
        const visibleQuestions = questions.slice(currentIndex, currentIndex + maxButtons);
        const menuQuestions = questions.slice(currentIndex, questions.length);

        menuQuestions.forEach((question, index) => {
            const button = document.createElement('button');
            button.className = 'btn btn-outline-secondary preset-question ';
            button.setAttribute('data-bs-dismiss', 'offcanvas');
            button.textContent = question;
            button.addEventListener('click', () => handleQuestionClick(index));
            faqQuestions.appendChild(button);}
        );
        visibleQuestions.forEach((question, index) => {
            const button = document.createElement('button');
            button.className = 'btn btn-outline-secondary btn-sm preset-question mx-auto';
            button.textContent = question;
            button.addEventListener('click', () => handleQuestionClick(index));
            presetQuestionsContainer.appendChild(button);
        });
    }


    // Manejar clic en un botón de pregunta
    function handleQuestionClick(buttonIndex) {
        const question = questions[currentIndex + buttonIndex];
        userMessageInput.value = question;
        sendMessage();

        // Avanzar al siguiente conjunto de preguntas
        currentIndex++;
        if (currentIndex + 2 < questions.length) {
            renderQuestions();
        } else {
            renderQuestions(); // Re-renderizar para mantener el máximo de botones dinámico
        }
    }


    function updateBotStatus(isTyping) {

        if(isTyping){
            textStatusElement.textContent =  'Escribiendo...';
            statusElement.classList.add('typing');
        } else {
            textStatusElement.textContent = 'En línea';
            statusElement.classList.remove('typing');
            statusElement.classList.add('online');
        }
    }


    
    function fadeOut(element) {
        element.classList.add('fade-out');
        element.addEventListener('transitionend', () => {
            element.style.display = 'none';
        }, { once: true }); // Asegura que el listener se ejecute solo una vez
    }


    function appendMessage(sender, message, isBot) {
        const time = new Date().toLocaleTimeString();
        const formattedMessage = isBot ? marked.parse(message) : message;
        const messageHTML = `
        <div class="${isBot ? 'chat-message-left' : 'chat-message-right'} pb-4">
            <div>
                <img src="${isBot ? '/logos_png/nevaita.png' : '/logos_png/avatar1.webp'}" 
                    class="rounded-circle mr-1" alt="${isBot ? 'Bot' : 'Tú'}" width="40" height="40">
                <div class="text-muted small text-nowrap mt-2">${time}</div>
            </div>
            <div class="flex-shrink-1 bg-light rounded py-2 px-3 ${isBot ? 'ml-3' : 'mr-3'}">
                <div class="font-weight-bold mb-1">${isBot ? 'Nev<span style="color: #25CBCC;">AI</span>ta' : 'Tú'}</div>
                <div>${formattedMessage}</div>
            </div>
        </div>`;
        chatMessages.innerHTML += messageHTML;
        chatMessages.lastElementChild?.scrollIntoView({ behavior: 'smooth' });

    }

    async function sendMessage() {
        
        const userMessage = userMessageInput.value.trim();
        if (userMessage === '') return;

        appendMessage('Tú', userMessage, false); // Mostrar mensaje del usuario
        userMessageInput.value = ''; // Limpiar input

        // Cambiar estado a "Escribiendo..."
        updateBotStatus(true);

        try {
            const response = await fetch('/api/bot', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: userMessage }),
            });

            if (!response.ok) throw new Error('Error en la respuesta del servidor');
            const data = await response.json();

            appendMessage('IA Nevadito', data.response, true); // Mostrar respuesta del bot
        } catch (error) {
            console.error('Error al enviar mensaje:', error);
            appendMessage('IA Nevadito', 'Hubo un error al procesar tu mensaje. Intenta nuevamente.', true);
        } finally {
            updateBotStatus(false); // Cambiar estado a "En línea"
        }
    }

    sendButton.addEventListener('click', () => {
        sendMessage();
        fadeOut(bienvenidaCard);
    });

    userMessageInput.addEventListener('keypress', (event) => {
        if (event.key === 'Enter') {
            sendMessage();
            fadeOut(bienvenidaCard);
        }
    });

    const presetQuestionButtons = document.querySelectorAll('.preset-question');
    presetQuestionButtons.forEach(button => {
        button.addEventListener('click', () => {
            const question = button.textContent.trim();
            userMessageInput.value = question;
            sendMessage();
            fadeOut(bienvenidaCard);
        });
    });



loadQuestions();

});


//FUNCION DESCARGAR ARCHIVO
function downloadPDF(fileName) {
    const link = document.createElement('a');
    link.href = `./reglamentos/${fileName}`;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}