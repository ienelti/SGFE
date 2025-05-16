const { connectEmail, downloadAttachments } = require('../services/emailService');
const { extractZip } = require('../services/fileService');

// Función principal para ejecutar el proceso de lectura y renombre
async function mainGestor(empresa, log, logError) {

    const accessToken = await connectEmail(logError); // Solo obtiene el token

    if (accessToken) {
        log(`Token de acceso obtenido para la empresa ${empresa}.`);
        try {
            // Descargar los archivos ZIP o RAR adjuntos de correos no leídos
            const attachments = await downloadAttachments(accessToken, empresa, log, logError);

            // Extraer el contenido de cada archivo comprimido
            for (let zipPath of attachments) {
                const { xmlFiles, pdfFiles } = await extractZip(zipPath, empresa, log, logError);

                if (xmlFiles.length > 0 || pdfFiles.length > 0) {
                    log('Archivos XML extraídos y renombrados:', xmlFiles);
                    log('Archivos PDF extraídos y renombrados:', pdfFiles);
                } else {
                    log(`No se encontraron archivos XML o PDF en el archivo comprimido: ${zipPath}`);
                }
            }
        } catch (error) {
            logError(`[Error] Error durante el proceso para ${empresa}:`, error);
            console.error(`[Error] Error durante el proceso para ${empresa}:`, error);
        }
    } else {
        logError(`[Error] No se pudo obtener token de acceso para la empresa ${empresa}`);
    }
    
}

// Exportar la función main para poder llamarla desde mainRoutes.js
module.exports = { mainGestor };
