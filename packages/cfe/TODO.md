# TODO — preguntas abiertas y deuda técnica

Cosas que no queremos olvidar mientras avanzamos. Cuando se resuelva una, moverla a "Resueltas" con la respuesta.

## Para confirmar en homologación con DGI

- [ ] **Payload del envelope (`Datain`/`xmlData`):** el WSDL importa `ws_eprueba.xsd1.xsd` con los tipos — el arnés lo baja en la próxima corrida. Namespace y SOAPAction ya confirmados (ver Resueltas).
- [ ] **¿WS-Security se exige o solo se "soporta"?** La policy del WSDL declara SignedParts (Body) vía DataPower. Si tras corregir namespace/SOAPAction sigue el fault, lo próximo es firmar el Body (WS-Security) — el dominio XMLDSig ya lo tenemos.

- [ ] **Código de seguridad = ¿DigestValue de la firma?** El Formato solo dice "hash SHA-2" vinculado a la firma. Implementamos DigestValue (Base64) de la Reference; verificar contra el portal consultaQR con un CFE real en testing.
- [ ] **Formato de parámetros del QR:** la spec los muestra separados por coma (no query string estándar). Implementado literal; confirmar si el hash va URL-encoded.
- [ ] **Encoding del envío: ¿ISO-8859-1 o UTF-8?** El ejemplo oficial (2016) declara `encoding="iso-8859-1"`. Emitimos UTF-8; confirmar qué acepta el WS de recepción hoy (relevante para tildes y ñ).
- [ ] **Certificados reales con serial >64 bits:** libxml2/xmllint falla validando `X509SerialNumber` grandes (limitación del validador, no del contenido — el fixture de test usa serial chico). Si un cert de Abitab/Correo trae serial grande, nuestros propios tests de validación no aplican; DGI valida con otra infraestructura.
- [ ] **¿Testing valida el CAE?** Los envíos con CAE ficticio `90230011234` no fueron observados por CAE (el rechazo fue siempre por certificado, etapa anterior). Con certificado real se sabrá si Testing exige CAE emitido o acepta cualquiera.
- [ ] **¿La tasa de IVA se informa como `10`/`22` o `10.000`/`22.000`?** v25 agregó 3 decimales a las tasas (C119/C120). Hoy emitimos enteros; el XSD acepta ambos pero la validación de DGI puede ser estricta.

## Para investigar (no bloquea el desarrollo)

- [ ] **Certificado digital de facturación electrónica real** (Abitab/Correo/Antel, a nombre de la empresa del RUT de Testing) — el ÚNICO bloqueante restante para el círculo completo: el nivel CFE rechaza self-signed con `E04 certificate not trusted`.
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

### Validadas contra el ambiente de Testing REAL de DGI (2026-07-08, envío manual por portal)

- [x] **WSDL real obtenido SIN autenticación** (2026-07-09, `{endpoint}?wsdl` → `spec/ws_eprueba.wsdl`): namespace `http://dgi.gub.uy` (doc/literal), operaciones `WS_eFactura.EFACRECEPCION{SOBRE,REPORTE}` y `EFACCONSULTARESTADOENVIO`, SOAPAction `http://dgi.gub.uyaction/AWS_EFACTURA.<OP>` (sic, sin barra y con prefijo A). Nuestro namespace "DGI" y SOAPAction eran incorrectos — corregidos.
- [x] **El TLS del WS NO exige certificado cliente:** el handshake completa sin cert (el "mTLS obligatorio" era un mito de la doc de terceros). Cert del servidor emitido por Abitab SSL, encadena a CA pública.

- [x] **El pipeline completo funciona contra DGI:** un sobre generado con `buildCfeXml` + `firmarCfe` + `crearSobre` fue **aceptado (Estado AS)** por el ambiente de Testing (envío 306849522). Formato v25.2, firma XMLDSig enveloped SHA-256 y sobre v05: todo correcto.
- [x] **RUT_DGI confirmado:** `219999830019` — aparece como `RUCReceptor` en los acuses reales y como RUC del propio certificado de DGI (`serialNumber=RUC219999830019`).
- [x] **Vínculo RUC↔certificado:** DGI exige que el subject del certificado tenga `serialNumber` (OID 2.5.4.5) = `"RUC" + RUT` (sin separador). Si no coincide con `RUCEmisor`: rechazo `S02` a nivel sobre.
- [x] **Validación de certificado en dos etapas:** a nivel *sobre* solo se chequea RUC y vigencia (un self-signed con el RUC correcto pasa → AS); a nivel *CFE* se valida la cadena de confianza contra las CA acreditadas → `BE/E04 "certificate not trusted"`.
- [x] **Vigencia del cert vs fecha de emisión (S03):** un CFE emitido en el mismo instante del `notBefore` del cert fue rechazado ("La fecha de emisión no corresponde con el certificado") — la comparación parece hacerse sin timezone. El cert debe preceder holgadamente a la emisión.
- [x] **UTF-8 aceptado:** el sobre se envió con `encoding="UTF-8"` y fue aceptado (AS) — el `iso-8859-1` del ejemplo de 2016 no es obligatorio.
- [x] **Parser de acuses validado con respuestas reales:** ACKSobre (AS y BS/S02) y ACKCFE (BE/E04) parsean sin cambios — fixtures en `test/fixtures/acuses-reales/`.
- [x] **DGI firma sus acuses con rsa-sha1** (cert `***TEST*** DGI-RUC PRUEBA CEDE` emitido por Correo Uruguayo - CA) — al verificar acuses no exigir SHA-2.
- [x] **Envío manual por portal:** `Envíos → Sobre` sube el archivo a `/ePruebaRecepcionFE/servlet/efacreceenviomanual` (multipart `upfile.jsp`, campo `FILE1`) y los acuses se descargan de `aefacreceopenxml?RESPUESTA,false` (sobre) / `?RESPUESTA,true` (comprobantes). Sirve como e2e sin WS.

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
