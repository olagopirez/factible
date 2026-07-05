/**
 * Builder XML de CFE (e-Ticket / e-Factura) según Formato CFE v25.2 y XSDs v1.44.2.
 * Genera el elemento <CFE> SIN firmar — la firma (ds:Signature) la agrega el módulo signer.
 *
 * El orden de los elementos respeta estrictamente las secuencias del XSD
 * (spec/xsd/CFEType.xsd): IdDoc → Emisor → Receptor → Totales → Detalle → Referencia → CAEData.
 */
import type { Cae } from '../types/cae.js';
import { TipoCFE, type CfeInput, type Receptor, type Totales } from '../types/cfe.js';
import { calcularTotales, TASA_BASICA, TASA_MINIMA } from '../totales.js';

export interface BuildParams {
  input: CfeInput;
  serie: string;
  numero: number;
  cae: Cae;
  /** Se calculan desde input.lineas si no se pasan. */
  totales?: Totales;
  fechaFirma?: Date;
}

const E_TICKETS = new Set([TipoCFE.E_TICKET, TipoCFE.NC_E_TICKET, TipoCFE.ND_E_TICKET]);
const E_FACTURAS = new Set([TipoCFE.E_FACTURA, TipoCFE.NC_E_FACTURA, TipoCFE.ND_E_FACTURA]);

/** Códigos TipoDocRecep — tabla oficial campo A-C60, Formato CFE v25.2 (pág. 32). */
const TIPO_DOC_RECEP: Record<Receptor['tipoDocumento'], number> = {
  NIE: 1,
  RUC: 2,
  CI: 3,
  OTRO: 4,
  PASAPORTE: 5,
  DNI: 6, // solo documentos de AR, BR, CL o PY
  NIFE: 7,
};

/** A-C60 ∈ {1,2,3} (NIE/RUC/CI) ⇒ A-C61 debe ser UY. */
const DOCS_URUGUAYOS = new Set<Receptor['tipoDocumento']>(['NIE', 'RUC', 'CI']);

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const money = (n: number) => n.toFixed(2);
const qty = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(3));
const fecha = (d: Date) => d.toISOString().slice(0, 10);

/** FechaHoraType exige offset; DGI opera en UTC-3 (hora uruguaya). */
const fechaHoraUy = (d: Date) => {
  const uy = new Date(d.getTime() - 3 * 3600 * 1000);
  return `${uy.toISOString().slice(0, 19)}-03:00`;
};

const el = (name: string, content: string | number | undefined | null): string =>
  content === undefined || content === null || content === ''
    ? ''
    : `<${name}>${typeof content === 'number' ? content : esc(String(content))}</${name}>`;

const raw = (name: string, inner: string) => `<${name}>${inner}</${name}>`;

