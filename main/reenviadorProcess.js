const { connectToOdoo, getPostedInvoices } = require('../services/odooService');
const { processZips } = require('../services/zipProcessorService');
const { clearCurrentLogFile, createLogger } = require('../utils/logger');

// Ejecutar el proceso para una empresa específica
async function mainReenviador() {
  const programa = 'reenviador';
  const empresa = 'index';

  const { log, logError } = createLogger(programa, empresa);
  
  try {
    await clearCurrentLogFile(programa, empresa);

    await startApp(log, logError);

  } catch (error) {
    logError('Error ejecutando el programa reenviador', error);
    console.log('Error ejecutando el programa reenviador', error);
  }
}

const startApp = async (log, logError) => {
  try {
    const message = await connectToOdoo();
    log(message);

    const invoices = await getPostedInvoices();
    const cufes = invoices.map(inv => inv.x_studio_cufecude).filter(Boolean);

    await processZips(cufes, log, logError);
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