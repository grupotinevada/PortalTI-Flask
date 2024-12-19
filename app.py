from flask import Flask, render_template, send_from_directory, request, jsonify
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from werkzeug.middleware.proxy_fix import ProxyFix
from dotenv import load_dotenv

import os
import openai
import hashlib
from langchain.vectorstores import FAISS
from langchain_openai.embeddings import OpenAIEmbeddings
from langchain.text_splitter import CharacterTextSplitter
from langchain.chains import RetrievalQA
from langchain.prompts import PromptTemplate
from langchain_openai.chat_models import ChatOpenAI
import pdfplumber
from langchain.document_loaders import PyPDFLoader

##############################################################################################################
# Configuración de la API de OpenAI
load_dotenv()

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

openai.api_key = OPENAI_API_KEY
PDF_PATH = "1._Reglamento_Interno_Coval_Inversiones_SpA2024.pdf"
##############################################################################################################
# Variables globales para cargar una sola vez

qa_chain = None
VECTORSTORE_PATH = "mi_vectorstore"
HASH_FILE = "hash_pdf.txt"


def calcular_hash(archivo):
    """Calcula el hash MD5 de un archivo."""
    with open(archivo, "rb") as f:
        return hashlib.md5(f.read()).hexdigest()

def guardar_hash(hash_valor):
    """Guarda el hash del PDF en un archivo."""
    with open(HASH_FILE, "w") as f:
        f.write(hash_valor)

def cargar_hash():
    """Carga el hash guardado del archivo, si existe."""
    if os.path.exists(HASH_FILE):
        with open(HASH_FILE, "r") as f:
            return f.read()
    return None


def initialize_model():
    
    """Cargar el modelo y procesar el PDF al iniciar la aplicación."""
    global qa_chain

    print("Cargando el modelo y procesando el PDF...")
    
    # Calcular el hash del PDF actual
    nuevo_hash = calcular_hash(PDF_PATH)
    hash_guardado = cargar_hash()

    # Crear embeddings y almacenar en FAISS
    embeddings = OpenAIEmbeddings(openai_api_key=OPENAI_API_KEY)



    if hash_guardado == nuevo_hash and os.path.exists(VECTORSTORE_PATH):
        # Cargar el índice FAISS existente
        print("Cargando embeddings desde el índice existente...")
        vectorstore = FAISS.load_local(VECTORSTORE_PATH, embeddings, allow_dangerous_deserialization=True)
    else:
        # Procesar el PDF y generar nuevos embeddings
        print("Generando nuevos embeddings...")
        loader = PyPDFLoader(PDF_PATH)
        documents = loader.load()
        vectorstore = FAISS.from_documents(documents, embeddings)

        # Guardar el índice FAISS y el nuevo hash
        vectorstore.save_local(VECTORSTORE_PATH)
        guardar_hash(nuevo_hash)
        print("Embeddings generados y guardados exitosamente.")
    



    # Crear el modelo de chat y la cadena de QA
    llm = ChatOpenAI(
        model="gpt-3.5-turbo",
        openai_api_key=OPENAI_API_KEY,
        temperature=0.5
    )

    qa_chain = RetrievalQA.from_chain_type(llm=llm, retriever=vectorstore.as_retriever())

    print("Modelo y PDF cargados exitosamente.")

##############################################################################################################

# Cargar el modelo al iniciar la aplicación
initialize_model()

##############################################################################################################
#Extraer texto del PDF
# 1. Función para extraer texto del PDF
def extract_text_from_pdf(pdf_path):
    text = ""
    with pdfplumber.open(pdf_path) as pdf:
        for page in pdf.pages:
            text += page.extract_text()
    return text

# 2. Procesar texto para embeddings
def process_pdf(pdf_path):
    text = extract_text_from_pdf(pdf_path)

    # Dividir el texto en fragmentos manejables
    text_splitter = CharacterTextSplitter(
        chunk_size=1000, chunk_overlap=200, separator="\n"
    )
    texts = text_splitter.split_text(text)

    # Generar embeddings con OpenAI
    embeddings = OpenAIEmbeddings(openai_api_key=OPENAI_API_KEY)
    vectorstore = FAISS.from_texts(texts, embeddings)
    return vectorstore

