# @factible/validar

Validación y dígito verificador de documentos uruguayos: **CI** y **RUT**. Cero dependencias.

```ts
import {
  validarCi, digitoVerificadorCi, formatearCi, normalizarCi,
  validarRut, digitoVerificadorRut, normalizarRut,
} from '@factible/validar';

// Cédula de identidad
validarCi('1.234.567-2');       // true — acepta con o sin puntos/guión
digitoVerificadorCi('1234567'); // 2
formatearCi('12345672');        // '1.234.567-2'
normalizarCi('1.234.567-2');    // '12345672'

// RUT (12 dígitos)
validarRut('219999830019');        // true (el RUT de DGI, de hecho)
digitoVerificadorRut('21999983001'); // 9 — null si el número no admite RUT válido
normalizarRut('21.999983.001-9');  // '219999830019'
```

Parte del ecosistema [factible](../../README.md): infraestructura open source para integrarte con el Estado uruguayo.

## Licencia

MIT
