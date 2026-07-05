/**
 * Representación impresa del CFE (Formato v25.2, §2-5: zonas del comprobante).
 *
 * Genera un HTML autocontenido e imprimible (A4 o ticket 80mm) con las zonas
 * obligatorias: identificación del comprobante, emisor, receptor, detalle,
 * totales y pie con sello digital (QR + código de seguridad), leyendas, CAE
 * y su vencimiento en recuadro.
 *
 * El QR va embebido como data-URL (librería `qrcode`), tamaño según spec:
 * mínimo 22x22 mm. El dev puede imprimir el HTML o convertirlo a PDF con su stack.
 */
import { toDataURL } from 'qrcode';
import { TipoCFE, type CfeInput } from '../types/cfe.js';
import type { Emitido } from '../factible.js';

export interface OpcionesImpresion {
  /** Formato de página: 'a4' (default) o 'ticket' (80 mm). */
  formato?: 'a4' | 'ticket';
  /**
   * Leyenda "Fecha emisor": fecha de incorporación al régimen, o número de
   * resolución ("Res. XX/año") si fue incorporado por resolución.
   */
  fechaEmisorORes: string;
  /** URL de verificación de la empresa — obligatoria para e-Tickets y sus NC/ND. */
  urlVerificacionEmpresa?: string;
}

const NOMBRE_CFE: Record<number, string> = {
  [TipoCFE.E_TICKET]: 'e-Ticket',
  [TipoCFE.NC_E_TICKET]: 'Nota de Crédito de e-Ticket',
  [TipoCFE.ND_E_TICKET]: 'Nota de Débito de e-Ticket',
  [TipoCFE.E_FACTURA]: 'e-Factura',
  [TipoCFE.NC_E_FACTURA]: 'Nota de Crédito de e-Factura',
  [TipoCFE.ND_E_FACTURA]: 'Nota de Débito de e-Factura',
};

const ES_TICKET = new Set([TipoCFE.E_TICKET, TipoCFE.NC_E_TICKET, TipoCFE.ND_E_TICKET]);

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const money = (n: number) => n.toFixed(2);
const fechaUy = (d: Date) => d.toLocaleDateString('es-UY', { timeZone: 'America/Montevideo' });

