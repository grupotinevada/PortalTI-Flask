const pdfInput = document.getElementById("pdfs");
const fileSizeInfo = document.getElementById("fileSizeInfo");
const form = document.getElementById("pdfForm");
const loadingOverlay = document.getElementById("loadingOverlay");
const previewContainer = document.getElementById("previewContainer");
const addMoreBtn = document.getElementById("addMoreBtn");
const uploadArea = document.querySelector(".upload-area");

let selectedFiles = [];

// 📌 Renderizar archivos seleccionados
function renderSelectedFiles() {
  if (selectedFiles.length === 0) {
    fileSizeInfo.textContent = "";
    previewContainer.classList.add("d-none");
    previewContainer.innerHTML = "";
    uploadArea.classList.remove("d-none");
    return;
  }

  uploadArea.classList.add("d-none");
  previewContainer.classList.remove("d-none");
  previewContainer.innerHTML = "";

  let totalBytes = 0;

  selectedFiles.forEach((file, index) => { // Usar index en lugar de positionCounter
    totalBytes += file.size;

    const reader = new FileReader();
    reader.onload = function (e) {
      const typedarray = new Uint8Array(e.target.result);

      pdfjsLib.getDocument(typedarray).promise.then((pdf) => {
        pdf.getPage(1).then((page) => {
          const scale = 0.6;
          const viewport = page.getViewport({ scale });

          const canvas = document.createElement("canvas");
          const context = canvas.getContext("2d");
          canvas.height = viewport.height;
          canvas.width = viewport.width;

          page.render({ canvasContext: context, viewport }).promise.then(() => {
            const imgData = canvas.toDataURL();
            const col = document.createElement("div");
            col.className = "col-6 col-md-4 col-lg-3";

            col.innerHTML = `
              <div class="card h-100 shadow-sm border-0 position-relative">
                <button type="button" class="btn btn-sm btn-light position-absolute top-0 end-0 m-1 rounded-circle delete-btn" aria-label="Eliminar" title="Eliminar">
                  <i class="bi bi-x-lg text-danger"></i>
                </button>
                <img src="${imgData}" class="card-img-top pdf-thumbnail" alt="PDF preview" style="border-bottom: 1px solid #eee;">
                <div class="card-body p-2">
                  <div class="text-center">
                    <p class="card-title small text-truncate mb-1" title="${file.name}">
                      <strong>#${index + 1}</strong> ${file.name}
                    </p>
                  </div>
                </div>
              </div>
            `;

            previewContainer.appendChild(col);

            // Eliminar
            col.querySelector(".delete-btn").addEventListener("click", () => {
              selectedFiles.splice(index, 1);
              renderSelectedFiles();
            });
          });
        });
      });
    };

    reader.readAsArrayBuffer(file);
  });

  // Card para "Agregar más"
  const addCol = document.createElement("div");
  addCol.className = "col-6 col-md-4 col-lg-3";

  addCol.innerHTML = `
    <div class="card h-100 shadow-sm border border-dashed text-center d-flex align-items-center justify-content-center cursor-pointer" style="min-height: 200px;" id="addMoreCard">
      <div>
        <i class="bi bi-plus-circle fs-1 text-primary"></i>
        <p class="mt-2 mb-0 small fw-bold">Agregar más PDF</p>
      </div>
    </div>
  `;

  addCol.addEventListener("click", () => pdfInput.click());
  previewContainer.appendChild(addCol);

  const mb = (totalBytes / 1024 / 1024).toFixed(2);
  fileSizeInfo.textContent = `Peso total seleccionado: ${mb} MB`;
}

// 📌 Al seleccionar nuevos archivos
pdfInput.addEventListener("change", () => {
  const newFiles = Array.from(pdfInput.files);
  newFiles.forEach((file) => {
    if (
      !selectedFiles.some((f) => f.name === file.name && f.size === file.size)
    ) {
      selectedFiles.push(file);
    }
  });

  pdfInput.value = ""; // Permite volver a seleccionar los mismos archivos
  renderSelectedFiles();
});

// 📌 Mostrar resultados
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
  document.getElementById("resultInfo").style.display = "block";
}

// 📌 Cookies
function getCookie(name) {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop().split(";").shift();
}

function deleteAllCookies() {
  const cookies = document.cookie.split(";");
  for (let i = 0; i < cookies.length; i++) {
    const cookieName = cookies[i].split("=")[0].trim();
    document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
  }
}

// 📌 Spinner
function hideSpinner(originalSize, compressedSize) {
  loadingOverlay.classList.remove("show");
  if (originalSize && compressedSize) {
    displayResults(originalSize, compressedSize);
  }
}

// 📌 Detección de descarga
function detectDownload(downloadToken) {
  const midwayTimeoutId = setTimeout(() => {
    const msg = document.getElementById("workingMessage");
    if (msg) {
      msg.textContent =
        "Todavía estamos trabajando, por favor espera unos segundos más...";
    }
  }, 3000);

  const fallbackTimeoutId = setTimeout(() => {
    clearInterval(checkDownload);
    const msg = document.getElementById("workingMessage");
    if (msg) {
      msg.textContent =
        "Esto está tomando más tiempo de lo normal. Intenta nuevamente más tarde o revisa tu conexión.";
    }
    hideSpinner();
  }, 120000);

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

// 📌 Submit del formulario usando fetch
form.addEventListener("submit", (e) => {
  e.preventDefault();

  if (selectedFiles.length === 0) {
    alert("Por favor selecciona al menos un archivo PDF");
    return;
  }

  const downloadToken = "download_" + Date.now();
  loadingOverlay.classList.add("show");
  detectDownload(downloadToken);

  const formData = new FormData();
  selectedFiles.forEach((file) => formData.append("pdfs", file));

  const quality =
    form.querySelector('input[name="quality"]:checked')?.value || "ebook";
  formData.append("quality", quality);
  formData.append("download_token", downloadToken);

  fetch(form.action, {
    method: "POST",
    body: formData,
  })
    .then((res) => {
      if (!res.ok) throw new Error("Error al procesar archivos");
      return res.blob();
    })
    .then((blob) => {
      const a = document.createElement("a");
      a.href = window.URL.createObjectURL(blob);
      a.download = "compressed.pdf";
      a.click();
    })
    .catch((err) => {
      alert("Hubo un error: " + err.message);
      hideSpinner();
    });
});

const sortable = new Sortable(previewContainer, {
  animation: 150,
  handle: ".card",
  ghostClass: 'blue-background-class',
  onEnd: function () {
    const newOrder = Array.from(previewContainer.children)
      .filter((child) => child.querySelector(".card-title")) // excluye "agregar más"
      .map((child) => {
        const title = child.querySelector(".card-title").getAttribute("title");
        return selectedFiles.find((f) => f.name === title);
      });

    selectedFiles.length = 0;
    selectedFiles.push(...newOrder);

    updateCardIndices(); // ✅ solo actualiza los # sin destruir el orden visual
  },
});

function updateCardIndices() {
  const cards = previewContainer.querySelectorAll(".card-title");
  cards.forEach((titleElem, index) => {
    const fullName = titleElem.getAttribute("title");
    titleElem.innerHTML = `<strong>#${index + 1}</strong> ${fullName}`;
  });
}
