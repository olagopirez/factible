#!/usr/bin/env node
/**
 * Arnés e2e contra el WS del ambiente de Testing de DGI (opt-in, se corre a mano).
 *
 * Qué resuelve: los TODO del transporte que solo el servicio real puede contestar
 * (WSDL/contrato, si el TLS exige certificado cliente, nombres del envelope
 * GeneXus, SOAPAction, encoding). Cada respuesta —incluso un error— es un dato:
 * anotar los hallazgos en TODO.md ("los mocks no mienten").
 *
 * Uso:
 *   npm run build
 *   DGI_E2E=1 \
 *   DGI_E2E_RUT=21XXXXXXXXXX \
 *   DGI_E2E_RAZON="Mi Empresa S.A." \
 *   DGI_E2E_CERT=/ruta/cert.pem \
 *   DGI_E2E_KEY=/ruta/key.pem \
 *   node scripts/e2e-dgi.mjs
 *
 * Variables opcionales:
 *   DGI_E2E_URL     override del endpoint (default: testing ePrueba)
 *   DGI_E2E_NUMERO  número del CFE (default: 1)
 *   DGI_E2E_SERIE   serie del CFE (default: A)
 *
 * El certificado: en Testing alcanza (a nivel sobre) un self-signed cuyo subject
 * tenga serialNumber=RUC<rut> y notBefore anterior a la emisión. Para pasar la
 * validación a nivel CFE (AE) hace falta uno real de Abitab/Correo/Antel.
 *
 * Las respuestas crudas se guardan en e2e-dgi-salida/ (gitignoreado).
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { request } from 'node:https';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..');

if (!process.env.DGI_E2E) {
  console.log('DGI_E2E no definido — arnés desactivado. Ver el encabezado del script.');
  process.exit(0);
}

const lib = await import(resolve(raiz, 'dist/index.js')).catch(() => null);
if (!lib) {
  console.error('No existe dist/ — correr primero: npm run build');
  process.exit(1);
}
const {
  buildCfeXml, firmarCfe, crearSobre, RUT_DGI, TipoCFE, IndicadorFacturacion,
  buildSoapEnvelope, ENDPOINTS, SoapDgiClient, enviarSobreADgi,
} = lib;

const rut = process.env.DGI_E2E_RUT;
const certPath = process.env.DGI_E2E_CERT;
const keyPath = process.env.DGI_E2E_KEY;
if (!rut || !certPath || !keyPath) {
  console.error('Faltan variables: DGI_E2E_RUT, DGI_E2E_CERT, DGI_E2E_KEY');
  process.exit(1);
}
const razon = process.env.DGI_E2E_RAZON ?? 'Empresa de Prueba';
const serie = process.env.DGI_E2E_SERIE ?? 'A';
const numero = Number(process.env.DGI_E2E_NUMERO ?? 1);
const urlBase = process.env.DGI_E2E_URL ?? ENDPOINTS.testing;
const cert = readFileSync(certPath, 'utf8');
const key = readFileSync(keyPath, 'utf8');

const salidaDir = resolve(raiz, 'e2e-dgi-salida');
mkdirSync(salidaDir, { recursive: true });
const guardar = (nombre, contenido) => {
  const f = resolve(salidaDir, `${Date.now()}-${nombre}`);
  writeFileSync(f, contenido);
  return f;
};

const titulo = (t) => console.log(`\n${'='.repeat(70)}\n${t}\n${'='.repeat(70)}`);

/** POST/GET crudo con control fino de TLS. Nunca lanza: todo error es un dato. */
function pedir(url, { metodo = 'POST', body = '', conCert = false, estricto = true, headers = {} } = {}) {
  const u = new URL(url);
  return new Promise((res) => {
    const req = request(
      {
        hostname: u.hostname,
        port: u.port || 443,
        path: u.pathname + u.search,
        method: metodo,
        rejectUnauthorized: estricto,
        ...(conCert ? { cert, key } : {}),
        timeout: 30_000,
        headers: { 'Content-Length': Buffer.byteLength(body), ...headers },
      },
      (r) => {
        const socket = r.socket;
        const tls = socket && typeof socket.getPeerCertificate === 'function'
          ? {
              autorizado: socket.authorized,
              errorAutorizacion: socket.authorizationError ?? null,
              emisorServidor: socket.getPeerCertificate()?.issuer?.CN ?? null,
            }
          : null;
        let data = '';
        r.setEncoding('utf8');
        r.on('data', (c) => (data += c));
        r.on('end', () => {
          res({ ok: true, status: r.statusCode, headers: r.headers, body: data, tls });
        });
      },
    );
    req.on('timeout', () => { req.destroy(new Error('timeout')); });
    req.on('error', (e) => res({ ok: false, error: `${e.code ?? ''} ${e.message}`.trim() }));
    if (body) req.write(body);
    req.end();
  });
}

