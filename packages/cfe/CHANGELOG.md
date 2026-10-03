# @factible/cfe

## 0.0.3

### Patch Changes

- 298eb5f: Actualiza `@xmldom/xmldom` a `^0.9.12` por GHSA-6gmq-8vp8-gcm6 (inyección de fragmento XML vía `EntityReference.nodeName` en la serialización con `requireWellFormed`). La instancia transitiva bajo `xml-crypto` resuelve al backport 0.8.15 dentro de su rango `^0.8.10`.

## 0.0.2

### Patch Changes

- 05609a3: Transporte SOAP confirmado contra el WS real del ambiente de Testing: namespace `http://dgi.gub.uy`, SOAPAction verbatim del WSDL (entre comillas), firma WS-Security obligatoria (BinarySecurityToken X509v3 + Body firmado exc-c14n) y formato `<ConsultaCFE>` en la consulta de estado (el formato anterior violaba el XSD del contrato). Nueva opción `verificarServidor` y `algoritmoWss` en `SoapDgiClient`; se exportan `buildSoapEnvelopeWss` y `xmlDataConsulta`. Fixtures de acuses reales de DGI y arnés e2e opt-in (`scripts/e2e-dgi.mjs`).
