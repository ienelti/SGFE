const { DOMParser } = require("xmldom");
const xpath = require("xpath");
const xml2js = require("xml2js");

// Función para analizar el XML directamente desde el contenido
async function parseXML(xmlContent, log, logError) {
  try {
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
        logError("Error al parsear el XML embebido:", error);
        console.error("Error al parsear el XML embebido:", error);
        embeddedXml = null;
      }
    } else {
      log("El nodo Description está vacío o no se encontró en el XML.");
    }

    // Función auxiliar para normalizar valores numéricos
    const normalizeNumeric = (value) => {
      if (typeof value !== "string") {
        // Si no es una cadena, convertir a número flotante directamente
        return parseFloat(value) || 0;
      }

      // Caso 1: Si el número tiene un punto como separador de decimales
      if (/^-?\d+(\.\d+)?$/.test(value)) {
        return parseFloat(value);
      }

      // Caso 2: Si el número tiene una coma como separador de decimales
      if (/^-?\d+(,\d+)?$/.test(value)) {
        return parseFloat(value.replace(",", "."));
      }

      // Caso 3: Si el número tiene comas como separadores de miles y punto como separador decimal
      if (/^-?[\d,]+(\.\d+)?$/.test(value)) {
        return parseFloat(value.replace(/,/g, ""));
      }

      // Caso 4: Si el número tiene puntos como separadores de miles y coma como separador decimal
      if (/^-?[\d.]+(,\d+)?$/.test(value)) {
        return parseFloat(value.replace(/\./g, "").replace(",", "."));
      }

      // Caso 5: Para cualquier otro caso, eliminar todos los puntos y comas, y agregar `.00`
      const numericValue = value.replace(/[.,]/g, "");
      return parseFloat(numericValue) || 0.00;
    };

    //// Extraer campos del XML utilizando expresiones XPath ////

    /****************************************
      <<<<<<<<<< VALORES TOTALES >>>>>>>>>>
    ****************************************/

    // SUBTOTAL
    const subtotal = normalizeNumeric(select("//cac:LegalMonetaryTotal/cbc:LineExtensionAmount/text()", embeddedXml || document)[0]?.nodeValue ?? 0);

    // TAX TOTAL E IMPUESTO A BOLSA
    // Seleccionar todos los nodos `<TaxTotal>` que no estén dentro de `<cac:InvoiceLine>`
    const taxTotalNodes = embeddedXml
      ? select("//cac:TaxTotal[not(ancestor::cac:InvoiceLine)]", embeddedXml)
      : select("//cac:TaxTotal[not(ancestor::cac:InvoiceLine)]", document);

    // Inicializar variables para los impuestos
    let taxTotal = 0; // TAX TOTAL
    let incBolsaTotal = 0; // IMPUESTO A BOLSA

    // Iterar sobre cada nodo `<TaxTotal>` para determinar el tipo de impuesto
    for (const node of taxTotalNodes) {
      // Extraer el nombre del impuesto
      const taxName = select(
        "./cac:TaxSubtotal/cac:TaxCategory/cac:TaxScheme/cbc:Name/text()",
        node
      )[0]?.nodeValue || "";

      // Extraer el valor del impuesto
      const taxAmount = normalizeNumeric(
        select("./cbc:TaxAmount/text()", node)[0]?.nodeValue || "0"
      );

      /// Asignar el valor según el nombre del impuesto
      if (taxName === "IVA" || taxName === "INC") {
        taxTotal = normalizeNumeric(taxAmount); // Asignar al total de IVA o INC
      } else if (taxName === "INC Bolsas") {
        incBolsaTotal = normalizeNumeric(taxAmount); // Asignar al total de impuesto de bolsas
      }
    }

    let incBolsaNombre = "INC Bolsas"; // NOMBRE DEL IMPUESTO A BOLSA

    // AJUSTE A VUELTAS
    const ajusteVueltas = normalizeNumeric(select("//cac:LegalMonetaryTotal/cbc:PayableRoundingAmount/text()", embeddedXml || document)[0]?.nodeValue ?? 0);
    
    // PROPINA
    const propina = (() => {
      const firstValue = normalizeNumeric(
          select("//cac:AllowanceCharge/cbc:Amount/text()", embeddedXml || document)[0]?.nodeValue || 0
      );
      if (firstValue !== 0) return firstValue;
  
      // Si no se encuentra nada en la primera ruta, intentar con la segunda
      return normalizeNumeric(
        select("//cac:InvoiceLine/cac:AllowanceCharge/cbc:Amount/text()", embeddedXml || document)[0]?.nodeValue || 0
      );
    })();

    const propinaDescripcion = (() => {
      const firstValue = select("//cac:AllowanceCharge/cbc:AllowanceChargeReason/text()", embeddedXml || document)[0]?.nodeValue || 'Otras deducciones, cargos o impuestos';
      if (firstValue !== 'Otras deducciones, cargos o impuestos') return firstValue;
  
      // Si no se encuentra nada en la primera ruta, intentar con la segunda
      return select("//cac:InvoiceLine/cac:AllowanceCharge/cbc:AllowanceChargeReason/text()", embeddedXml || document)[0]?.nodeValue || 'Otras deducciones, cargos o impuestos';
    })();

    // VALOR TOTAL
    const totalValor = normalizeNumeric(select("//cac:LegalMonetaryTotal/cbc:PayableAmount/text()", embeddedXml || document)[0]?.nodeValue ?? 0);

    // CUFE (Código Único de Factura Electrónica)
    const cufe = select("//cac:ParentDocumentLineReference/cac:DocumentReference/cbc:UUID/text() | //cbc:UUID/text()", document)[0]?.nodeValue || 'N/A';

    // TIPO DE DOCUMENTO
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
        } else {
          DocumentTypeTemp = 'N/A';
        }
      }
    }
    const DocumentType = DocumentTypeTemp;

    // TIPO DE DOCUMENTO PARA ODOO
    let DocumentTypeTemp2 = "";
    // Buscar el nodo 'Description' en el XML principal
    if (embeddedXml) {
      // Obtener el nodo raíz del XML embebido
      const rootNode = embeddedXml.documentElement;
      if (rootNode) {
        // Verificar si es 'Invoice' o 'CreditNote'
        const rootNodeName = rootNode.nodeName.toUpperCase();
        if (rootNodeName === "INVOICE") {
          DocumentTypeTemp2 = "Facturas de Proveedores";
        } else if (rootNodeName === "CREDITNOTE") {
          DocumentTypeTemp2 = "Nota crédito";
        }
      }
    } else {
      // Si no hay XML embebido válido, seguir usando el documento principal
      const rootNode = document.documentElement;
      if (rootNode) {
        const rootNodeName = rootNode.nodeName.toUpperCase();
        if (rootNodeName === "INVOICE") {
          DocumentTypeTemp2 = "Factura electrónica";
        } else if (rootNodeName === "CREDITNOTE") {
          DocumentTypeTemp2 = "Notas Credito Proveedores";
        } else {
          DocumentTypeTemp2 = 'N/A';
        }
      }
    }
    const DocumentType2 = DocumentTypeTemp2;

    // CONSECUTIVO DE FACTURA
    const consecutiveInvoice = select("//cbc:ID/text()", document)[0]?.nodeValue || 'N/A';

    // PREFIJO O NÚMERO RELACIONADO
    let prefixNumberTemp = select("//cbc:ParentDocumentID/text()", document)[0]?.nodeValue ?? 'N/A';
    if (prefixNumberTemp === 'N/A') {
      prefixNumberTemp = select("//cbc:ID/text()", document)[0]?.nodeValue ?? 'N/A';
      if (prefixNumberTemp === 'N/A') {
        log("No se halla prefijo");
      }
    }
    const prefixNumber = prefixNumberTemp;

    // EMPRESA EMISORA
    const issuerCompany = select("//cac:SenderParty/cac:PartyTaxScheme/cbc:RegistrationName/text() | //cac:AccountingSupplierParty/cac:Party/cac:PartyTaxScheme/cbc:RegistrationName/text()", document)[0]?.nodeValue || 'N/A';

    // NIT DE LA EMPRESA EMISORA
    const issuerNit = select("//cac:SenderParty/cac:PartyTaxScheme/cbc:CompanyID/text() | //cac:AccountingSupplierParty/cac:Party/cac:PartyTaxScheme/cbc:CompanyID/text()", document)[0]?.nodeValue || 'N/A';

    // FECHA DE EMISIÓN
    const issueDate = select("//cbc:IssueDate/text()", document)[0]?.nodeValue || '0000-00-00';

    // FECHA DE VENCIMIENTO
    let expirationDateTemp = "";
    // Buscar el nodo 'Description' en el XML principal
    if (embeddedXml) {
      // Obtener el valor en el XML embebido
      expirationDateTemp = select("//cac:PaymentMeans/cbc:PaymentDueDate/text()", embeddedXml)[0]?.nodeValue ?? '0000-00-00';
    } else {
      // Si no se encontró o está vacío, buscar en el XML principal
      expirationDateTemp = select("//cac:PaymentMeans/cbc:PaymentDueDate/text()", document)[0]?.nodeValue ?? '0000-00-00';
    }
    // Asignar la fecha de vencimiento, si el valor es '0000-00-00', asignar la fecha de emisión
    const expirationDate = expirationDateTemp !== '0000-00-00' ? expirationDateTemp : issueDate;
    

    /*****************************************
      <<<<<<<<<< VALORES POR ÍTEM >>>>>>>>>>
    *****************************************/

    // Determinar el nodo de línea según el tipo de documento
    const lineNodeName = DocumentType === "Factura electrónica" ? "InvoiceLine"
      : DocumentType === "Nota crédito" ? "CreditNoteLine"
      : null;

    if (!lineNodeName) {
    logError("No se pudo determinar el tipo de nodo de línea para este documento.");
    throw new Error("Tipo de documento no reconocido.");
    }

    // Seleccionar todos los nodos de ítems en el XML embebido o principal
    const invoiceLineNodes = embeddedXml
      ? select(`//cac:${lineNodeName}`, embeddedXml)
      : select(`//cac:${lineNodeName}`, document);

    // Inicializar el array para almacenar los ítems extraídos
    const items = [];

    // Iterar sobre cada nodo `<InvoiceLine>` para extraer sus datos
    for (const node of invoiceLineNodes) {
      // Función auxiliar para buscar en ambos XML
      const getValue = (xpath, currentNode) => {
        const embeddedValue = embeddedXml
          ? select(xpath, currentNode || embeddedXml)[0]?.nodeValue
          : 0;
        if (embeddedValue) return embeddedValue;

        // Si no se encuentra en embeddedXml, buscar en document
        return select(xpath, currentNode || document)[0]?.nodeValue ?? 0;
      };

      // Función auxiliar para obtener el valor según las rutas definidas
      const getPrioritizedValue = (node, paths) => {
        for (const path of paths) {
          const value = normalizeNumeric(getValue(path, node));
          if (value !== 0) return value; // Si encuentra un valor válido, lo retorna
        }
        return 0; // Si ninguna ruta tiene valor, retorna 0 por defecto
      };

      // Extraer cada campo dentro del nodo actual `<InvoiceLine>`
      const item = getValue("./cbc:ID/text()", node);
      const codigo = getValue("./cac:Item/cac:StandardItemIdentification/cbc:ID/text()", node);
      const descripcion = getValue("./cac:Item/cbc:Description/text()", node);
      const cantidad = normalizeNumeric(getValue("./cbc:InvoicedQuantity/text()", node) || 1);

      // Asignar valores a las constantes según el orden de las rutas
      const valorUniXCant = getPrioritizedValue(node, [
        "./cbc:Note[@languageLocaleID='linea2']/text()",
        "./cbc:Note[@languageLocaleID='linea1']/text()",
        "./cac:Price/cbc:PriceAmount/text()",
        "./cbc:LineExtensionAmount/text()",
      ]);
      const taxValorXCant = getPrioritizedValue(node, [
        "./cac:TaxTotal/cbc:TaxAmount/text()",
        "./cac:TaxTotal/cac:TaxSubtotal/cbc:TaxAmount/text()",
      ]);
      const valorUniSinIvaXCant = (() => {
        const prioritizedValue = getPrioritizedValue(node, [
          "./cac:TaxTotal/cac:TaxSubtotal/cbc:TaxableAmount/text()",
          "./cbc:LineExtensionAmount/text()",
          "./cac:Price/cbc:PriceAmount/text()"
        ]);
        
        return prioritizedValue !== 0 ? prioritizedValue : valorUniXCant-taxValorXCant; // Si no se encuentra, usar `valorUni-TaxValorUni`
      })();
      const valorTotalItem = (() => {
        const prioritizedValue = getPrioritizedValue(node, [
          "./cbc:Note[@languageLocaleID='linea1']/text()",
          "./cbc:Note[@languageLocaleID='linea2']/text()",
        ]);

        return prioritizedValue !== 0 ? prioritizedValue : valorUniXCant; // Si no se encuentra, usar `valorUni`
      })();

      const valorUni = normalizeNumeric(Number(valorUniXCant) / Number(cantidad));
      const TaxValorUni = normalizeNumeric(Number(taxValorXCant) / Number(cantidad));
      const valorUniSinIva = normalizeNumeric(Number(valorUniSinIvaXCant) / Number(cantidad));
      const taxTipo = getValue("./cac:TaxTotal/cac:TaxSubtotal/cac:TaxCategory/cac:TaxScheme/cbc:Name/text()", node);
      const taxPorcentaje = normalizeNumeric(getValue("./cac:TaxTotal/cac:TaxSubtotal/cac:TaxCategory/cbc:Percent/text()", node));

      // Constante que almacena el valorUni + el TaxValorUni solo si el taxTipo es 'INC'
      const valorUniSinIvaMasOtros = taxTipo === "INC" ? normalizeNumeric(valorUniSinIva + TaxValorUni) : valorUniSinIva;

      // Constante que almacena el TaxValorUni solo si el taxTipo es 'IVA'
      const iva = taxTipo === "IVA" ? TaxValorUni : 0;

      // Constante que almacena valorUniSinIvaMasOtros + el iva
      const total = normalizeNumeric(valorUniSinIvaMasOtros + iva);

      // TIPO DE DOCUMENTO
      let DocumentTypeItemTemp = "";
      // Buscar el nodo 'Description' en el XML principal
      if (embeddedXml) {
        // Obtener el nodo raíz del XML embebido
        const rootNode = embeddedXml.documentElement;
        if (rootNode) {
          // Verificar si es 'Invoice' o 'CreditNote'
          const rootNodeName = rootNode.nodeName.toUpperCase();
          if (rootNodeName === "INVOICE") {
            DocumentTypeItemTemp = "Facturas de Proveedores";
          } else if (rootNodeName === "CREDITNOTE") {
            DocumentTypeItemTemp = "Notas Credito Proveedores";
          }
        }
      } else {
        // Si no hay XML embebido válido, seguir usando el documento principal
        const rootNode = document.documentElement;
        if (rootNode) {
          const rootNodeName = rootNode.nodeName.toUpperCase();
          if (rootNodeName === "INVOICE") {
            DocumentTypeItemTemp = "Facturas de Proveedores";
          } else if (rootNodeName === "CREDITNOTE") {
            DocumentTypeItemTemp = "Notas Credito Proveedores";
          } else {
            DocumentTypeItemTemp = 'N/A';
          }
        }
      }
      const DocumentTypeItem = DocumentTypeItemTemp;

      const prefixNumberPago = prefixNumber;

      // Almacenar los datos del ítem en el array
      items.push({
        item,
        codigo,
        descripcion,
        cantidad,
        valorUniXCant,
        taxValorXCant,
        valorUniSinIvaXCant,
        valorTotalItem,
        valorUni,
        TaxValorUni,
        valorUniSinIva,
        taxTipo,
        taxPorcentaje,
        valorUniSinIvaMasOtros,
        iva,
        total,
        DocumentTypeItem,
        prefixNumberPago,
        cufe,
        consecutiveInvoice,
        prefixNumber,
        issuerCompany,
        issuerNit,
        issueDate,
        expirationDate
      });
    }

    //Total de artículos
    const totalArticulos = items.length || 0;

    // Retornar todos los campos extraídos
    return {
      items,
      totalArticulos,
      subtotal,
      taxTotal,
      incBolsaTotal,
      incBolsaNombre,
      ajusteVueltas,
      propina,
      propinaDescripcion,
      totalValor,
      cufe,
      DocumentType,
      DocumentType2,
      consecutiveInvoice,
      prefixNumber,
      issuerCompany,
      issuerNit,
      issueDate,
      expirationDate
    };

  } catch (error) {
    logError("Error al procesar el XML:", error);
    console.error("Error al procesar el XML:", error);
    throw error; // Re-lanzar el error para que la llamada superior lo maneje
  }

}

module.exports = { parseXML };