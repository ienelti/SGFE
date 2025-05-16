const { connectToOdoo, getPostedInvoices } = require('../services/odooService');
const { processZips } = require('../services/zipProcessorService');
const { clearCurrentLogFile, createLogger } = require('../utils/logger');

const EMPRESAS = [
  {
    nombre: 'IENEL',
    companyId: 1,
    zipSource: process.env.ZIP_SOURCE_PATH,
    zipDest: process.env.ZIP_DEST_PATH,
    zipRejected: process.env.ZIP_REJECTED_PATH
  },
  {
    nombre: 'TRJA',
    companyId: 2,
    zipSource: process.env.TRJA_ZIP_SOURCE_PATH,
    zipDest: process.env.TRJA_ZIP_DEST_PATH,
    zipRejected: process.env.TRJA_ZIP_REJECTED_PATH
  },
  {
    nombre: 'ENP',
    companyId: 3,
    zipSource: process.env.ENP_ZIP_SOURCE_PATH,
    zipDest: process.env.ENP_ZIP_DEST_PATH,
    zipRejected: process.env.ENP_ZIP_REJECTED_PATH
  }
];

// Ejecutar el proceso para una empresa específica
async function mainReenviador() {
  const programa = 'REENVIADOR';

  for (const empresa of EMPRESAS) {
    const { log, logError } = createLogger(programa, empresa.nombre);
    
    try {
      await clearCurrentLogFile(programa, empresa.nombre);

      log(`Iniciando proceso para la empresa: ${empresa.nombre}`);

      await startApp(empresa, log, logError);

    } catch (error) {
      logError(`Error ejecutando el proceso para la empresa: ${empresa.nombre}`, error);
      console.log(`Error ejecutando el proceso para la empresa: ${empresa.nombre}`, error);
    }
  }
}

const startApp = async (empresa, log, logError) => {
  try {
    const message = await connectToOdoo();
    log(message);

    const invoices = await getPostedInvoices(empresa.companyId);
    const cufes = invoices.map(inv => inv.x_studio_cufecude).filter(Boolean);

    await processZips(cufes, 100, empresa, log, logError);
    return { success: true, processed: cufes.length };
  } catch (error) {
    logError(error);
    console.error(error);
    return { success: false, error };
  }
};

module.exports = {
  mainReenviador
};