// Estructura de manuales por categoría
const manuales = {
  outlook: [
      '/manuales/manualesCorreo/Autoarchivo Outlook.pdf',
      '/manuales/manualesCorreo/Configuracion correo Android.pdf',
      '/manuales/manualesCorreo/Manual de respuestas automáticas en Outlook.pdf'
  ],
  direccion_trabajo: [
      'manuales/manualDireccionTrabajo/Manual de compatibilidad.pdf',
	  'manuales/manualDireccionTrabajo/PP - CANAL DE DENUNCIAS V2 (LEY KARIN).pdf'
  ],
  impresora: [
      'manuales/manualImpresora/Proceso de escaneo doble cara.pdf'
  ],
  authenticator: [
      'manuales/manualAuthenticator/Manual autenticator restablecer.pdf'
  ],
  pdf: [
      'manuales/manualPdf/Protección y seguridad en PDF.pdf'
  ],
  sap: [
      'manuales/manualesSap/Manual Carga Extractos Bancarios Banco Santander-Chile.pdf',
      'manuales/manualesSap/Manual Pago Automatico Proveedores -F110.pdf',
      'manuales/manualesSap/Registro Factura clientes a través de Finanzas.pdf',
      'manuales/manualesSap/Registro Factura Especial IVA y CEEC Constructoras.pdf'
  ],
  exe: [
      'ejecutables/ClickShare_for_Windows.exe'
  ]
};

// Función para cargar los manuales en el modal
function cargarManuales(categoria) {
  const listaManuales = document.getElementById('listaManuales');
  listaManuales.innerHTML = ''; // Limpiar la lista de manuales
  const archivos = manuales[categoria]; // Obtener archivos de la categoría seleccionada

  // Agregar los enlaces a los manuales en la lista
  archivos.forEach(archivo => {
      const li = document.createElement('li');
      const link = document.createElement('a');
      link.href = archivo;
      link.textContent = `Descargar ${archivo.split('/').pop()}`;
      link.target = '_blank';
      li.appendChild(link);
      listaManuales.appendChild(li);
  });
}






// Elementos del DOM
const chatBall = document.getElementById('chat-floating-ball');
const chatBox = document.getElementById('chat-box');
const closeChat = document.getElementById('close-chat');
const sendMessage = document.getElementById('sendButton');
const chatContent = document.getElementById('chatContent');
const userInput = document.getElementById('userMessage');

// Variables para el manejo del arrastre
let isDragging = false;
let startX, startY, initialX, initialY;
let preventChatOpen = false;

// Función para posicionar el chat
function positionChat() {
    const ballRect = chatBall.getBoundingClientRect();
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;
    const chatWidth = 350;
    const chatHeight = 500;

    let left = ballRect.right + 10;
    let top = ballRect.top;

    if (left + chatWidth > windowWidth) {
        left = ballRect.left - chatWidth - 10;
    }

    if (top + chatHeight > windowHeight) {
        top = windowHeight - chatHeight - 10;
    }

    left = Math.max(10, left);
    top = Math.max(10, top);

    chatBox.style.left = `${left}px`;
    chatBox.style.top = `${top}px`;
}

// Función para agregar mensajes al chat
function appendMessage(sender, message) {
    const messageElement = document.createElement('div');
    messageElement.innerHTML = `<strong>${sender}:</strong> ${message}`;
    if (sender === 'Usuario') {
        messageElement.classList.add('user-message');
    } else {
        messageElement.classList.add('bot-message');
    }
    chatContent.appendChild(messageElement);
    chatContent.scrollTop = chatContent.scrollHeight;
}
// Función para manejar el envío del mensaje del usuario
function handleUserMessage(event) {
    event.preventDefault(); // Prevenir recarga del formulario si es un submit
    const userMessageInput = document.getElementById('userMessage'); // Cambiar por el ID del input
    const userMessage = userMessageInput.value.trim();

    if (userMessage) {
        appendMessage('Usuario', userMessage); // Mostrar mensaje del usuario en el chat
        getBotResponse(userMessage); // Enviar mensaje al bot
        userMessageInput.value = ''; // Limpiar campo de entrada
    }
}
// Asignar evento al botón de enviar
const sendButton = document.getElementById('sendButton'); // Cambiar por el ID del botón
sendButton.addEventListener('click', handleUserMessage);

