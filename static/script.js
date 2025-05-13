// Estructura de manuales por categoría
const manuales = {
  outlook: [
      '/manuales/manualesCorreo/Autoarchivo Outlook.pdf',
      '/manuales/manualesCorreo/Configuracion correo Android.pdf',
      '/manuales/manualesCorreo/Manual de respuestas automaticas en Outlook.pdf'
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
      'manuales/manualPdf/Proteccion_y_seguridad_en_PDF.pdf'
  ],
  sap: [
      'manuales/manualesSap/Manual Carga Extractos Bancarios Banco Santander-Chile.pdf',
      'manuales/manualesSap/Manual Pago Automatico Proveedores -F110.pdf',
      'manuales/manualesSap/Registro Factura clientes a traves de Finanzas.pdf',
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