export function buildCfeXml(p: BuildParams): string {
  const { input, serie, numero, cae } = p;
  const totales = p.totales ?? calcularTotales(input);
  const fechaEmision = input.fechaEmision ?? new Date();
  const fechaFirma = p.fechaFirma ?? new Date();

  const esTicket = E_TICKETS.has(input.tipo);
  const esFactura = E_FACTURAS.has(input.tipo);
  if (!esTicket && !esFactura) {
    throw new Error(`Tipo de CFE ${input.tipo} fuera del alcance del MVP (e-Ticket/e-Factura y sus NC/ND)`);
  }
  if (esFactura && !input.receptor) {
    throw new Error('e-Factura requiere receptor identificado');
  }
  // Regla A-C60 (Formato v25.2): e-Factura y sus NC/ND exigen receptor con RUC.
  if (esFactura && input.receptor && input.receptor.tipoDocumento !== 'RUC') {
    throw new Error('e-Factura requiere receptor con RUC (campo A-C60=2)');
  }
  // Regla A-C61: documentos uruguayos (NIE/RUC/CI) implican país UY.
  if (input.receptor && DOCS_URUGUAYOS.has(input.receptor.tipoDocumento) && (input.receptor.paisCodigo ?? 'UY') !== 'UY') {
    throw new Error(`Documento ${input.receptor.tipoDocumento} exige país UY (regla A-C61)`);
  }
  const esNcNd = input.tipo !== TipoCFE.E_TICKET && input.tipo !== TipoCFE.E_FACTURA;
  if (esNcNd && !input.referencias?.length) {
    throw new Error('NC/ND requieren al menos una referencia al CFE original');
  }
  if (input.moneda !== 'UYU' && input.tipoCambio === undefined) {
    throw new Error(`Moneda ${input.moneda} requiere tipoCambio`);
  }

  // --- Encabezado/IdDoc ---
  const idDoc = raw(
    'IdDoc',
    el('TipoCFE', input.tipo) +
      el('Serie', serie) +
      el('Nro', numero) +
      el('FchEmis', fecha(fechaEmision)) +
      el('FmaPago', input.formaPago === 'CREDITO' ? 2 : 1),
  );

  // --- Encabezado/Emisor ---
  const em = input.emisor;
  const emisor = raw(
    'Emisor',
    el('RUCEmisor', em.ruc) +
      el('RznSoc', em.razonSocial) +
      el('NomComercial', em.nombreComercial) +
      el('CdgDGISucur', em.sucursal.codigo) +
      el('DomFiscal', em.sucursal.domicilio) +
      el('Ciudad', em.sucursal.ciudad) +
      el('Departamento', em.sucursal.departamento),
  );

  // --- Encabezado/Receptor ---
  let receptor = '';
  if (input.receptor) {
    const r = input.receptor;
    receptor = raw(
      'Receptor',
      el('TipoDocRecep', TIPO_DOC_RECEP[r.tipoDocumento]) +
        el('CodPaisRecep', r.paisCodigo ?? 'UY') +
        el('DocRecep', r.documento) +
        el('RznSocRecep', r.razonSocial) +
        el('DirRecep', r.domicilio) +
        el('CiudadRecep', r.ciudad) +
        el('DeptoRecep', r.departamento),
    );
  }

  // --- Encabezado/Totales (orden estricto del XSD) ---
  const t = totales;
  const totalesXml = raw(
    'Totales',
    el('TpoMoneda', input.moneda) +
      el('TpoCambio', input.tipoCambio !== undefined ? input.tipoCambio.toFixed(3) : undefined) +
      el('MntNoGrv', t.montoNoGravado > 0 ? money(t.montoNoGravado) : undefined) +
      el('MntNetoIvaTasaMin', t.montoNetoTasaMinima > 0 ? money(t.montoNetoTasaMinima) : undefined) +
      el('MntNetoIVATasaBasica', t.montoNetoTasaBasica > 0 ? money(t.montoNetoTasaBasica) : undefined) +
      el('IVATasaMin', t.montoNetoTasaMinima > 0 ? (TASA_MINIMA * 100).toFixed(0) : undefined) +
      el('IVATasaBasica', t.montoNetoTasaBasica > 0 ? (TASA_BASICA * 100).toFixed(0) : undefined) +
      el('MntIVATasaMin', t.montoNetoTasaMinima > 0 ? money(t.ivaTasaMinima) : undefined) +
      el('MntIVATasaBasica', t.montoNetoTasaBasica > 0 ? money(t.ivaTasaBasica) : undefined) +
      el('MntTotal', money(t.montoTotal)) +
      el('CantLinDet', t.cantidadLineas) +
      el('MntPagar', money(t.montoTotal)),
  );

  const encabezado = raw('Encabezado', idDoc + emisor + receptor + totalesXml);

  // --- Detalle ---
  const items = input.lineas
    .map((l, i) => {
      const bruto = l.cantidad * l.precioUnitario;
      const neto = Math.round(bruto * (1 - (l.descuentoPct ?? 0) / 100) * 100) / 100;
      return raw(
        'Item',
        el('NroLinDet', i + 1) +
          el('IndFact', l.indicadorFacturacion) +
          el('NomItem', l.descripcion) +
          el('Cantidad', qty(l.cantidad)) +
          el('UniMed', l.unidadMedida ?? 'N/A') +
          el('PrecioUnitario', money(l.precioUnitario)) +
          el('DescuentoPct', l.descuentoPct !== undefined ? l.descuentoPct.toFixed(2) : undefined) +
          el('DescuentoMonto', l.descuentoPct !== undefined ? money(bruto - neto) : undefined) +
          el('MontoItem', money(neto)),
      );
    })
    .join('');
  const detalle = raw('Detalle', items);

  // --- Referencia (NC/ND) ---
  let referencia = '';
  if (input.referencias?.length) {
    referencia = raw(
      'Referencia',
      input.referencias
        .map((ref, i) =>
          raw(
            'Referencia',
            el('NroLinRef', i + 1) +
              el('TpoDocRef', ref.tipoCFE) +
              el('Serie', ref.serie) +
              el('NroCFERef', ref.numero) +
              el('RazonRef', ref.razon) +
              // v25: monto y moneda obligatorios en referencias
              el('MntCFEref', money(ref.monto)) +
              el('TpoMonedaRef', ref.moneda) +
              el('TpoCambioRef', ref.tipoCambio !== undefined ? ref.tipoCambio.toFixed(3) : undefined),
          ),
        )
        .join(''),
    );
  }

  // --- CAEData ---
  const caeData = raw(
    'CAEData',
    el('CAE_ID', cae.id) +
      el('DNro', cae.numeroDesde) +
      el('HNro', cae.numeroHasta) +
      el('FecVenc', fecha(cae.fechaExpiracion)),
  );

  const rama = esTicket ? 'eTck' : 'eFact';
  const cuerpo = raw(rama, el('TmstFirma', fechaHoraUy(fechaFirma)) + encabezado + detalle + referencia + caeData);

  return `<CFE xmlns="http://cfe.dgi.gub.uy" version="1.0">${cuerpo}</CFE>`;
}
