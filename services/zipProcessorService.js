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
  const zipFiles = fs.readdirSync(zipSourcePath).filter(file => file.endsWith('.zip')).slice(0, limit);

  for (const zipFile of zipFiles) {
    const fullZipPath = path.join(zipSourcePath, zipFile);
    const zip = new AdmZip(fullZipPath);
    const entries = zip.getEntries();

    const xmlEntry = entries.find(e => e.entryName.toLowerCase().endsWith('.xml'));

    if (!xmlEntry) {
      log(`No se encontró XML en: ${zipFile}`);
      continue;
    }

    try {
      const xmlContent = xmlEntry.getData().toString("utf8");
      const { cufe, documentType, paymentType } = await parseXMLContent(xmlContent, log, logError);

      const isCUFEValid = cufe && validCufes.includes(cufe);
      const isInvoice = documentType === "Factura electrónica";
      const isCreditPayment = paymentType === "credito";

      if (isCUFEValid && isInvoice && isCreditPayment) {
        await sendInvoiceEmail(recipientEmail, fullZipPath, log, logError);
        await moveFile(fullZipPath, path.join(zipDestPath, zipFile)); // A match/
        log(`Enviado y movido: ${zipFile}`);
      } else {
        log(`No cumple condiciones para ser enviado: ${zipFile}`);
        
        await moveToRejected(fullZipPath, path.join(zipRejectedPath, zipFile), zipFile, log); // No match
      }
    } catch (err) {
      logError(`Error procesando ${zipFile}:`, err.message);
      console.error(`Error procesando ${zipFile}:`, err.message);
      await moveToRejected(fullZipPath, path.join(zipRejectedPath, zipFile), zipFile); // No match
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