/**
 * Reporte diario de CFEs (Formato Reporte v13.2 / XSD ReporteDiarioCFE.xsd).
 *
 * Resume todo lo emitido en el día por tipo de CFE: montos por fecha/sucursal,
 * cantidades y rangos de numeración utilizados. Se firma (firmarReporte) y se
 * envía a DGI diariamente, incluso los días sin emisiones (reporte "sin movimiento").
 *
 * Alcance MVP: e-Ticket y e-Factura + NC/ND (101,102,103,111,112,113).
 * La secuencia de secciones respeta el orden del XSD: Tck → Tck_NC → Tck_ND → Fac → Fac_NC → Fac_ND.
 */
import { TASA_BASICA, TASA_MINIMA } from '../totales.js';
import { TipoCFE, type CfeEmitido } from '../types/cfe.js';

export interface ReporteParams {
  rucEmisor: string;
  /** Día que se resume. */
  fechaResumen: Date;
  /** Secuencia de envío del día (1 si es el primero). */
  secEnvio: number;
  /** Código de sucursal DGI de los CFEs resumidos. */
  codSucursal: number;
  /** CFEs emitidos en el día (output de Factible.emitir / buildCfeXml+datos). */
  emitidos: CfeEmitido[];
  fechaFirma?: Date;
}

const SECCION: Record<number, string> = {
  [TipoCFE.E_TICKET]: 'Rsmn_Tck',
  [TipoCFE.NC_E_TICKET]: 'Rsmn_Tck_Nota_Credito',
  [TipoCFE.ND_E_TICKET]: 'Rsmn_Tck_Nota_Debito',
  [TipoCFE.E_FACTURA]: 'Rsmn_Fac',
  [TipoCFE.NC_E_FACTURA]: 'Rsmn_Fac_Nota_Credito',
  [TipoCFE.ND_E_FACTURA]: 'Rsmn_Fac_Nota_Debito',
};
/** Orden de secciones exigido por la secuencia del XSD. */
const ORDEN_TIPOS = [101, 102, 103, 111, 112, 113] as const;

const money = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(2));
const fecha = (d: Date) => d.toISOString().slice(0, 10);
const fechaHoraUy = (d: Date) => {
  const uy = new Date(d.getTime() - 3 * 3600 * 1000);
  return `${uy.toISOString().slice(0, 19)}-03:00`;
};
const el = (name: string, inner: string | number) => `<${name}>${inner}</${name}>`;

/** Rangos contiguos de numeración por serie (RDU_Item). */
function rangos(cfes: CfeEmitido[]): { serie: string; desde: number; hasta: number }[] {
  const porSerie = new Map<string, number[]>();
  for (const c of cfes) {
    const nums = porSerie.get(c.serie) ?? [];
    nums.push(c.numero);
    porSerie.set(c.serie, nums);
  }
  const out: { serie: string; desde: number; hasta: number }[] = [];
  for (const [serie, nums] of porSerie) {
    nums.sort((a, b) => a - b);
    let desde = nums[0]!;
    let prev = nums[0]!;
    for (const n of nums.slice(1)) {
      if (n === prev) throw new Error(`Número duplicado en reporte: serie ${serie} nro ${n}`);
      if (n !== prev + 1) {
        out.push({ serie, desde, hasta: prev });
        desde = n;
      }
      prev = n;
    }
    out.push({ serie, desde, hasta: prev });
  }
  return out;
}

function seccion(tipo: TipoCFE, cfes: CfeEmitido[], codSucursal: number): string {
  // Montos agregados por fecha de emisión (Mnts_FyT_Item por fecha+sucursal).
  const porFecha = new Map<string, CfeEmitido[]>();
  for (const c of cfes) {
    const f = fecha(c.fechaEmision);
    porFecha.set(f, [...(porFecha.get(f) ?? []), c]);
  }

  const items = [...porFecha.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([f, grupo]) => {
      const sum = (fn: (c: CfeEmitido) => number) => grupo.reduce((acc, c) => acc + fn(c), 0);
      const noGrv = sum((c) => c.totales.montoNoGravado);
      const netoMin = sum((c) => c.totales.montoNetoTasaMinima);
      const netoBas = sum((c) => c.totales.montoNetoTasaBasica);
      const ivaMin = sum((c) => c.totales.ivaTasaMinima);
      const ivaBas = sum((c) => c.totales.ivaTasaBasica);
      const total = sum((c) => c.totales.montoTotal);
      return el(
        'Mnts_FyT_Item',
        el('Fecha', f) +
          el('CodSuc', codSucursal) +
          (noGrv > 0 ? el('TotMntNoGrv', money(noGrv)) : '') +
          // Nomenclatura del XSD: TotMntIVATasaMin/Bas = monto NETO gravado a esa tasa.
          (netoMin > 0 ? el('TotMntIVATasaMin', money(netoMin)) : '') +
          (netoBas > 0 ? el('TotMntIVATasaBas', money(netoBas)) : '') +
          (netoMin > 0 ? el('MntIVATasaMin', money(ivaMin)) : '') +
          (netoBas > 0 ? el('MntIVATasaBas', money(ivaBas)) : '') +
          (netoMin > 0 ? el('IVATasaMin', TASA_MINIMA * 100) : '') +
          (netoBas > 0 ? el('IVATasaBas', TASA_BASICA * 100) : '') +
          el('TotMntTotal', money(total)),
      );
    })
    .join('');

  const rdu = rangos(cfes)
    .map((r) => el('RDU_Item', el('Serie', r.serie) + el('NroDesde', r.desde) + el('NroHasta', r.hasta)))
    .join('');

  return el(
    SECCION[tipo]!,
    el('TipoComp', tipo) +
      el(
        'RsmnData',
        el('Montos', items) +
          el('CantDocsUtil', cfes.length) +
          el('CantDocsAnulados', 0) +
          el('CantDocsEmi', cfes.length) +
          el('RngDocsUtil', rdu),
      ),
  );
}

/** Construye el XML del reporte diario SIN firmar (firmar con firmarReporte). */
export function crearReporteDiario(p: ReporteParams): string {
  const porTipo = new Map<number, CfeEmitido[]>();
  for (const c of p.emitidos) {
    if (!(c.tipo in SECCION)) {
      throw new Error(`Tipo de CFE ${c.tipo} fuera del alcance del reporte MVP (101-103, 111-113)`);
    }
    porTipo.set(c.tipo, [...(porTipo.get(c.tipo) ?? []), c]);
  }

  const caratula = `<Caratula version="1.0">${
    el('RUCEmisor', p.rucEmisor) +
    el('FechaResumen', fecha(p.fechaResumen)) +
    el('SecEnvio', p.secEnvio) +
    el('TmstFirmaEnv', fechaHoraUy(p.fechaFirma ?? new Date())) +
    el('CantComprobantes', p.emitidos.length)
  }</Caratula>`;

  const secciones = ORDEN_TIPOS.filter((t) => porTipo.has(t))
    .map((t) => seccion(t, porTipo.get(t)!, p.codSucursal))
    .join('');

  return `<Reporte xmlns="http://cfe.dgi.gub.uy">${caratula}${secciones}</Reporte>`;
}
