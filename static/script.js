// Estructura de manuales por categoría
/**Aqui se pueden agregar "categorias" basicamente cuadros del portal ti*/
const manuales = {
  outlook: [
    "/manuales/manualesCorreo/Autoarchivo Outlook.pdf",
    "/manuales/manualesCorreo/Configuracion correo Android.pdf",
    "/manuales/manualesCorreo/Manual de respuestas automaticas en Outlook.pdf",
  ],
  direccion_trabajo: [
    "manuales/manualDireccionTrabajo/Manual de compatibilidad.pdf",
    "manuales/manualDireccionTrabajo/PP - CANAL DE DENUNCIAS V2 (LEY KARIN).pdf",
  ],
  impresora: ["manuales/manualImpresora/Proceso de escaneo doble cara.pdf"],
  authenticator: [
    "manuales/manualAuthenticator/Manual autenticator restablecer.pdf",
  ],
  pdf: ["manuales/manualPdf/Proteccion_y_seguridad_en_PDF.pdf"],
  sap: [
    "manuales/manualesSap/Manual Carga Extractos Bancarios Banco Santander-Chile.pdf",
    "manuales/manualesSap/Manual Pago Automatico Proveedores -F110.pdf",
    "manuales/manualesSap/Registro Factura clientes a traves de Finanzas.pdf",
    "manuales/manualesSap/Registro Factura Especial IVA y CEEC Constructoras.pdf",
  ],
  exe: ["ejecutables/ClickShare_for_Windows.exe"],
};

// Diccionario de nombres y logos amigables por categoría
/**Aqui se le asigna el nombre y su foto */
const categoriasInfo = {
  outlook: { nombre: "Manuales Outlook", icono: "/logos_png/outlookLogo.webp" },
  direccion_trabajo: {
    nombre: "Manuales Dirección de Trabajo",
    icono: "/logos_png/direccionDelTrabajo.webp",
  },
  impresora: {
    nombre: "Manuales Impresoras",
    icono: "/logos_png/impresoraLogo.webp",
  },
  authenticator: {
    nombre: "Manuales Authenticator",
    icono: "/logos_png/authenticatorLogo.webp",
  },
  pdf: { nombre: "Manuales PDF", icono: "/logos_png/llave.webp" },
  sap: { nombre: "Manuales SAP", icono: "/logos_png/sapLogo.webp" },
  exe: {
    nombre: "Aplicaciones y descargables",
    icono: "/logos_png/ejecutableLogo.webp",
  },
  chatbot: { nombre: "Chatbot", icono: "/logos_png/nevaita.webp" },
  contratos: {
    nombre: "Renombre de Contratos",
    icono: "/logos_png/pdfLogo.webp",
  },
  ihatepdf: { nombre: "I hate PDF", icono: "/logos_png/ihatepdf.webp" },
};
/**
 * aqui para agregar aplicaciones o extensiones en aplicaciones al offcanvas del index.html
 */
