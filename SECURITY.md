# Política de seguridad

Este proyecto maneja material sensible por naturaleza: firma digital de comprobantes fiscales, autenticación con cédula de identidad y credenciales de APIs estatales. Los reportes de seguridad se toman en serio.

## Cómo reportar una vulnerabilidad

**No abras un issue público.** En su lugar:

- Usá [GitHub Security Advisories](https://github.com/olagopirez/factible/security/advisories/new) (preferido), o
- escribí a **olagopirez@gmail.com** con asunto `[SECURITY] factible`.

Incluí si podés: el paquete afectado y su versión, una descripción del problema, pasos para reproducirlo y el impacto que estimás.

## Qué esperar

- Confirmación de recibo dentro de las **72 horas**.
- Evaluación y plan de corrección dentro de los **14 días**.
- Crédito en el advisory al publicar el fix (salvo que prefieras anonimato).

## Versiones soportadas

Los paquetes están en fase 0.x: se corrige la última versión publicada de cada paquete en npm. No hay backports a versiones anteriores.

## Áreas especialmente sensibles

- `@factible/cfe` — firma XMLDSig, manejo de claves privadas y certificados, construcción de XML fiscal.
- `@factible/id-uruguay` — verificación de id_token (JWKS), nonce, flujo OIDC.
- Manejo de credenciales en todos los clientes HTTP (`bcu`, `montevideo`).

Si encontrás algo raro en esas zonas, aunque no estés seguro de que sea explotable, reportalo igual.
