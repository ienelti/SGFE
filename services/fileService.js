const fsPromises = require('fs').promises;
const fs = require('fs');
const path = require('path');
const unzipper = require('unzipper');
const { getFacturadorInfo } = require('../utils/xmlUtils');
const { parseXML } = require('../utils/lectorGestor');
const { delay, getUniqueFileName } = require('../utils/fileUtils');

// 3. Extraer el contenido del ZIP (XML y PDF) en subcarpetas y renombrar
async function extractZip(zipPath, empresa, log, logError) {
    // Definir las carpetas de descarga según la empresa
    const downloadFolders = {
        IENEL: process.env.IENEL_DOWNLOAD_FOLDER,
        TRJA: process.env.TRJA_DOWNLOAD_FOLDER,
        ENP: process.env.ENP_DOWNLOAD_FOLDER
    };

    const downloadFolder = downloadFolders[empresa];

    if (!downloadFolder) {
        logError(`[Error] Carpeta de descarga no configurada para la empresa: ${empresa}`);
        return { xmlFiles: [], pdfFiles: [] };
    }

    const zipBaseName = path.basename(zipPath, path.extname(zipPath));  // Nombre del archivo comprimido sin extensión

    // Crear una subcarpeta específica para este ZIP en la carpeta raíz
    const tempFolder = path.join(downloadFolder, zipBaseName);
    await fsPromises.mkdir(tempFolder, { recursive: true });

    // EXTRAER ARCHIVOS COMO COPIA (no extracción destructiva)
    try {
        // Abre el zip sin modificarlo
        let directory;
        let intento = 0;
        const maxIntentos = 3;

        while (intento < maxIntentos) {
            try {
                directory = await unzipper.Open.file(zipPath);
                break; // si se logró abrir, salimos del bucle
            } catch (error) {
                intento++;
                log(`[Advertencia] Fallo al abrir ZIP (${zipPath}) intento ${intento}: ${error.message}`);
                if (intento === maxIntentos) {
                    logError(`[Error] No se pudo abrir el ZIP después de ${maxIntentos} intentos: ${zipPath}`);
                    return { xmlFiles: [], pdfFiles: [] };
                }
                await delay(2000); // esperar 2s antes del siguiente intento
            }
        }

        for (const file of directory.files) {
            if (!file.type || file.type !== 'File') continue; // Solo procesar archivos normales
            const destPath = path.join(tempFolder, file.path);
            await fsPromises.mkdir(path.dirname(destPath), { recursive: true }); // Crear subdirectorios si los hay
            const writeStream = fs.createWriteStream(destPath);
            file.stream().pipe(writeStream);
            await new Promise((resolve, reject) => {
                writeStream.on('finish', resolve);
                writeStream.on('error', reject);
            });
        }
        log(`Extracción temporal completada para: ${zipPath}`);
    } catch (error) {
        logError(`[Error] Error durante la extracción temporal del ZIP: ${zipPath}`, error);
        console.error(`[Error] Error durante la extracción temporal del ZIP: ${zipPath}`, error);
        return { xmlFiles: [], pdfFiles: [] };
    }

    // Leer los archivos extraídos en la subcarpeta
    const files = await fsPromises.readdir(tempFolder);
    log('Archivos extraídos:', files);

    let xmlFiles = [], pdfFiles = [], facturador = '', numeroFactura = '';
    let monthPath = '', finalXmlPath = '', finalPdfPath = '', invoiceData;
    // Definir un array para los nombres de los meses en español
    const monthNames = [
        'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
        'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ];

    // 1. Procesar el archivo XML primero
    for (let file of files) {
        const filePath = path.join(tempFolder, file);

        // Si es un archivo XML, obtener la información del facturador y número de factura
        if (file.endsWith('.xml')) {
            try {
                // Leer el archivo explícitamente antes de parsear y cerrarlo
                const fileDescriptor = await fs.promises.open(filePath, 'r');
                invoiceData = await parseXML(filePath, log, logError);
                await fileDescriptor.close(); // Cerrar el archivo explícitamente

                if (!invoiceData || !invoiceData.customerNit) {
                    throw new Error('XML inválido o vacío');
                }
                
                // Definir los NITs correctos según la empresa
                const expectedNits = {
                    IENEL: process.env.IENEL_NIT,
                    TRJA: process.env.TRJA_NIT,
                    ENP: process.env.ENP_NIT
                };

                const expectedNit = expectedNits[empresa];

                // Validar si el customerNit concuerda con el NIT esperado
                if (!invoiceData.customerNit.includes(expectedNit)) {
                    log(
                        `[Advertencia] El archivo XML ${file} no fue procesado porque el Nit del cliente (${invoiceData.customerNit}) no contiene '${expectedNit}'.`
                    );

                    // Retrasar la eliminación de la carpeta temporal para evitar el error EBUSY
                    await delay(3000);  // Esperar 3 segundos

                    // Eliminar la subcarpeta temporal
                    try {
                        await fsPromises.rm(tempFolder, { recursive: true });
                        log(`Subcarpeta temporal eliminada: ${tempFolder}`);
                    } catch (error) {
                        logError(`[Error] Error al eliminar la subcarpeta temporal: ${tempFolder}`, error);
                        console.error(`[Error] Error al eliminar la subcarpeta temporal: ${tempFolder}`, error);
                    }

                    // Eliminar el archivo ZIP original para mantener limpia la carpeta raíz
                    try {
                        await fsPromises.unlink(zipPath);
                        log(`Archivo ZIP eliminado: ${zipPath}`);
                    } catch (error) {
                        logError(`[Error] Error al eliminar el archivo ZIP: ${zipPath}`, error);
                        console.error(`[Error] Error al eliminar el archivo ZIP: ${zipPath}`, error);
                    }

                    // Continuar con el siguiente archivo ZIP
                    return { xmlFiles: [], pdfFiles: [] };
                }

                // Formatear la fecha de emisión de manera segura para evitar problemas de zona horaria
                const issueDateParts = invoiceData.issueDate.split('-');
                const issueDate = new Date(Date.UTC(
                    parseInt(issueDateParts[0], 10),  // Año
                    parseInt(issueDateParts[1], 10) - 1,  // Mes (base 0)
                    parseInt(issueDateParts[2], 10)   // Día
                ));

                // Crear la carpeta del mes usando el array de nombres de meses
                const monthNumber = String(issueDate.getUTCMonth() + 1).padStart(2, '0');
                const monthName = monthNames[issueDate.getUTCMonth()];
                const monthFolder = `${monthNumber} ${monthName}`;

                // Determinar la carpeta de destino según el tipo de documento
                let documentFolder, xmlSubFolder;
                if (invoiceData.DocumentType === 'Factura electrónica') {
                    // Si es Factura Electrónica, verificar si es Contado o Crédito
                    if (invoiceData.paymentType === 'contado') {
                        documentFolder = '03 Facturas de Compra';
                        xmlSubFolder = '00 XML Facturas de Compra';
                    } else if (invoiceData.paymentType === 'credito') {
                        documentFolder = '03 Facturas de Compra/credito';
                        xmlSubFolder = '00 XML Facturas de Compra';
                    } else {
                        logError('[Error] Tipo de pago no reconocido:', invoiceData.paymentType);
                        continue; // Saltar al siguiente archivo si el tipo de pago no es válido
                    }
                } else if (invoiceData.DocumentType === 'Nota crédito') {
                    documentFolder = '04 Nota Credito Proveedores';
                    xmlSubFolder = '00 XML Nota Credito';
                } else {
                    logError('[Error] Tipo de documento no reconocido:', invoiceData.DocumentType);
                    continue; // Saltar al siguiente archivo si no se reconoce el tipo de documento
                }

                // Crear las rutas de destino
                monthPath = path.join(downloadFolder, monthFolder, documentFolder);
                const xmlPath = path.join(monthPath, xmlSubFolder);
                await fsPromises.mkdir(xmlPath, { recursive: true });

                // Obtener la información del facturador y el número de factura para renombrar
                const info = await getFacturadorInfo(filePath, log, logError);
                facturador = info.facturador || 'facturador_desconocido';
                numeroFactura = info.numeroFactura || '';

                // Añadir un retraso antes de renombrar
                await delay(2000); // 2 segundos de espera

                // Generar el nombre de archivo usando el manejo de duplicados
                let newXmlFileName = `${facturador}_${numeroFactura}.xml`;
                newXmlFileName = path.basename(getUniqueFileName(path.join(xmlPath, newXmlFileName))); // Obtener nombre único
                finalXmlPath = path.join(xmlPath, newXmlFileName);
                await fsPromises.rename(filePath, finalXmlPath);
                xmlFiles.push(finalXmlPath);

            } catch (error) {
                logError(`[Error] Error al procesar el archivo XML: ${filePath}`, error);
                console.error(`[Error] Error al procesar el archivo XML: ${filePath}`, error);

                // Retrasar la eliminación de la carpeta temporal para evitar el error EBUSY
                await delay(3000);  // Esperar 3 segundos

                // XML dañado, eliminar carpeta y ZIP
                try {
                    await fsPromises.rm(tempFolder, { recursive: true });
                    log(`Subcarpeta temporal eliminada debido a error en XML: ${tempFolder}`);
                } catch (error) {
                    logError(`[Error] Error al eliminar la subcarpeta temporal: ${tempFolder}`, error);
                    console.error(`[Error] Error al eliminar la subcarpeta temporal: ${tempFolder}`, error);
                }

                try {
                    await fsPromises.unlink(zipPath);
                    log(`Archivo ZIP eliminado debido a error de lectura: ${zipPath}`);
                } catch (error) {
                    logError(`[Error] Error al eliminar el archivo ZIP: ${zipPath}`, error);
                    console.error(`[Error] Error al eliminar el archivo ZIP: ${zipPath}`, error);
                }
            }
        }
    }

    // 2. Renombrar y mover los archivos PDF a la carpeta de destino
    let pdfFound = false; // Variable para verificar si se encontró al menos un PDF
    for (let file of files) {
        const filePath = path.join(tempFolder, file);
        
        if (file.endsWith('.pdf')) {
            pdfFound = true;
            if (monthPath) {
                // Generar el nombre de archivo PDF con manejo de duplicados
                let newPdfFileName = `${facturador}_${numeroFactura}.pdf`;
                newPdfFileName = path.basename(getUniqueFileName(path.join(monthPath, newPdfFileName))); // Obtener nombre único
                finalPdfPath = path.join(monthPath, newPdfFileName);
                await fsPromises.rename(filePath, finalPdfPath);
                pdfFiles.push(finalPdfPath);
            } else {
                logError('[Error] No se pudo determinar `monthPath` para mover el archivo PDF.');
            }
        }
    }

    // Verificar si no se encontraron archivos PDF
    if (!pdfFound) {
        log('No se encontraron archivos PDF en el ZIP. Continuando con el flujo.');
    }

    // Retrasar la eliminación de la carpeta temporal para evitar el error EBUSY
    await delay(3000);  // Esperar 3 segundos

    // Eliminar la subcarpeta temporal después de procesar los archivos
    try {
        await fsPromises.rm(tempFolder, { recursive: true });
        log(`Subcarpeta temporal eliminada: ${tempFolder}`);
    } catch (error) {
        logError(`[Error] Error al eliminar la subcarpeta temporal: ${tempFolder}`, error);
        console.error(`[Error] Error al eliminar la subcarpeta temporal: ${tempFolder}`, error);
    }
    
    return { xmlFiles, pdfFiles };
}

module.exports = { extractZip };