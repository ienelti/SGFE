const fs = require("fs").promises;
const { DOMParser } = require("xmldom");
const xpath = require("xpath");
const xml2js = require("xml2js");

// Función para leer y analizar el XML
async function parseXMLContent(xmlContent, log, logError) {
  try {
      const document = new DOMParser().parseFromString(xmlContent, "text/xml");
  
      const namespaces = {
        cbc: "urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2",
        cac: "urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2",
      };
  
      const select = xpath.useNamespaces(namespaces);
  
      // PARSEO JSON para buscar el nodo con el XML embebido
      const parser = new xml2js.Parser({ explicitArray: false, mergeAttrs: true });
      const jsonResult = await parser.parseStringPromise(xmlContent);
  
      const descriptionNodeContent =
        jsonResult?.["AttachedDocument"]?.["cac:Attachment"]?.["cac:ExternalReference"]?.["cbc:Description"] || "";
  
      let embeddedXml = null;
  
      if (descriptionNodeContent) {
        const cleanContent = descriptionNodeContent
          .replace(/^<!\[CDATA\[/, "")
          .replace(/\]\]>$/, "")
          .trim();
  
        try {
          embeddedXml = new DOMParser().parseFromString(cleanContent, "text/xml");
          log("XML embebido detectado y parseado.");
        } catch (error) {
          log("No se pudo parsear el XML embebido. Se usará el XML principal.");
          embeddedXml = null;
        }
      }
  
      const xmlSource = embeddedXml || document;
  
      // ➤ CUFE
      const cufe = select(
        "//cac:ParentDocumentLineReference/cac:DocumentReference/cbc:UUID/text() | //cbc:UUID/text()",
        xmlSource
      )[0]?.nodeValue || null;
  
      // ➤ Tipo de documento (INVOICE o CREDITNOTE)
      const rootNodeName = xmlSource.documentElement?.nodeName?.toUpperCase() || "";
      let documentType = "";
      if (rootNodeName === "INVOICE") {
        documentType = "Factura electrónica";
      } else if (rootNodeName === "CREDITNOTE") {
        documentType = "Nota crédito";
      }
  
      // ➤ Tipo de pago (1 = contado, 2 = crédito)
      let paymentType = "";
      const paymentMeansID = select("//cac:PaymentMeans/cbc:ID/text()", xmlSource)[0]?.nodeValue || null;
  
      if (paymentMeansID === "1") {
        paymentType = "contado";
      } else if (paymentMeansID === "2") {
        paymentType = "credito";
      }
  
      return {
        cufe,
        documentType,
        paymentType,
      };
  } catch (error) {
    logError("Error al analizar contenido XML:", error);
    console.error("Error al analizar contenido XML:", error);
    throw error; // Re-lanzar el error para que la llamada superior lo maneje
  }
}

module.exports = { parseXMLContent };