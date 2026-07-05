# Protocolo eFactura DGI — notas técnicas

> Relevado el 2026-07-04 desde el [índice oficial de documentos](https://www.efactura.dgi.gub.uy/principal/ampliacion_de_contenido/documentos-de-interes?es). Verificar vigencias antes de implementar cada módulo.

## Versiones vigentes (testing y producción)

| Documento | Versión vigente | Link |
|---|---|---|
| Formato CFE | **v25.2** | [PDF](https://www.efactura.dgi.gub.uy/files/formato_cfe_v25-2-pdf?es) |
| Formato Sobre | **v05** | [PDF](https://www.efactura.dgi.gub.uy/files/Formato_Sobre_v05_pdf?es) |
| Reporte diario | **v13.2** | [PDF](https://www.efactura.dgi.gub.uy/files/formato_reporte_cfe_v13_2-pdf?es) |
| Mensajes de respuesta | **v19** | [PDF](https://www.efactura.dgi.gub.uy/files/formato_mensajes_respuesta_v19-pdf?es) |
| CAE | **v05** | [PDF](https://www.efactura.dgi.gub.uy/files/Formato_CAE_v05-pdf?es) |
| XSDs | **v1.44.2** | [ZIP](https://www.efactura.dgi.gub.uy/files/xsds_fe_1_44_2-zip?es) |

⚠️ Nota: producción también lista v24 como "Publicado" (convivencia de versiones). El plan original mencionaba v25.1; ya fue sustituida por v25.2.

## Recursos técnicos clave

- **WSDL testing (ePrueba):** https://efactura.dgi.gub.uy:6443/ePrueba/ws_eprueba?wsdl
- [Web Services Externos — Recepción](https://www.efactura.dgi.gub.uy/files/DocumentoServiciosWebExternos?es)
- [Web Services Externos — Consultas](https://www.efactura.dgi.gub.uy/files/web-services-externos-consultas-pdf?es)
- [WS Consulta de RUT](https://www.efactura.dgi.gub.uy/files/web-services-consulta-de-rut?es)
- [Documento Técnico de División Informática](https://www.efactura.dgi.gub.uy/files/documento-tecnico-de-division-informatica-archivo-pdf-514-kb?es)
- [Estándar de intercambio entre emisores vía WS](https://www.efactura.dgi.gub.uy/files/estandar-de-intercambio-entre-emisores-a-traves-de-servicios-web?es) + [WSDL intercambio](https://www.efactura.dgi.gub.uy/files/wsdl_aws_efactura_intercambio.xml?es)
- [Ejemplo de Sobre (XML)](https://www.efactura.dgi.gub.uy/files/ejemplo-de-sobre?es)
- [Ejemplo de Reporte (XML)](https://www.efactura.dgi.gub.uy/files/ejemplo-de-reporte?es)
- [Ejemplos de CAE](https://www.efactura.dgi.gub.uy/files/ejemplos-de-constancias-de-autorizacion-para-emision-de-comprobantes-fiscales-electronicos?es)
- [Guías XMLEncryption](https://www.efactura.dgi.gub.uy/files/guias-en-el-uso-de-xmlencryption-11062014-pdf?es) (para complemento fiscal cuenta ajena)
- [Clave pública producción](https://www.efactura.dgi.gub.uy/files/clave_publica_produccion?es) · [Clave pública testing (desde 19/09/2024)](https://www.efactura.dgi.gub.uy/files/clave_ambiente_prueba_19_09_24?es)
- [Códigos de retenciones/percepciones](https://www.efactura.dgi.gub.uy/files/codigos-de-retenciones-percepciones?es) (act. 01/12/2025)
- [Definiciones funcionales CFE](https://www.efactura.dgi.gub.uy/files/descripcion-e-factura-archivo-pdf-263-kb?es)
- [Instructivo Registro de Proveedores Habilitados](https://www.efactura.dgi.gub.uy/files/Instructivo_registro_proveedor?es) ← relevante para la fase gateway

## Modelo conceptual del flujo de emisión

1. **Alta como emisor:** el contribuyente se postula ante DGI, pasa el proceso de **homologación** (set de pruebas en ambiente de testing) y obtiene autorización.
2. **Certificado digital:** emitido por un proveedor autorizado (ver [lista](https://www.efactura.dgi.gub.uy/principal/factura-electronica-informacion-general-proveedores-de-certificado-digital?es)); se usa para firmar los CFE (XMLDSig) y el canal WS-Security.
3. **CAE (Constancia de Autorización de Emisión):** DGI otorga rangos de numeración por tipo de CFE; cada comprobante consume un número del rango.
4. **Emisión:** se construye el XML del CFE (formato v25.2, validable contra XSD v1.44.2), se **firma**, se calcula el QR/código de seguridad para la representación impresa.
5. **Envío a DGI:** los CFE se agrupan en un **Sobre** (v05) y se envían por SOAP al WS de recepción. DGI responde con acuse (Mensajes v19): aceptado/rechazado, sincrónico o asincrónico.
6. **Intercambio con receptores electrónicos:** si el receptor es emisor electrónico, hay que enviarle el sobre por el estándar de intercambio (WS o email) y procesar sus acuses comerciales.
7. **Reporte diario:** resumen (v13.2) de todo lo emitido en el día, firmado y enviado a DGI.
8. **Contingencia:** comprobantes en papel pre-impresos si el sistema cae; luego se informan.

## Tipos de CFE (códigos a verificar contra Formato v25.2)

| Código | Tipo |
|---|---|
| 101 / 102 / 103 | e-Ticket / NC / ND |
| 111 / 112 / 113 | e-Factura / NC / ND |
| 121 / 122 / 123 | e-Factura de Exportación / NC / ND |
| 124 | e-Remito de Exportación |
| 131-133, 141-143 | Cuenta ajena (e-Ticket / e-Factura) |
| 151-153 | e-Boleta de entrada |
| 181 / 182 | e-Remito / e-Resguardo |

Alcance MVP: **101 (e-Ticket) y 111 (e-Factura)** + sus NC/ND (102/103/112/113), que cubren la gran mayoría de las emisiones domésticas.

## Verificado contra Formato CFE v25.2 (specs en `spec/`)

- **Tabla A-C60 (TipoDocRecep):** 1 NIE, 2 RUC, 3 CI, 4 Otros, 5 Pasaporte, 6 DNI (solo AR/BR/CL/PY), 7 NIFE.
- **e-Factura y sus NC/ND (111-113, 141-143):** receptor obligatorio con RUC (A-C60=2).
- **A-C61 (país):** si A-C60 ∈ {1,2,3} ⇒ país UY; si A-C60=6 ⇒ AR/BR/CL/PY.
- **IVA:** las tasas (C119/C120) admiten 3 decimales desde v25; validación estricta C121 = C116×C119 y C122 = C117×C120 (total IVA = neto × tasa, 2 decimales). Sin tolerancia explícita de redondeo en el formato.
- **CFEDGI.xsd** está oficialmente destinado a "pruebas y validaciones unitarias" (Cartilla) — es correcto usarlo en los tests.
- e-Ticket: receptor obligatorio solo si supera tope (tabla E) o si documenta retenciones.

## Acceso al ambiente de Testing (relevado 2026-07)

1. **Requisito previo:** usuario de Servicios en Línea de DGI (requiere RUT — para dev independiente: empresa unipersonal).
2. **Solicitud:** Servicios en Línea → sección eFactura → "Solicitud de creación de usuario para eFactura": CI + correo de la persona autorizada + rol **Testing**. DGI envía la clave al correo.
3. Con esa clave: Portal eFactura, ambiente Testing — envío libre de sobres/CFEs/reportes sin valor fiscal contra `ws_eprueba`.
4. **Camino completo:** Testing → Homologación/Certificación (Portal eFactura → Servicios → Postulación; DGI evalúa por etapas) → Producción (requiere CAE vigente: Servicios en Línea → Constancias → e-Factura). "Homologación Simplificada" existe solo para clientes de Proveedores Habilitados.
5. Para firmar en testing hace falta certificado digital de proveedor autorizado (Abitab/Correo).

Fuentes: [Guía oficial de ingreso al régimen](https://www.gub.uy/direccion-general-impositiva/guia-ingreso-facturacion-electronica) · [Ambientes de e-Factura (GRO)](https://www.gro.com.uy/single-post/ambientes-de-e-factura-en-uruguay-2025-testing-homologaci%C3%B3n-homologaci%C3%B3n-simplificada-y-producc)

## Pendientes de investigación

- [ ] Detalle del algoritmo del código de seguridad / QR de la representación impresa (buscar en Formato v25.2 §representación impresa).
- [ ] Tabla E (topes para identificar receptor en e-Ticket) — valores vigentes.
- [ ] Requisitos exactos del proceso de homologación (set de pruebas de DGI).
- [ ] Cómo obtener un certificado de prueba para desarrollo (¿Abitab/Correo emiten para testing?).
- [ ] Política de convivencia v24/v25.2 en producción y fechas de corte.
