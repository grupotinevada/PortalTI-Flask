from flask import Flask, render_template, send_from_directory, request, jsonify, send_file, redirect, url_for, flash, make_response
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from werkzeug.middleware.proxy_fix import ProxyFix
from dotenv import load_dotenv
from flask import after_this_request
import platform
import shutil
import subprocess

#IHATE PDF

import datetime
import subprocess
import sys
from werkzeug.utils import secure_filename
import fitz
import uuid

import markdown
import json
import time
import os
import openai
import hashlib
import re  # Agregar esta línea si no está ya importado

from langchain.schema import Document  # Importar la clase Document
from langchain_community.vectorstores import FAISS
from langchain_openai.embeddings import OpenAIEmbeddings
from langchain.text_splitter import CharacterTextSplitter, RecursiveCharacterTextSplitter
from langchain.chains import RetrievalQA
from langchain.prompts import PromptTemplate
from langchain_openai.chat_models import ChatOpenAI
import pdfplumber
from langchain_community.document_loaders import PyPDFLoader

##############################################################################################################
# Configuración de la API de OpenAI
load_dotenv()

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

# Variables globales para cargar una sola vez
openai.api_key = OPENAI_API_KEY
PDF_PATH = "1._Reglamento_Interno_Coval_Inversiones_SpA2024.pdf"
qa_chain = None
VECTORSTORE_PATH = "mi_vectorstore"
HASH_FILE = "hash_pdf.txt"

#################################################################################################################
# Funciones auxiliares
#################################################################################################################

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


def extraer_texto_pdf(pdf_path):
    """Extrae todo el texto del PDF."""
    text = ""
    with pdfplumber.open(pdf_path) as pdf:
        for page in pdf.pages:
            page_text = page.extract_text()
            if page_text:
                text += page_text + "\n"
    return text
#################################################################################################################
# REGISTRO PREGUNTAS
#################################################################################################################
import csv
from datetime import datetime

CSV_FILE = "USUARIO_DATA.csv"

def registrar_interaccion_csv(pregunta, respuesta):
    """Registra la pregunta, respuesta y fecha en un archivo CSV."""
    fecha_actual = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    encabezados = ["PREGUNTA", "RESPUESTA", "FECHA"]
    datos = {"PREGUNTA": pregunta, "RESPUESTA": respuesta, "FECHA": fecha_actual}

    # Verificar si el archivo ya existe
    existe_archivo = os.path.exists(CSV_FILE)

    with open(CSV_FILE, mode="a", newline="", encoding="utf-8") as archivo_csv:
        escritor = csv.DictWriter(archivo_csv, fieldnames=encabezados, delimiter="|")

        # Si el archivo no existía, escribir los encabezados primero
        if not existe_archivo:
            escritor.writeheader()

        # Escribir los datos
        escritor.writerow(datos)



#################################################################################################################
# Inicialización del sistema
#################################################################################################################

def initialize_model():
    """Inicializa el modelo, procesa el PDF y genera embeddings."""
    global qa_chain

    print("Cargando el modelo y procesando el PDF...")

    # Calcular hash del archivo PDF
    nuevo_hash = calcular_hash(PDF_PATH)
    hash_guardado = cargar_hash()

    embeddings = OpenAIEmbeddings(openai_api_key=OPENAI_API_KEY)
    vectorstore = None

    try:
        # Verificar si el índice FAISS ya existe y no se ha modificado el PDF
        if hash_guardado == nuevo_hash and os.path.exists(VECTORSTORE_PATH):
            print("Cargando embeddings desde el índice existente...")
            vectorstore = FAISS.load_local(VECTORSTORE_PATH, embeddings, allow_dangerous_deserialization=True)
        else:
            print("Generando nuevos embeddings...")
            texto_completo = extraer_texto_pdf(PDF_PATH)

            # Dividir el texto en fragmentos
            text_splitter = CharacterTextSplitter(chunk_size=1000, chunk_overlap=250, separator="\n")
            fragmentos = text_splitter.split_text(texto_completo)

            # Crear documentos y generar embeddings
            documentos = [Document(page_content=fragmento) for fragmento in fragmentos]
            vectorstore = FAISS.from_documents(documentos, embeddings)
            vectorstore.save_local(VECTORSTORE_PATH)
            guardar_hash(nuevo_hash)
            print("Embeddings generados y guardados exitosamente.")
    except Exception as e:
        print(f"Error al cargar o generar el índice FAISS: {e}")
        raise

    if vectorstore is None:
        raise ValueError("No se pudo inicializar el vectorstore.")

    retriever = vectorstore.as_retriever(search_kwargs={"k": 20})  # Reducir a 5 resultados relevantes

    llm = ChatOpenAI(
        model="gpt-4o-mini-2024-07-18",
        openai_api_key=OPENAI_API_KEY,
        temperature=0.5
    )
    qa_chain = RetrievalQA.from_chain_type(llm=llm, retriever=retriever)
    print("Modelo y PDF cargados exitosamente.")