// O permitir enviar con la tecla Enter
document.getElementById('userMessage').addEventListener('keypress', function (event) {
    if (event.key === 'Enter') {
        handleUserMessage(event);
    }
});
// Función para enviar mensaje al backend y obtener respuesta del bot
async function getBotResponse(userMessage) {
    try {
        // Hacer una solicitud POST al endpoint del bot
        const response = await fetch('/api/bot', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ message: userMessage }),
        });

        // Verificar si la respuesta es exitosa
        if (!response.ok) {
            throw new Error('Error en la comunicación con el bot.');
        }

        // Parsear la respuesta como JSON
        const data = await response.json();

        // Obtener la respuesta del bot
        const botResponse = data.response || 'No se pudo obtener respuesta.';
        appendMessage('AI', botResponse);
    } catch (error) {
        console.error('Error:', error);
        appendMessage('AI', 'Ocurrió un error al comunicarse con el bot.');
    }
}

// Evento para mostrar/ocultar el chat
chatBall.addEventListener('click', (event) => {
    if (preventChatOpen) {
        preventChatOpen = false;
        return;
    }

    if (chatBox.style.display === 'none' || chatBox.style.display === '') {
        positionChat();
        chatBox.style.display = 'flex';
    } else {
        chatBox.style.display = 'none';
    }
});

// Evento para cerrar el chat
closeChat.addEventListener('click', () => {
    chatBox.style.display = 'none';
});

// Evento para enviar mensaje
sendMessage.addEventListener('click', () => {
    const userMessage = userInput.value.trim();
    if (userMessage) {
        appendMessage('Usuario', userMessage);
        userInput.value = '';
        getBotResponse(userMessage);
    }
});

// Eventos para el arrastre de la bola flotante
chatBall.addEventListener('mousedown', (e) => {
    isDragging = true;
    preventChatOpen = false;
    startX = e.clientX;
    startY = e.clientY;
    const ballRect = chatBall.getBoundingClientRect();
    initialX = ballRect.left;
    initialY = ballRect.top;
    chatBall.style.transition = 'none';
    document.body.style.userSelect = 'none';
});

document.addEventListener('mousemove', (e) => {
    if (isDragging) {
        if (Math.abs(e.clientX - startX) > 5 || Math.abs(e.clientY - startY) > 5) {
            preventChatOpen = true;
        }

        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        const newX = initialX + dx;
        const newY = initialY + dy;

        const maxX = window.innerWidth - chatBall.offsetWidth;
        const maxY = window.innerHeight - chatBall.offsetHeight;

        chatBall.style.left = `${Math.max(0, Math.min(newX, maxX))}px`;
        chatBall.style.top = `${Math.max(0, Math.min(newY, maxY))}px`;
    }
});

document.addEventListener('mouseup', () => {
    if (isDragging) {
        isDragging = false;
        document.body.style.userSelect = '';
        chatBall.style.transition = 'all 0.3s ease';
    }
});

// Eventos táctiles para dispositivos móviles
chatBall.addEventListener('touchstart', (e) => {
    isDragging = true;
    preventChatOpen = false;
    const touch = e.touches[0];
    startX = touch.clientX;
    startY = touch.clientY;
    const ballRect = chatBall.getBoundingClientRect();
    initialX = ballRect.left;
    initialY = ballRect.top;
    chatBall.style.transition = 'none';
});

document.addEventListener('touchmove', (e) => {
    if (isDragging) {
        const touch = e.touches[0];
        if (Math.abs(touch.clientX - startX) > 5 || Math.abs(touch.clientY - startY) > 5) {
            preventChatOpen = true;
        }

        const dx = touch.clientX - startX;
        const dy = touch.clientY - startY;
        const newX = initialX + dx;
        const newY = initialY + dy;

        const maxX = window.innerWidth - chatBall.offsetWidth;
        const maxY = window.innerHeight - chatBall.offsetHeight;

        chatBall.style.left = `${Math.max(0, Math.min(newX, maxX))}px`;
        chatBall.style.top = `${Math.max(0, Math.min(newY, maxY))}px`;
    }
});

document.addEventListener('touchend', () => {
    isDragging = false;
    chatBall.style.transition = 'all 0.3s ease';
});

// Inicialización
window.addEventListener('DOMContentLoaded', () => {
    // Asegurar que el chat esté cerrado inicialmente
    chatBox.style.display = 'none';

    // Ajustar la posición inicial de la bola flotante
    chatBall.style.position = 'fixed';
    chatBall.style.bottom = '20px';
    chatBall.style.right = '20px';

    // Prevenir que el chat parpadee abierto
    setTimeout(() => {
        chatBox.style.transition = 'all 0.3s ease';
    }, 500);
});

// Ajustar posición del chat cuando se redimensiona la ventana
window.addEventListener('resize', () => {
    if (chatBox.style.display !== 'none') {
        positionChat();
    }
});