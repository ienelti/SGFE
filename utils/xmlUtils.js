const xpath = require('xpath');
const { DOMParser } = require('xmldom');
const fs = require('fs');

// 4. Función para obtener el facturador y el número de factura
async function getFacturadorInfo(xmlFile, log, logError) {
    // Leer y parsear el archivo XML
    const xmlContent = await fs.promises.readFile(xmlFile, 'utf8');
    const documentoxml = new DOMParser().parseFromString(xmlContent, 'text/xml');
    log('Documento XML parseado correctamente.');

    // Definir los espacios de nombres que utiliza el XML
    const namespaces = {
        cbc: 'urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2',
        cac: 'urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2'
    };

    // Función auxiliar para manejar namespaces en XPath
    const selectWithNS = xpath.useNamespaces(namespaces);

    // Obtener el número de factura
    const numeroFacturaNodes = selectWithNS("//cbc:ParentDocumentID/text()", documentoxml);
    let numeroFactura = '';
    if (numeroFacturaNodes.length > 0) {
        log('Nodos encontrados para número de factura:', numeroFacturaNodes.length);
        numeroFactura = numeroFacturaNodes[0].nodeValue;
    } else {
        const alternativeNodes = selectWithNS("//cbc:ID/text()", documentoxml);
        
        if (alternativeNodes.length > 0) {
            log('Nodos encontrados para número de factura:', alternativeNodes.length);
            numeroFactura = alternativeNodes[0].nodeValue;
        } else {
            logError('[Error] No se encontró el nodo para número de factura.');
        }
    }

    // Obtener el facturador
    const facturadorNodes = selectWithNS("//cac:SenderParty/cac:PartyTaxScheme/cbc:RegistrationName/text() | //cac:AccountingSupplierParty/cac:Party/cac:PartyTaxScheme/cbc:RegistrationName/text()", documentoxml);
    log('Nodos encontrados para facturador:', facturadorNodes.length);

    let facturador = '';
    if (facturadorNodes.length > 0) {
        facturador = facturadorNodes[0].nodeValue;
    } else {
        logError('[Error] No se encontró el nodo para facturador.');
    }

    return { facturador, numeroFactura };
}

module.exports = { getFacturadorInfo };