const resumen = [];
const anotar = (hallazgo) => { resumen.push(hallazgo); console.log(`  → ${hallazgo}`); };

// ---------------------------------------------------------------- Sonda 0: TLS
titulo(`Sonda 0 — TLS del endpoint (${urlBase})`);
let tlsEstricto = true;
{
  let r = await pedir(urlBase, { metodo: 'GET', estricto: true });
  if (!r.ok && /UNABLE_TO_VERIFY|SELF_SIGNED|CERT_/i.test(r.error ?? '')) {
    anotar(`el certificado del SERVIDOR no valida contra las CAs públicas (${r.error}) — se sigue sin verificación estricta`);
    tlsEstricto = false;
    r = await pedir(urlBase, { metodo: 'GET', estricto: false });
  }
  if (!r.ok) {
    anotar(`sin cert cliente la conexión FALLA (${r.error}) — el TLS exige certificado cliente`);
    const r2 = await pedir(urlBase, { metodo: 'GET', estricto: tlsEstricto, conCert: true });
    if (!r2.ok) {
      anotar(`CON cert cliente también falla (${r2.error}) — ¿exige cert de CA acreditada en el handshake?`);
      console.log('\nNada más para probar a nivel HTTP. Hallazgo igual valioso: documentarlo.');
      process.exit(0);
    }
    anotar(`con cert cliente el handshake completa (HTTP ${r2.status})`);
  } else {
    anotar(`el handshake TLS completa SIN certificado cliente (HTTP ${r.status} al GET)`);
  }
}

// --------------------------------------------------------------- Sonda 1: WSDL
titulo('Sonda 1 — ¿WSDL público?');
for (const conCert of [false, true]) {
  const r = await pedir(`${urlBase}?wsdl`, { metodo: 'GET', estricto: tlsEstricto, conCert });
  const etiqueta = conCert ? 'con cert' : 'sin cert';
  if (r.ok && r.status === 200 && /wsdl|definitions/i.test(r.body)) {
    const f = guardar(`wsdl-${conCert ? 'con' : 'sin'}-cert.xml`, r.body);
    anotar(`WSDL OBTENIDO ${etiqueta} (${r.body.length} bytes) → ${f} — ¡compararlo contra buildSoapEnvelope!`);
    // Bajar también los XSD que el WSDL referencia (ahí están los nombres del payload).
    const schemas = [...r.body.matchAll(/schemaLocation="([^"]+)"/g)].map((m) => m[1]);
    for (const s of schemas) {
      const urlXsd = new URL(s, urlBase).href;
      const rx = await pedir(urlXsd, { metodo: 'GET', estricto: tlsEstricto, conCert });
      if (rx.ok && rx.status === 200 && rx.body.length) {
        anotar(`XSD del contrato OBTENIDO (${s}, ${rx.body.length} bytes) → ${guardar(s.replace(/[^\w.]/g, '_'), rx.body)}`);
      } else {
        anotar(`XSD ${s}: ${rx.ok ? `HTTP ${rx.status}` : rx.error}`);
      }
    }
    break;
  }
  anotar(`?wsdl ${etiqueta}: ${r.ok ? `HTTP ${r.status}, body ${r.body.length} bytes` : r.error}${r.ok && r.body.length < 400 ? ` — "${r.body.replace(/\s+/g, ' ').slice(0, 120)}"` : ''}`);
  if (r.ok && r.body.length) guardar(`wsdl-intento-${conCert ? 'con' : 'sin'}-cert.txt`, r.body);
}

// ------------------------------------------------- Generación del sobre local
titulo('Generación local del sobre (mismo pipeline validado por portal)');
const cae = {
  id: '90230011234',
  tipoCFE: TipoCFE.E_TICKET,
  serie,
  numeroDesde: 1,
  numeroHasta: 5000,
  fechaExpiracion: new Date(Date.now() + 365 * 24 * 3600 * 1000),
};
const ticket = {
  tipo: TipoCFE.E_TICKET,
  emisor: {
    ruc: rut,
    razonSocial: razon,
    sucursal: { codigo: 1, domicilio: 'Montevideo', ciudad: 'Montevideo', departamento: 'Montevideo' },
  },
  moneda: 'UYU',
  fechaEmision: new Date(),
  lineas: [{ cantidad: 1, descripcion: 'Prueba e2e WS', precioUnitario: 100, indicadorFacturacion: IndicadorFacturacion.TASA_BASICA }],
};
const certificado = { cert, privateKey: key };
const cfeFirmado = firmarCfe(buildCfeXml({ input: ticket, serie, numero, cae }), certificado);
const sobre = `<?xml version="1.0" encoding="UTF-8"?>${crearSobre({
  rucEmisor: rut,
  rutReceptor: RUT_DGI,
  idEmisor: 1,
  cfesFirmados: [cfeFirmado],
  cert,
})}`;
console.log(`  sobre generado: ${sobre.length} bytes (e-Ticket ${serie}-${numero}) → ${guardar('sobre-enviado.xml', sobre)}`);

