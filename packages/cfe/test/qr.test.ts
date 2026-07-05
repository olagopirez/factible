import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildCfeXml } from '../src/builder/xml.js';
import { codigoSeguridad, codigoSeguridadImpreso, urlQr } from '../src/qr/qr.js';
import { firmarCfe } from '../src/signer/xmldsig.js';
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
    ruc: '211234560019',
    razonSocial: 'Ejemplo SA',
    sucursal: { codigo: 1, domicilio: 'Av. Siempre Viva 123', ciudad: 'Montevideo', departamento: 'Montevideo' },
  },
  moneda: 'UYU',
  fechaEmision: new Date('2026-07-04T14:30:00-03:00'),
  lineas: [
    { cantidad: 1, descripcion: 'Café', precioUnitario: 190, indicadorFacturacion: IndicadorFacturacion.TASA_BASICA },
  ],
};

const firmado = firmarCfe(
  buildCfeXml({ input: ticket, serie: 'A', numero: 300, cae, fechaFirma: new Date('2026-07-04T15:00:00-03:00') }),
  certificado,
);

describe('código de seguridad y QR', () => {
  it('extrae el código de seguridad (DigestValue Base64) del CFE firmado', () => {
    const code = codigoSeguridad(firmado);
    expect(code.length).toBeGreaterThanOrEqual(28); // SHA-256 en Base64 = 44 chars
    expect(() => Buffer.from(code, 'base64')).not.toThrow();
  });

  it('el código impreso son los primeros 6 caracteres', () => {
    expect(codigoSeguridadImpreso(firmado)).toBe(codigoSeguridad(firmado).slice(0, 6));
    expect(codigoSeguridadImpreso(firmado)).toHaveLength(6);
  });

  it('arma la URL del QR con los 7 parámetros en orden', () => {
    const url = urlQr(firmado);
    expect(url).toMatch(/^https:\/\/www\.efactura\.dgi\.gub\.uy\/consultaQR\/cfe\?/);
    const params = url.split('?')[1]!.split(',');
    expect(params[0]).toBe('211234560019'); // RUC
    expect(params[1]).toBe('101'); // TipoCFE
    expect(params[2]).toBe('A'); // Serie
    expect(params[3]).toBe('300'); // Nro
    expect(params[4]).toBe('231.80'); // MntPagar
    expect(params[5]).toBe('04/07/2026'); // fecha de firma dd/mm/yyyy
    expect(decodeURIComponent(params[6]!)).toBe(codigoSeguridad(firmado)); // hash
  });

  it('falla con un CFE sin firma', () => {
    const sinFirma = buildCfeXml({ input: ticket, serie: 'A', numero: 301, cae });
    expect(() => codigoSeguridad(sinFirma)).toThrow(/DigestValue/);
  });
});
