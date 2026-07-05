/**
 * Cálculo de totales e IVA según reglas del Formato CFE.
 * ⚠️ TODO: verificar reglas oficiales de redondeo (v25.2) — hoy usa redondeo a 2 decimales.
 */
import { IndicadorFacturacion, type CfeInput, type Totales } from './types/cfe.js';

export const TASA_MINIMA = 0.10;
export const TASA_BASICA = 0.22;

const r2 = (n: number) => Math.round(n * 100) / 100;

export function calcularTotales(input: CfeInput): Totales {
  let noGravado = 0;
  let netoMinima = 0;
  let netoBasica = 0;

  for (const linea of input.lineas) {
    const bruto = linea.cantidad * linea.precioUnitario;
    const neto = r2(bruto * (1 - (linea.descuentoPct ?? 0) / 100));

    switch (linea.indicadorFacturacion) {
      case IndicadorFacturacion.EXENTO_IVA:
        noGravado += neto;
        break;
      case IndicadorFacturacion.TASA_MINIMA:
        netoMinima += neto;
        break;
      case IndicadorFacturacion.TASA_BASICA:
        netoBasica += neto;
        break;
      default:
        throw new Error(
          `Indicador de facturación ${linea.indicadorFacturacion} aún no soportado (MVP: exento, tasa mínima, tasa básica)`,
        );
    }
  }

  const ivaMinima = r2(netoMinima * TASA_MINIMA);
  const ivaBasica = r2(netoBasica * TASA_BASICA);

  return {
    montoNoGravado: r2(noGravado),
    montoNetoTasaMinima: r2(netoMinima),
    montoNetoTasaBasica: r2(netoBasica),
    ivaTasaMinima: ivaMinima,
    ivaTasaBasica: ivaBasica,
    montoTotal: r2(noGravado + netoMinima + netoBasica + ivaMinima + ivaBasica),
    cantidadLineas: input.lineas.length,
  };
}
