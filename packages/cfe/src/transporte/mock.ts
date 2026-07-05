/**
 * MockDgiTransport: simulador de DGI para desarrollo y tests — tuyo y de quien
 * use la lib. Acepta todo por defecto; configurable para simular rechazos.
 */
import { DOMParser } from '@xmldom/xmldom';
import type { DgiTransport } from './transporte.js';

export interface MockConfig {
  /** Rechazar el sobre con estos motivos (S01-S20). */
  rechazarSobre?: string[];
  /** Rechazar CFEs puntuales: clave "serie-numero", valor motivos (E01-E15). */
  rechazarCfes?: Record<string, string[]>;
  /** Fechahora de consulta relativa a ahora, en ms. Default: 0 (consultable ya). */
  demoraConsultaMs?: number;
}

const NS = 'http://cfe.dgi.gub.uy';

export class MockDgiTransport implements DgiTransport {
  private secuencia = 1000;
  private pendientes = new Map<string, { cfes: { tipo: string; serie: string; numero: string }[] }>();

  constructor(private readonly config: MockConfig = {}) {}

  async enviarSobre(sobreXml: string): Promise<string> {
    const doc = new DOMParser().parseFromString(sobreXml, 'text/xml');
    const texto = (tag: string) =>
      doc.getElementsByTagNameNS(NS, tag).item(0)?.textContent ?? '';
    const idRespuesta = this.secuencia++;
    const idReceptor = this.secuencia++;
    const cantidad = Number(texto('CantCFE'));

    if (this.config.rechazarSobre?.length) {
      const motivos = this.config.rechazarSobre
        .map((m) => `<MotivosRechazo><Motivo>${m}</Motivo></MotivosRechazo>`)
        .join('');
      return this.ackSobre(texto('RUCEmisor'), idRespuesta, texto('Idemisor'), idReceptor, cantidad, `<Estado>BS</Estado>${motivos}`);
    }

    // Registra los CFEs del sobre para responder la consulta posterior.
    const cfes: { tipo: string; serie: string; numero: string }[] = [];
    const idDocs = doc.getElementsByTagNameNS(NS, 'IdDoc');
    for (let i = 0; i < idDocs.length; i++) {
      const d = idDocs.item(i)!;
      const get = (tag: string) => d.getElementsByTagNameNS(NS, tag).item(0)?.textContent ?? '';
      cfes.push({ tipo: get('TipoCFE'), serie: get('Serie'), numero: get('Nro') });
    }
    const token = Buffer.from(`tok-${idReceptor}`).toString('base64');
    this.pendientes.set(`${idReceptor}:${token}`, { cfes });

    const desde = new Date(Date.now() + (this.config.demoraConsultaMs ?? 0));
    const consulta = `<ParamConsulta><Token>${token}</Token><Fechahora>${desde.toISOString().slice(0, 19)}-03:00</Fechahora></ParamConsulta>`;
    return this.ackSobre(texto('RUCEmisor'), idRespuesta, texto('Idemisor'), idReceptor, cantidad, `<Estado>AS</Estado>${consulta}`);
  }

  async enviarReporte(_reporteXml: string): Promise<string> {
    return `<?xml version="1.0"?><ACKRepDiario xmlns="${NS}"><Estado>AR</Estado></ACKRepDiario>`;
  }

  async consultarEstadoEnvio(idReceptor: number, token: string): Promise<string> {
    const envio = this.pendientes.get(`${idReceptor}:${token}`);
    if (!envio) throw new Error('Mock: idReceptor/token desconocidos');

    let aceptados = 0;
    let rechazados = 0;
    const dets = envio.cfes
      .map((c, i) => {
        const motivos = this.config.rechazarCfes?.[`${c.serie}-${c.numero}`];
        const rechazado = !!motivos?.length;
        rechazado ? rechazados++ : aceptados++;
        const cuerpoMotivos = (motivos ?? [])
          .map((m) => `<MotivosRechazoCF><Motivo>${m}</Motivo></MotivosRechazoCF>`)
          .join('');
        return (
          `<ACKCFE_Det><Nro_ordinal>${i + 1}</Nro_ordinal><TipoCFE>${c.tipo}</TipoCFE>` +
          `<Serie>${c.serie}</Serie><NroCFE>${c.numero}</NroCFE>` +
          `<Estado>${rechazado ? 'BE' : 'AE'}</Estado>${cuerpoMotivos}</ACKCFE_Det>`
        );
      })
      .join('');

    return (
      `<?xml version="1.0"?><ACKCFE xmlns="${NS}" version="1.0"><Caratula>` +
      `<RUCReceptor>219999830019</RUCReceptor><RUCEmisor>-</RUCEmisor>` +
      `<IDRespuesta>${this.secuencia++}</IDRespuesta><IDEmisor>0</IDEmisor><IDReceptor>${idReceptor}</IDReceptor>` +
      `<CantCFEAceptados>${aceptados}</CantCFEAceptados><CantCFERechazados>${rechazados}</CantCFERechazados>` +
      `</Caratula>${dets}</ACKCFE>`
    );
  }

  private ackSobre(ruc: string, idResp: number, idEmisor: string, idReceptor: number, cant: number, detalle: string): string {
    return (
      `<?xml version="1.0"?><ACKSobre xmlns="${NS}" version="1.0"><Caratula>` +
      `<RUCReceptor>219999830019</RUCReceptor><RUCEmisor>${ruc}</RUCEmisor>` +
      `<IDRespuesta>${idResp}</IDRespuesta><NomArch>sobre.xml</NomArch>` +
      `<FecHRecibido>${new Date().toISOString().slice(0, 19)}-03:00</FecHRecibido>` +
      `<IDEmisor>${idEmisor}</IDEmisor><IDReceptor>${idReceptor}</IDReceptor>` +
      `<CantidadCFE>${cant}</CantidadCFE><Tmst>${new Date().toISOString().slice(0, 19)}-03:00</Tmst>` +
      `</Caratula><Detalle>${detalle}</Detalle></ACKSobre>`
    );
  }
}
