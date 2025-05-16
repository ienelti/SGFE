const { getClient } = require('./connectDB');

// Función para eliminar todos los registros de las tablas `invoices` e `invoice_items`
async function clearDatabase(log, logError) {
    const client = getClient(); // Obtener el cliente de la base de datos

    try {
        await client.connect(); // Conectar a la base de datos
        log("Conexión establecida con la base de datos.");

        // Iniciar transacción
        await client.query("BEGIN");

        // Eliminar registros de la tabla `invoice_items`
        await client.query("DELETE FROM invoice_items;");
        log("Registros eliminados de la tabla 'invoice_items'.");

        // Eliminar registros de la tabla `invoices`
        await client.query("DELETE FROM invoices CASCADE;");
        log("Registros eliminados de la tabla 'invoices'.");

        // Confirmar transacción
        await client.query("COMMIT");
        log("Base de datos limpiada correctamente.");

        return true; // Retornar true si todo se ejecutó correctamente
    } catch (error) {
        // Revertir transacción en caso de error
        await client.query("ROLLBACK");
        logError("Error al limpiar la base de datos:", error.message);
        console.error("Error al limpiar la base de datos:", error.message);
        throw error;
    } finally {
        await client.end(); // Cerrar la conexión
    }
}

module.exports = { clearDatabase };