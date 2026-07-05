"""factible-validar — validación de documentos uruguayos (CI y RUT).

Port oficial de @factible/validar. Cero dependencias.
Parte del ecosistema factible: https://github.com/olagopirez/factible
"""
import re

__all__ = [
    "validar_ci", "digito_verificador_ci", "formatear_ci", "normalizar_ci",
    "validar_rut", "digito_verificador_rut", "normalizar_rut",
]

_COEFS_CI = (2, 9, 8, 7, 6, 3, 4)
_COEFS_RUT = (4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2)


def normalizar_ci(ci: str) -> str:
    """Quita puntos, guiones y espacios."""
    return re.sub(r"[.\-\s]", "", ci)


def digito_verificador_ci(numero) -> int:
    """Dígito verificador para un número de CI (sin dv, hasta 7 dígitos)."""
    digitos = str(numero).zfill(7)
    if not re.fullmatch(r"\d{7}", digitos):
        raise ValueError(f'Número de CI inválido: "{numero}" (se esperan hasta 7 dígitos)')
    suma = sum(int(d) * c for d, c in zip(digitos, _COEFS_CI))
    return (10 - (suma % 10)) % 10


def validar_ci(ci: str) -> bool:
    """Valida una CI completa (con dígito verificador). Acepta puntos/guión."""
    limpia = normalizar_ci(ci)
    if not re.fullmatch(r"\d{7,8}", limpia):
        return False
    return digito_verificador_ci(limpia[:-1]) == int(limpia[-1])


def formatear_ci(ci: str) -> str:
    """Formatea como '1.234.567-2'."""
    limpia = normalizar_ci(ci)
    if not re.fullmatch(r"\d{7,8}", limpia):
        raise ValueError(f'CI inválida: "{ci}"')
    c = limpia.zfill(8)
    millones = f"{int(c[0])}." if int(c[0]) > 0 else ""
    return f"{millones}{c[1:4]}.{c[4:7]}-{c[7]}"


def normalizar_rut(rut: str) -> str:
    """Quita puntos, guiones y espacios."""
    return re.sub(r"[.\-\s]", "", rut)


def digito_verificador_rut(base: str):
    """Dígito verificador para los primeros 11 dígitos de un RUT.

    Devuelve None si el número no admite RUT válido (resto 10).
    """
    if not re.fullmatch(r"\d{11}", base):
        raise ValueError(f'Base de RUT inválida: "{base}" (se esperan 11 dígitos)')
    suma = sum(int(d) * c for d, c in zip(base, _COEFS_RUT))
    dv = 11 - (suma % 11)
    if dv == 11:
        return 0
    if dv == 10:
        return None
    return dv


def validar_rut(rut: str) -> bool:
    """Valida un RUT completo de 12 dígitos. Acepta puntos/guión."""
    limpio = normalizar_rut(rut)
    if not re.fullmatch(r"\d{12}", limpio):
        return False
    return digito_verificador_rut(limpio[:11]) == int(limpio[-1])
