---
"@factible/id-uruguay": patch
---

Actualiza `jose` de `^5.9.0` a `^6.2.12`. Sin cambios en la API de `@factible/id-uruguay`: jose v6 es ESM-only y pasa a `CryptoKey` de WebCrypto como tipo de clave, y el paquete ya cumplía ambas cosas (ESM puro, `CryptoKey` en el mock, `RS256`). Los removals de v6 (Ed448/X448, secp256k1, RSA1_5, opción `agent` de `createRemoteJWKSet`) no se usaban.
