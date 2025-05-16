const { Client } = require('pg');
const dbConfig = require('../config/dbconfig');

// Función para obtener un cliente de PostgreSQL
function getClient() {
    return new Client(dbConfig);
}

module.exports = { getClient };