/**
 * Tipos núcleo del dominio CFE (Comprobante Fiscal Electrónico) — DGI Uruguay.
 * Referencia: Formato CFE v25.2 — https://www.efactura.dgi.gub.uy/files/formato_cfe_v25-2-pdf?es
 *
 * ⚠️ Los códigos y campos marcados con TODO deben verificarse contra el PDF
 * oficial y los XSDs v1.44.2 antes de considerarse estables.
 */

/** Tipos de CFE según DGI. MVP: E_TICKET y E_FACTURA (+ NC/ND). */
export enum TipoCFE {
  E_TICKET = 101,
  NC_E_TICKET = 102,
  ND_E_TICKET = 103,
  E_FACTURA = 111,
  NC_E_FACTURA = 112,
  ND_E_FACTURA = 113,
  E_FACTURA_EXPORTACION = 121, // fuera del MVP
  E_REMITO = 181, // fuera del MVP
  E_RESGUARDO = 182, // fuera del MVP
}

/** Indicador de facturación por línea de detalle (TODO: verificar tabla completa v25.2). */
export enum IndicadorFacturacion {
  EXENTO_IVA = 1,
  TASA_MINIMA = 2, // 10 %
  TASA_BASICA = 3, // 22 %
  OTRA_TASA = 4,
  ENTREGA_GRATUITA = 5,
  NO_FACTURABLE = 6,
  NO_FACTURABLE_NEGATIVO = 7,
}

export type Moneda = 'UYU' | 'USD' | (string & {});

export interface Emisor {
  ruc: string; // RUC del emisor (12 dígitos)
  razonSocial: string;
  nombreComercial?: string;
  sucursal: { codigo: number; domicilio: string; ciudad: string; departamento: string };
}

/**
 * Receptor: obligatorio en e-Factura (con RUC), opcional en e-Ticket bajo cierto monto.
 * Tipos según campo C60 del Formato CFE v25.2: NIE(1), RUC(2), CI(3), OTRO(4),
 * PASAPORTE(5), DNI(6, solo AR/BR/CL/PY), NIFE(7).
 */
export interface Receptor {
  tipoDocumento: 'NIE' | 'RUC' | 'CI' | 'OTRO' | 'PASAPORTE' | 'DNI' | 'NIFE';
  documento: string;
  razonSocial?: string;
  domicilio?: string;
  ciudad?: string;
  departamento?: string;
  paisCodigo?: string; // ISO 3166-1 alpha-2, default 'UY'
}

export interface LineaDetalle {
  cantidad: number;
  descripcion: string;
  precioUnitario: number;
  indicadorFacturacion: IndicadorFacturacion;
  /** Unidad de medida (ej: 'kg', 'hora', 'unidad'). Default: 'N/A'. */
  unidadMedida?: string;
  descuentoPct?: number;
  codigoInterno?: string;
}

/** Referencia a otro CFE (obligatoria en NC/ND). v25: Monto y Moneda obligatorios. */
export interface ReferenciaCFE {
  tipoCFE: TipoCFE;
  serie: string;
  numero: number;
  monto: number; // obligatorio desde v25, no puede superar el total del referenciado
  moneda: Moneda; // obligatorio desde v25
  tipoCambio?: number;
  razon?: string;
}

/** Input de alto nivel para construir un CFE. La lib calcula totales, IVA y numeración. */
export interface CfeInput {
  tipo: TipoCFE;
  emisor: Emisor;
  receptor?: Receptor;
  moneda: Moneda;
  tipoCambio?: number; // obligatorio si moneda !== 'UYU'
  lineas: LineaDetalle[];
  referencias?: ReferenciaCFE[]; // requerido para NC/ND
  fechaEmision?: Date; // default: ahora
  formaPago?: 'CONTADO' | 'CREDITO';
  adenda?: string;
}

/** Totales calculados según reglas v25.2 (TODO: redondeos oficiales). */
export interface Totales {
  montoNoGravado: number;
  montoNetoTasaMinima: number;
  montoNetoTasaBasica: number;
  ivaTasaMinima: number;
  ivaTasaBasica: number;
  montoTotal: number;
  cantidadLineas: number;
}

/** CFE ya numerado, construido y (eventualmente) firmado. */
export interface CfeEmitido {
  tipo: TipoCFE;
  serie: string;
  numero: number;
  caeId: string;
  fechaEmision: Date;
  totales: Totales;
  xml: string; // XML firmado, listo para sobre
  codigoSeguridad: string; // hash para representación impresa / QR
}
