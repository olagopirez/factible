import { describe, expect, it } from 'vitest';
import {
  digitoVerificadorCi,
  digitoVerificadorRut,
  formatearCi,
  validarCi,
  validarRut,
} from '../src/index.js';

describe('CI', () => {
  it('calcula el dígito verificador (ejemplo conocido 1.234.567-2)', () => {
    expect(digitoVerificadorCi('1234567')).toBe(2);
  });

  it('valida CIs en distintos formatos', () => {
    expect(validarCi('1.234.567-2')).toBe(true);
    expect(validarCi('12345672')).toBe(true);
    expect(validarCi('1234567-2')).toBe(true);
    expect(validarCi('1.234.567-3')).toBe(false);
  });

  it('acepta CIs de 6 dígitos + dv (cédulas viejas)', () => {
    const dv = digitoVerificadorCi('123456');
    expect(validarCi(`123456${dv}`)).toBe(true);
  });

  it('rechaza basura', () => {
    expect(validarCi('')).toBe(false);
    expect(validarCi('abc')).toBe(false);
    expect(validarCi('123456789')).toBe(false);
  });

  it('formatea', () => {
    expect(formatearCi('12345672')).toBe('1.234.567-2');
  });
});

describe('RUT', () => {
  it('valida el RUT real de DGI (219999830019)', () => {
    expect(validarRut('219999830019')).toBe(true);
  });

  it('calcula dígito verificador', () => {
    expect(digitoVerificadorRut('21999983001')).toBe(9);
  });

  it('rechaza RUT con dv incorrecto', () => {
    expect(validarRut('219999830018')).toBe(false);
  });

  it('acepta formato con puntos y guión', () => {
    expect(validarRut('21.999983.001-9')).toBe(true);
  });

  it('rechaza largo incorrecto y basura', () => {
    expect(validarRut('21999983001')).toBe(false);
    expect(validarRut('')).toBe(false);
    expect(validarRut('abcdefghijkl')).toBe(false);
  });
});
