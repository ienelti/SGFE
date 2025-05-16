const { saveToPostgres } = require('../db/saveToPostgres');
const { clearDatabase } = require('../db/clearDatabase');
const { parseXML } = require('../utils/lector');

// Función principal para ejecutar el proceso de lectura y guardado de datos
async function mainLector(xmlFiles, log, logError) {
    log('Iniciando procesamiento de archivos:', xmlFiles.map(f => f.filename));

    // Limpiar la base de datos antes de procesar los nuevos archivos
    let isDatabaseCleared = false;

    try {
        log("Limpiando la base de datos...");
        isDatabaseCleared = await clearDatabase(log, logError); // Retorna true si se ejecutó correctamente
    } catch (error) {
        logError("Error al limpiar la base de datos:", error.message);
        console.error("Error al limpiar la base de datos:", error.message);
    }

    // Si no se pudo limpiar la base de datos, detener el procesamiento
    if (!isDatabaseCleared) {
        logError("No se pudo limpiar la base de datos. Abortando el proceso.");
        return;
    }

    // Inicializar contadores para estadísticas
    let successCount = 0;
    let errorCount = 0;

    // Recorrer cada archivo y procesarlo
    for (const file of xmlFiles) {
        try {
            log(`Procesando archivo: ${file.filename}`);

            // Parsear el contenido del archivo XML
            const invoiceData = await parseXML(file.content, log, logError);

            // Guardar los datos en la base de datos
            await saveToPostgres(invoiceData, log, logError);

            successCount++; // Incrementar el contador de éxito
        } catch (error) {
            logError(`Error al procesar el archivo ${file.filename}:`, error.message);
            console.error(`Error al procesar el archivo ${file.filename}:`, error.message);
            errorCount++; // Incrementar el contador de errores
        }
    }

    log(`Procesamiento completado. Éxitos: ${successCount}, Errores: ${errorCount}`);
}

// Exportar la función mainLector para poder llamarla desde mainRoutes.js
module.exports = { mainLector };