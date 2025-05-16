const Odoo = require('odoo-xmlrpc');

const odoo = new Odoo({
  url: process.env.ODOO_URL,
  db: process.env.ODOO_DB,
  username: process.env.ODOO_USER,
  password: process.env.ODOO_PASS
});

// Función para conectar con Odoo
const connectToOdoo = () => {
  return new Promise((resolve, reject) => {
    odoo.connect((err) => {
      if (err) {
        reject(`Error al conectar con Odoo: ${err}`);
      } else {
        resolve('¡Conexión exitosa a Odoo!');
      }
    });
  });
};

// Función corregida para buscar facturas publicadas
const getPostedInvoices = (companyId) => {
  return new Promise((resolve, reject) => {
    const domain = [
      ["state", "=", "posted"],
      ["company_id", "=", companyId], // Filtra sólo registros activos y de la compañia IENEL(1) // 3JA(2) ENP(3)
      ["x_studio_cufecude", "!=", false],  // Excluye valores nulos o falsos
      ["x_studio_cufecude", "!=", ""]      // Excluye valores vacíos
    ];

    const fields = ["id", "x_studio_cufecude"]; // Campos a devolver

    odoo.execute_kw(
      "account.move",  // Modelo en Odoo
      "search_read",   // Método para buscar y leer datos
      [[domain], { fields }], // Parámetros de búsqueda y campos a devolver
      (err, invoices) => {
        if (err) {
          reject(`Error al obtener facturas: ${err}`);
        } else {
          resolve(invoices);
        }
      }
    );
  });
};

module.exports = {
  connectToOdoo,
  getPostedInvoices
};