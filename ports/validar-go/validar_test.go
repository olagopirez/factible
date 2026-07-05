package validar

import "testing"

func TestDigitoVerificadorCI(t *testing.T) {
	dv, err := DigitoVerificadorCI("1234567")
	if err != nil || dv != 2 {
		t.Fatalf("esperaba 2, obtuve %d (err %v)", dv, err)
	}
}

func TestValidarCI(t *testing.T) {
	casos := map[string]bool{
		"1.234.567-2": true,
		"12345672":    true,
		"1.234.567-3": false,
		"":            false,
		"abc":         false,
		"123456789":   false,
	}
	for ci, esperado := range casos {
		if ValidarCI(ci) != esperado {
			t.Errorf("ValidarCI(%q) != %v", ci, esperado)
		}
	}
}

func TestValidarRUT(t *testing.T) {
	if !ValidarRUT("219999830019") {
		t.Error("el RUT real de DGI debería ser válido")
	}
	if !ValidarRUT("21.999983.001-9") {
		t.Error("debería aceptar formato con puntos y guión")
	}
	if ValidarRUT("219999830018") || ValidarRUT("21999983001") || ValidarRUT("") {
		t.Error("debería rechazar dv incorrecto, largo incorrecto y vacío")
	}
}

func TestDigitoVerificadorRUT(t *testing.T) {
	dv, err := DigitoVerificadorRUT("21999983001")
	if err != nil || dv != 9 {
		t.Fatalf("esperaba 9, obtuve %d (err %v)", dv, err)
	}
}
