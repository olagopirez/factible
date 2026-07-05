# TODO — preguntas abiertas y deuda técnica

Cosas que no queremos olvidar mientras avanzamos. Cuando se resuelva una, moverla a "Resueltas" con la respuesta.

## Para confirmar en homologación con DGI

- [ ] **Envelope SOAP del WS de recepción:** nombres exactos de elementos (`Datain`/`xmlData`), namespace y SOAPAction implementados por convención GeneXus — confirmar contra el WSDL real (requiere acceso al endpoint, que parece exigir cert cliente). Igual que si exige WS-Security además del mTLS.

- [ ] **Código de seguridad = ¿DigestValue de la firma?** El Formato solo dice "hash SHA-2" vinculado a la firma. Implementamos DigestValue (Base64) de la Reference; verificar contra el portal consultaQR con un CFE real en testing.
- [ ] **Formato de parámetros del QR:** la spec los muestra separados por coma (no query string estándar). Implementado literal; confirmar si el hash va URL-encoded.
- [ ] **Encoding del envío: ¿ISO-8859-1 o UTF-8?** El ejemplo oficial (2016) declara `encoding="iso-8859-1"`. Emitimos UTF-8; confirmar qué acepta el WS de recepción hoy (relevante para tildes y ñ).
- [ ] **Certificados reales con serial >64 bits:** libxml2/xmllint falla validando `X509SerialNumber` grandes (limitación del validador, no del contenido — el fixture de test usa serial chico). Si un cert de Abitab/Correo trae serial grande, nuestros propios tests de validación no aplican; DGI valida con otra infraestructura.
- [ ] **RUT_DGI (receptor de sobres a DGI):** usamos `219999830019` como constante — confirmar contra el ejemplo de sobre oficial o la doc del WS de recepción.
- [ ] **¿La tasa de IVA se informa como `10`/`22` o `10.000`/`22.000`?** v25 agregó 3 decimales a las tasas (C119/C120). Hoy emitimos enteros; el XSD acepta ambos pero la validación de DGI puede ser estricta.

## Para investigar (no bloquea el desarrollo)

- [ ] **Usuario Testing de DGI — vía empresa madrina.** Oscar no quiere abrir empresa; el usuario Testing va atado a un RUT pero la "persona autorizada" (CI + correo) puede ser cualquiera. Plan: conseguir una empresa conocida/entrevistada de Fase 0 que solicite el usuario Testing designando a Oscar. Mientras tanto: validar output contra el [ejemplo de sobre oficial](https://www.efactura.dgi.gub.uy/files/ejemplo-de-sobre?es). Ver docs/protocolo-dgi.md §Acceso al ambiente de Testing.
- [ ] **Trámite Oscar: certificado digital** de proveedor autorizado (Abitab/Correo) — necesario para firmar contra testing. ¿Aceptan testing con cert de persona física o exige el de la empresa?
- [ ] **Proceso de homologación:** set de pruebas exacto que exige DGI para autorizar un emisor/software (Portal eFactura → Servicios → Postulación, por etapas).
- [ ] **Algoritmo del código de seguridad / QR** de la representación impresa (Formato v25.2 §representación impresa — está en el PDF, falta extraerlo).
- [ ] **Tabla E:** topes vigentes para exigir identificación del receptor en e-Ticket.
- [ ] **Convivencia v24/v25.2 en producción:** fechas de corte definitivas.
- [ ] **Reglas de redondeo con tolerancia:** el formato exige IVA = neto × tasa estricto; confirmar si DGI admite diferencias de ±1 peso en la práctica (las Reglas de Negocio `spec/RN_XSD-1_44_2.pdf` pueden decirlo — es PDF escaneado, habría que hacerle OCR).

## Deuda técnica de la lib

- [ ] `qrcode` como dependencia dura (~29 paquetes): evaluar hacerla opcional/peer para quienes no usan la representación impresa.
- [ ] Representación impresa: e-Tickets a consumidor final >tope UI requieren recuadro "Consumo Final" — no implementado.

- [ ] `UniMed` hardcodeado en `'N/A'` — exponerlo en `LineaDetalle`.
- [ ] Tabla completa de `IndicadorFacturacion` (hoy solo exento/mínima/básica; faltan otra tasa, entrega gratuita, no facturable, suspenso, etc.).
- [ ] `MntPagar` hoy = `MntTotal`; con retenciones/percepciones y montos no facturables difieren.
## Resueltas

- [x] **Dígito verificador de RUC/CI:** el builder valida emisor y receptor con `@factible/validar` antes de construir el XML — anticipa los rechazos E de DGI offline.

- [x] **Algoritmo de firma:** DGI no acepta SHA-1 desde el 01/01/2018 — nuestro default SHA-256 es correcto. *(FAQ oficial CFE v12, pregunta 4.15)*
- [x] **Adenda (Zona J): NO se envía a DGI.** Es solo para el receptor y la representación impresa; el sobre a DGI no la lleva. *(FAQ 4.17 + Cartilla: solo EnvioCFE_entreEmpresas incluye adenda)*

- [x] **Tabla A-C60 (TipoDocRecep):** 1 NIE, 2 RUC, 3 CI, 4 Otros, 5 Pasaporte, 6 DNI (AR/BR/CL/PY), 7 NIFE. *(Formato v25.2 pág. 32)*
- [x] **e-Factura exige receptor con RUC** (A-C60=2). *(pág. 32)*
- [x] **CFEDGI.xsd es oficialmente para validaciones unitarias** — nuestro approach de tests es correcto. *(Cartilla)*
- [x] **Atributo Id en `<CFE>`:** el XSD lo rechaza; firmar con `isEmptyUri` (URI="").
- [x] **Formato X509IssuerName:** el ejemplo oficial usa `CN=..., OU=..., O=..., C=UY` (coma+espacio, orden CN primero). Implementado igual.
- [x] **Signature sin prefijo:** el ejemplo oficial usa `<Signature xmlns="...xmldsig#">` con namespace default. Implementado igual. Reference URI="" y C14N coinciden con lo nuestro.
- [x] **Montos sin decimales obligatorios:** el ejemplo oficial emite `MntTotal>168816` y tasa `IVATasaMin>10` — DGI acepta representación mínima; nuestro `.toFixed(2)` también es válido (xs:decimal).
- [x] **UniMed real:** el ejemplo usa `kg` — expuesto `unidadMedida` en `LineaDetalle` (default 'N/A').
