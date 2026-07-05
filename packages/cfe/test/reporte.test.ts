import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { MemoryCaeStore } from '../src/cae/memory-store.js';
import { Factible } from '../src/factible.js';
import { crearReporteDiario } from '../src/reporte/diario.js';
import { firmarReporte, verificarFirmaCfe } from '../src/signer/xmldsig.js';
import { IndicadorFacturacion, TipoCFE } from '../src/types/cfe.js';

const certificado = {
  privateKey: readFileSync(resolve(__dirname, 'fixtures/test-key.pem'), 'utf8'),
  cert: readFileSync(resolve(__dirname, 'fixtures/test-cert.pem'), 'utf8'),
};

const emisor = {
  ruc: '211234560012',
  razonSocial: 'Ejemplo SA',
  sucursal: { codigo: 1, domicilio: 'Av. Siempre Viva 123', ciudad: 'Montevideo', departamento: 'Montevideo' },
};

async function emitirDia() {
  const caeStore = new MemoryCaeStore();
  await caeStore.agregarRango({
    id: '90230011234', tipoCFE: TipoCFE.E_TICKET, serie: 'A',
    numeroDesde: 1, numeroHasta: 1000, fechaExpiracion: new Date(Date.now() + 86400_000 * 365),
  });
  await caeStore.agregarRango({
    id: '90230011235', tipoCFE: TipoCFE.E_FACTURA, serie: 'F',
    numeroDesde: 1, numeroHasta: 1000, fechaExpiracion: new Date(Date.now() + 86400_000 * 365),
  });
  const factible = new Factible({ emisor, certificado, caeStore });
  const lineas = [
    { cantidad: 1, descripcion: 'Café', precioUnitario: 190, indicadorFacturacion: IndicadorFacturacion.TASA_BASICA },
  ];
  const receptor = { tipoDocumento: 'RUC' as const, documento: '219876540015', razonSocial: 'Cliente SRL' };
  return Promise.all([
    factible.emitir({ tipo: TipoCFE.E_TICKET, moneda: 'UYU', lineas }),
    factible.emitir({ tipo: TipoCFE.E_TICKET, moneda: 'UYU', lineas }),
    factible.emitir({ tipo: TipoCFE.E_FACTURA, moneda: 'UYU', lineas, receptor }),
  ]);
}

describe('crearReporteDiario', () => {
  it('genera reporte firmado válido contra ReporteDiarioCFE.xsd', async () => {
    const emitidos = await emitirDia();
    const xml = crearReporteDiario({
      rucEmisor: emisor.ruc,
      fechaResumen: new Date(),
      secEnvio: 1,
      codSucursal: 1,
      emitidos,
    });
    const firmado = firmarReporte(xml, certificado);
    expect(verificarFirmaCfe(firmado)).toBe(true);

    const dir = mkdtempSync(join(tmpdir(), 'rep-'));
    const file = join(dir, 'rep.xml');
    writeFileSync(file, `<?xml version="1.0" encoding="UTF-8"?>${firmado}`);
    const xsd = resolve(__dirname, '../spec/xsd/ReporteDiarioCFE.xsd');
    expect(() =>
      execFileSync('xmllint', ['--noout', '--schema', xsd, file], { encoding: 'utf8', stdio: 'pipe' }),
    ).not.toThrow();
  });

  it('resume montos y rangos por tipo', async () => {
    const emitidos = await emitirDia();
    const xml = crearReporteDiario({
      rucEmisor: emisor.ruc, fechaResumen: new Date(), secEnvio: 1, codSucursal: 1, emitidos,
    });
    expect(xml).toContain('<CantComprobantes>3</CantComprobantes>');
    // e-Ticket: 2 docs, rango A 1-2, neto 380, IVA 83.60
    expect(xml).toContain('<Rsmn_Tck><TipoComp>101</TipoComp>');
    expect(xml).toContain('<Serie>A</Serie><NroDesde>1</NroDesde><NroHasta>2</NroHasta>');
    expect(xml).toContain('<TotMntIVATasaBas>380</TotMntIVATasaBas>');
    expect(xml).toContain('<MntIVATasaBas>83.6</MntIVATasaBas>'.replace('83.6', '83.60'));
    // e-Factura: 1 doc, rango F 1-1
    expect(xml).toContain('<Rsmn_Fac><TipoComp>111</TipoComp>');
    expect(xml).toContain('<Serie>F</Serie><NroDesde>1</NroDesde><NroHasta>1</NroHasta>');
  });

  it('reporte sin movimiento: válido con 0 comprobantes', async () => {
    const xml = crearReporteDiario({
      rucEmisor: emisor.ruc, fechaResumen: new Date(), secEnvio: 1, codSucursal: 1, emitidos: [],
    });
    const firmado = firmarReporte(xml, certificado);
    const dir = mkdtempSync(join(tmpdir(), 'rep0-'));
    const file = join(dir, 'rep.xml');
    writeFileSync(file, `<?xml version="1.0" encoding="UTF-8"?>${firmado}`);
    const xsd = resolve(__dirname, '../spec/xsd/ReporteDiarioCFE.xsd');
    expect(() =>
      execFileSync('xmllint', ['--noout', '--schema', xsd, file], { encoding: 'utf8', stdio: 'pipe' }),
    ).not.toThrow();
  });

  it('detecta numeración duplicada', async () => {
    const [uno] = await emitirDia();
    expect(() =>
      crearReporteDiario({
        rucEmisor: emisor.ruc, fechaResumen: new Date(), secEnvio: 1, codSucursal: 1,
        emitidos: [uno!, uno!],
      }),
    ).toThrow(/duplicado/);
  });
});
