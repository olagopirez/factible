/**
 * Cédula de Identidad uruguaya.
 * Algoritmo: los 7 dígitos del número (sin verificador, con ceros a la izquierda)
 * se multiplican por [2,9,8,7,6,3,4]; dv = (10 - suma % 10) % 10.
 */

const COEFS_CI = [2, 9, 8, 7, 6, 3, 4] as const;

/** Normaliza una CI quitando puntos, guiones y espacios. */
export function normalizarCi(ci: string): string {
  return ci.replace(/[.\-\s]/g, '');
}

/** Calcula el dígito verificador para un número de CI (sin dv, 6 o 7 dígitos). */
export function digitoVerificadorCi(numero: string | number): number {
  const digitos = String(numero).padStart(7, '0');
  if (!/^\d{7}$/.test(digitos)) {
    throw new Error(`Número de CI inválido: "${numero}" (se esperan hasta 7 dígitos)`);
  }
  const suma = [...digitos].reduce((acc, d, i) => acc + Number(d) * COEFS_CI[i]!, 0);
  return (10 - (suma % 10)) % 10;
}

/** Valida una CI completa (con dígito verificador). Acepta formato con puntos/guión. */
export function validarCi(ci: string): boolean {
  const limpia = normalizarCi(ci);
  if (!/^\d{7,8}$/.test(limpia)) return false;
  const numero = limpia.slice(0, -1);
  const dv = Number(limpia.slice(-1));
  return digitoVerificadorCi(numero) === dv;
}

/** Formatea una CI como "1.234.567-2". */
export function formatearCi(ci: string): string {
  const limpia = normalizarCi(ci);
  if (!/^\d{7,8}$/.test(limpia)) throw new Error(`CI inválida: "${ci}"`);
  const conOcho = limpia.padStart(8, '0');
  const [m, a, b, dv] = [conOcho.slice(0, 1), conOcho.slice(1, 4), conOcho.slice(4, 7), conOcho.slice(7)];
  return `${Number(m) > 0 ? `${Number(m)}.` : ''}${a}.${b}-${dv}`;
}
