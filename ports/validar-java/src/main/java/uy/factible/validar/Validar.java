package uy.factible.validar;

/**
 * factible/validar — validación de documentos uruguayos (CI y RUT).
 *
 * Port oficial de @factible/validar. Cero dependencias.
 * Parte del ecosistema factible: https://github.com/olagopirez/factible
 */
public final class Validar {

    private static final int[] COEFS_CI = {2, 9, 8, 7, 6, 3, 4};
    private static final int[] COEFS_RUT = {4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2};

    private Validar() {}

    /** Quita puntos, guiones y espacios. */
    public static String normalizarCi(String ci) {
        return ci.replaceAll("[.\\-\\s]", "");
    }

    /** Quita puntos, guiones y espacios. */
    public static String normalizarRut(String rut) {
        return rut.replaceAll("[.\\-\\s]", "");
    }

    /** Dígito verificador para un número de CI (sin dv, hasta 7 dígitos). */
    public static int digitoVerificadorCi(String numero) {
        String digitos = String.format("%7s", numero).replace(' ', '0');
        if (!digitos.matches("\\d{7}")) {
            throw new IllegalArgumentException(
                "Número de CI inválido: \"" + numero + "\" (se esperan hasta 7 dígitos)");
        }
        int suma = 0;
        for (int i = 0; i < 7; i++) {
            suma += (digitos.charAt(i) - '0') * COEFS_CI[i];
        }
        return (10 - (suma % 10)) % 10;
    }

    /** Valida una CI completa (con dígito verificador). Acepta puntos/guión. */
    public static boolean validarCi(String ci) {
        String limpia = normalizarCi(ci);
        if (!limpia.matches("\\d{7,8}")) return false;
        return digitoVerificadorCi(limpia.substring(0, limpia.length() - 1))
            == limpia.charAt(limpia.length() - 1) - '0';
    }

    /** Formatea como "1.234.567-2". */
    public static String formatearCi(String ci) {
        String limpia = normalizarCi(ci);
        if (!limpia.matches("\\d{7,8}")) {
            throw new IllegalArgumentException("CI inválida: \"" + ci + "\"");
        }
        String c = String.format("%8s", limpia).replace(' ', '0');
        String millones = c.charAt(0) != '0' ? c.charAt(0) + "." : "";
        return millones + c.substring(1, 4) + "." + c.substring(4, 7) + "-" + c.charAt(7);
    }

    /**
     * Dígito verificador para los primeros 11 dígitos de un RUT.
     * Devuelve null si el número no admite RUT válido (resto 10).
     */
    public static Integer digitoVerificadorRut(String base) {
        if (!base.matches("\\d{11}")) {
            throw new IllegalArgumentException(
                "Base de RUT inválida: \"" + base + "\" (se esperan 11 dígitos)");
        }
        int suma = 0;
        for (int i = 0; i < 11; i++) {
            suma += (base.charAt(i) - '0') * COEFS_RUT[i];
        }
        int dv = 11 - (suma % 11);
        if (dv == 11) return 0;
        if (dv == 10) return null;
        return dv;
    }

    /** Valida un RUT completo de 12 dígitos. Acepta puntos/guión. */
    public static boolean validarRut(String rut) {
        String limpio = normalizarRut(rut);
        if (!limpio.matches("\\d{12}")) return false;
        Integer dv = digitoVerificadorRut(limpio.substring(0, 11));
        return dv != null && dv == limpio.charAt(11) - '0';
    }
}
