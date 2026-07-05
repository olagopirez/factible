/**
 * Transporte hacia DGI — contrato y utilidades SOAP.
 *
 * Operaciones del WS de recepción (ws_efactura / ws_eprueba):
 *   - EFACRECEPCIONSOBRE:      envía un sobre; responde ACKSobre.
 *   - EFACRECEPCIONREPORTE:    envía el reporte diario; responde ACKRepDiario.
 *   - EFACCONSULTARESTADOENVIO: con id de recepción + token del ACKSobre,
 *                               devuelve el ACKCFE (resultado por comprobante).
 *
 * ⚠️ TODO homologación (ver TODO.md): nombres exactos de los elementos del
 * envelope (Datain/xmlData), SOAPAction y si exige WS-Security además del
 * TLS con certificado cliente. Se confirman contra el WSDL real; por eso
 * todo es configurable y la capa HTTP es inyectable.
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

const escXml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Construye el envelope SOAP 1.1 de una operación DGI. */
export function buildSoapEnvelope(operacion: string, xmlData: string, extra?: Record<string, string>): string {
  const extras = Object.entries(extra ?? {})
    .map(([k, v]) => `<${k}>${escXml(v)}</${k}>`)
    .join('');
  return (
    '<?xml version="1.0" encoding="UTF-8"?>' +
    '<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:dgi="DGI">' +
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
