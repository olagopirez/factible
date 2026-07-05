/**
 * Parseo de acuses de DGI (Mensajes de Respuesta v19 / XSDs ACKSobre y ACKCFE_DGI).
 *
 * Flujo de respuesta de DGI:
 *   1. ACKSobre (sincrónico): estado AS (recibido) o BS (rechazado). Si AS, trae
 *      ParamConsulta (Token + Fechahora) para consultar el segundo mensaje.
 *   2. ACKCFE (segundo mensaje): resultado por comprobante — AE (recibido) o
 *      BE (rechazado) con motivos E01-E15.
 */
import { DOMParser } from '@xmldom/xmldom';

/** Motivos de rechazo de sobre (tabla oficial RechazoSobreType). */
export const MOTIVOS_RECHAZO_SOBRE: Record<string, string> = {
  S01: 'Formato del archivo no es el indicado',
  S02: 'No coincide RUC de Sobre, Certificado, envío o CFE',
  S03: 'Certificado electrónico no es válido',
  S04: 'No cumple validaciones según Formato de sobre',
  S05: 'No coinciden cantidad CFE de carátula y contenido',
  S06: 'No coinciden certificado de sobre y comprobantes',
  S07: 'Sobre enviado supera el tamaño máximo admitido',
  S08: 'Sobre enviado ya existe en los registros de DGI',
  S20: 'Sobre enviado ya existe en los registros del receptor',
};

/** Motivos de rechazo de CFE (tabla oficial RechazoCFE_DGIType). */
export const MOTIVOS_RECHAZO_CFE: Record<string, string> = {
  E01: 'Tipo y Nº de CFE ya fue reportado como anulado',
  E02: 'CFE no tiene al menos una línea de detalle',
  E03: 'Tipo y Nº de CFE ya existe en los registros',
  E04: 'Tipo y Nº de CFE no se corresponden con el CAE',
  E05: 'Firma electrónica no es válida',
  E06: 'Importe informado en el CFE excede montos habituales',
  E07: 'Fecha y hora de firma no es válida',
  E08: 'No coincide RUC de CFE y Complemento Fiscal',
  E09: 'RUC emisor y/o tipo de CFE no se corresponden con el CAE',
  E10: 'Tipo de cambio no válido',
  E11: 'Tipo de CAE especial del CFE no se corresponde con el CAE',
  E12: 'Información en Zona de Referencia no existe en los registros',
  E13: 'Tipo de CAE del CFE no se corresponde con el CAE utilizado',
  E14: 'Irregularidades detectadas',
  E15: 'Deudor contumaz sin informar situación',
};

export interface MotivoRechazo {
  motivo: string;
  glosa: string;
  detalle?: string;
}

export interface AcuseSobre {
  estado: 'AS' | 'BS';
  aceptado: boolean;
  rucReceptor: string;
  rucEmisor: string;
  idRespuesta: number;
  nombreArchivo: string;
  fechaRecibido: Date;
  idEmisor: number;
  idReceptor: number;
  cantidadCfe: number;
  motivosRechazo: MotivoRechazo[];
  /** Presente si aceptado: token y momento desde el cual consultar el resultado por CFE. */
  consulta?: { token: string; desde: Date };
}

export interface AcuseCfeDetalle {
  ordinal: number;
  tipoCFE: number;
  serie: string;
  numero: number;
  estado: 'AE' | 'BE';
  aceptado: boolean;
  motivosRechazo: MotivoRechazo[];
}

export interface AcuseCfe {
  rucReceptor: string;
  rucEmisor: string;
  idRespuesta: number;
  idEmisor: number;
  idReceptor: number;
  aceptados: number;
  rechazados: number;
  detalles: AcuseCfeDetalle[];
}

function parsear(xml: string, raizEsperada: string) {
  const doc = new DOMParser().parseFromString(xml, 'text/xml');
  const raiz = doc.documentElement;
  if (!raiz || raiz.localName !== raizEsperada) {
    throw new Error(`Se esperaba <${raizEsperada}>, llegó <${raiz?.localName ?? 'nada'}>`);
  }
  return raiz;
}

