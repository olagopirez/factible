/**
 * RUT/RUC uruguayo (12 dígitos).
 * Algoritmo: los primeros 11 dígitos se multiplican por [4,3,2,9,8,7,6,5,4,3,2];
 * resto = suma % 11; dv = 11 - resto (11 → 0; 10 → no existe RUT válido).
 */

const COEFS_RUT = [4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] as const;

/** Normaliza un RUT quitando puntos, guiones y espacios. */
export function normalizarRut(rut: string): string {
  return rut.replace(/[.\-\s]/g, '');
}

/**
 * Calcula el dígito verificador para los primeros 11 dígitos de un RUT.
 * Devuelve null si el número no admite verificador (resto 10 — RUT inexistente).
 */
export function digitoVerificadorRut(base: string): number | null {
  if (!/^\d{11}$/.test(base)) {
    throw new Error(`Base de RUT inválida: "${base}" (se esperan 11 dígitos)`);
  }
  const suma = [...base].reduce((acc, d, i) => acc + Number(d) * COEFS_RUT[i]!, 0);
  const dv = 11 - (suma % 11);
  if (dv === 11) return 0;
  if (dv === 10) return null;
  return dv;
}

/** Valida un RUT completo de 12 dígitos. Acepta formato con puntos/guión. */
export function validarRut(rut: string): boolean {
  const limpio = normalizarRut(rut);
  if (!/^\d{12}$/.test(limpio)) return false;
  return digitoVerificadorRut(limpio.slice(0, 11)) === Number(limpio.slice(-1));
}
