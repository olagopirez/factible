import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseAcuseCfe, parseAcuseSobre } from '../src/acuses/acuses.js';

/**
 * Acuses REALES del ambiente de Testing de DGI, capturados el 2026-07-08
 * mediante el envío manual de sobres por el portal (Envíos → Sobre).
 * "Los mocks no mienten": estos fixtures verifican que el parser funciona
 * contra lo que DGI responde de verdad, no contra lo que dice la spec.
 *
 * Hallazgos empíricos documentados en los propios fixtures:
 * - DGI firma sus acuses con rsa-sha1 (a los emisores nos exige SHA-2).
 * - El RUC del emisor se vincula al certificado vía subject serialNumber="RUC"+RUT.
 * - A nivel sobre NO se valida la cadena de CA; a nivel CFE sí (E04 certificate not trusted).
 */
const fixture = (nombre: string) =>
  readFileSync(resolve(__dirname, 'fixtures/acuses-reales', nombre), 'utf8');

describe('parseAcuseSobre con acuses reales de DGI Testing', () => {
  it('parsea un rechazo BS con motivo S02 (RUC del cert no coincide)', () => {
    const acuse = parseAcuseSobre(fixture('ack-sobre-bs-s02.xml'));
    expect(acuse.estado).toBe('BS');
    expect(acuse.aceptado).toBe(false);
    expect(acuse.rucReceptor).toBe('219999830019');
    expect(acuse.rucEmisor).toBe('211234560019');
    expect(acuse.idRespuesta).toBe(306849304);
    expect(acuse.nombreArchivo).toBe('sobre-testing.xml');
    expect(acuse.cantidadCfe).toBe(1);
    expect(acuse.motivosRechazo).toHaveLength(1);
    expect(acuse.motivosRechazo[0]).toMatchObject({
      motivo: 'S02',
      glosa: 'No coincide RUC de Sobre, Certificado, envío o CFE',
    });
    expect(acuse.consulta).toBeUndefined();
  });

  it('parsea una aceptación AS con token de consulta', () => {
    const acuse = parseAcuseSobre(fixture('ack-sobre-as.xml'));
    expect(acuse.estado).toBe('AS');
    expect(acuse.aceptado).toBe(true);
    expect(acuse.idRespuesta).toBe(306849522);
    expect(acuse.motivosRechazo).toHaveLength(0);
    expect(acuse.consulta).toBeDefined();
    expect(acuse.consulta!.token.length).toBeGreaterThan(50);
    expect(acuse.consulta!.desde.toISOString()).toBe('2026-07-08T21:08:10.000Z');
  });
});

describe('parseAcuseCfe con acuses reales de DGI Testing', () => {
  it('parsea un rechazo BE con motivo E04 (certificado no confiable)', () => {
    const acuse = parseAcuseCfe(fixture('ack-cfe-be-e04.xml'));
    expect(acuse.rucEmisor).toBe('211234560019');
    expect(acuse.idRespuesta).toBe(306849522);
    expect(acuse.aceptados).toBe(0);
    expect(acuse.rechazados).toBe(1);
    expect(acuse.detalles).toHaveLength(1);
    const det = acuse.detalles[0];
    expect(det).toMatchObject({
      ordinal: 1,
      tipoCFE: 101,
      serie: 'A',
      numero: 1,
      estado: 'BE',
      aceptado: false,
    });
    expect(det.motivosRechazo[0]).toMatchObject({
      motivo: 'E04',
      glosa: 'Firma electrónica no es válida',
      detalle: 'Error al validar el Certificado - certificate not trusted',
    });
  });
});
