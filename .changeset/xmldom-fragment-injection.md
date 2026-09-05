---
"@factible/cfe": patch
---

Actualiza `@xmldom/xmldom` a `^0.9.12` por GHSA-6gmq-8vp8-gcm6 (inyección de fragmento XML vía `EntityReference.nodeName` en la serialización con `requireWellFormed`). La instancia transitiva bajo `xml-crypto` resuelve al backport 0.8.15 dentro de su rango `^0.8.10`.
