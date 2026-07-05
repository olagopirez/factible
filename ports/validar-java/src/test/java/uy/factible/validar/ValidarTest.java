package uy.factible.validar;

/**
 * Tests sin dependencias. Correr:
 *   cd ports/validar-java && javac -d out src/main/java/uy/factible/validar/Validar.java src/test/java/uy/factible/validar/ValidarTest.java && java -cp out uy.factible.validar.ValidarTest
 */
public final class ValidarTest {

    private static int fallas = 0;

    private static void check(boolean cond, String msg) {
        System.out.println((cond ? "  ✓ " : "  ✗ ") + msg);
        if (!cond) fallas++;
    }

    public static void main(String[] args) {
        System.out.println("CI:");
        check(Validar.digitoVerificadorCi("1234567") == 2, "dígito verificador ejemplo conocido (1234567 → 2)");
        check(Validar.validarCi("1.234.567-2"), "valida con puntos y guión");
        check(Validar.validarCi("12345672"), "valida sin formato");
        check(!Validar.validarCi("1.234.567-3"), "rechaza dv incorrecto");
        check(!Validar.validarCi("") && !Validar.validarCi("abc") && !Validar.validarCi("123456789"), "rechaza basura");
        check(Validar.formatearCi("12345672").equals("1.234.567-2"), "formatea");

        System.out.println("RUT:");
        check(Validar.validarRut("219999830019"), "RUT real de DGI válido");
        check(Integer.valueOf(9).equals(Validar.digitoVerificadorRut("21999983001")), "dígito verificador (→ 9)");
        check(!Validar.validarRut("219999830018"), "rechaza dv incorrecto");
        check(Validar.validarRut("21.999983.001-9"), "acepta formato con puntos");
        check(!Validar.validarRut("21999983001") && !Validar.validarRut(""), "rechaza largo incorrecto");

        if (fallas > 0) {
            System.out.println("\n" + fallas + " tests fallaron");
            System.exit(1);
        }
        System.out.println("\nTodos los tests pasaron ✓");
    }
}
