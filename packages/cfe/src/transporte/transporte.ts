/**
 * Transporte hacia DGI — contrato y utilidades SOAP.
 *
 * Operaciones del WS de recepción (ws_efactura / ws_eprueba):
 *   - EFACRECEPCIONSOBRE:      envía un sobre; responde ACKSobre.
 *   - EFACRECEPCIONREPORTE:    envía el reporte diario; responde ACKRepDiario.
 *   - EFACCONSULTARESTADOENVIO: con id de recepción + token del ACKSobre,
 *                               devuelve el ACKCFE (resultado por comprobante).
 *
 * Contrato confirmado contra el WSDL REAL del ambiente de Testing
 * (spec/ws_eprueba.wsdl, obtenido de {endpoint}?wsdl el 2026-07-09):
 *   - namespace: http://dgi.gub.uy (binding document/literal)
 *   - elementos: WS_eFactura.EFACRECEPCIONSOBRE / EFACRECEPCIONREPORTE /
 *     EFACCONSULTARESTADOENVIO (+Response)
 *   - SOAPAction: "http://dgi.gub.uyaction/AWS_EFACTURA.<OPERACION>"
 *     (sic: sin barra entre "uy" y "action", y con prefijo A — verbatim WSDL)
 *   - el handshake TLS NO exige certificado cliente (validado 2026-07-09)
 *   - la policy del WSDL declara WS-Security SignedParts (Body) — ⚠️ TODO:
 *     confirmar si se exige en la práctica o solo se "soporta" (DataPower)
 * Payload confirmado por el XSD del contrato (spec/ws_eprueba.xsd1.xsd) y el
 * manual oficial (spec/ws-externos-recepcion.pdf): Datain{xmlData}; la consulta
 * manda dentro de xmlData un <ConsultaCFE> con IdReceptor y Token.
 * WS-Security es OBLIGATORIO (fault "No signature in message!") — ver wss.ts.
 */

/** Contrato del transporte. Implementaciones: SoapDgiClient (real), MockDgiTransport (tests). */
export interface DgiTransport {
  /** Envía un sobre firmado. Devuelve el XML del ACKSobre. */
  enviarSobre(sobreXml: string): Promise<string>;
  /** Envía un reporte diario firmado. Devuelve el XML del acuse de reporte. */
  enviarReporte(reporteXml: string): Promise<string>;
  /** Consulta el resultado por CFE de un envío aceptado. Devuelve el XML del ACKCFE. */
  consultarEstadoEnvio(idReceptor: number, token: string): Promise<string>;
}

export const ENDPOINTS = {
  testing: 'https://efactura.dgi.gub.uy:6443/ePrueba/ws_eprueba',
  produccion: 'https://efactura.dgi.gub.uy:6443/eFactura/ws_efactura',
} as const;

export const escXml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Construye el envelope SOAP 1.1 de una operación DGI. */
export function buildSoapEnvelope(operacion: string, xmlData: string, extra?: Record<string, string>): string {
  const extras = Object.entries(extra ?? {})
    .map(([k, v]) => `<${k}>${escXml(v)}</${k}>`)
    .join('');
  return (
    '<?xml version="1.0" encoding="UTF-8"?>' +
    '<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:dgi="http://dgi.gub.uy">' +
    '<soapenv:Body>' +
    `<dgi:WS_eFactura.${operacion}>` +
    `<dgi:Datain><dgi:xmlData>${escXml(xmlData)}</dgi:xmlData>${extras}</dgi:Datain>` +
    `</dgi:WS_eFactura.${operacion}>` +
    '</soapenv:Body>' +
    '</soapenv:Envelope>'
  );
}

/** Extrae el payload XML (xmlData) de la respuesta SOAP de DGI. */
export function extractSoapResult(soapXml: string): string {
  // Falla SOAP explícita
  const fault = soapXml.match(/<(?:\w+:)?faultstring[^>]*>([\s\S]*?)<\/(?:\w+:)?faultstring>/i);
  if (fault) throw new Error(`SOAP Fault de DGI: ${fault[1]!.trim()}`);

  const m = soapXml.match(/<(?:\w+:)?xmlData[^>]*>([\s\S]*?)<\/(?:\w+:)?xmlData>/);
  if (!m) throw new Error('Respuesta SOAP sin <xmlData>');
  return m[1]!
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&');
}
