import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildCfeXml } from '../src/builder/xml.js';
import { IndicadorFacturacion, TipoCFE, type CfeInput } from '../src/types/cfe.js';
import type { Cae } from '../src/types/cae.js';

const emisor = {
  ruc: '211234560012',
  razonSocial: 'Ejemplo SA',
  sucursal: { codigo: 1, domicilio: 'Av. Siempre Viva 123', ciudad: 'Montevideo', departamento: 'Montevideo' },
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
  emisor,
  moneda: 'UYU',
  fechaEmision: new Date('2026-07-04T14:30:00-03:00'),
  lineas: [
    { cantidad: 2, descripcion: 'Café espresso', precioUnitario: 190, indicadorFacturacion: IndicadorFacturacion.TASA_BASICA },
    { cantidad: 1, descripcion: 'Medialuna', precioUnitario: 80, indicadorFacturacion: IndicadorFacturacion.TASA_MINIMA },
  ],
};

const factura: CfeInput = {
  ...ticket,
  tipo: TipoCFE.E_FACTURA,
  receptor: {
    tipoDocumento: 'RUC',
    documento: '219876540015',
    razonSocial: 'Cliente SRL',
    domicilio: '18 de Julio 1000',
    ciudad: 'Montevideo',
    departamento: 'Montevideo',
  },
};

/** Firma dummy estructuralmente válida (xmldsig) para poder validar contra el XSD sin firmar de verdad. */
const DUMMY_SIGNATURE =
  '<ds:Signature xmlns:ds="http://www.w3.org/2000/09/xmldsig#"><ds:SignedInfo>' +
  '<ds:CanonicalizationMethod Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"/>' +
  '<ds:SignatureMethod Algorithm="http://www.w3.org/2001/04/xmldsig-more#rsa-sha256"/>' +
  '<ds:Reference URI=""><ds:DigestMethod Algorithm="http://www.w3.org/2001/04/xmlenc#sha256"/>' +
  '<ds:DigestValue>AA==</ds:DigestValue></ds:Reference></ds:SignedInfo>' +
  '<ds:SignatureValue>AA==</ds:SignatureValue></ds:Signature>';

function validarContraXsd(xml: string): string {
  const conFirma = xml.replace('</eTck></CFE>', `</eTck>${DUMMY_SIGNATURE}</CFE>`).replace(
    '</eFact></CFE>',
    `</eFact>${DUMMY_SIGNATURE}</CFE>`,
  );
  const dir = mkdtempSync(join(tmpdir(), 'cfe-'));
  const file = join(dir, 'cfe.xml');
  writeFileSync(file, `<?xml version="1.0" encoding="UTF-8"?>${conFirma}`);
  const xsd = resolve(__dirname, '../spec/xsd/CFEDGI.xsd');
  try {
    return execFileSync('xmllint', ['--noout', '--schema', xsd, file], { encoding: 'utf8', stdio: 'pipe' });
  } catch (e: any) {
    throw new Error(`Validación XSD falló:\n${e.stderr}`);
  }
}

describe('buildCfeXml', () => {
  it('genera un e-Ticket válido contra el XSD oficial v1.44.2', () => {
    const xml = buildCfeXml({ input: ticket, serie: 'A', numero: 42, cae });
    expect(xml).toContain('<TipoCFE>101</TipoCFE>');
    expect(xml).toContain('<MntTotal>551.60</MntTotal>'); // 380*1.22 + 80*1.10
    expect(() => validarContraXsd(xml)).not.toThrow();
  });

  it('genera una e-Factura con receptor válida contra el XSD', () => {
    const xml = buildCfeXml({ input: factura, serie: 'A', numero: 43, cae });
    expect(xml).toContain('<TipoCFE>111</TipoCFE>');
    expect(xml).toContain('<DocRecep>219876540015</DocRecep>');
    expect(() => validarContraXsd(xml)).not.toThrow();
  });

  it('genera una NC de e-Ticket con referencia (regla v25: monto+moneda) válida contra el XSD', () => {
    const nc: CfeInput = {
      ...ticket,
      tipo: TipoCFE.NC_E_TICKET,
      referencias: [
        { tipoCFE: TipoCFE.E_TICKET, serie: 'A', numero: 42, monto: 551.6, moneda: 'UYU', razon: 'Devolución' },
      ],
    };
    const xml = buildCfeXml({ input: nc, serie: 'A', numero: 44, cae });
    expect(xml).toContain('<TpoDocRef>101</TpoDocRef>');
    expect(xml).toContain('<MntCFEref>551.60</MntCFEref>');
    expect(() => validarContraXsd(xml)).not.toThrow();
  });

  it('rechaza e-Factura con receptor sin RUC (regla A-C60)', () => {
    const conCi: CfeInput = { ...factura, receptor: { tipoDocumento: 'CI', documento: '12345672' } };
    expect(() => buildCfeXml({ input: conCi, serie: 'A', numero: 48, cae })).toThrow(/RUC/);
  });

  it('rechaza documento uruguayo con país extranjero (regla A-C61)', () => {
    const mal: CfeInput = {
      ...ticket,
      receptor: { tipoDocumento: 'CI', documento: '12345672', paisCodigo: 'AR' },
    };
    expect(() => buildCfeXml({ input: mal, serie: 'A', numero: 49, cae })).toThrow(/A-C61/);
  });

  it('rechaza e-Factura sin receptor', () => {
    expect(() => buildCfeXml({ input: { ...factura, receptor: undefined }, serie: 'A', numero: 45, cae })).toThrow(
      /receptor/,
    );
  });

  it('rechaza NC sin referencias', () => {
    expect(() =>
      buildCfeXml({ input: { ...ticket, tipo: TipoCFE.NC_E_TICKET }, serie: 'A', numero: 46, cae }),
    ).toThrow(/referencia/);
  });

  it('rechaza moneda extranjera sin tipo de cambio', () => {
    expect(() => buildCfeXml({ input: { ...ticket, moneda: 'USD' }, serie: 'A', numero: 47, cae })).toThrow(
      /tipoCambio/,
    );
  });
});
