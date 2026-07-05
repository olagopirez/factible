import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildCfeXml } from '../src/builder/xml.js';
import { firmarCfe } from '../src/signer/xmldsig.js';
import { crearSobre, RUT_DGI } from '../src/sobre/sobre.js';
import { IndicadorFacturacion, TipoCFE, type CfeInput } from '../src/types/cfe.js';
import type { Cae } from '../src/types/cae.js';

const certificado = {
  privateKey: readFileSync(resolve(__dirname, 'fixtures/test-key.pem'), 'utf8'),
  cert: readFileSync(resolve(__dirname, 'fixtures/test-cert.pem'), 'utf8'),
};

const cae: Cae = {
  id: '90230011234',
  tipoCFE: TipoCFE.E_TICKET,
  serie: 'A',
  numeroDesde: 1,
  numeroHasta: 5000,
  fechaExpiracion: new Date('2027-12-31'),
};

const ticket: CfeInput = {
  tipo: TipoCFE.E_TICKET,
  emisor: {
    ruc: '211234560012',
    razonSocial: 'Ejemplo SA',
    sucursal: { codigo: 1, domicilio: 'Av. Siempre Viva 123', ciudad: 'Montevideo', departamento: 'Montevideo' },
  },
  moneda: 'UYU',
  fechaEmision: new Date('2026-07-04T14:30:00-03:00'),
  lineas: [
    { cantidad: 1, descripcion: 'Café', precioUnitario: 190, indicadorFacturacion: IndicadorFacturacion.TASA_BASICA },
  ],
};

const cfeFirmado = (numero: number) =>
  firmarCfe(buildCfeXml({ input: ticket, serie: 'A', numero, cae }), certificado);

describe('crearSobre', () => {
  it('genera un sobre con 2 CFEs válido contra EnvioCFE.xsd', () => {
    const sobre = crearSobre({
      rucEmisor: '211234560012',
      rutReceptor: RUT_DGI,
      idEmisor: 1,
      cfesFirmados: [cfeFirmado(200), cfeFirmado(201)],
      cert: certificado.cert,
      fecha: new Date('2026-07-04T15:00:00-03:00'),
    });
    expect(sobre).toContain('<CantCFE>2</CantCFE>');

    const dir = mkdtempSync(join(tmpdir(), 'sobre-'));
    const file = join(dir, 'sobre.xml');
    writeFileSync(file, `<?xml version="1.0" encoding="UTF-8"?>${sobre}`);
    const xsd = resolve(__dirname, '../spec/xsd/EnvioCFE.xsd');
    expect(() =>
      execFileSync('xmllint', ['--noout', '--schema', xsd, file], { encoding: 'utf8', stdio: 'pipe' }),
    ).not.toThrow();
  });

  it('rechaza sobre sin CFEs', () => {
    expect(() =>
      crearSobre({ rucEmisor: '211234560012', rutReceptor: RUT_DGI, idEmisor: 1, cfesFirmados: [], cert: certificado.cert }),
    ).toThrow(/entre 1 y 250/);
  });

  it('rechaza contenido que no sea un CFE', () => {
    expect(() =>
      crearSobre({
        rucEmisor: '211234560012',
        rutReceptor: RUT_DGI,
        idEmisor: 1,
        cfesFirmados: ['<Otro/>'],
        cert: certificado.cert,
      }),
    ).toThrow(/CFE/);
  });
});
