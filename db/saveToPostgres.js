const { getClient } = require('./connectDB');

// Función para insertar los datos en PostgreSQL
async function saveToPostgres(invoiceData, log, logError) {
    const client = getClient(); // Obtener el cliente de la BD

    try {
        await client.connect(); // Conectar a la base de datos

        // Verificar si el CUFE ya existe en la tabla `invoices`
        const checkCufeQuery = `SELECT COUNT(*) FROM invoices WHERE cufe = $1;`;
        const checkResult = await client.query(checkCufeQuery, [invoiceData.cufe]);
        const cufeExists = parseInt(checkResult.rows[0].count, 10) > 0;

        if (cufeExists) {
            log(`El CUFE "${invoiceData.cufe}" ya existe en la base de datos. No se guardará esta factura.`);
            return; // Salir de la función si el CUFE ya existe
        }

        // Iniciar transacción
        await client.query("BEGIN"); // Iniciar transacción

        // Insertar datos únicos de la factura en la tabla `invoices`
        const insertInvoiceQuery = `
            INSERT INTO invoices (subtotal, tax_total, total_valor, total_articulos, cufe, document_type,
                consecutive_invoice, prefix_number, issuer_company, issuer_nit, issue_date, expiration_date, created_at, inc_bolsa_total, ajuste_vueltas, propina)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, CURRENT_TIMESTAMP, $13, $14, $15)
            RETURNING invoice_id;
        `;
        const invoiceResult = await client.query(insertInvoiceQuery, [
            invoiceData.subtotal,
            invoiceData.taxTotal,
            invoiceData.totalValor,
            invoiceData.totalArticulos,
            invoiceData.cufe,
            invoiceData.DocumentType,
            invoiceData.consecutiveInvoice,
            invoiceData.prefixNumber,
            invoiceData.issuerCompany,
            invoiceData.issuerNit,
            invoiceData.issueDate,
            invoiceData.expirationDate,
            invoiceData.incBolsaTotal,
            invoiceData.ajusteVueltas,
            invoiceData.propina
        ]);

        const invoiceId = invoiceResult.rows[0].invoice_id; // Obtener el ID generado para la factura

        // Insertar datos de los ítems en la tabla `invoice_items`
        const insertItemQuery = `
            INSERT INTO invoice_items (invoice_id, item, codigo, descripcion, cantidad, valor_uni_xcant, valor_uni_sin_iva_xcant, tax_valor_xcant, tax_porcentaje, valor_total_item,
            tax_tipo, valor_uni, tax_valor_uni, document_type_item, prefix_number_pago, cufe, consecutive_invoice, prefix_number, issuer_nit, issue_date, expiration_date,
            valor_uni_sin_iva, valor_uni_sin_iva_mas_otros, iva, total, issuer_company)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26);
        `;

        for (const item of invoiceData.items) {
            await client.query(insertItemQuery, [
                invoiceId, // Relacionar el ítem con la factura correspondiente
                item.item,
                item.codigo,
                item.descripcion,
                item.cantidad,
                item.valorUniXCant,
                item.valorUniSinIvaXCant,
                item.taxValorXCant,
                item.taxPorcentaje,
                item.valorTotalItem,
                item.taxTipo,
                item.valorUni,
                item.TaxValorUni,
                item.DocumentTypeItem,
                item.prefixNumberPago,
                item.cufe,
                item.consecutiveInvoice,
                item.prefixNumber,
                item.issuerNit,
                item.issueDate,
                item.expirationDate,
                item.valorUniSinIva,
                item.valorUniSinIvaMasOtros,
                item.iva,
                item.total,
                item.issuerCompany
            ]);
        }

        // Añadir datos generales como ítems solo si tienen valores válidos
        const generalItems = [];

        // Verificar y agregar Impuesto a la Bolsa
        if (invoiceData.incBolsaTotal && invoiceData.incBolsaTotal !== 0) {
            generalItems.push({
                descripcion: invoiceData.incBolsaNombre,
                total: invoiceData.incBolsaTotal
            });
        }

        // Verificar y agregar Ajuste de Vueltas
        if (invoiceData.ajusteVueltas && invoiceData.ajusteVueltas !== 0) {
            generalItems.push({
                descripcion: "Ajuste de vueltas",
                total: invoiceData.ajusteVueltas
            });
        }

        // Verificar y agregar Propina
        if (invoiceData.propina && invoiceData.propina !== 0) {
            generalItems.push({
                descripcion: invoiceData.propinaDescripcion,
                total: invoiceData.propina
            });
        };

        // Insertar cada ítem general en la base de datos
        for (const generalItem of generalItems) {
            await client.query(insertItemQuery, [
                invoiceId,
                'N/A', // item
                'N/A', // codigo
                generalItem.descripcion, // descripcion
                parseFloat(1), // cantidad
                parseFloat(0), // valor_uni_xcant
                parseFloat(0), // valor_uni_sin_iva_xcant
                parseFloat(0), // tax_valor_xcant
                parseFloat(0), // tax_porcentaje
                generalItem.total, // valor_total_item
                "N/A", // tax_tipo
                generalItem.total, // valor_uni
                parseFloat(0), // tax_valor_uni
                invoiceData.DocumentType2, // document_type_item
                invoiceData.prefixNumber, // prefix_number_pago
                invoiceData.cufe,
                invoiceData.consecutiveInvoice,
                invoiceData.prefixNumber,
                invoiceData.issuerNit,
                invoiceData.issueDate,
                invoiceData.expirationDate,
                parseFloat(0), // valor_uni_sin_iva
                parseFloat(0), // valor_uni_sin_iva_mas_otros
                parseFloat(0), // iva
                generalItem.total, // total
                invoiceData.issuerCompany
            ]);
        }

        await client.query("COMMIT"); // Confirmar transacción
        log("Factura y detalles guardados correctamente en la base de datos.");
    } catch (error) {
        await client.query("ROLLBACK"); // Revertir transacción en caso de error
        logError("Error al guardar en la base de datos:", error.message);
        console.error("Error al guardar en la base de datos:", error.message);
        throw error;
    } finally {
        await client.end(); // Cerrar la conexión
    }
}

module.exports = { saveToPostgres };