import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { MemoryCaeStore } from '../src/cae/memory-store.js';
import { Factible } from '../src/factible.js';
import { representacionImpresa } from '../src/impresion/html.js';
import { IndicadorFacturacion, TipoCFE, type CfeInput } from '../src/types/cfe.js';

const certificado = {
  privateKey: readFileSync(resolve(__dirname, 'fixtures/test-key.pem'), 'utf8'),
  cert: readFileSync(resolve(__dirname, 'fixtures/test-cert.pem'), 'utf8'),
};

const emisor = {
  ruc: '211234560012',
  razonSocial: 'Ejemplo SA',
  sucursal: { codigo: 1, domicilio: 'Av. Siempre Viva 123', ciudad: 'Montevideo', departamento: 'Montevideo' },
};

const input: CfeInput = {
  tipo: TipoCFE.E_TICKET,
  emisor,
  moneda: 'UYU',
  lineas: [
    { cantidad: 2, descripcion: 'Café <espresso>', precioUnitario: 190, indicadorFacturacion: IndicadorFacturacion.TASA_BASICA },
  ],
};

async function emitirUno() {
  const caeStore = new MemoryCaeStore();
  await caeStore.agregarRango({
    id: '90230011234', tipoCFE: TipoCFE.E_TICKET, serie: 'A',
    numeroDesde: 1, numeroHasta: 5000, fechaExpiracion: new Date('2027-12-31T00:00:00-03:00'),
  });
  const factible = new Factible({ emisor, certificado, caeStore });
  return factible.emitir(input);
}

describe('representacionImpresa', () => {
  it('genera HTML con las zonas obligatorias del Formato v25.2 §5', async () => {
    const emitido = await emitirUno();
    const html = await representacionImpresa(input, emitido, {
      fechaEmisorORes: 'Res. 123/2026',
      urlVerificacionEmpresa: 'www.ejemplo.uy/verificar',
    });

    expect(html).toContain('e-Ticket');
    expect(html).toContain('data:image/png;base64'); // QR embebido
    expect(html).toContain(`Código de seguridad: <strong>${emitido.codigoSeguridadImpreso}</strong>`);
    expect(html).toContain('Puede verificar comprobante en www.ejemplo.uy/verificar');
    expect(html).toContain('Fecha emisor: Res. 123/2026');
    expect(html).toContain('Nº de CAE: 90230011234');
    expect(html).toContain('del 1 al 5000'); // rango CAE
    expect(html).toContain('Fecha de vencimiento');
    expect(html).toContain('TOTAL UYU');
    expect(html).toContain('463.60'); // 380 * 1.22
    expect(html).toContain('Café &lt;espresso&gt;'); // escape XSS/HTML
  });

  it('e-Ticket exige URL de verificación de la empresa', async () => {
    const emitido = await emitirUno();
    await expect(representacionImpresa(input, emitido, { fechaEmisorORes: '01/01/2026' })).rejects.toThrow(
      /urlVerificacionEmpresa/,
    );
  });
});