const categoriasConLink = {
  chatbot: "/chatBotPage",
  contratos: "/renombreContratosPage",
  ihatepdf: "/ihatepdf",
};
// Función para cargar los manuales en el modal
function cargarManuales(categoria) {
  const lista = document.getElementById(
    categoria === "exe" ? "listaManualesCanvas" : "listaManualesModal"
  );
  lista.innerHTML = ""; // Limpiar lista de manuales

  // Eliminar contenedor de botones anteriores si existe
  const oldBotones = document.getElementById("botonesLinksExtra");
  if (oldBotones) oldBotones.remove();

  // Cargar archivos PDF o ejecutables
  if (manuales[categoria]) {
    manuales[categoria].forEach((archivo) => {
      const li = document.createElement("li");
      li.className = "list-group-item p-0";

      const button = document.createElement("div"); // usar div si no es un botón real
      button.className = "full-width-button";

      const link = document.createElement("a");
      link.href = archivo;
      link.textContent = `Descargar ${archivo.split("/").pop()}`;
      link.target = "_blank";
      link.rel = "noopener";

      const tooltipContainer = document.createElement("span");
      tooltipContainer.className = "tooltip-container";
      tooltipContainer.innerHTML = `
            <svg class="pdf-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                <path d="M6 2a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6H6zM13 9V3.5L18.5 9H13z"/>
            </svg>
            <span class="tooltip-text">Archivo PDF</span>
            `;

      button.appendChild(link);
      button.appendChild(tooltipContainer);
      li.appendChild(button);
      lista.appendChild(li);
    });
  }

  // Si la categoría es 'exe', agregar botones con enlaces externos
  if (categoria === "exe") {
    const gridApps = document.createElement("div");
    gridApps.className = "mt-4 d-flex flex-column gap-3";

    Object.entries(categoriasConLink).forEach(([cat, url]) => {
      const card = document.createElement("a");
      card.href = url;
      card.target = "_blank";
      card.className = "card shadow-sm text-decoration-none text-dark";
      card.style.transition = "transform 0.2s ease";
      card.onmouseover = () => {
        card.style.transform = "scale(1.01)";
        card.style.borderColor = "#0E5C94";
        card.querySelector(".card-title").style.color = "#0E5C94";
      };
      card.onmouseout = () => {
        card.style.transform = "scale(1)";
        card.style.borderColor = "";
        card.querySelector(".card-title").style.color = "";
      };
      card.innerHTML = `
        <div class="row g-0 align-items-center">
        <div class="col-auto p-3">
            <img src="${categoriasInfo[cat]?.icono || "logos_png/default.webp"}" alt="${cat}" style="width:64px;" />
        </div>
        <div class="col">
            <div class="card-body py-2">
            <h6 class="card-title mb-1">${categoriasInfo[cat]?.nombre || cat}</h6>
            <p class="card-text small text-muted mb-0">Haz clic para abrir la aplicación.</p>
            </div>
        </div>
        </div>
        `;
      gridApps.appendChild(card);
    });

    lista.parentElement.appendChild(gridApps);
  }

  // Cierra el otro componente si está abierto
  if (categoria === "exe") {
    const modal = bootstrap.Modal.getInstance(
      document.getElementById("manualModal")
    );
    if (modal) modal.hide();
  } else {
    const offcanvas = bootstrap.Offcanvas.getInstance(
      document.getElementById("manualOffcanvas")
    );
    if (offcanvas) offcanvas.hide();
  }
}

// Crear dinámicamente las tarjetas de categoría
function crearCategorias() {
  const contenedor = document.getElementById("contenedorCategorias");
  contenedor.innerHTML = "";
  contenedor.className = "container-fluid";

  const fila = document.createElement("div");
  fila.className = "row justify-content-center";

  // Solo las categorías del objeto "manuales", no las de link
  const categorias = Object.keys(manuales);

  categorias.forEach((categoria) => {
    const info = categoriasInfo[categoria] || {
      nombre: categoria,
      icono: "logos_png/default.webp",
    };

    const col = document.createElement("div");
    col.className = "col-md-4 mb-3";

    const elemento = document.createElement("button");
    elemento.className =
      "btn btn-light w-100 h-100 p-3 d-flex flex-column align-items-center justify-content-center";
    elemento.onclick = () => cargarManuales(categoria);

    if (categoria === "exe") {
      elemento.setAttribute("data-bs-toggle", "offcanvas");
      elemento.setAttribute("data-bs-target", "#manualOffcanvas");
    } else {
      elemento.setAttribute("data-bs-toggle", "modal");
      elemento.setAttribute("data-bs-target", "#manualModal");
    }

    const img = document.createElement("img");
    img.src = info.icono;
    img.alt = info.nombre;
    img.className = "mb-2 categoryImg";
    elemento.appendChild(img);

    const titulo = document.createElement("h5");
    titulo.className = "text-center";
    titulo.textContent = `${info.nombre}`;
    elemento.appendChild(titulo);

    col.appendChild(elemento);
    fila.appendChild(col);
  });

  contenedor.appendChild(fila);
}

// Ejecutar cuando el DOM esté listo
document.addEventListener("DOMContentLoaded", crearCategorias);