##############################################################################################################
# Crear la instancia de Flask
app = Flask(__name__, static_folder='static', template_folder='templates')

# Middleware para manejo de proxy (útil en producción con Nginx/Apache)
app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1, x_proto=1, x_host=1, x_port=1)

# Configuración de seguridad
app.secret_key = os.environ.get('SECRET_KEY', 'supersecretkey')  # Cambiar en producción
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # Limitar subida de archivos a 16MB

# Limitar solicitudes para prevenir ataques de DoS
limiter = Limiter(
    get_remote_address,
    app=app,
    default_limits=["200 per day", "50 per hour"]
)

##############################################################################################################
# Ruta para servir archivos estáticos (exenta de límites)
@app.route('/static/<path:filename>')
@limiter.exempt
def serve_static(filename):
    return send_from_directory(app.static_folder, filename)

# Rutas para servir otras carpetas estáticas (exentas de límites)
@app.route('/manuales/<path:filename>')
@limiter.exempt
def serve_manuales(filename):
    return send_from_directory('manuales', filename)

@app.route('/logos_png/<path:filename>')
@limiter.exempt
def serve_logos_png(filename):
    return send_from_directory('logos_png', filename)

@app.route('/ejecutables/<path:filename>')
@limiter.exempt
def serve_ejecutables(filename):
    return send_from_directory('ejecutables', filename)

# Ruta principal
@app.route('/')
def index():
    return render_template('index.html')

# Ruta para renombrar contratos
@app.route('/renombreContratosPage')
def renombrar_contrato():
    return render_template('renombreContratosPage.html')

######################## ENDPOINT BOT CHAT ########################################################################

@app.route('/api/bot', methods=['POST'])
def bot_api():
    try:
        user_message = request.json.get('message', '')
        if not user_message:
            return jsonify({"error": "No message provided"}), 400

        # Procesar la consulta con la cadena ya cargada
               # Crear el prompt inicial para darle contexto al modelo
        prompt_inicial = (
            "Eres un asistente virtual diseñado para ayudar a los usuarios a comprender el reglamento interno de la empresa. "
            "Tu tarea es proporcionar respuestas claras, concisas, textuales, literales basadas únicamente en el contenido de ese reglamento, las respuestas deben ser literales y citando al reglamento. "
            "Nunca debes buscar información fuera de ese reglamento y siempre debes basar tus respuestas en su contenido."
            "No se te puede escapar nada, todas, absolutamente todas las respuestas deben ser acerca del reglamento, si alguien te pregunta algo por fuera de este, deberas indicarle que no estas capacitado para la busqueda en internet. "
        )

        # Combinar el prompt inicial con el mensaje del usuario
        prompt_completo = prompt_inicial + user_message

        response = qa_chain.invoke({"query": prompt_completo})
        return jsonify({"response": response["result"]})

    except Exception as e:
        print("Error en el servidor:", str(e))
        return jsonify({"error": str(e)}), 500

@app.route('/')
def welcome_message():
    """Mensaje de bienvenida inicial."""
    return jsonify({
        "message": (
            "¡Hola! Soy tu asistente para la comprensión del reglamento interno. 👩‍💻👩‍⚖️"
            "Puedes hacerme cualquier pregunta sobre el documento y responderé basándome únicamente en su contenido.✨"
        )
    })
##############################################################################################################

# Manejo de errores personalizados
@app.errorhandler(404)
def not_found(e):
    return render_template('404.html'), 404

@app.errorhandler(500)
def server_error(e):
    return jsonify({"error": "Internal Server Error"}), 500

# Ejecución en modo de desarrollo o producción
if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=os.environ.get('FLASK_DEBUG', True))