// ---------------------------------------------- Sonda 2: envelope crudo al WS
titulo('Sonda 2 — POST SOAP crudo (envelope por convención GeneXus)');
const envelope = buildSoapEnvelope('EFACRECEPCIONSOBRE', sobre);
const r = await pedir(urlBase, {
  body: envelope,
  conCert: true,
  estricto: tlsEstricto,
  headers: { 'Content-Type': 'text/xml; charset=utf-8', SOAPAction: '"http://dgi.gub.uyaction/AWS_EFACTURA.EFACRECEPCIONSOBRE"' },
});
if (!r.ok) {
  anotar(`el POST falló a nivel conexión: ${r.error}`);
  process.exit(0);
}
const fRespuesta = guardar('respuesta-cruda.xml', r.body);
anotar(`HTTP ${r.status} (${r.body.length} bytes) → ${fRespuesta}`);
if (r.tls) anotar(`TLS: servidor emitido por "${r.tls.emisorServidor}", verificación ${r.tls.autorizado ? 'OK' : `NO (${r.tls.errorAutorizacion})`}`);

const fault = r.body.match(/<(?:\w+:)?faultstring[^>]*>([\s\S]*?)<\/(?:\w+:)?faultstring>/i);
if (fault) {
  anotar(`SOAP Fault: "${fault[1].trim().slice(0, 200)}" — probable pista sobre el nombre real del envelope/operación`);
  console.log('\nSi el fault menciona el elemento esperado, ajustar buildSoapEnvelope y reintentar.');
} else if (/<(?:\w+:)?xmlData/i.test(r.body)) {
  anotar('la respuesta trae <xmlData> — el envelope GeneXus fue ACEPTADO tal cual lo construimos');
} else {
  anotar(`respuesta sin fault ni xmlData — inspeccionar ${fRespuesta} (primeros 300: "${r.body.replace(/\s+/g, ' ').slice(0, 300)}")`);
}

// ------------------------------------- Sonda 3: flujo completo con la lib
if (!fault && /<(?:\w+:)?xmlData/i.test(r.body)) {
  titulo('Sonda 3 — flujo completo con SoapDgiClient + enviarSobreADgi');
  const cliente = new SoapDgiClient({
    ambiente: 'testing',
    cert,
    key,
    url: process.env.DGI_E2E_URL,
    verificarServidor: tlsEstricto,
  });
  try {
    const resultado = await enviarSobreADgi(cliente, sobre);
    const s = resultado.acuseSobre;
    anotar(`ACKSobre: estado ${s.estado} (${s.aceptado ? 'ACEPTADO' : 'rechazado'}), idReceptor ${s.idReceptor}`);
    for (const m of s.motivosRechazo) anotar(`  motivo ${m.motivo}: ${m.glosa} — ${m.detalle ?? ''}`);
    if (resultado.acuseCfe) {
      const c = resultado.acuseCfe;
      anotar(`ACKCFE: ${c.aceptados} aceptados, ${c.rechazados} rechazados`);
      for (const d of c.detalles) {
        anotar(`  CFE ${d.serie}-${d.numero}: ${d.estado}${d.motivosRechazo.map((m) => ` | ${m.motivo} ${m.glosa}`).join('')}`);
      }
    }
    guardar('resultado-flujo.json', JSON.stringify(resultado, null, 2));
  } catch (e) {
    anotar(`el flujo de la lib falló: ${e.message} — comparar con la respuesta cruda de la sonda 2`);
  }
}

// ----------------------------------------------------------------- Resumen
titulo('RESUMEN DE HALLAZGOS (pasar a TODO.md los que resuelvan ⚠️)');
resumen.forEach((h, i) => console.log(`${String(i + 1).padStart(2)}. ${h}`));
console.log(`\nArchivos crudos en: ${salidaDir}\n`);
