const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');
const { parseXMLContent } = require('./xmlParserService');
const { sendInvoiceEmail } = require('./emailSender');

const recipientEmail = process.env.RECIPIENT_EMAIL;
const zipSourcePath = process.env.ZIP_SOURCE_PATH;
const zipDestPath = process.env.ZIP_DEST_PATH;
const zipRejectedPath = process.env.ZIP_REJECTED_PATH;

const processZips = async (validCufes, limit, log, logError) => {
  const allZipFiles = fs.readdirSync(zipSourcePath).filter(file => file.endsWith('.zip')).map(file => {
    const fullPath = path.join(zipSourcePath, file);
    const stats = fs.statSync(fullPath);
    return { file, mtime: stats.mtime };
  }).sort((a, b) => a.mtime - b.mtime).slice(0, limit); // más viejo primero

  for (const { file: zipFile } of allZipFiles) {
    const fullZipPath = path.join(zipSourcePath, zipFile);
    const zip = new AdmZip(fullZipPath);
    const entries = zip.getEntries();

    const xmlEntry = entries.find(e => e.entryName.toLowerCase().endsWith('.xml'));

    if (!xmlEntry) {
      log(`No se encontró XML en: ${zipFile}`);
      await moveToRejected(fullZipPath, path.join(zipRejectedPath, zipFile), zipFile, log);
      continue;
    }

    try {
      const xmlContent = xmlEntry.getData().toString("utf8");
      const { cufe, documentType, paymentType } = await parseXMLContent(xmlContent, log, logError);

      const isInvoice = documentType === "Factura electrónica";
      const isCreditPayment = paymentType === "credito";

      // Validar tipo de documento y tipo de pago
      if (!isInvoice || !isCreditPayment) {
        log(`Descartado por tipo: ${zipFile} (TipoDoc: ${documentType}, Pago: ${paymentType})`);
        await moveToRejected(fullZipPath, path.join(zipRejectedPath, zipFile), zipFile, log);
        continue;
      }

      const isCUFEValid = cufe && validCufes.includes(cufe);

      if (isCUFEValid) {
        await sendInvoiceEmail(recipientEmail, fullZipPath, log, logError);
        await moveFile(fullZipPath, path.join(zipDestPath, zipFile)); // A match/
        log(`Enviado y movido: ${zipFile}`);
      } else {
        log(`CUFE no encontrado aún en Odoo: ${cufe} (pendiente) - ${zipFile}`);
        // No mover el archivo, permanece en zipSourcePath
      }

    } catch (err) {
      logError(`[Error] Error procesando ${zipFile}:`, err.message);
      await moveToRejected(fullZipPath, path.join(zipRejectedPath, zipFile), zipFile, log);
    }
  }
};

// Función auxiliar para mover a carpeta de rechazados
const moveToRejected = async (from, to, zipName, log) => {
    await fs.promises.rename(from, to);
    log(`Movido a rechazados: ${zipName}`);
};

// Función auxiliar para mover a cualquier carpeta
const moveFile = async (from, to) => {
  await fs.promises.rename(from, to);
};

module.exports = { processZips };