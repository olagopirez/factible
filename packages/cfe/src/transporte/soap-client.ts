/**
 * Cliente SOAP real contra DGI.
 *
 * Contrato confirmado contra el WSDL y el manual oficial (ver transporte.ts y
 * spec/). El envelope va con el Body firmado (WS-Security, obligatorio); el
 * certificado cliente se presenta ademas en el TLS aunque el handshake no lo
 * exige — no hace daño y es lo que hacen los clientes GeneXus.
 */
import { request as httpsRequest } from 'node:https';
import { request as httpRequest } from 'node:http';
import { extractSoapResult, ENDPOINTS, type DgiTransport } from './transporte.js';
import { buildSoapEnvelopeWss, xmlDataConsulta } from './wss.js';

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
  /**
   * Algoritmo de la firma WS-Security del envelope. El ejemplo oficial y las
   * respuestas de DGI usan sha1; default sha256 hasta confirmar qué acepta.
   */
  algoritmoWss?: 'sha256' | 'sha1';
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
    // Formato del manual oficial (spec/ws-externos-recepcion.pdf §CONSULTARESTADOENVIO).
    return this.invocar('EFACCONSULTARESTADOENVIO', xmlDataConsulta(idReceptor, token));
  }

  private invocar(operacion: string, xmlData: string): Promise<string> {
    // WS-Security obligatorio: Body firmado (ver wss.ts).
    const envelope = buildSoapEnvelopeWss(
      operacion,
      xmlData,
      { cert: this.config.cert, privateKey: this.config.key },
      { algoritmo: this.config.algoritmoWss ?? 'sha256' },
    );
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
            // Entre comillas: SOAP 1.1 define SOAPAction como quoted string.
            SOAPAction: `"http://dgi.gub.uyaction/AWS_EFACTURA.${operacion}"`,
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
