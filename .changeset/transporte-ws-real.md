---
"@factible/cfe": patch
---

Transporte SOAP confirmado contra el WS real del ambiente de Testing: namespace `http://dgi.gub.uy`, SOAPAction verbatim del WSDL (entre comillas), firma WS-Security obligatoria (BinarySecurityToken X509v3 + Body firmado exc-c14n) y formato `<ConsultaCFE>` en la consulta de estado (el formato anterior violaba el XSD del contrato). Nueva opción `verificarServidor` y `algoritmoWss` en `SoapDgiClient`; se exportan `buildSoapEnvelopeWss` y `xmlDataConsulta`. Fixtures de acuses reales de DGI y arnés e2e opt-in (`scripts/e2e-dgi.mjs`).