##############################################################################################################

# Cargar el modelo al iniciar la aplicación
# initialize_model()

##############################################################################################################
# Función Keep-Alive
import requests
def keep_alive():
    while True:
        try:
            # Realiza un ping a la propia aplicación cada 5 minutos
            print("Enviando ping para mantener la aplicación activa...")
            requests.get("https://portalti.inevada.cl/")  # Cambia el puerto si es diferente
        except Exception as e:
            print(f"Error en Keep-Alive: {e}")
        time.sleep(300)  # Intervalo de 5 minutos
##############################################################################################################

##############################################################################################################
# Crear la instancia de Flask
app = Flask(__name__, static_folder='static', template_folder='templates')

# Middleware para manejo de proxy (útil en producción con Nginx/Apache)
app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1, x_proto=1, x_host=1, x_port=1)

# Configuración de seguridad
app.secret_key = os.environ.get('SECRET_KEY', os.getenv("key"))  # Cambiar en producción
app.config['MAX_CONTENT_LENGTH'] = 100 * 1024 * 1024   

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

@app.route('/reglamentos/<path:filename>')
@limiter.exempt
def serve_reglamentos(filename):
    return send_from_directory('reglamentos', filename)

@app.route('/ejecutables/<path:filename>')
@limiter.exempt
def serve_ejecutables(filename):
    return send_from_directory('ejecutables', filename)

# Ruta principal
@app.route('/')
def index():
    return render_template('index.html')

# Ruta para faq
@app.route('/faq')
def faq():
    return send_from_directory('.', 'faq.json')

# Ruta para renombrar contratos
@app.route('/renombreContratosPage')
def renombrar_contrato():
    return render_template('renombreContratosPage.html')

# Ruta para chatBot
@app.route('/chatBotPage')
def chat_bot_page():
    return render_template('chatBot.html')

######################## ENDPOINT BOT CHAT ########################################################################

def formatear_texto(texto):
    """
    Aplica formato al texto del artículo usando Markdown para mejorar la presentación.
    """
    # Títulos (como "Artículo X")
    texto = re.sub(r"(Artículo \d+[º]?:)", r"## \1", texto)
    
    # Detectar listas enumeradas (1. Algo, 2. Algo más...)
    texto = re.sub(r"(\n\d+\.\s)", r"\n- \1", texto)
    texto = re.sub(r"(\(\s*[a-zA-Z]+\s*\))", r"- \1", texto)  
    texto = re.sub(r"(\n\s*[ivxlcdm]+[)])", r"\n  - \1", texto)  # Números romanos
    texto = re.sub(r"(\(\s*[ivxlcdmIVXLCDM]+\s*\))", r"  - \1", texto)  
    # Detectar viñetas comunes (usualmente marcadas con guiones o asteriscos)
    texto = re.sub(r"(\n[-*]\s)", r"\n- ", texto)
    # Detectar y formatear subtítulos (como "a)", "b)", etc.)
    texto = re.sub(r"(\n\s*[a-z]\))", r"\n- \1", texto)

    # Detectar y formatear subtítulos con números romanos (como "i)", "ii)", etc.)
    texto = re.sub(r"(\n\s*[ivxlcdm]+\))", r"\n  - \1", texto)

    # Detectar y formatear subtítulos con letras mayúsculas (como "A)", "B)", etc.)
    texto = re.sub(r"(\n\s*[A-Z]\))", r"\n- \1", texto)

    # Detectar y formatear subtítulos con números (como "1)", "2)", etc.)
    texto = re.sub(r"(\n\s*\d+\))", r"\n- \1", texto)

    # Detectar y formatear listas con letras minúsculas seguidas de paréntesis (como "a)", "b)", etc.)
    texto = re.sub(r"([a-z]\))", r"\n- \1", texto)

    # Convertir el texto procesado a HTML o mantenerlo en Markdown
    return markdown.markdown(texto)

