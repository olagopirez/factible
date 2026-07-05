/**
 * Sobre de envío de CFEs a DGI (EnvioCFE, Formato Sobre v05 / XSD EnvioCFE.xsd).
 *
 * Estructura: Caratula (RUT receptor, RUT emisor, id de envío, cantidad, fecha,
 * certificado) seguida de 1 a 250 CFEs firmados.
 *
 * Nota: el sobre a DGI NO lleva adenda (esa va solo en el sobre entre empresas,
 * EnvioCFE_entreEmpresas.xsd).
 */

/**
 * RUT de DGI como receptor de los sobres.
 * ⚠️ TODO (ver TODO.md): confirmar contra el ejemplo de sobre oficial antes de
 * usar en testing/producción.
 */
export const RUT_DGI = '219999830019';

export interface SobreParams {
  /** RUT del emisor de los CFEs. */
  rucEmisor: string;
  /** RUT del receptor del sobre. Para envíos a DGI usar RUT_DGI. */
  rutReceptor: string;
  /** Número secuencial asignado por el emisor a este envío (hasta 10 dígitos). */
  idEmisor: number;
  /** CFEs ya firmados (output de firmarCfe), entre 1 y 250. */
  cfesFirmados: string[];
  /** Certificado X.509 PEM (el mismo usado para firmar). */
  cert: string;
  fecha?: Date;
}

const fechaHoraUy = (d: Date) => {
  const uy = new Date(d.getTime() - 3 * 3600 * 1000);
  return `${uy.toISOString().slice(0, 19)}-03:00`;
};

/** Quita la declaración <?xml?> y el xmlns redundante para anidar el CFE en el sobre. */
const prepararCfe = (xml: string): string => {
  const sinDecl = xml.replace(/^\s*<\?xml[^?]*\?>\s*/, '');
  if (!/^<CFE[\s>]/.test(sinDecl)) {
    throw new Error('Cada elemento de cfesFirmados debe ser un <CFE> (output de firmarCfe)');
  }
  return sinDecl;
};

export function crearSobre(p: SobreParams): string {
  if (p.cfesFirmados.length < 1 || p.cfesFirmados.length > 250) {
    throw new Error(`El sobre admite entre 1 y 250 CFEs (recibidos: ${p.cfesFirmados.length})`);
  }
  if (!Number.isInteger(p.idEmisor) || p.idEmisor < 0 || String(p.idEmisor).length > 10) {
    throw new Error('idEmisor debe ser un entero ≥0 de hasta 10 dígitos');
  }

  const certBody = p.cert.replace(/-----(BEGIN|END) CERTIFICATE-----|\s/g, '');
  const cfes = p.cfesFirmados.map(prepararCfe).join('');

  const caratula =
    '<Caratula version="1.0">' +
    `<RutReceptor>${p.rutReceptor}</RutReceptor>` +
    `<RUCEmisor>${p.rucEmisor}</RUCEmisor>` +
    `<Idemisor>${p.idEmisor}</Idemisor>` +
    `<CantCFE>${p.cfesFirmados.length}</CantCFE>` +
    `<Fecha>${fechaHoraUy(p.fecha ?? new Date())}</Fecha>` +
    `<X509Certificate>${certBody}</X509Certificate>` +
    '</Caratula>';

  return `<EnvioCFE xmlns="http://cfe.dgi.gub.uy" version="1.0">${caratula}${cfes}</EnvioCFE>`;
}
