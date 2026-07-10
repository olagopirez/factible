/**
 * Cliente SOAP real contra DGI: HTTPS con certificado cliente (mTLS).
 *
 * Sin probar contra el ambiente real (requiere usuario de testing + certificado
 * de proveedor autorizado). La estructura del envelope y el SOAPAction se
 * confirman contra el WSDL en la primera conexión — ver TODO.md.
 */
import { request as httpsRequest } from 'node:https';
import { request as httpRequest } from 'node:http';
import {
  buildSoapEnvelope,
  extractSoapResult,
  ENDPOINTS,
  type DgiTransport,
} from './transporte.js';

export interface SoapClientConfig {
  ambiente: 'testing' | 'produccion';
  /** Certificado cliente para mTLS (el mismo del emisor). */
  cert: string;
  key: string;
  /** Override del endpoint (para proxies o cambios de DGI). */
  url?: string;
  timeoutMs?: number;
  /**
   * Verificar el certificado TLS del servidor contra las CAs del sistema.
   * Default: true. Solo ponerlo en false si el endpoint de DGI presenta un
   * certificado que no encadena a una CA pública (documentar el hallazgo).
   */
  verificarServidor?: boolean;
}

export class SoapDgiClient implements DgiTransport {
  constructor(private readonly config: SoapClientConfig) {}

  async enviarSobre(sobreXml: string): Promise<string> {
    return this.invocar('EFACRECEPCIONSOBRE', sobreXml);
  }

  async enviarReporte(reporteXml: string): Promise<string> {
    return this.invocar('EFACRECEPCIONREPORTE', reporteXml);
  }

  async consultarEstadoEnvio(idReceptor: number, token: string): Promise<string> {
    return this.invocar('EFACCONSULTARESTADOENVIO', '', {
      idReceptor: String(idReceptor),
      token,
    });
  }

  private invocar(operacion: string, xmlData: string, extra?: Record<string, string>): Promise<string> {
    const envelope = buildSoapEnvelope(operacion, xmlData, extra);
    const url = new URL(this.config.url ?? ENDPOINTS[this.config.ambiente]);
    // http solo para tests locales; DGI es siempre https con mTLS.
    const request = url.protocol === 'http:' ? httpRequest : httpsRequest;

    return new Promise((resolve, reject) => {
      const req = request(
        {
          hostname: url.hostname,
          port: url.port || (url.protocol === 'http:' ? 80 : 443),
          path: url.pathname,
          method: 'POST',
          cert: this.config.cert,
          key: this.config.key,
          rejectUnauthorized: this.config.verificarServidor ?? true,
          timeout: this.config.timeoutMs ?? 30_000,
          headers: {
            'Content-Type': 'text/xml; charset=utf-8',
            // Verbatim del WSDL real (spec/ws_eprueba.wsdl): sin barra tras "uy".
            SOAPAction: `http://dgi.gub.uyaction/AWS_EFACTURA.${operacion}`,
            'Content-Length': Buffer.byteLength(envelope),
          },
        },
        (res) => {
          let body = '';
          res.setEncoding('utf8');
          res.on('data', (c) => (body += c));
          res.on('end', () => {
            try {
              if ((res.statusCode ?? 500) >= 400 && !body.includes('faultstring')) {
                throw new Error(`DGI respondió HTTP ${res.statusCode}`);
              }
              resolve(extractSoapResult(body));
            } catch (e) {
              reject(e);
            }
          });
        },
      );
      req.on('timeout', () => req.destroy(new Error('Timeout esperando respuesta de DGI')));
      req.on('error', reject);
      req.write(envelope);
      req.end();
    });
  }
}
