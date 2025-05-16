const fsPromises = require('fs').promises;
const fs = require('fs');
const path = require('path');

// Función para obtener la fecha y hora local formateada
function getCurrentDateTime() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0'); // Mes (base 0)
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');

    // Formato: YYYY-MM-DD HH:MM:SS
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

// Función para verificar si han pasado 7 días desde la última limpieza
async function shouldCleanLogFile(filePath) {
    try {
        const stats = await fsPromises.stat(filePath);
        const lastModified = new Date(stats.mtime);
        const now = new Date();
        const daysSinceLastModified = (now - lastModified) / (1000 * 60 * 60 * 24);
        return daysSinceLastModified >= 7; //Campo a modificar dependiendo de la cantidad de días para la verificación
    } catch (error) {
        console.error(`[Error] Error obteniendo el estado del archivo: ${error}`);
        return false;
    }
}

// Función para limpiar la mitad de los registros más antiguos en el archivo de log
async function cleanUpLogFile(filePath) {
    try {
        const data = await fsPromises.readFile(filePath, 'utf8');
        const lines = data.split('\n').filter(line => line.trim() !== '');

        // Si hay más de 1 línea, eliminamos la mitad de las más antiguas
        if (lines.length > 1) {
            const halfIndex = Math.floor(lines.length / 2);
            const newData = lines.slice(halfIndex).join('\n') + '\n';
            await fsPromises.writeFile(filePath, newData, 'utf8');
            console.log(`[${getCurrentDateTime()}] Limpieza de log: se han eliminado registros antiguos.`);
        }
    } catch (error) {
        console.error(`[Error] Error al limpiar el archivo de log: ${error}`);
    }
}

function resolveLogPaths(programa, empresa) {
    const basePath = path.join(__dirname, '..', 'logs', programa.toLowerCase(), empresa.toLowerCase());
    return {
        logFilePath: path.join(basePath, 'events.log'),
        currentLogFilePath: path.join(basePath, 'currentEvents.log')
    };
}

async function logToFile(message, isError, programa, empresa) {
    const { logFilePath, currentLogFilePath } = resolveLogPaths(programa, empresa);
    const logPrefix = isError ? '[Error]' : '[Log]';
    const logMessage = `[${getCurrentDateTime()}] ${logPrefix} ${message}\n`;

    try {
        // Crear los archivos si no existen
        if (!fs.existsSync(logFilePath)) await fsPromises.writeFile(logFilePath, '');
        if (!fs.existsSync(currentLogFilePath)) await fsPromises.writeFile(currentLogFilePath, '');

        // Verificar si es necesario limpiar el archivo events.log
        if (await shouldCleanLogFile(logFilePath)) {
            await cleanUpLogFile(logFilePath);
        }

        // Registrar en ambos logs
        await fsPromises.appendFile(logFilePath, logMessage, 'utf8');
        await fsPromises.appendFile(currentLogFilePath, logMessage, 'utf8');
    } catch (error) {
        console.error(`[Error] Error al escribir logs: ${error}`);
    }
}

async function clearCurrentLogFile(programa, empresa) {
    const { currentLogFilePath } = resolveLogPaths(programa, empresa);
    try {
        if (fs.existsSync(currentLogFilePath)) {
            await fsPromises.writeFile(currentLogFilePath, '', 'utf8');
        }
    } catch (error) {
        console.error(`[Error] Limpieza fallida de currentEvents: ${error}`);
    }
}

function createLogger(programa, empresa) {
    const log = (message) => logToFile(message, false, programa, empresa);
    const logError = (message) => logToFile(message, true, programa, empresa);
    return { log, logError };
}

module.exports = { 
    clearCurrentLogFile, createLogger
};