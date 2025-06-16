const pdfInput = document.getElementById("pdfs");
const fileSizeInfo = document.getElementById("fileSizeInfo");
const form = document.getElementById("pdfForm");
const loadingOverlay = document.getElementById("loadingOverlay");

// Función para calcular y mostrar peso total seleccionado
pdfInput.addEventListener("change", () => {
  const files = pdfInput.files;
  if (files.length === 0) {
    fileSizeInfo.textContent = "";
    return;
  }
  let totalBytes = 0;
  for (const file of files) {
    totalBytes += file.size;
  }
  const mb = (totalBytes / 1024 / 1024).toFixed(2);
  fileSizeInfo.textContent = `Peso total seleccionado: ${mb} MB`;
});

// Función para ocultar el spinner y mostrar resultados
function hideSpinner(originalSize = null, compressedSize = null) {
  loadingOverlay.classList.remove("show");

  // Si se proporcionaron los tamaños, mostrar los resultados
  if (originalSize && compressedSize) {
    displayResults(originalSize, compressedSize);
  }
}

// Función para mostrar los resultados de compresión
function displayResults(originalSize, compressedSize) {
  const originalMB = (originalSize / 1024 / 1024).toFixed(2);
  const compressedMB = (compressedSize / 1024 / 1024).toFixed(2);
  const variation = (
    ((compressedSize - originalSize) / originalSize) *
    -100
  ).toFixed(2);

  document.getElementById("originalSize").textContent = originalMB;
  document.getElementById("compressedSize").textContent = compressedMB;
  document.getElementById("variation").textContent = variation;

  // Mostrar el div de resultados
  document.getElementById("resultInfo").style.display = "block";
}

// Función para obtener el valor de una cookie
function getCookie(name) {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop().split(";").shift();
}

function deleteAllCookies() {
  const cookies = document.cookie.split(";");

  for (let i = 0; i < cookies.length; i++) {
    const cookieName = cookies[i].split("=")[0].trim();
    document.cookie =
      cookieName + "=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
  }
}
// Detectar cuando comienza la descarga
function detectDownload() {
  // Crear un token único
  const downloadToken = "download_" + Date.now();

  // Eliminar cualquier input previo con ese name
  const existingTokenInput = form.querySelector('input[name="download_token"]');
  if (existingTokenInput) {
    existingTokenInput.remove();
  }

  // Agregar nuevo token oculto al formulario
  const tokenInput = document.createElement("input");
  tokenInput.type = "hidden";
  tokenInput.name = "download_token";
  tokenInput.value = downloadToken;
  form.appendChild(tokenInput);

  // Mostrar overlay inmediatamente
  loadingOverlay.classList.add("show");

  // A los 30 segundos, cambia el mensaje
  const midwayTimeoutId = setTimeout(() => {
    const msg = document.getElementById("workingMessage");
    if (msg) {
      msg.textContent =
        "Todavía estamos trabajando, por favor espera unos segundos más...";
    }
  }, 3000);

  // A los 60 segundos, oculta el spinner
  const fallbackTimeoutId = setTimeout(() => {
    clearInterval(checkDownload);
    if (msg) {
      msg.textContent =
        "Esto está tomando más tiempo de lo normal. Intenta nuevamente más tarde o revisa tu conexión.";
    }
    hideSpinner();
  }, 120000);

  // Intervalo para detectar la cookie
  const checkDownload = setInterval(() => {
    if (document.cookie.includes("download_complete_" + downloadToken)) {
      clearInterval(checkDownload);
      clearTimeout(midwayTimeoutId);
      clearTimeout(fallbackTimeoutId);

      const originalSize = getCookie("original_size_" + downloadToken);
      const compressedSize = getCookie("compressed_size_" + downloadToken);

      hideSpinner(originalSize, compressedSize);
      deleteAllCookies();
    }
  }, 1000);
}

// Mostrar overlay "Trabajando"
form.addEventListener("submit", (e) => {
  // Validar que se hayan seleccionado archivos
  if (pdfInput.files.length === 0) {
    e.preventDefault();
    alert("Por favor selecciona al menos un archivo PDF");
    return;
  }

  // Mostrar el spinner usando la clase CSS
  loadingOverlay.classList.add("show");

  // Iniciar detección de descarga
  detectDownload();
});
