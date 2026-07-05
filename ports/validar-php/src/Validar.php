<?php
/**
 * factible/validar — validación de documentos uruguayos (CI y RUT).
 *
 * Port oficial de @factible/validar. Cero dependencias.
 * Parte del ecosistema factible: https://github.com/olagopirez/factible
 */

declare(strict_types=1);

namespace Factible;

final class Validar
{
    private const COEFS_CI = [2, 9, 8, 7, 6, 3, 4];
    private const COEFS_RUT = [4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

    /** Quita puntos, guiones y espacios. */
    public static function normalizarCi(string $ci): string
    {
        return preg_replace('/[.\-\s]/', '', $ci);
    }

    /** Quita puntos, guiones y espacios. */
    public static function normalizarRut(string $rut): string
    {
        return preg_replace('/[.\-\s]/', '', $rut);
    }

    /** Dígito verificador para un número de CI (sin dv, hasta 7 dígitos). */
    public static function digitoVerificadorCi(string|int $numero): int
    {
        $digitos = str_pad((string) $numero, 7, '0', STR_PAD_LEFT);
        if (!preg_match('/^\d{7}$/', $digitos)) {
            throw new \InvalidArgumentException("Número de CI inválido: \"$numero\" (se esperan hasta 7 dígitos)");
        }
        $suma = 0;
        foreach (str_split($digitos) as $i => $d) {
            $suma += ((int) $d) * self::COEFS_CI[$i];
        }
        return (10 - ($suma % 10)) % 10;
    }

    /** Valida una CI completa (con dígito verificador). Acepta puntos/guión. */
    public static function validarCi(string $ci): bool
    {
        $limpia = self::normalizarCi($ci);
        if (!preg_match('/^\d{7,8}$/', $limpia)) {
            return false;
        }
        return self::digitoVerificadorCi(substr($limpia, 0, -1)) === (int) substr($limpia, -1);
    }

    /** Formatea como "1.234.567-2". */
    public static function formatearCi(string $ci): string
    {
        $limpia = self::normalizarCi($ci);
        if (!preg_match('/^\d{7,8}$/', $limpia)) {
            throw new \InvalidArgumentException("CI inválida: \"$ci\"");
        }
        $c = str_pad($limpia, 8, '0', STR_PAD_LEFT);
        $millones = ((int) $c[0]) > 0 ? $c[0] . '.' : '';
        return $millones . substr($c, 1, 3) . '.' . substr($c, 4, 3) . '-' . $c[7];
    }

    /**
     * Dígito verificador para los primeros 11 dígitos de un RUT.
     * Devuelve null si el número no admite RUT válido (resto 10).
     */
    public static function digitoVerificadorRut(string $base): ?int
    {
        if (!preg_match('/^\d{11}$/', $base)) {
            throw new \InvalidArgumentException("Base de RUT inválida: \"$base\" (se esperan 11 dígitos)");
        }
        $suma = 0;
        foreach (str_split($base) as $i => $d) {
            $suma += ((int) $d) * self::COEFS_RUT[$i];
        }
        $dv = 11 - ($suma % 11);
        if ($dv === 11) {
            return 0;
        }
        if ($dv === 10) {
            return null;
        }
        return $dv;
    }

    /** Valida un RUT completo de 12 dígitos. Acepta puntos/guión. */
    public static function validarRut(string $rut): bool
    {
        $limpio = self::normalizarRut($rut);
        if (!preg_match('/^\d{12}$/', $limpio)) {
            return false;
        }
        return self::digitoVerificadorRut(substr($limpio, 0, 11)) === (int) substr($limpio, -1);
    }
}