export async function representacionImpresa(
  input: CfeInput,
  emitido: Emitido,
  opciones: OpcionesImpresion,
): Promise<string> {
  const nombre = NOMBRE_CFE[input.tipo];
  if (!nombre) throw new Error(`Tipo de CFE ${input.tipo} fuera del alcance del MVP`);
  const esTicket = ES_TICKET.has(input.tipo);
  if (esTicket && !opciones.urlVerificacionEmpresa) {
    throw new Error('e-Tickets requieren urlVerificacionEmpresa para la leyenda de verificación (Formato v25.2 §5)');
  }

  // QR: mínimo 22x22mm ≈ 83px a 96dpi; generamos a 200px para nitidez de impresión.
  const qrDataUrl = await toDataURL(emitido.urlQr, { width: 200, margin: 2 });

  const t = emitido.totales;
  const em = input.emisor;
  const r = input.receptor;
  const leyendaVerificacion = esTicket
    ? `Puede verificar comprobante en ${opciones.urlVerificacionEmpresa}`
    : 'Puede verificar comprobante en www.dgi.gub.uy';

  const filas = input.lineas
    .map((l) => {
      const neto = l.cantidad * l.precioUnitario * (1 - (l.descuentoPct ?? 0) / 100);
      return `<tr><td>${esc(l.descripcion)}</td><td class="n">${l.cantidad}</td><td class="n">${money(l.precioUnitario)}</td><td class="n">${money(neto)}</td></tr>`;
    })
    .join('');

  const totales =
    (t.montoNoGravado > 0 ? `<tr><td>Monto no gravado</td><td class="n">${money(t.montoNoGravado)}</td></tr>` : '') +
    (t.montoNetoTasaMinima > 0
      ? `<tr><td>Neto IVA tasa mínima</td><td class="n">${money(t.montoNetoTasaMinima)}</td></tr><tr><td>IVA tasa mínima (10%)</td><td class="n">${money(t.ivaTasaMinima)}</td></tr>`
      : '') +
    (t.montoNetoTasaBasica > 0
      ? `<tr><td>Neto IVA tasa básica</td><td class="n">${money(t.montoNetoTasaBasica)}</td></tr><tr><td>IVA tasa básica (22%)</td><td class="n">${money(t.ivaTasaBasica)}</td></tr>`
      : '') +
    `<tr class="total"><td>TOTAL ${esc(input.moneda)}</td><td class="n">${money(t.montoTotal)}</td></tr>`;

  const ancho = opciones.formato === 'ticket' ? '80mm' : '210mm';

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<title>${esc(nombre)} ${esc(emitido.serie)}-${emitido.numero}</title>
<style>
  @page { size: ${opciones.formato === 'ticket' ? '80mm auto' : 'A4'}; margin: 8mm; }
  body { font-family: system-ui, sans-serif; font-size: 11px; width: ${ancho}; margin: 0 auto; color: #000; }
  h1 { font-size: 14px; margin: 0; }
  .cabezal, .pie { border: 1px solid #000; padding: 6px; margin-bottom: 6px; }
  .doc-id { text-align: right; border: 2px solid #000; padding: 6px; float: right; min-width: 40%; }
  table { width: 100%; border-collapse: collapse; margin: 6px 0; }
  th, td { text-align: left; padding: 2px 4px; border-bottom: 1px solid #ccc; }
  td.n { text-align: right; }
  tr.total td { font-weight: bold; border-top: 2px solid #000; font-size: 12px; }
  .sello { display: flex; gap: 8px; align-items: flex-start; }
  .sello img { width: 22mm; height: 22mm; margin: 3mm; }
  .cod-seg { font-size: 10px; }
  .cae-venc { border: 1px solid #000; width: 2cm; min-width: 2cm; min-height: 1cm; padding: 4px; font-size: 10px; float: right; }
  .leyendas { font-size: 10px; margin-top: 4px; }
  .clear { clear: both; }
</style>
</head>
<body>
  <div class="doc-id">
    <h1>${esc(nombre)}</h1>
    <div>Serie ${esc(emitido.serie)} — Nº ${emitido.numero}</div>
    <div>Fecha: ${fechaUy(emitido.fechaEmision)}</div>
    <div>RUC: ${esc(em.ruc)}</div>
  </div>
  <div class="cabezal">
    <strong>${esc(em.razonSocial)}</strong>${em.nombreComercial ? ` — ${esc(em.nombreComercial)}` : ''}<br>
    ${esc(em.sucursal.domicilio)}, ${esc(em.sucursal.ciudad)}, ${esc(em.sucursal.departamento)}
  </div>
  <div class="clear"></div>
  ${
    r
      ? `<div class="cabezal">Receptor: <strong>${esc(r.razonSocial ?? '')}</strong> — ${esc(r.tipoDocumento)} ${esc(r.documento)}${r.domicilio ? `<br>${esc(r.domicilio)}` : ''}</div>`
      : ''
  }
  <table>
    <thead><tr><th>Detalle</th><th class="n">Cant.</th><th class="n">P. unit.</th><th class="n">Importe</th></tr></thead>
    <tbody>${filas}</tbody>
  </table>
  <table><tbody>${totales}</tbody></table>
  <div class="pie">
    <div class="cae-venc"><strong>CAE</strong><br>Fecha de vencimiento<br>${fechaUy(emitido.cae.fechaExpiracion)}</div>
    <div class="sello">
      <div>
        <img src="${qrDataUrl}" alt="QR-Code">
        <div class="cod-seg">Código de seguridad: <strong>${esc(emitido.codigoSeguridadImpreso)}</strong></div>
      </div>
      <div class="leyendas">
        <div>Fecha emisor: ${esc(opciones.fechaEmisorORes)}</div>
        <div>${esc(leyendaVerificacion)}</div>
        <div>Nº de CAE: ${esc(emitido.caeId)} — Serie ${esc(emitido.cae.serie)}, del ${emitido.cae.numeroDesde} al ${emitido.cae.numeroHasta}</div>
      </div>
    </div>
    <div class="clear"></div>
  </div>
</body>
</html>`;
}
