# Plan de conectores estatales — ecosistema factible

**Visión:** factible como la infraestructura open source de referencia para integrarse con el Estado uruguayo. Un conector por organismo, misma DX: TypeScript tipado, mocks incluidos, validado contra las specs oficiales.

**Principio (aprendido con CFE):** un conector solo entra al roadmap si pasa el triaje: ① API/formato oficial documentado y accesible, ② validable sin depender de terceros (o con trámite liviano), ③ demanda real de devs. DGI salió "en una tarde" porque publica XSDs y ejemplos — es el organismo mejor documentado; el resto varía mucho.

## Triaje (relevado 2026-07)

| Conector | API oficial | Acceso | Validación real | Competencia | Veredicto |
|---|---|---|---|---|---|
| **@factible/bcu** — cotizaciones de monedas | SOAP público, [WSDL abierto](https://cotizaciones.bcu.gub.uy/wscotizaciones/servlet/awsbcucotizaciones?wsdl), sin auth | Ninguno | ✅ **Hoy, sin trámites** | Libs viejas/parciales (PHP, Python, alguna TS) | 🟢 **Construir ya** (1-2 noches) |
| **@factible/id-uruguay** — login con cédula (OpenID Connect) | [Documentado por AGESIC](https://centroderecursos.agesic.gub.uy/web/seguridad/wiki/-/wiki/Main/ID+Uruguay+-+Integraci%C3%B3n+con+OpenID+Connect), OIDC estándar | Credenciales de testing por trámite liviano (email a AGESIC) | ✅ En testing de AGESIC | Solo un SDK React Native abandonado (2020); **no hay lib server-side Node** | 🟢 **Construir ya**; pedir credenciales en paralelo |
| **@factible/rut** — consulta/validación de RUT (DGI) | [WS documentado](https://www.efactura.dgi.gub.uy/files/web-services-consulta-de-rut?es) | Probablemente cert de emisor (a confirmar) | ⚠️ Con acceso DGI | Ninguna | 🟡 Construir junto al gateway; reusa transporte de cfe. El **dígito verificador de RUT/CI** (offline) se puede publicar YA como `@factible/validar` |
| **@factible/bps** — nóminas/GAFI | Sin API para terceros: formatos de archivo (ATYRO) + carga web | Manuales públicos parciales | ⚠️ Solo formato, no envío | ATYRO (software oficial gratuito) | 🟡 Ángulo viable: *generador de archivos* de nómina tipado. Requiere estudiar manuales — más adelante |
| PDI / e-notificaciones (AGESIC) | SOA para **organismos del Estado**, no para privados | Restringido | ❌ | — | 🔴 Descartar por ahora |
| **@factible/antel-sms** — SMS número corto (A2P) | Protocolo entregado **por contrato** (Centro Comercial/ejecutivo), no público | Contrato comercial con Antel | ⚠️ Solo con empresa con contrato | Agregadores (Mensajero Automático, Mobility Chasqui) ya venden APIs REST sobre esto | 🟡 Explorar — necesita empresa madrina con contrato; los agregadores son señal de demanda real |
| **@factible/antel-gateway** — SIM Swap / Number Verification | Estándar **CAMARA (GSMA Open Gateway)**, specs públicas | Acuerdo comercial (canal a confirmar) | ⚠️ Spec pública, endpoint comercial | Ninguna local | 🟡 Explorar — construible contra la spec CAMARA como hicimos con OIDC; útil para fintech/antifraude |

## Orden de construcción

1. **`@factible/validar`** (1 noche): dígito verificador de RUT y CI, formato de cédulas. Cero dependencias, útil para todos, ya lo necesita cfe (está en su TODO). El "hola mundo" del ecosistema.
2. **`@factible/bcu`** (1-2 noches): cotizaciones con tipos, caché opcional y mock. Se valida contra el WS real hoy — primer conector 100% verificado de punta a punta, algo que cfe aún no puede decir.
3. **`@factible/id-uruguay`** (1-2 semanas): cliente OIDC server-side (authorization code + PKCE, niveles ACR de identidad). Pedir credenciales de testing a AGESIC **esta semana** (soporte@agesic.gub.uy) — el trámite corre en paralelo mientras se construye contra el spec OIDC.
4. **`@factible/rut`**: cuando haya acceso al ambiente de DGI (misma empresa madrina que cfe).
5. **`@factible/bps`**: tras estudiar los manuales de formato — candidato fuerte pero de spec más opaca.

## Estructura: monorepo

Antes de publicar en GitHub, migrar a monorepo con npm workspaces — evita mudar URLs después:

```
factible/                  (repo github.com/<usuario>/factible)
├── packages/
│   ├── cfe/               (lo construido hasta hoy)
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
