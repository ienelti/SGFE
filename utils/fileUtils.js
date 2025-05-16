const fs = require('fs');
const path = require('path');

// Función auxiliar para evitar sobrescribir archivos con el mismo nombre
function getUniqueFileName(filepath) {
    let ext = path.extname(filepath);  // Obtener la extensión del archivo (ej. .zip)
    let baseName = path.basename(filepath, ext);  // Obtener el nombre sin extensión
    let dir = path.dirname(filepath);  // Obtener la ruta del directorio
    let counter = 1;  // Contador para iterar nombres duplicados

    // Mientras el archivo exista, incrementar el número y cambiar el nombre
    while (fs.existsSync(filepath)) {
        filepath = path.join(dir, `${baseName} (${counter})${ext}`);
        counter++;
    }
    return filepath;
}

// Función para retrasar la ejecución
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = { getUniqueFileName, delay };