import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { MemoryCaeStore } from '../src/cae/memory-store.js';
import { Factible } from '../src/factible.js';
import { verificarFirmaCfe } from '../src/signer/xmldsig.js';
import { IndicadorFacturacion, TipoCFE } from '../src/types/cfe.js';

const certificado = {
  privateKey: readFileSync(resolve(__dirname, 'fixtures/test-key.pem'), 'utf8'),
  cert: readFileSync(resolve(__dirname, 'fixtures/test-cert.pem'), 'utf8'),
};

const emisor = {
  ruc: '211234560019',
  razonSocial: 'Ejemplo SA',
  sucursal: { codigo: 1, domicilio: 'Av. Siempre Viva 123', ciudad: 'Montevideo', departamento: 'Montevideo' },
};

async function crearFactible() {
  const caeStore = new MemoryCaeStore();
  await caeStore.agregarRango({
    id: '90230011234',
    tipoCFE: TipoCFE.E_TICKET,
    serie: 'A',
    numeroDesde: 1,
    numeroHasta: 3,
    fechaExpiracion: new Date(Date.now() + 86400_000 * 365),
  });
  return new Factible({ emisor, certificado, caeStore });
}

const lineas = [
  { cantidad: 1, descripcion: 'Café', precioUnitario: 190, indicadorFacturacion: IndicadorFacturacion.TASA_BASICA },
];

describe('Factible.emitir', () => {
  it('emite un e-Ticket completo: numerado, firmado y con sello digital', async () => {
    const factible = await crearFactible();
    const cfe = await factible.emitir({ tipo: TipoCFE.E_TICKET, moneda: 'UYU', lineas });

    expect(cfe.serie).toBe('A');
    expect(cfe.numero).toBe(1);
    expect(cfe.totales.montoTotal).toBe(231.8);
    expect(verificarFirmaCfe(cfe.xml)).toBe(true);
    expect(cfe.codigoSeguridadImpreso).toHaveLength(6);
    expect(cfe.urlQr).toContain('consultaQR/cfe?211234560019,101,A,1,');
  });

  it('la numeración avanza y es única bajo concurrencia', async () => {
    const factible = await crearFactible();
    const emitidos = await Promise.all([
      factible.emitir({ tipo: TipoCFE.E_TICKET, moneda: 'UYU', lineas }),
      factible.emitir({ tipo: TipoCFE.E_TICKET, moneda: 'UYU', lineas }),
      factible.emitir({ tipo: TipoCFE.E_TICKET, moneda: 'UYU', lineas }),
    ]);
    const numeros = emitidos.map((e) => e.numero).sort();
    expect(numeros).toEqual([1, 2, 3]);
  });

  it('falla con mensaje claro al agotar el rango CAE', async () => {
    const factible = await crearFactible();
    for (let i = 0; i < 3; i++) await factible.emitir({ tipo: TipoCFE.E_TICKET, moneda: 'UYU', lineas });
    await expect(factible.emitir({ tipo: TipoCFE.E_TICKET, moneda: 'UYU', lineas })).rejects.toThrow(/CAE/);
  });

  it('falla si no hay CAE para el tipo solicitado', async () => {
    const factible = await crearFactible();
    await expect(
      factible.emitir({
        tipo: TipoCFE.E_FACTURA,
        moneda: 'UYU',
        lineas,
        receptor: { tipoDocumento: 'RUC', documento: '219876540012', razonSocial: 'Cliente SRL' },
      }),
    ).rejects.toThrow(/tipo 111/);
  });
});
