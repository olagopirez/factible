/**
 * Código de seguridad y sello digital (QR) de la representación impresa.
 * Formato CFE v25.2, §5 Pie del comprobante:
 *
 *   - Código de seguridad: hash SHA-2 vinculado a la firma electrónica del CFE.
 *     Interpretación implementada: el DigestValue (Base64) de la Reference de la
 *     ds:Signature. ⚠️ Confirmar contra el portal de verificación en homologación
 *     (ver TODO.md).
 *   - Impreso: los primeros 6 caracteres del hash.
 *   - QR: link https://www.efactura.dgi.gub.uy/consultaQR/cfe?ruc,tipoCFE,serie,nroCFE,monto,fecha,hash
 *     con fecha de firma dd/mm/yyyy y monto = MntPagar (A-C130) para e-Ticket/e-Factura.
 */

const QR_BASE = 'https://www.efactura.dgi.gub.uy/consultaQR/cfe';

function extraer(xml: string, tag: string): string {
  const m = xml.match(new RegExp(`<(?:ds:)?${tag}[^>]*>([^<]*)</(?:ds:)?${tag}>`));
  if (!m) throw new Error(`No se encontró <${tag}> en el CFE`);
  return m[1]!;
}

/** Código de seguridad completo (Base64) desde un CFE firmado. */
export function codigoSeguridad(xmlFirmado: string): string {
  return extraer(xmlFirmado, 'DigestValue');
}

/** Los 6 caracteres que se imprimen bajo el QR junto a la leyenda "Código de seguridad". */
export function codigoSeguridadImpreso(xmlFirmado: string): string {
  return codigoSeguridad(xmlFirmado).slice(0, 6);
}

/** Contenido del QR-Code del sello digital, derivado del propio CFE firmado. */
export function urlQr(xmlFirmado: string): string {
  const ruc = extraer(xmlFirmado, 'RUCEmisor');
  const tipoCFE = extraer(xmlFirmado, 'TipoCFE');
  const serie = extraer(xmlFirmado, 'Serie');
  const nro = extraer(xmlFirmado, 'Nro');
  const monto = extraer(xmlFirmado, 'MntPagar');
  const tmstFirma = extraer(xmlFirmado, 'TmstFirma'); // yyyy-mm-ddThh:mm:ss-03:00
  const [y, m, d] = tmstFirma.slice(0, 10).split('-');
  const fecha = `${d}/${m}/${y}`;
  const hash = encodeURIComponent(codigoSeguridad(xmlFirmado));

  // Parámetros separados por coma, en el orden fijado por el Formato v25.2.
  return `${QR_BASE}?${ruc},${tipoCFE},${serie},${nro},${monto},${fecha},${hash}`;
}