@app.route('/api/bot', methods=['POST'])
def bot_api():
    global last_relevant_question

    try:
        # Obtener el mensaje del usuario y el último mensaje del historial
        user_message = request.json.get('message', '').strip()
        last_message = request.json.get('last_message', '')

        if not user_message:
            return jsonify({"error": "No se proporcionó un mensaje"}), 400

        # Verificar si la cadena QA está inicializada
        if qa_chain is None:
            return jsonify({"error": "El sistema no está listo. Por favor, intenta nuevamente más tarde."}), 503

        # Cargar el FAQ JSON
        with open('faq.json', 'r', encoding='utf-8') as f:
            faq_data = json.load(f)

        # Buscar si la pregunta del usuario coincide con alguna pregunta del FAQ
        for faq in faq_data:
            if user_message.lower() == faq['question'].lower():
                respuesta = faq['answer']
                registrar_interaccion_csv(user_message, respuesta)
                time.sleep(2.0)  # Agregar un delay de 2.0 segundos antes de responder
                return jsonify({"response": formatear_texto(respuesta), "last_message": user_message})

        # Detectar si elona algo del contexto previo
        requiere_contexto = any(
            palabra in user_message.lower() for palabra in ["acerca de este tema", "esto", "anterior", "referido", "mencionado", "dicho", "a lo anterior", "a lo mencionado", "a dicho", "dicho"]
        )

        # Crear el prompt con o sin el mensaje anterior según corresponda
        if requiere_contexto and last_message:
            contexto = f"El usuario mencionó anteriormente: {last_message}\n\n"
        else:
            contexto = ""

        # Detectar si el usuario menciona un artículo
        match_articulo = re.search(r"(art[ií]culo\s*)?(\d+)(º)?", user_message, re.IGNORECASE)
        contenido_articulo = None

        if match_articulo:
            numero_articulo = match_articulo.group(2)
            texto_completo = extraer_texto_pdf(PDF_PATH)

            # Patrón para buscar el contenido del artículo
            patron_articulo = fr"(Artículo {numero_articulo}[º]?\s.*?)(?=\nArtículo \d+|$)"
            resultado = re.search(patron_articulo, texto_completo, re.DOTALL)

            if resultado:
                contenido_articulo = resultado.group(1).strip()
                contenido_articulo = formatear_texto(contenido_articulo)

        # Crear el prompt completo para el modelo
        prompt_completo = f"""
        Eres un asistente virtual especializado en responder preguntas basadas en el reglamento interno. 
        Responde de manera literal y textual basándote exclusivamente en el reglamento.
        Eres un asistente amable y profesional, solo saluda si te saludan, si no te saludan no saludarás(Son mal educados). siempre preguntarás si queda alguna duda.
        siempre recomendarás revisar el reglamento RIOHS.
        Siempre debes responder de manera clara y citando de que articulo o capitulo sacaste la informacion.
        antes de responder verificaras el articulo y basaras la informacion en base a ese articulo, por ejemplo si te preguntan "lavado de activos" Buscaras donde se mencione las caracteristicas, analizaras y responderas.
        Aveces los usuarios preguntaran cosas raras, debes responder de manera profesional y amable.
        debes interpretar las preguntas y dar una respuesta clara y precisa.
        ATENCION, Si te preguntan acerca del contrato de trabajo, responderas en base al articulo 112.
        Ten en cuenta que eres un asistente para 4 empresas que tienen el mismo reglamento interno debido a que es un holding, trata de no nombrar la empresa para mantener la coherencia entre empresas.
        {f"**Artículo {numero_articulo}**:\n{contenido_articulo}\n\n" if contenido_articulo else ""}
        {contexto}
        Consulta del usuario: {user_message}
        """

        # Ejecutar la consulta
        respuesta = qa_chain.run(prompt_completo)

        if not respuesta.strip():
            respuesta = (
                f"Lo siento, no encontré información relevante en el reglamento sobre tu consulta."
                f"{' Además, no encontré el Artículo solicitado.' if contenido_articulo is None else ''}"
            )

        # Registrar la interacción en el CSV
        registrar_interaccion_csv(user_message, respuesta)

        # Retornar respuesta y el mensaje actual como referencia para el próximo mensaje
        return jsonify({"response": respuesta, "last_message": user_message})

    except Exception as e:
        print("Error en el servidor:", str(e))
        return jsonify({"error": f"Error interno del servidor: {str(e)}"}), 500
    
    

