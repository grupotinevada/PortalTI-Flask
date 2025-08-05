// IIFE (Immediately Invoked Function Expression) para encapsular el código.
(() => {
    'use strict';

    /**
     * @class PdfManager
     * Gestiona la lógica para cargar, previsualizar, ordenar, rotar y procesar archivos PDF.
     */
    class PdfManager {
        /**
         * @param {HTMLElement} formElement - El elemento del formulario principal que contiene la aplicación.
         */
        constructor(formElement) {
            if (!formElement) {
                throw new Error("El elemento del formulario es requerido para inicializar la aplicación.");
            }

            // =================================================================
            // 1. CONFIGURACIÓN Y ESTADO
            // =================================================================

            this.config = {
                MAX_FILE_SIZE_MB: 100,
                THUMBNAIL_SCALE: 0.6,
                ALERT_DURATION_MS: 5000,
                RESULT_FADEOUT_MS: 10000,
                DOWNLOAD_CHECK_INTERVAL_MS: 1000,
                DOWNLOAD_MIDWAY_TIMEOUT_MS: 15000,
                DOWNLOAD_FALLBACK_TIMEOUT_MS: 120000,
                selectors: {
                    pdfInput: "#pdfs",
                    fileSizeInfo: "#fileSizeInfo",
                    loadingOverlay: "#loadingOverlay",
                    previewContainer: "#previewContainer",
                    uploadArea: ".upload-area",
                    resultInfo: "#resultInfo",
                    alertContainer: "#alertContainer",
                    workingMessage: "#workingMessage",
                    addMoreCard: "#addMoreCard",
                    pdfCardWrapper: ".pdf-card-wrapper",
                    card: ".card",
                    deleteBtn: ".delete-btn",
                    rotateBtn: ".rotate-btn"
                },
                cookiePrefix: {
                    downloadComplete: 'download_complete_',
                    originalSize: 'original_size_',
                    compressedSize: 'compressed_size_'
                },
                cssClasses: {
                    hidden: 'd-none',
                    visible: 'show'
                }
            };

            this.dom = {
                form: formElement,
                pdfInput: formElement.querySelector(this.config.selectors.pdfInput),
                fileSizeInfo: document.getElementById("fileSizeInfo"), // Asumiendo que estos pueden estar fuera del form
                loadingOverlay: document.getElementById("loadingOverlay"),
                previewContainer: document.getElementById("previewContainer"),
                uploadArea: document.querySelector(this.config.selectors.uploadArea),
                resultInfo: document.getElementById("resultInfo"),
                alertContainer: document.getElementById("alertContainer")
            };

            this.state = {
                files: [],
                sortableInstance: null,
                resultTimeout: null,
                isSubmitting: false,
                isTransitioning : false 
            };

            // Asegurar que las dependencias externas existen
            if (typeof Sortable === 'undefined' || typeof pdfjsLib === 'undefined' || typeof PDFLib === 'undefined' || typeof bootstrap === 'undefined') {
                console.error("Una o más dependencias (Sortable, pdf.js, PDF-Lib, Bootstrap) no se han cargado.");
            }
        }

        // =================================================================
        // 2. MÉTODOS PÚBLICOS (API de la clase)
        // =================================================================

        /**
         * Inicializa la aplicación, configura los listeners de eventos y renderiza el estado inicial.
         */
        init() {
            this._setupEventListeners();
            this._initSortable();
            this.render();
        }

        /**
         * Renderiza la vista completa basada en el estado actual.
         */
        render() {
            this._updateView();
            this.dom.previewContainer.innerHTML = "";

            if (this.state.files.length > 0) {
                this._renderFileCards();
                this._updateTotalSizeInfo();
            }
        }

        /**
         * Agrega archivos al estado, evitando duplicados.
         * @param {FileList} fileList - La lista de archivos del input o drag & drop.
         */
        addFiles(fileList) {
            const newFiles = Array.from(fileList).filter(file =>
                !this.state.files.some(f => f.name === file.name && f.size === file.size)
            );

            newFiles.forEach(file => {
                this.state.files.push({
                    uniqueId: crypto.randomUUID(),
                    sourceFile: file,
                    rotation: 0,
                    name: file.name,
                    size: file.size
                });
            });

            this.dom.pdfInput.value = ""; // Limpiar el input para permitir volver a seleccionar el mismo archivo
            this.render();
        }

        /**
         * Elimina un archivo del estado usando su ID único.
         * @param {string} fileId - El ID único del archivo a eliminar.
         */
        deleteFile(fileId) {
            this.state.files = this.state.files.filter(f => f.uniqueId !== fileId);
            this.render();
        }

        /**
         * Rota un archivo 90 grados en sentido horario.
         * @param {string} fileId - El ID único del archivo a rotar.
         */
        rotateFile(fileId) {

          if (this.state.isTransitioning) return;
            const fileData = this.state.files.find(f => f.uniqueId === fileId);
            if (fileData) {
                fileData.rotation = (fileData.rotation + 90) % 360;
                // En lugar de un re-renderizado completo, solo actualizamos el thumbnail afectado
                const cardElement = this.dom.previewContainer.querySelector(`.card[data-file-id="${fileId}"]`);
                if(cardElement) {
                    const placeholder = cardElement.querySelector('.card-img-top-placeholder');
                    placeholder.style.transform = `rotate(${fileData.rotation}deg)`;
                }
            }
        }

        // =================================================================
        // 3. MÉTODOS "PRIVADOS" (Lógica interna y helpers)
        // =================================================================

        /**
         * Configura todos los manejadores de eventos para la aplicación.
         */
        _setupEventListeners() {
            this.dom.pdfInput.addEventListener("change", (e) => this.addFiles(e.target.files));
            this.dom.previewContainer.addEventListener("click", this._handlePreviewContainerClick.bind(this));
            this.dom.form.addEventListener("submit", this._handleFormSubmit.bind(this));
        }
        
        /**
         * Inicializa la librería SortableJS en el contenedor de previsualización.
         */
        _initSortable() {
            this.state.sortableInstance = new Sortable(this.dom.previewContainer, {
                animation: 150,
                handle: this.config.selectors.card,
                filter: '.add-more-card-wrapper',
                onEnd: () => {
                  const cardElements = [...this.dom.previewContainer.querySelectorAll(`${this.config.selectors.pdfCardWrapper} ${this.config.selectors.card}`)];
                  const newIdOrder = cardElements.map(card => card.dataset.fileId);

                  // Crea nuevo estado basado en el nuevo orden visual
                  const newFilesState = newIdOrder.map(id => {
                      const file = this.state.files.find(f => f.uniqueId === id);
                      return file ? { ...file } : null;
                  }).filter(Boolean);

                  if (newFilesState.length === this.state.files.length) {
                      this.state.files = newFilesState;
                      this.render(); // Re-renderizar para que el orden se refleje bien
                      this.state.isTransitioning = true;
                      setTimeout(() => {
                          this.state.isTransitioning = false;
                      }, 500); // 0.5 segundos de buffer

                  }
              }

            });
        }

        /**
         * Alterna la visibilidad entre el área de carga y el área de previsualización.
         */
        _updateView() {
            const hasFiles = this.state.files.length > 0;
            this.dom.uploadArea.classList.toggle(this.config.cssClasses.hidden, hasFiles);
            this.dom.previewContainer.classList.toggle(this.config.cssClasses.hidden, !hasFiles);
        }

        /**
         * Calcula y muestra el peso total de los archivos seleccionados.
         */
        _updateTotalSizeInfo() {
            const totalBytes = this.state.files.reduce((acc, file) => acc + file.size, 0);
            const totalMB = (totalBytes / 1024 / 1024);
            this.dom.fileSizeInfo.textContent = `Peso total: ${totalMB.toFixed(2)} MB`;
            
            // Actualizar el texto en la tarjeta "Agregar más" si existe
            const addMoreSizeInfo = this.dom.previewContainer.querySelector('.add-more-size-info');
            if (addMoreSizeInfo) {
                addMoreSizeInfo.textContent = `${totalMB.toFixed(2)} MB / ${this.config.MAX_FILE_SIZE_MB} MB`;
            }
        }
        
        /**
         * Renderiza las tarjetas de los archivos y la tarjeta de "Agregar más".
         */
        _renderFileCards() {
            const totalMB = this.state.files.reduce((acc, file) => acc + file.size, 0) / 1024 / 1024;
            
            if (totalMB < this.config.MAX_FILE_SIZE_MB) {
                this.dom.previewContainer.insertAdjacentHTML('beforeend', this._createAddMoreCardHTML());
            }

            this.state.files.forEach((fileData, index) => {
                const cardHTML = this._createPdfCardHTML(fileData, index);
                this.dom.previewContainer.insertAdjacentHTML('beforeend', cardHTML);
                this._loadPdfThumbnail(fileData.uniqueId);
            });
        }

        /**
         * Maneja los clics dentro del contenedor de previsualización (delegación de eventos).
         * @param {Event} event - El objeto del evento de clic.
         */
        _handlePreviewContainerClick(event) {
            const target = event.target;
            const closestCard = target.closest(this.config.selectors.card);

            if (target.closest(this.config.selectors.addMoreCard)) {
                this.dom.pdfInput.click();
                return;
            }
            
            if (!closestCard) return;
            const fileId = closestCard.dataset.fileId;
            if (!fileId) return;

            if (target.closest(this.config.selectors.deleteBtn)) {
                this.deleteFile(fileId);
            } else if (target.closest(this.config.selectors.rotateBtn)) {
                this.rotateFile(fileId);
            }
        }

        /**
         * Maneja el envío del formulario.
         * @param {Event} event - El objeto del evento de envío.
         */
        async _handleFormSubmit(event) {
            event.preventDefault();
            if (this.state.files.length === 0) {
                return this._showBootstrapAlert("Por favor, selecciona al menos un archivo PDF.", "danger");
            }
            if (this.state.isSubmitting) return;

            this._showSpinner();
            
            this.state.isSubmitting = true;

            const downloadToken = `token_${Date.now()}`;

            try {
                const formData = await this._buildFormData(downloadToken);
                this._startDownloadDetection(downloadToken);

                const response = await fetch(this.dom.form.action, { method: "POST", body: formData });
                if (!response.ok) {
                    throw new Error(`Error del servidor: ${response.status} ${response.statusText}`);
                }

                const blob = await response.blob();
                this._triggerFileDownload(blob, "compressed.pdf");
            } catch (error) {
                console.error("Error en la subida:", error);
                this._showBootstrapAlert(`Hubo un error al procesar los archivos: ${error.message}`, "danger");
                this._hideSpinner(); // Asegurarse de ocultar el spinner en caso de error
            } finally {
                    setTimeout(() => {
                        this.state.isSubmitting = false;
                    }, 500);
                }

        }
        
        /**
         * Construye el objeto FormData con los archivos (rotados si es necesario).
         * @param {string} downloadToken - El token para asociar con la descarga.
         * @returns {Promise<FormData>} El objeto FormData listo para ser enviado.
         */
        async _buildFormData(downloadToken) {
            const formData = new FormData();
            const quality = this.dom.form.querySelector('input[name="quality"]:checked')?.value || "ebook";
            formData.append("quality", quality);
            formData.append("download_token", downloadToken);

            for (const fileData of this.state.files) {
                const fileToUpload = await this._rotatePdfBinary(fileData.sourceFile, fileData.rotation);
                formData.append("pdfs", fileToUpload, fileData.name);
            }
            return formData;
        }
        
        /**
         * Inicia el mecanismo de detección de descarga basado en cookies.
         * @param {string} downloadToken - El token de descarga a monitorear.
         */
        _startDownloadDetection(downloadToken) {
            const midwayTimeoutId = setTimeout(() => {
                const msg = document.querySelector(this.config.selectors.workingMessage);
                if (msg) msg.textContent = "La compresión está casi lista, por favor espera un poco más...";
            }, this.config.DOWNLOAD_MIDWAY_TIMEOUT_MS);

            const checkIntervalId = setInterval(() => {
                if (this._getCookie(`${this.config.cookiePrefix.downloadComplete}${downloadToken}`)) {
                    cleanup();
                    
                    const originalSize = this._getCookie(`${this.config.cookiePrefix.originalSize}${downloadToken}`);
                    const compressedSize = this._getCookie(`${this.config.cookiePrefix.compressedSize}${downloadToken}`);

                    this._hideSpinner();
                    this._displayResults(originalSize, compressedSize);
                    this._deleteAllCookies();
                }
            }, this.config.DOWNLOAD_CHECK_INTERVAL_MS);
            
            const fallbackTimeoutId = setTimeout(() => {
                cleanup();
                this._hideSpinner();
                this._showBootstrapAlert("La operación está tardando más de lo esperado. Inténtalo de nuevo.", "danger");
            }, this.config.DOWNLOAD_FALLBACK_TIMEOUT_MS);
            
            // Función para limpiar todos los temporizadores e intervalos
            function cleanup() {
                clearInterval(checkIntervalId);
                clearTimeout(midwayTimeoutId);
                clearTimeout(fallbackTimeoutId);
            }
        }
        
        /**
         * Dispara la descarga de un archivo en el navegador.
         * @param {Blob} blob - El contenido del archivo.
         * @param {string} filename - El nombre del archivo a descargar.
         */
        _triggerFileDownload(blob, filename) {
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.style.display = 'none';
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            a.remove();
        }

        /**
         * Crea el HTML para la tarjeta de un archivo PDF.
         * @param {object} fileData - Los datos del archivo.
         * @param {number} index - El índice del archivo en la lista.
         * @returns {string} La cadena de HTML para la tarjeta.
         */
        _createPdfCardHTML(fileData, index) {
            return `
                <div class="col-6 col-md-4 col-lg-3 pdf-card-wrapper">
                    <div class="card h-100 shadow-sm border-0 position-relative" data-file-id="${fileData.uniqueId}">
                        <div class="card-img-top-placeholder d-flex justify-content-center align-items-center bg-light" 
                             style="height: 220px; border-bottom: 1px solid #eee; transform: rotate(${fileData.rotation}deg);">
                            <div class="spinner-border text-primary" role="status"></div>
                        </div>
                        <div class="card-body p-2">
                            <p class="card-title small text-truncate mb-1" title="${fileData.name}">
                                <strong>#${index + 1}</strong> ${fileData.name}
                            </p>
                        </div>
                        <button type="button" class="btn btn-sm btn-light position-absolute top-0 end-0 m-1 rounded-circle delete-btn" aria-label="Eliminar" title="Eliminar">
                            <i class="bi bi-trash text-danger"></i>
                        </button>
                        <button type="button" class="btn btn-sm btn-light position-absolute top-0 start-0 m-1 rounded-circle rotate-btn" aria-label="Rotar" title="Rotar 90°">
                            <i class="bi bi-arrow-clockwise text-primary"></i>
                        </button>
                    </div>
                </div>`;
        }

        /**
         * Crea el HTML para la tarjeta "Agregar más archivos".
         * @returns {string} La cadena de HTML para la tarjeta.
         */
        _createAddMoreCardHTML() {
            return `
                <div class="col-6 col-md-4 col-lg-3 add-more-card-wrapper">
                    <div class="card h-100 shadow-sm border border-dashed text-center d-flex flex-column justify-content-center align-items-center cursor-pointer bg-light" id="addMoreCard" style="min-height: 200px;">
                        <div class="d-flex flex-column justify-content-center align-items-center" style="height: 220px;">
                            <i class="bi bi-plus-circle fs-1 text-primary"></i>
                            <p class="mt-2 mb-0 small fw-bold">Agregar más PDF</p>
                        </div>
                        <div class="pt-2">
                            <p class="mb-0 small text-muted add-more-size-info" style="min-height: 1.25rem;"></p>
                        </div>
                    </div>
                </div>`;
        }

        /**
         * Carga y renderiza la miniatura de la primera página de un PDF.
         * @param {string} fileId - El ID único del archivo.
         */
        async _loadPdfThumbnail(fileId) {
            const fileData = this.state.files.find(f => f.uniqueId === fileId);
            const cardElement = this.dom.previewContainer.querySelector(`.card[data-file-id="${fileId}"]`);
            if (!fileData || !cardElement) return;

            const placeholder = cardElement.querySelector('.card-img-top-placeholder');
            if (!placeholder) return;

            try {
                const arrayBuffer = await fileData.sourceFile.arrayBuffer();
                const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
                const page = await pdf.getPage(1);

                const viewport = page.getViewport({ scale: this.config.THUMBNAIL_SCALE });
                const canvas = document.createElement("canvas");
                const context = canvas.getContext("2d");
                canvas.height = viewport.height;
                canvas.width = viewport.width;

                await page.render({ canvasContext: context, viewport }).promise;

                const img = document.createElement('img');
                img.src = canvas.toDataURL();
                img.className = "card-img-top pdf-thumbnail object-fit-contain bg-light";
                img.style.height = "100%";
                
                placeholder.innerHTML = '';
                placeholder.appendChild(img);
            } catch (error) {
                console.error(`Error al renderizar miniatura para ${fileData.name}:`, error);
                placeholder.innerHTML = '<i class="bi bi-exclamation-triangle-fill text-danger fs-1" title="No se pudo previsualizar"></i>';
            }
        }

        /**
         * Rota un archivo PDF en memoria usando PDF-Lib.
         * @param {File} sourceFile - El archivo PDF original.
         * @param {number} angle - El ángulo de rotación (0, 90, 180, 270).
         * @returns {Promise<File>} Un nuevo objeto File con el PDF rotado.
         */
        async _rotatePdfBinary(sourceFile, angle) {
            if (angle === 0) return sourceFile; // No hay necesidad de procesar si no hay rotación
            const arrayBuffer = await sourceFile.arrayBuffer();
            const pdfDoc = await PDFLib.PDFDocument.load(arrayBuffer);
            pdfDoc.getPages().forEach(page => {
                const currentRotation = page.getRotation().angle;
                page.setRotation(PDFLib.degrees(currentRotation + angle));
            });
            const rotatedBytes = await pdfDoc.save();
            return new File([rotatedBytes], sourceFile.name, { type: "application/pdf" });
        }

        /**
         * Muestra una alerta de Bootstrap que se desvanece automáticamente.
         * @param {string} message - El mensaje a mostrar.
         * @param {string} [type="warning"] - El tipo de alerta (e.g., 'success', 'danger').
         */
        _showBootstrapAlert(message, type = "warning") {
            if (!this.dom.alertContainer) return;
            const alert = document.createElement("div");
            alert.className = `alert alert-${type} alert-dismissible fade show`;
            alert.role = "alert";
            alert.innerHTML = `<i class="bi bi-exclamation-triangle-fill me-2"></i> ${message}<button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Cerrar"></button>`;
            
            this.dom.alertContainer.appendChild(alert);

            setTimeout(() => {
                const alertInstance = bootstrap.Alert.getOrCreateInstance(alert);
                if (alertInstance) alertInstance.close();
            }, this.config.ALERT_DURATION_MS);
        }

        /**
         * Muestra la tarjeta de resultados de compresión.
         * @param {number} originalSize - Tamaño original en bytes.
         * @param {number} compressedSize - Tamaño comprimido en bytes.
         */
        _displayResults(originalSize, compressedSize) {
            const { resultInfo } = this.dom;
            if (!resultInfo || !originalSize || !compressedSize) return;

            if (this.state.resultTimeout) clearTimeout(this.state.resultTimeout);

            const originalMB = (originalSize / 1024 / 1024).toFixed(2);
            const compressedMB = (compressedSize / 1024 / 1024).toFixed(2);
            const variation = originalSize > 0 ? (((compressedSize - originalSize) / originalSize) * -100).toFixed(2) : 0;

            resultInfo.querySelector("#originalSize").textContent = originalMB;
            resultInfo.querySelector("#compressedSize").textContent = compressedMB;
            resultInfo.querySelector("#variation").textContent = variation;

            resultInfo.style.display = "block";
            resultInfo.style.opacity = 1;

            this.state.resultTimeout = setTimeout(() => {
                resultInfo.style.opacity = 0;
                setTimeout(() => { resultInfo.style.display = "none"; }, 500);
            }, this.config.RESULT_FADEOUT_MS);
        }

        /**
         * Muestra el overlay de carga.
         */
        _showSpinner() {
            this.dom.loadingOverlay.classList.add(this.config.cssClasses.visible);
        }
        
        /**
         * Oculta el overlay de carga.
         */
        _hideSpinner() {
            this.dom.loadingOverlay.classList.remove(this.config.cssClasses.visible);
        }

        /**
         * Obtiene el valor de una cookie por su nombre.
         * @param {string} name - El nombre de la cookie.
         * @returns {string|undefined} El valor de la cookie o undefined si no se encuentra.
         */
        _getCookie(name) {
            const value = `; ${document.cookie}`;
            const parts = value.split(`; ${name}=`);
            if (parts.length === 2) return parts.pop().split(";").shift();
        }

        /**
         * Elimina todas las cookies del sitio.
         */
        _deleteAllCookies() {
            const cookies = document.cookie.split(";");
            for (const cookie of cookies) {
                const eqPos = cookie.indexOf("=");
                const name = eqPos > -1 ? cookie.substr(0, eqPos) : cookie;
                document.cookie = `${name.trim()}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
            }
        }
    }

    // =================================================================
    // 5. INICIALIZACIÓN DE LA APLICACIÓN
    // =================================================================
    document.addEventListener('DOMContentLoaded', () => {
        const pdfForm = document.getElementById("pdfForm");
        if (pdfForm) {
            const app = new PdfManager(pdfForm);
            app.init();
        } else {
            console.error("No se encontró el elemento del formulario con ID 'pdfForm'.");
        }
    });

})();