// Package validar — validación de documentos uruguayos (CI y RUT).
//
// Port oficial de @factible/validar. Cero dependencias.
// Parte del ecosistema factible: https://github.com/olagopirez/factible
package validar

import (
	"fmt"
	"regexp"
	"strings"
)

var (
	coefsCI      = [7]int{2, 9, 8, 7, 6, 3, 4}
	coefsRUT     = [11]int{4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2}
	soloDigitos  = regexp.MustCompile(`^\d+$`)
	separadores  = strings.NewReplacer(".", "", "-", "", " ", "")
)

// NormalizarCI quita puntos, guiones y espacios.
func NormalizarCI(ci string) string { return separadores.Replace(ci) }

// NormalizarRUT quita puntos, guiones y espacios.
func NormalizarRUT(rut string) string { return separadores.Replace(rut) }

// DigitoVerificadorCI calcula el dígito verificador para un número de CI (sin dv, hasta 7 dígitos).
func DigitoVerificadorCI(numero string) (int, error) {
	digitos := fmt.Sprintf("%07s", numero)
	if len(digitos) != 7 || !soloDigitos.MatchString(digitos) {
		return 0, fmt.Errorf("número de CI inválido: %q (se esperan hasta 7 dígitos)", numero)
	}
	suma := 0
	for i, r := range digitos {
		suma += int(r-'0') * coefsCI[i]
	}
	return (10 - (suma % 10)) % 10, nil
}

// ValidarCI valida una CI completa (con dígito verificador). Acepta puntos/guión.
func ValidarCI(ci string) bool {
	limpia := NormalizarCI(ci)
	if len(limpia) < 7 || len(limpia) > 8 || !soloDigitos.MatchString(limpia) {
		return false
	}
	dv, err := DigitoVerificadorCI(limpia[:len(limpia)-1])
	return err == nil && dv == int(limpia[len(limpia)-1]-'0')
}

// DigitoVerificadorRUT calcula el verificador para los primeros 11 dígitos de un RUT.
// Devuelve -1 si el número no admite RUT válido (resto 10).
func DigitoVerificadorRUT(base string) (int, error) {
	if len(base) != 11 || !soloDigitos.MatchString(base) {
		return 0, fmt.Errorf("base de RUT inválida: %q (se esperan 11 dígitos)", base)
	}
	suma := 0
	for i, r := range base {
		suma += int(r-'0') * coefsRUT[i]
	}
	dv := 11 - (suma % 11)
	switch dv {
	case 11:
		return 0, nil
	case 10:
		return -1, nil
	}
	return dv, nil
}

// ValidarRUT valida un RUT completo de 12 dígitos. Acepta puntos/guión.
func ValidarRUT(rut string) bool {
	limpio := NormalizarRUT(rut)
	if len(limpio) != 12 || !soloDigitos.MatchString(limpio) {
		return false
	}
	dv, err := DigitoVerificadorRUT(limpio[:11])
	return err == nil && dv == int(limpio[11]-'0')
}
