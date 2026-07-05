import { describe, expect, it } from 'vitest';
import { calcularTotales } from '../src/totales.js';
import { IndicadorFacturacion, TipoCFE, type CfeInput } from '../src/types/cfe.js';

const base: Omit<CfeInput, 'lineas'> = {
  tipo: TipoCFE.E_TICKET,
  emisor: {
    ruc: '211234567890',
    razonSocial: 'Ejemplo SA',
    sucursal: { codigo: 1, domicilio: 'Av. Siempre Viva 123', ciudad: 'Montevideo', departamento: 'Montevideo' },
  },
  moneda: 'UYU',
};

describe('calcularTotales', () => {
  it('calcula IVA tasa básica (22 %)', () => {
    const t = calcularTotales({
      ...base,
      lineas: [
        { cantidad: 2, descripcion: 'Producto', precioUnitario: 100, indicadorFacturacion: IndicadorFacturacion.TASA_BASICA },
      ],
    });
    expect(t.montoNetoTasaBasica).toBe(200);
    expect(t.ivaTasaBasica).toBe(44);
    expect(t.montoTotal).toBe(244);
  });

  it('mezcla exento + tasa mínima + descuento', () => {
    const t = calcularTotales({
      ...base,
      lineas: [
        { cantidad: 1, descripcion: 'Libro', precioUnitario: 500, indicadorFacturacion: IndicadorFacturacion.EXENTO_IVA },
        { cantidad: 1, descripcion: 'Alimento', precioUnitario: 200, descuentoPct: 10, indicadorFacturacion: IndicadorFacturacion.TASA_MINIMA },
      ],
    });
    expect(t.montoNoGravado).toBe(500);
    expect(t.montoNetoTasaMinima).toBe(180);
    expect(t.ivaTasaMinima).toBe(18);
    expect(t.montoTotal).toBe(698);
  });

  it('rechaza indicadores fuera del MVP', () => {
    expect(() =>
      calcularTotales({
        ...base,
        lineas: [
          { cantidad: 1, descripcion: 'Regalo', precioUnitario: 50, indicadorFacturacion: IndicadorFacturacion.ENTREGA_GRATUITA },
        ],
      }),
    ).toThrow(/no soportado/);
  });
});
