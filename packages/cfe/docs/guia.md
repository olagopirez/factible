# Guía de uso — de cero a CFE enviado

Recorrido completo por `@factible/cfe`. Todo el código es ejecutable hoy; el único paso que requiere credenciales reales de DGI es el final (cambiar el mock por el cliente real).

## 1. Configuración

```ts
import { Factible, MemoryCaeStore, TipoCFE } from '@factible/cfe';
import { readFileSync } from 'node:fs';

// Certificado digital del emisor (Abitab/Correo). Para desarrollo: autofirmado.
const certificado = {
  privateKey: readFileSync('cert/key.pem', 'utf8'),
  cert: readFileSync('cert/cert.pem', 'utf8'),
};

const emisor = {
  ruc: '211234560012',
  razonSocial: 'Mi Empresa SRL',
  nombreComercial: 'Mi Comercio',
  sucursal: { codigo: 1, domicilio: 'Av. 18 de Julio 1234', ciudad: 'Montevideo', departamento: 'Montevideo' },
};
```

## 2. Numeración CAE

DGI otorga rangos de numeración (CAE) por tipo de comprobante. La lib los administra vía `CaeStore`; el consumo es atómico (seguro bajo concurrencia).

```ts
const caeStore = new MemoryCaeStore(); // en producción: implementá CaeStore sobre tu DB
await caeStore.agregarRango({
  id: '90230011234',            // nro. de CAE otorgado por DGI
  tipoCFE: TipoCFE.E_TICKET,
  serie: 'A',
  numeroDesde: 1,
  numeroHasta: 5000,
  fechaExpiracion: new Date('2027-12-31'),
});
```

> Para producción implementá `CaeStore` sobre tu base de datos. Contrato en `src/types/cae.ts`: `siguienteNumero` debe ser atómico (SQL: `UPDATE ... RETURNING`).

## 3. Emitir

```ts
const factible = new Factible({ emisor, certificado, caeStore });

const cfe = await factible.emitir({
  tipo: TipoCFE.E_TICKET,
  moneda: 'UYU',
  lineas: [
    { cantidad: 2, descripcion: 'Café espresso', precioUnitario: 190, indicadorFacturacion: 3 }, // IVA 22%
    { cantidad: 1, descripcion: 'Pan integral', precioUnitario: 120, indicadorFacturacion: 2 },  // IVA 10%
    { cantidad: 1, descripcion: 'Libro', precioUnitario: 890, indicadorFacturacion: 1 },         // exento
  ],
});

cfe.xml;      // CFE firmado (XMLDSig, listo para DGI)
cfe.totales;  // IVA y totales calculados
cfe.urlQr;    // contenido del QR de verificación
```

Indicadores de facturación: `1` exento, `2` tasa mínima (10%), `3` tasa básica (22%). e-Factura (`TipoCFE.E_FACTURA`) requiere `receptor` con RUC. NC/ND requieren `referencias` al CFE original (con monto y moneda — regla v25).

## 4. Ensobrar y enviar

```ts
import { crearSobre, RUT_DGI, enviarSobreADgi, MockDgiTransport } from '@factible/cfe';

const sobre = crearSobre({
  rucEmisor: emisor.ruc,
  rutReceptor: RUT_DGI,
  idEmisor: 1,               // secuencia de envío, la administrás vos
  cfesFirmados: [cfe.xml],   // hasta 250 por sobre
  cert: certificado.cert,
});

// Desarrollo: DGI simulada. Acepta todo, o configurale rechazos.
const transporte = new MockDgiTransport();
// const transporte = new MockDgiTransport({ rechazarCfes: { 'A-1': ['E05'] } });

const resultado = await enviarSobreADgi(transporte, sobre);

resultado.acuseSobre.aceptado;        // ¿DGI recibió el sobre?
resultado.acuseCfe?.detalles;         // resultado por comprobante (AE/BE)
resultado.acuseCfe?.detalles[0].motivosRechazo; // motivos con glosa en español
```

`enviarSobreADgi` maneja el flujo asíncrono de DGI: ACKSobre → espera hasta la `Fechahora` indicada → consulta con token → ACKCFE, con reintentos.

## 5. Representación impresa

```ts
import { representacionImpresa } from '@factible/cfe';

const html = await representacionImpresa(input, cfe, {
  formato: 'ticket', // o 'a4'
  fechaEmisorORes: 'Res. 123/2026',
  urlVerificacionEmpresa: 'www.miempresa.uy/cfe', // obligatoria en e-Tickets
});
// HTML autocontenido con QR embebido: imprimí o convertí a PDF con tu stack.
```

## 6. Reporte diario

Obligatorio todos los días, incluso sin emisiones:

```ts
import { crearReporteDiario, firmarReporte } from '@factible/cfe';

const reporte = firmarReporte(
  crearReporteDiario({
    rucEmisor: emisor.ruc,
    fechaResumen: new Date(),
    secEnvio: 1,
    codSucursal: 1,
    emitidos: cfesDelDia, // los Emitido del día; [] si no hubo movimiento
  }),
  certificado,
);
await transporte.enviarReporte(reporte);
```

## 7. Pasar a DGI real

```ts
import { SoapDgiClient } from '@factible/cfe';

const transporte = new SoapDgiClient({
  ambiente: 'testing', // o 'produccion'
  cert: certificado.cert,
  key: certificado.privateKey,
});
```

Requisitos previos: usuario del ambiente de testing de DGI y certificado de proveedor autorizado — ver [protocolo-dgi.md](protocolo-dgi.md) §Acceso al ambiente de Testing. El cliente SOAP no fue validado aún contra el endpoint real ([TODO.md](../TODO.md)).

## Mapa de módulos

| Módulo | Qué hace |
|---|---|
| `builder/xml` | CfeInput → XML CFE v25.2 (validado contra XSD oficial en tests) |
| `signer/xmldsig` | Firma/verificación XMLDSig (formato del ejemplo oficial DGI) |
| `sobre/sobre` | EnvioCFE v05 con carátula |
| `cae/memory-store` | Numeración CAE atómica (contrato para SQL) |
| `qr/qr` | Código de seguridad + URL del QR |
| `reporte/diario` | Reporte diario v13.2 |
| `acuses/acuses` | Parseo ACKSobre/ACKCFE + tablas de motivos |
| `impresion/html` | Representación impresa imprimible |
| `transporte/*` | SOAP mTLS real, mock para desarrollo, flujo de envío |
| `factible` | API de alto nivel que encadena todo |
