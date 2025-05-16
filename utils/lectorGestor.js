const fs = require("fs").promises;
const { DOMParser } = require("xmldom");
const xpath = require("xpath");
const xml2js = require("xml2js");

// Función para leer y analizar el XML
async function parseXML(filePath, log, logError) {
  try {
    const xmlContent = await fs.readFile(filePath, "utf8"); // Leer el archivo XML

    // Parsear el contenido del XML con DOMParser
    const document = new DOMParser().parseFromString(xmlContent, "text/xml");

    // Parsear el contenido del XML con xml2js
    const parser = new xml2js.Parser({ explicitArray: false, mergeAttrs: true });
    const jsonResult = await parser.parseStringPromise(xmlContent);

    // Definir los namespaces para XPath
    const namespaces = {
      cbc: "urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2",
      cac: "urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
    };

    const select = xpath.useNamespaces(namespaces); // Usar los namespaces definidos

    // Verificar si el nodo `Description` está presente en la estructura JSON
    const descriptionNodeContent = jsonResult?.["AttachedDocument"]?.["cac:Attachment"]?.["cac:ExternalReference"]?.["cbc:Description"] || "";
    let embeddedXml;

    if (descriptionNodeContent) {
      // Limpiar cualquier etiqueta CDATA si está presente
      const cleanContent = descriptionNodeContent.replace(/<!\[CDATA\[|\]\]>$/g, "").trim();

      // Intentar parsear el XML embebido en el nodo Description usando DOMParser
      try {
        embeddedXml = new DOMParser().parseFromString(cleanContent, "text/xml");
        log("XML embebido parseado correctamente.");
      } catch (error) {
        logError("[Error] Error al parsear el XML embebido:", error);
        console.error("[Error] Error al parsear el XML embebido:", error);
        embeddedXml = null;
      }
    } else {
      log("El nodo Description está vacío o no se encontró en el XML.");
    }

    //// Extraer campos del XML utilizando expresiones XPath ////

    // 1. NIT DE LA EMPRESA ADQUIRIENTE
    const customerNit = select("//cac:ReceiverParty/cac:PartyTaxScheme/cbc:CompanyID/text() | //cac:AccountingCustomerParty/cac:Party/cac:PartyTaxScheme/cbc:CompanyID/text()", document)[0]?.nodeValue || null;

    // 2. TIPO DE DOCUMENTO
    let DocumentTypeTemp = "";
    // Buscar el nodo 'Description' en el XML principal
    if (embeddedXml) {
      // Obtener el nodo raíz del XML embebido
      const rootNode = embeddedXml.documentElement;
      if (rootNode) {
        // Verificar si es 'Invoice' o 'CreditNote'
        const rootNodeName = rootNode.nodeName.toUpperCase();
        if (rootNodeName === "INVOICE") {
          DocumentTypeTemp = "Factura electrónica";
        } else if (rootNodeName === "CREDITNOTE") {
          DocumentTypeTemp = "Nota crédito";
        }
      } else {
        log(
          "No se encontró el nodo Invoice o CreditNote en el XML embebido."
        );
      }
    } else {
      // Si no hay XML embebido válido, seguir usando el documento principal
      const rootNode = document.documentElement;
      if (rootNode) {
        const rootNodeName = rootNode.nodeName.toUpperCase();
        if (rootNodeName === "INVOICE") {
          DocumentTypeTemp = "Factura electrónica";
        } else if (rootNodeName === "CREDITNOTE") {
          DocumentTypeTemp = "Nota crédito";
        }
      }
    }
    const DocumentType = DocumentTypeTemp;

    // 3. FECHA DE EMISIÓN
    const issueDate = select("//cbc:IssueDate/text()", document)[0]?.nodeValue || null;

    // 4. CUFE (Código único de factura electrónica)
    const cufe = select("//cac:ParentDocumentLineReference/cac:DocumentReference/cbc:UUID/text() | //cbc:UUID/text()", document)[0]?.nodeValue || null;

    // 5. TIPO DE PAGO (FORMA DE PAGO)
    let paymentTypeTemp = "";
    // Buscar el nodo 'cbc:ID' dentro de 'cac:PaymentMeans' en el XML embebido primero
    if (embeddedXml) {
      const paymentMeansID = select("//cac:PaymentMeans/cbc:ID/text()", embeddedXml)[0]?.nodeValue ?? null;
      // Validar el valor del tipo de pago
      if (paymentMeansID === "1") {
        paymentTypeTemp = "contado";
      } else if (paymentMeansID === "2") {
        paymentTypeTemp = "credito";
      } else {
        log("No se encontró tipo de pago válido en el XML embebido.");
      }
    } else {
      // Si no se encuentra en el XML embebido, buscar en el XML principal
      const paymentMeansID = select("//cac:PaymentMeans/cbc:ID/text()", document)[0]?.nodeValue ?? null;

      // Validar el valor del tipo de pago
      if (paymentMeansID === "1") {
        paymentTypeTemp = "contado";
      } else if (paymentMeansID === "2") {
        paymentTypeTemp = "credito";
      } else {
        log("No se encontró tipo de pago válido en el XML principal.");
      }
    }

    // Asignar el tipo de pago
    const paymentType = paymentTypeTemp;

    // Retornar todos los campos extraídos
    return {
      customerNit,
      DocumentType,
      issueDate,
      cufe,
      paymentType
    };
  } catch (error) {
    logError("[Error] Error al procesar el XML:", error);
    console.error("[Error] Error al procesar el XML:", error);
    throw error; // Re-lanzar el error para que la llamada superior lo maneje
  }

}

module.exports = { parseXML };