function texto(nodo: any, tag: string): string | undefined {
  const els = nodo.getElementsByTagNameNS('http://cfe.dgi.gub.uy', tag);
  return els.length > 0 ? (els.item(0)!.textContent ?? undefined) : undefined;
}

function textoReq(nodo: any, tag: string): string {
  const t = texto(nodo, tag);
  if (t === undefined) throw new Error(`Acuse sin <${tag}>`);
  return t;
}

function motivos(nodo: any, tagContenedor: string, tabla: Record<string, string>): MotivoRechazo[] {
  const out: MotivoRechazo[] = [];
  const els = nodo.getElementsByTagNameNS('http://cfe.dgi.gub.uy', tagContenedor);
  for (let i = 0; i < els.length; i++) {
    const m = els.item(i)!;
    const motivo = textoReq(m, 'Motivo');
    const detalle = texto(m, 'Detalle');
    out.push({
      motivo,
      glosa: texto(m, 'Glosa') ?? tabla[motivo] ?? 'Motivo desconocido',
      ...(detalle !== undefined && { detalle }),
    });
  }
  return out;
}

/** Parsea el primer mensaje de respuesta (ACKSobre). */
export function parseAcuseSobre(xml: string): AcuseSobre {
  const raiz = parsear(xml, 'ACKSobre');
  const estado = textoReq(raiz, 'Estado') as AcuseSobre['estado'];
  const token = texto(raiz, 'Token');
  const desde = texto(raiz, 'Fechahora');

  return {
    estado,
    aceptado: estado === 'AS',
    rucReceptor: textoReq(raiz, 'RUCReceptor'),
    rucEmisor: textoReq(raiz, 'RUCEmisor'),
    idRespuesta: Number(textoReq(raiz, 'IDRespuesta')),
    nombreArchivo: textoReq(raiz, 'NomArch'),
    fechaRecibido: new Date(textoReq(raiz, 'FecHRecibido')),
    idEmisor: Number(textoReq(raiz, 'IDEmisor')),
    idReceptor: Number(textoReq(raiz, 'IDReceptor')),
    cantidadCfe: Number(textoReq(raiz, 'CantidadCFE')),
    motivosRechazo: motivos(raiz, 'MotivosRechazo', MOTIVOS_RECHAZO_SOBRE),
    ...(token && desde && { consulta: { token, desde: new Date(desde) } }),
  };
}

/** Parsea el segundo mensaje de respuesta (ACKCFE): resultado por comprobante. */
export function parseAcuseCfe(xml: string): AcuseCfe {
  const raiz = parsear(xml, 'ACKCFE');
  const detalles: AcuseCfeDetalle[] = [];
  const dets = raiz.getElementsByTagNameNS('http://cfe.dgi.gub.uy', 'ACKCFE_Det');
  for (let i = 0; i < dets.length; i++) {
    const d = dets.item(i)!;
    const estado = textoReq(d, 'Estado') as AcuseCfeDetalle['estado'];
    detalles.push({
      ordinal: Number(textoReq(d, 'Nro_ordinal')),
      tipoCFE: Number(textoReq(d, 'TipoCFE')),
      serie: textoReq(d, 'Serie'),
      numero: Number(textoReq(d, 'NroCFE')),
      estado,
      aceptado: estado === 'AE',
      motivosRechazo: motivos(d, 'MotivosRechazoCF', MOTIVOS_RECHAZO_CFE),
    });
  }

  return {
    rucReceptor: textoReq(raiz, 'RUCReceptor'),
    rucEmisor: textoReq(raiz, 'RUCEmisor'),
    idRespuesta: Number(textoReq(raiz, 'IDRespuesta')),
    idEmisor: Number(textoReq(raiz, 'IDEmisor')),
    idReceptor: Number(textoReq(raiz, 'IDReceptor')),
    aceptados: Number(texto(raiz, 'CantCFEAceptados') ?? 0),
    rechazados: Number(texto(raiz, 'CantCFERechazados') ?? 0),
    detalles,
  };
}