##############################################################################################################
################################### LOGGER IHATE PDF###################################################################
import logging
from logging.handlers import RotatingFileHandler
from datetime import datetime
from flask import request


app.config['UPLOAD_FOLDER'] = 'uploads'
app.config['OUTPUT_FOLDER'] = 'outputs'

# Crear logger
log_file_path = os.path.join(app.config['OUTPUT_FOLDER'], 'ihatepdf_log.txt')
log_formatter = logging.Formatter('%(asctime)s [%(levelname)s] %(message)s')

file_handler = RotatingFileHandler(log_file_path, maxBytes=1024*1024, backupCount=5, encoding='utf-8')
file_handler.setFormatter(log_formatter)

logger = logging.getLogger('ihatepdfLogger')
logger.setLevel(logging.INFO)
logger.addHandler(file_handler)

# Función para log personalizado
def log_usage_info(files):
    ip = request.headers.get('X-Forwarded-For', request.remote_addr)
    if not ip:
        ip = request.remote_addr or 'Unknown IP'
    now = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    extensions = [os.path.splitext(f.filename)[1].lower() for f in files]
    unique_exts = list(set(extensions))
    logger.info(f'[USAGE] IP: {ip} | Fecha: {now} | Archivos: {len(files)} | Extensiones: {", ".join(unique_exts)}')

##############################################################################################################
################################## IHATEPDF ##################################################################







os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
os.makedirs(app.config['OUTPUT_FOLDER'], exist_ok=True)

def merge_pdfs(pdf_list, output_path):  
    try:
        logger.info(f"Merge iniciado con {len(pdf_list)} archivos...")
        merged = fitz.open()
        for path in pdf_list:
            with fitz.open(path) as pdf:
                merged.insert_pdf(pdf)
        merged.save(output_path)
        merged.close()
        logger.info(f"Merge completado: {output_path}")
    except Exception as e:
        logger.exception(f"Error en merge_pdfs: {e}")
        raise

def get_ghostscript_executable():
    """
    Retorna la ruta adecuada al ejecutable Ghostscript según el sistema operativo.
    Soporta ejecución empaquetada con PyInstaller (usando _MEIPASS).
    """
    if getattr(sys, 'frozen', False):  # Si es una app compilada con PyInstaller
        base_path = sys._MEIPASS
        if platform.system() == 'Windows':
            return os.path.join(base_path, 'gs', 'gswin64c.exe')
        else:
            return os.path.join(base_path, 'gs', 'gs')
    else:
        return 'gswin64c' if platform.system() == 'Windows' else 'gs'
    
