# factible

**Facturación electrónica de DGI (Uruguay) para desarrolladores.** Open source, MIT.

Integrar CFE hoy significa semanas leyendo PDFs de DGI, firmando XML con SOAP de 2012, o pagar un gateway propietario sin saber qué hay adentro. `@factible/cfe` es la alternativa: una librería TypeScript moderna, tipada y testeada que habla el protocolo de DGI por vos — y una DGI simulada para que desarrolles sin trámites.

```ts
import { Factible, MemoryCaeStore, MockDgiTransport, crearSobre, enviarSobreADgi, RUT_DGI, TipoCFE } from '@factible/cfe';

const factible = new Factible({ emisor, certificado, caeStore });

// Emitir: numeración CAE + XML v25.2 + firma + sello digital, en una llamada
const cfe = await factible.emitir({
  tipo: TipoCFE.E_TICKET,
  moneda: 'UYU',
  lineas: [{ cantidad: 2, descripcion: 'Café', precioUnitario: 190, indicadorFacturacion: 3 }],
});

// Enviar: sobre → ACKSobre → consulta con token → resultado por comprobante
const sobre = crearSobre({ rucEmisor: emisor.ruc, rutReceptor: RUT_DGI, idEmisor: 1, cfesFirmados: [cfe.xml], cert });
const resultado = await enviarSobreADgi(new MockDgiTransport(), sobre);

resultado.acuseCfe?.detalles[0].aceptado; // true
cfe.urlQr;                                // QR de verificación DGI
cfe.codigoSeguridadImpreso;               // los 6 caracteres bajo el QR
```

## Por qué factible

- **DX primero:** tipos estrictos, errores con mensajes útiles (los rechazos de DGI llegan con glosa en español, no códigos crípticos), quickstart en minutos.
- **Desarrollá sin DGI:** `MockDgiTransport` simula el ciclo completo de DGI — aceptaciones, rechazos con motivos reales (S01-S20, E01-E15), flujo asíncrono con token. Tu integración se testea entera sin certificados ni trámites.
- **Verificado contra las fuentes:** todo el output se valida en tests contra los XSDs oficiales v1.44.2 (el mismo esquema que DGI destina a validaciones unitarias) y contra los ejemplos publicados por DGI.
- **Sin cajas negras:** MIT, autohosteable, el protocolo documentado en [docs/protocolo-dgi.md](docs/protocolo-dgi.md).

## Qué cubre

| Etapa | Estado |
|---|---|
| Construcción XML CFE v25.2 (e-Ticket, e-Factura, NC/ND con reglas v25) | ✅ validado contra XSD |
| Totales e IVA (básica/mínima/exento) | ✅ |
| Firma y verificación XMLDSig (formato del ejemplo oficial) | ✅ |
| Numeración CAE atómica (`CaeStore`) | ✅ memoria; contrato para SQL |
| Sobre EnvioCFE v05 | ✅ validado contra XSD |
| Sello digital: código de seguridad + QR | ✅ |
| Representación impresa (A4 / ticket 80mm, QR embebido) | ✅ |
| Reporte diario v13.2 (incluso sin movimiento) | ✅ validado contra XSD |
| Acuses ACKSobre/ACKCFE con tablas de motivos | ✅ |
| Transporte SOAP mTLS + mock de DGI | ✅ estructura; ⚠️ sin validar contra endpoint real |
| Homologación ante DGI | ⏳ pendiente |

**Estado: beta offline.** El pipeline completo funciona y está testeado (42 tests), pero aún no fue validado contra el ambiente de testing de DGI. **No usar en producción todavía.** Los supuestos pendientes de confirmación están documentados en [TODO.md](TODO.md).

## Empezar

```bash
npm install @factible/cfe
```

Guía completa paso a paso: **[docs/guia.md](docs/guia.md)** — de cero a CFE enviado, incluyendo representación impresa y reporte diario.

## Alcance y roadmap

MVP: e-Ticket (101) y e-Factura (111) + NC/ND — la gran mayoría de las emisiones domésticas. Después: exportación, cuenta ajena, e-Remito, e-Resguardo, intercambio entre emisores.

Multi-lenguaje: esta lib no se porta; llegará vía gateway REST (cualquier stack integra por HTTP) y SDKs finos por lenguaje.

## Documentación

- [Guía de uso](docs/guia.md) — flujo completo con código ejecutable.
- [Protocolo DGI](docs/protocolo-dgi.md) — versiones vigentes, WSDLs, acceso a testing, hallazgos verificados.
- [TODO](TODO.md) — supuestos por confirmar en homologación y deuda técnica.
- `spec/` — XSDs y formatos oficiales de DGI usados como fuente de verdad.

## Desarrollo

```bash
npm install
npm test        # 42 tests, incluye validación contra XSDs oficiales (requiere xmllint)
npm run build
```

## Licencia

MIT
