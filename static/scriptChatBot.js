document.addEventListener('DOMContentLoaded', () => {
    const sendButton = document.getElementById('sendButton');
    const userMessageInput = document.getElementById('userMessage');
    const chatMessages = document.querySelector('.chat-messages');
    const textStatusElement = document.querySelector('.text-muted.small em'); // Referencia al estado del bot
    const statusElement = document.querySelector('.status-indicator'); // Referencia al estado del bot
    const presetQuestions = document.querySelector('.preset-question')
    
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


    function appendMessage(sender, message, isBot) {
        const time = new Date().toLocaleTimeString();
        const formattedMessage = isBot ? marked.parse(message) : message;
        const messageHTML = `
        <div class="${isBot ? 'chat-message-left' : 'chat-message-right'} pb-4">
            <div>
                <img src="${isBot ? '/logos_png/chatLogo.png' : 'https://bootdey.com/img/Content/avatar/avatar1.png'}" 
                    class="rounded-circle mr-1" alt="${isBot ? 'Bot' : 'Tú'}" width="40" height="40">
                <div class="text-muted small text-nowrap mt-2">${time}</div>
            </div>
            <div class="flex-shrink-1 bg-light rounded py-2 px-3 ${isBot ? 'ml-3' : 'mr-3'}">
                <div class="font-weight-bold mb-1">${isBot ? 'IA Nevadito' : 'Tú'}</div>
                <div>${formattedMessage}</div>
            </div>
        </div>`;
        chatMessages.innerHTML += messageHTML;
        chatMessages.scrollTop = chatMessages.scrollHeight; // Scroll hacia abajo
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

    sendButton.addEventListener('click', sendMessage);
    userMessageInput.addEventListener('keypress', (event) => {
        if (event.key === 'Enter') sendMessage();
    });

const presetQuestionButtons = document.querySelectorAll('.preset-question');
presetQuestionButtons.forEach(button => {
    button.addEventListener('click', () => {
        const question = button.textContent.trim();
        userMessageInput.value = question;
        sendMessage();
    });
});
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