def standardize_pdf(input_pdf, output_pdf):
    """
    Lee un PDF y lo vuelve a escribir usando Ghostscript.
    Esto repara/estandariza la estructura interna del archivo, haciéndolo
    más compatible con procesos posteriores como la compresión.
    """
    try:
        logger.info(f"Inicio de estandarización de PDF: {input_pdf}")
        gs_executable = get_ghostscript_executable()

        if shutil.which(gs_executable) is None:
            raise FileNotFoundError(f"Ghostscript no encontrado en PATH: {gs_executable}")

        gs_command = [
            gs_executable,
            "-o", output_pdf,
            "-sDEVICE=pdfwrite",
            "-dPDFSETTINGS=/default",
            "-dAutoRotatePages=/None",
            "-dCompatibilityLevel=1.4",
            "-dNOPAUSE",
            "-dQUIET",
            "-dBATCH",
            input_pdf
        ]
        

        result = subprocess.run(gs_command, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, encoding='utf-8')
        
        # Mostramos siempre la salida de Ghostscript para más información
        if result.stdout:
            logger.info(f"Ghostscript stdout: {result.stdout.strip()}")
            
        if result.stderr:
            # Lo mostramos como 'warning' aunque el proceso sea exitoso, ya que GS a veces emite avisos.
            logger.warning(f"Ghostscript stderr: {result.stderr.strip()}")
        

        if result.returncode != 0:
            # El error ahora será más detallado gracias al log anterior
            raise RuntimeError(f"Ghostscript (estandarización) falló con código {result.returncode}")

        logger.info(f"Estandarización completada: {output_pdf}")

    except Exception as e:
        logger.exception(f"Error al estandarizar PDF: {e}")
        raise

