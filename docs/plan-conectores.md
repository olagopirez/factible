# Plan de conectores estatales — ecosistema factible

**Visión:** factible como la infraestructura open source de referencia para integrarse con el Estado uruguayo. Un conector por organismo, misma DX: TypeScript tipado, mocks incluidos, validado contra las specs oficiales.

**Principio (aprendido con CFE):** un conector solo entra al roadmap si pasa el triaje: ① API/formato oficial documentado y accesible, ② validable sin depender de terceros (o con trámite liviano), ③ demanda real de devs. DGI salió "en una tarde" porque publica XSDs y ejemplos — es el organismo mejor documentado; el resto varía mucho.

## Triaje (relevado 2026-07)

| Conector | API oficial | Acceso | Validación real | Competencia | Veredicto |
|---|---|---|---|---|---|
| **@factible/bcu** — cotizaciones de monedas | SOAP público, [WSDL abierto](https://cotizaciones.bcu.gub.uy/wscotizaciones/servlet/awsbcucotizaciones?wsdl), sin auth | Ninguno | ✅ **Hoy, sin trámites** | Libs viejas/parciales (PHP, Python, alguna TS) | ✅ Construido y en npm |
| **@factible/id-uruguay** — login con cédula (OpenID Connect) | [Documentado por AGESIC](https://centroderecursos.agesic.gub.uy/web/seguridad/wiki/-/wiki/Main/ID+Uruguay+-+Integraci%C3%B3n+con+OpenID+Connect), OIDC estándar | Credenciales de testing por trámite liviano (email a AGESIC) | ✅ En testing de AGESIC | Solo un SDK React Native abandonado (2020); **no hay lib server-side Node** | ✅ Construido (beta); credenciales AGESIC en trámite |
| **@factible/rut** — consulta/validación de RUT (DGI) | [WS documentado](https://www.efactura.dgi.gub.uy/files/web-services-consulta-de-rut?es) | Probablemente cert de emisor (a confirmar) | ⚠️ Con acceso DGI | Ninguna | 🟡 Construir junto al gateway; reusa transporte de cfe. El **dígito verificador de RUT/CI** (offline) ya salió como `@factible/validar` |
| **@factible/bps** — nóminas/GAFI | Sin API para terceros: formatos de archivo (ATYRO) + carga web | Manuales públicos parciales | ⚠️ Solo formato, no envío | ATYRO (software oficial gratuito) | 🟡 Ángulo viable: *generador de archivos* de nómina tipado. Requiere estudiar manuales — más adelante |
| PDI / e-notificaciones (AGESIC) | SOA para **organismos del Estado**, no para privados | Restringido | ❌ | — | 🔴 Descartar por ahora |
| **@factible/antel-sms** — SMS número corto (A2P) | Protocolo entregado **por contrato** (Centro Comercial/ejecutivo), no público | Contrato comercial con Antel | ⚠️ Solo con empresa con contrato | Agregadores (Mensajero Automático, Mobility Chasqui) ya venden APIs REST sobre esto | 🟡 Explorar — necesita empresa madrina con contrato; los agregadores son señal de demanda real |
| **@factible/antel-gateway** — SIM Swap / Number Verification | Estándar **CAMARA (GSMA Open Gateway)**, specs públicas | Acuerdo comercial (canal a confirmar) | ⚠️ Spec pública, endpoint comercial | Ninguna local | 🟡 Explorar — construible contra la spec CAMARA como hicimos con OIDC; útil para fintech/antifraude |

## Orden de construcción — estado

1. ✅ **`@factible/validar`** — publicado en npm (estable), con ports a Python, PHP, Go y Java validados en CI. Integrado en cfe (valida RUC/CI antes de construir el XML).
2. ✅ **`@factible/bcu`** — publicado en npm, verificado contra el WS real del Banco Central (e2e).
3. ✅ **`@factible/id-uruguay`** — construido y verificado contra mock OIDC (JWT RS256 real). Sin publicar: espera credenciales de testing de AGESIC (trámite enviado).
4. ⏳ **`@factible/rut`** — espera acceso al ambiente de DGI (misma empresa madrina que cfe).
5. 🔍 **`@factible/bps`** — investigación abierta (issue en el tracker): formatos de archivo de nómina.
6. 🔍 **Antel** (SMS corto / Open Gateway) — triaje hecho (ver tabla); espera empresa con contrato o definición del canal comercial CAMARA.

## Estructura: monorepo

✅ Hecho — monorepo con npm workspaces en [github.com/olagopirez/factible](https://github.com/olagopirez/factible):

```
factible/
├── packages/
│   ├── cfe/
│   ├── validar/
│   ├── bcu/
│   └── id-uruguay/
├── web/                   (landing)
└── docs/                  (protocolo-dgi, guías, este plan)
```

Un solo repo = una sola comunidad, un solo README que muestra el ecosistema, estrellas concentradas.

## Política multi-lenguaje

Uruguay enterprise es Java/.NET/Genexus; también hay mucho PHP, Python y Go. La regla: **la lógica pesada se escribe una vez; se porta solo lo diminuto y congelado.**

- Un paquete es **portable** solo si cumple las tres: ① diminuto (~cientos de líneas), ② spec congelada (no cambia con resoluciones del organismo), ③ cero dependencias.
- **`validar`**: ✅ portable — ports a Java/PHP/Python/Go como jugada de adopción y SEO ("validar RUT java" → entrada al ecosistema). Una noche por lenguaje, mantenimiento ~0.
- **`cfe`**: ❌ nunca — cada cambio de formato DGI se multiplicaría por N lenguajes (así murieron las libs OSS anteriores). Multi-lenguaje = gateway REST; los mails del CTA de la landing miden esa demanda por stack.
- **`bcu` y demás clientes HTTP**: ⏸️ solo con demanda visible — tienen superficie de mantenimiento.

## Qué NO cambia

- **CFE sigue siendo la apuesta principal** (demanda forzada por ley) y su validación con empresa madrina sigue siendo la prioridad de Fase 0.
- El gateway espera a la homologación de cfe (decisión ya tomada).
- La homologación/validación de cada conector corre en paralelo a la construcción del siguiente — nunca se bloquea el avance, pero **nada se marca "listo para producción" sin validar contra el servicio real**.
