"""Tests de factible-validar. Correr: python3 -m unittest test_validar -v"""
import unittest

from factible_validar import (
    digito_verificador_ci, digito_verificador_rut, formatear_ci,
    validar_ci, validar_rut,
)


class TestCi(unittest.TestCase):
    def test_digito_verificador_ejemplo_conocido(self):
        self.assertEqual(digito_verificador_ci("1234567"), 2)

    def test_valida_formatos(self):
        self.assertTrue(validar_ci("1.234.567-2"))
        self.assertTrue(validar_ci("12345672"))
        self.assertFalse(validar_ci("1.234.567-3"))

    def test_ci_seis_digitos(self):
        dv = digito_verificador_ci("123456")
        self.assertTrue(validar_ci(f"123456{dv}"))

    def test_rechaza_basura(self):
        self.assertFalse(validar_ci(""))
        self.assertFalse(validar_ci("abc"))
        self.assertFalse(validar_ci("123456789"))

    def test_formatea(self):
        self.assertEqual(formatear_ci("12345672"), "1.234.567-2")


class TestRut(unittest.TestCase):
    def test_rut_real_de_dgi(self):
        self.assertTrue(validar_rut("219999830019"))

    def test_digito_verificador(self):
        self.assertEqual(digito_verificador_rut("21999983001"), 9)

    def test_rechaza_dv_incorrecto(self):
        self.assertFalse(validar_rut("219999830018"))

    def test_acepta_formato_con_puntos(self):
        self.assertTrue(validar_rut("21.999983.001-9"))

    def test_rechaza_largo_incorrecto(self):
        self.assertFalse(validar_rut("21999983001"))
        self.assertFalse(validar_rut(""))
        self.assertFalse(validar_rut("abcdefghijkl"))


if __name__ == "__main__":
    unittest.main()
