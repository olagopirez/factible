/**
 * @factible/cfe — Facturación electrónica DGI (Uruguay) para desarrolladores.
 *
 * Estado: esqueleto en desarrollo. Ver README y docs/protocolo-dgi.md.
 */
export * from './types/cfe.js';
export * from './types/cae.js';
export { calcularTotales, TASA_BASICA, TASA_MINIMA } from './totales.js';
export { buildCfeXml, type BuildParams } from './builder/xml.js';
export { firmarCfe, firmarReporte, verificarFirmaCfe, type Certificado, type OpcionesFirma } from './signer/xmldsig.js';
export { crearReporteDiario, type ReporteParams } from './reporte/diario.js';
export {
  parseAcuseSobre,
  parseAcuseCfe,
  MOTIVOS_RECHAZO_SOBRE,
  MOTIVOS_RECHAZO_CFE,
  type AcuseSobre,
  type AcuseCfe,
  type AcuseCfeDetalle,
  type MotivoRechazo,
} from './acuses/acuses.js';
export { crearSobre, RUT_DGI, type SobreParams } from './sobre/sobre.js';
export { codigoSeguridad, codigoSeguridadImpreso, urlQr } from './qr/qr.js';
export { MemoryCaeStore } from './cae/memory-store.js';
export { Factible, type FactibleConfig, type Emitido } from './factible.js';
export { representacionImpresa, type OpcionesImpresion } from './impresion/html.js';
export { buildSoapEnvelope, extractSoapResult, ENDPOINTS, type DgiTransport } from './transporte/transporte.js';
export { SoapDgiClient, type SoapClientConfig } from './transporte/soap-client.js';
export { MockDgiTransport, type MockConfig } from './transporte/mock.js';
export { enviarSobreADgi, type ResultadoEnvio, type OpcionesEnvio } from './transporte/flujo.js';

// Módulos en construcción (ver roadmap en README):
// export { DgiClient } from './transport/dgi.js';      // SOAP + WS-Security (testing/prod)
// export { reporteDiario } from './reporte/diario.js'; // Reporte v13.2