def compress_pdf_with_ghostscript(input_pdf, output_pdf, quality="ebook"):
    """
    Comprime un archivo PDF usando Ghostscript con la calidad especificada.
    Parámetros válidos para 'quality': screen, ebook, printer, prepress, default
    """
    try:
        logger.info(f"Inicio de compresión con Ghostscript - Calidad: {quality}")

        gs_executable = get_ghostscript_executable()
        # Verifica si Ghostscript está disponible en el PATH
        if shutil.which(gs_executable) is None:
            raise FileNotFoundError(f"Ghostscript no encontrado en PATH: {gs_executable}")

        gs_command = [
            gs_executable,
            "-sDEVICE=pdfwrite",
            "-dCompatibilityLevel=1.4",
            f"-dPDFSETTINGS=/{quality}",  # opciones: screen, ebook, printer, prepress, default
            "-dAutoRotatePages=/None",
            "-dNOPAUSE",
            "-dQUIET",
            "-dBATCH",
            f"-sOutputFile={output_pdf}",
            input_pdf
        ]

        result = subprocess.run(gs_command, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        if result.returncode != 0:
            raise RuntimeError(f"Ghostscript falló: {result.stderr.decode().strip()}")

        logger.info(f"Compresión completada: {output_pdf}")

    except Exception as e:
        logger.exception(f"Error al comprimir PDF: {e}")
        raise

# Función para eliminar el archivo después de un delay
def delayed_delete(filepath, delay=10):
    def delete_file():
        try:
            if os.path.exists(filepath):
                os.remove(filepath)
                logger.info(f"Archivo eliminado: {filepath}")
        except Exception as e:
            logger.error(f"Error al eliminar el archivo {filepath}: {e}")
    threading.Timer(delay, delete_file).start()


@app.route('/ihatepdf', methods=['GET', 'POST'])
def ihatepdf():
    if request.method == 'POST':
        if 'pdfs' not in request.files:
            flash('No files part')
            logger.warning("Solicitud de 'ihatepdf' sin archivos adjuntos.")
            return redirect(request.url)
        
        files = request.files.getlist('pdfs')
        
        if not files or any(f.filename == '' for f in files):
            flash('No selected file')
            logger.warning("Solicitud de 'ihatepdf' con archivos vacíos o sin selección.")
            return redirect(request.url)

        log_usage_info(files)
        
        quality = request.form.get('quality', 'ebook')
        token = request.form.get('download_token')

        unique_id = uuid.uuid4().hex
        first_filename = secure_filename(files[0].filename)
        base_name = os.path.splitext(first_filename)[0]
        output_filename = f"{base_name}_{unique_id}_compressed.pdf"

        # Rutas para archivos temporales que se crearán y eliminarán
        merged_pdf_path = os.path.join(app.config['OUTPUT_FOLDER'], f'merged_{unique_id}.pdf')
        standardized_pdf_path = os.path.join(app.config['OUTPUT_FOLDER'], f'standardized_{unique_id}.pdf')
        compressed_pdf_path = os.path.join(app.config['OUTPUT_FOLDER'], output_filename)

        saved_files = []
        original_size = 0
        
        try:
            # Guarda los archivos subidos en una carpeta temporal
            for file in files:
                filename = secure_filename(file.filename)
                temp_filename = f"{unique_id}_{filename}"
                filepath = os.path.join(app.config['UPLOAD_FOLDER'], temp_filename)
                file.save(filepath)
                saved_files.append(filepath)
                original_size += os.path.getsize(filepath)
            
            logger.info(f"Archivos recibidos: {len(saved_files)}. Tamaño original total: {original_size / 1024 / 1024:.2f} MB.")

            # Inicia el pipeline de procesamiento
            if len(saved_files) == 1:
                shutil.copy(saved_files[0], merged_pdf_path)
            else:
                merge_pdfs(saved_files, merged_pdf_path)
            
            standardize_pdf(merged_pdf_path, standardized_pdf_path)
            compress_pdf_with_ghostscript(standardized_pdf_path, compressed_pdf_path, quality=quality)
            
            compressed_size = os.path.getsize(compressed_pdf_path)

            # --- LOG DE ÉXITO ---
            logger.info(f"Proceso completado para {output_filename}. Original: {original_size / 1024 / 1024:.2f} MB -> Comprimido: {compressed_size / 1024 / 1024:.2f} MB.")

            # Envía el archivo al usuario y prepara las cookies de seguimiento
            response = make_response(send_file(compressed_pdf_path, as_attachment=True, download_name=output_filename))
            if token:
                response.set_cookie(f'download_complete_{token}', 'true')
                response.set_cookie(f'original_size_{token}', str(original_size))
                response.set_cookie(f'compressed_size_{token}', str(compressed_size))
            
            return response

        except Exception as e:
            # --- LOG DE ERROR ---
            logger.exception(f"Error durante el procesamiento de PDF en 'ihatepdf': {e}")
            flash("Ocurrió un error inesperado al procesar los archivos. Por favor, inténtalo de nuevo.")
            return redirect(request.url)
        
        finally:
            # --- LIMPIEZA DE ARCHIVOS TEMPORALES ---
            # Se asegura de eliminar todos los archivos generados durante el proceso, incluso si falla.
            for f in saved_files:
                if os.path.exists(f): os.remove(f)
            if os.path.exists(merged_pdf_path): os.remove(merged_pdf_path)
            if os.path.exists(standardized_pdf_path): os.remove(standardized_pdf_path)
            # El archivo final se elimina tras un breve retraso para asegurar la descarga
            if os.path.exists(compressed_pdf_path): delayed_delete(compressed_pdf_path, delay=15)

    return render_template('ihatepdf.html')

##############################################################################################################
# Manejo de errores personalizados
@app.errorhandler(404)
def not_found(e):
    return render_template('404.html'), 404

@app.errorhandler(500)
def server_error(e):
    return jsonify({"error": "Internal Server Error"}), 500

# Ejecución en modo de desarrollo o producción


import threading
# Precarga diferida del modelo después de la primera petición
modelo_cargado = False

@app.before_request
def cargar_modelo_en_segundo_plano():
    global modelo_cargado
    if not modelo_cargado:
        def background_loader():
            global modelo_cargado
            try:
                print("Inicializando modelo en segundo plano...")
                initialize_model()
                modelo_cargado = True
                print("Modelo cargado correctamente en segundo plano.")
            except Exception as e:
                print(f"Error al inicializar el modelo: {e}")
        threading.Thread(target=background_loader, daemon=True).start()


if __name__ == '__main__':
    threading.Thread(target=keep_alive, daemon=True).start()
    app.run(host='0.0.0.0', port=5000, debug=True)









