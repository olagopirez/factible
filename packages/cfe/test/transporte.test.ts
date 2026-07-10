import { SignedXml } from 'xml-crypto';
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { MemoryCaeStore } from '../src/cae/memory-store.js';
import { Factible } from '../src/factible.js';
import { crearSobre, RUT_DGI } from '../src/sobre/sobre.js';
import { enviarSobreADgi } from '../src/transporte/flujo.js';
import { MockDgiTransport } from '../src/transporte/mock.js';
import { SoapDgiClient } from '../src/transporte/soap-client.js';
import { buildSoapEnvelope, extractSoapResult } from '../src/transporte/transporte.js';
import { IndicadorFacturacion, TipoCFE } from '../src/types/cfe.js';

const certificado = {
  privateKey: readFileSync(resolve(__dirname, 'fixtures/test-key.pem'), 'utf8'),
  cert: readFileSync(resolve(__dirname, 'fixtures/test-cert.pem'), 'utf8'),
};

const emisor = {
  ruc: '211234560019',
  razonSocial: 'Ejemplo SA',
  sucursal: { codigo: 1, domicilio: 'Av. Siempre Viva 123', ciudad: 'Montevideo', departamento: 'Montevideo' },
};

async function sobreConDosCfes() {
  const caeStore = new MemoryCaeStore();
  await caeStore.agregarRango({
    id: '90230011234', tipoCFE: TipoCFE.E_TICKET, serie: 'A',
    numeroDesde: 1, numeroHasta: 100, fechaExpiracion: new Date(Date.now() + 86400_000),
  });
  const factible = new Factible({ emisor, certificado, caeStore });
  const lineas = [
    { cantidad: 1, descripcion: 'Café', precioUnitario: 190, indicadorFacturacion: IndicadorFacturacion.TASA_BASICA },
  ];
  const [a, b] = await Promise.all([
    factible.emitir({ tipo: TipoCFE.E_TICKET, moneda: 'UYU', lineas }),
    factible.emitir({ tipo: TipoCFE.E_TICKET, moneda: 'UYU', lineas }),
  ]);
  return crearSobre({
    rucEmisor: emisor.ruc, rutReceptor: RUT_DGI, idEmisor: 7,
    cfesFirmados: [a!.xml, b!.xml], cert: certificado.cert,
  });
}

describe('envelope SOAP', () => {
  it('construye y extrae xmlData (roundtrip con caracteres especiales)', () => {
    const payload = '<Sobre><Texto>Café & <ñandú></Texto></Sobre>';
    const envelope = buildSoapEnvelope('EFACRECEPCIONSOBRE', payload);
    expect(envelope).toContain('WS_eFactura.EFACRECEPCIONSOBRE');
    expect(envelope).not.toContain('<Sobre>'); // va escapado
    const respuesta = envelope.replace('EFACRECEPCIONSOBRE', 'EFACRECEPCIONSOBREResponse');
    expect(extractSoapResult(respuesta)).toBe(payload);
  });

  it('detecta SOAP Fault', () => {
    const fault = '<soapenv:Envelope xmlns:soapenv="x"><soapenv:Body><soapenv:Fault><faultstring>Acceso denegado</faultstring></soapenv:Fault></soapenv:Body></soapenv:Envelope>';
    expect(() => extractSoapResult(fault)).toThrow(/Acceso denegado/);
  });
});

describe('flujo completo contra DGI simulada', () => {
  it('sobre aceptado → consulta → todos los CFEs aceptados', async () => {
    const transporte = new MockDgiTransport();
    const sobre = await sobreConDosCfes();
    const r = await enviarSobreADgi(transporte, sobre, { dormir: async () => {} });

    expect(r.acuseSobre.aceptado).toBe(true);
    expect(r.acuseSobre.cantidadCfe).toBe(2);
    expect(r.acuseCfe?.aceptados).toBe(2);
    expect(r.acuseCfe?.detalles.every((d) => d.aceptado)).toBe(true);
  });

  it('sobre rechazado: corta sin consultar y trae glosa', async () => {
    const transporte = new MockDgiTransport({ rechazarSobre: ['S05'] });
    const sobre = await sobreConDosCfes();
    const r = await enviarSobreADgi(transporte, sobre, { dormir: async () => {} });

    expect(r.acuseSobre.aceptado).toBe(false);
    expect(r.acuseCfe).toBeUndefined();
    expect(r.acuseSobre.motivosRechazo[0]).toMatchObject({
      motivo: 'S05',
      glosa: 'No coinciden cantidad CFE de carátula y contenido',
    });
  });

  it('CFE puntual rechazado con motivo E05 y glosa de tabla', async () => {
    const transporte = new MockDgiTransport({ rechazarCfes: { 'A-2': ['E05'] } });
    const sobre = await sobreConDosCfes();
    const r = await enviarSobreADgi(transporte, sobre, { dormir: async () => {} });

    expect(r.acuseCfe?.aceptados).toBe(1);
    expect(r.acuseCfe?.rechazados).toBe(1);
    const rechazado = r.acuseCfe!.detalles.find((d) => !d.aceptado)!;
    expect(rechazado.numero).toBe(2);
    expect(rechazado.motivosRechazo[0]!.glosa).toBe('Firma electrónica no es válida');
  });
});

describe('SoapDgiClient contra servidor local', () => {
  const recibido: { body?: string; soapAction?: string } = {};
  const server = createServer((req, res) => {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      recibido.body = body;
      recibido.soapAction = req.headers.soapaction as string;
      res.setHeader('Content-Type', 'text/xml');
      res.end(
        '<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"><soapenv:Body>' +
          '<Resp><xmlData>&lt;ACKSobre&gt;ok&lt;/ACKSobre&gt;</xmlData></Resp>' +
          '</soapenv:Body></soapenv:Envelope>',
      );
    });
  });
  afterAll(() => server.close());

  it('envía envelope y SOAPAction correctos y parsea la respuesta', async () => {
    await new Promise<void>((r) => server.listen(0, () => r()));
    const port = (server.address() as { port: number }).port;

    const cliente = new SoapDgiClient({
      ambiente: 'testing',
      cert: certificado.cert,
      key: certificado.privateKey,
      url: `http://127.0.0.1:${port}/ws`, // http solo para el test local
    });
    const ack = await cliente.enviarSobre('<EnvioCFE/>');

    expect(ack).toBe('<ACKSobre>ok</ACKSobre>');
    // Verbatim del WSDL real (spec/ws_eprueba.wsdl).
    expect(recibido.soapAction).toBe('"http://dgi.gub.uyaction/AWS_EFACTURA.EFACRECEPCIONSOBRE"');
    expect(recibido.body).toContain('xmlns:dgi="http://dgi.gub.uy"');
    expect(recibido.body).toContain('WS_eFactura.EFACRECEPCIONSOBRE');
    expect(recibido.body).toContain('&lt;EnvioCFE/&gt;');
    // WS-Security obligatorio (manual oficial + fault real "No signature in message!")
    expect(recibido.body).toContain('<wsse:Security');
    expect(recibido.body).toContain('BinarySecurityToken');
    expect(recibido.body).toContain('Reference URI="#Body-factible"');
    const sigWss = new SignedXml({ idMode: 'wssecurity', publicCert: certificado.cert });
    sigWss.loadSignature(recibido.body!.match(/<Signature[\s\S]*?<\/Signature>/)![0]);
    expect(sigWss.checkSignature(recibido.body!)).toBe(true);
  });
});
