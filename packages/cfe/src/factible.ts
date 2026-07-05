/**
 * API de alto nivel: emitir un CFE en una sola llamada.
 * Encadena: numeración CAE → builder XML → firma → código de seguridad/QR.
 *
 * (El envío a DGI será parte de esta cadena cuando exista el transporte SOAP.)
 */
import { buildCfeXml } from './builder/xml.js';
import { calcularTotales } from './totales.js';
import { codigoSeguridad, codigoSeguridadImpreso, urlQr } from './qr/qr.js';
import { firmarCfe, type Certificado, type OpcionesFirma } from './signer/xmldsig.js';
import type { Cae, CaeStore } from './types/cae.js';
import type { CfeEmitido, CfeInput, Emisor } from './types/cfe.js';

export interface FactibleConfig {
  emisor: Emisor;
  certificado: Certificado;
  caeStore: CaeStore;
  firma?: OpcionesFirma;
}

export interface Emitido extends CfeEmitido {
  /** URL de verificación para el QR-Code del sello digital. */
  urlQr: string;
  /** Los 6 caracteres impresos bajo el QR. */
  codigoSeguridadImpreso: string;
  /** CAE utilizado (necesario para la representación impresa: rango y vencimiento). */
  cae: Cae;
}

export class Factible {
  constructor(private readonly config: FactibleConfig) {}

  /**
   * Emite un CFE: asigna numeración, construye el XML v25.2, lo firma y
   * calcula el sello digital. El emisor de la config se aplica si el input no trae uno.
   */
  async emitir(input: Omit<CfeInput, 'emisor'> & { emisor?: Emisor }): Promise<Emitido> {
    const completo: CfeInput = { ...input, emisor: input.emisor ?? this.config.emisor };
    const { cae, numero } = await this.config.caeStore.siguienteNumero(completo.tipo);

    const fechaFirma = new Date();
    const xml = buildCfeXml({ input: completo, serie: cae.serie, numero, cae, fechaFirma });
    const firmado = firmarCfe(xml, this.config.certificado, this.config.firma);

    return {
      tipo: completo.tipo,
      serie: cae.serie,
      numero,
      caeId: cae.id,
      fechaEmision: completo.fechaEmision ?? fechaFirma,
      totales: calcularTotales(completo),
      xml: firmado,
      codigoSeguridad: codigoSeguridad(firmado),
      codigoSeguridadImpreso: codigoSeguridadImpreso(firmado),
      urlQr: urlQr(firmado),
      cae,
    };
  }
}
