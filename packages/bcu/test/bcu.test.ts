import { createServer, type Server } from 'node:http';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { BcuClient, MONEDAS } from '../src/index.js';

const RESPUESTA_COTIZACIONES = `<?xml version="1.0" encoding="utf-8"?>
<SOAP-ENV:Envelope xmlns:SOAP-ENV="http://schemas.xmlsoap.org/soap/envelope/">
<SOAP-ENV:Body><cot:wsbcucotizaciones.ExecuteResponse xmlns:cot="Cotiza"><cot:Salida>
<cot:respuestastatus><cot:status>1</cot:status><cot:codigoerror>0</cot:codigoerror><cot:mensaje/></cot:respuestastatus>
<cot:datoscotizaciones>
<cot:datoscotizaciones.dato>
  <cot:Fecha>2026-07-03</cot:Fecha><cot:Moneda>2225</cot:Moneda>
  <cot:Nombre>DLS. USA BILLETE</cot:Nombre><cot:CodigoISO>USD</cot:CodigoISO>
  <cot:Emisor>Estados Unidos</cot:Emisor>
  <cot:TCC>39.85</cot:TCC><cot:TCV>40.35</cot:TCV>
  <cot:ArbAct>1</cot:ArbAct><cot:FormaArbitrar>1</cot:FormaArbitrar>
</cot:datoscotizaciones.dato>
<cot:datoscotizaciones.dato>
  <cot:Fecha>2026-07-03</cot:Fecha><cot:Moneda>1111</cot:Moneda>
  <cot:Nombre>EURO</cot:Nombre><cot:CodigoISO>EUR</cot:CodigoISO>
  <cot:TCC>43.10</cot:TCC><cot:TCV>44.20</cot:TCV>
</cot:datoscotizaciones.dato>
</cot:datoscotizaciones>
</cot:Salida></cot:wsbcucotizaciones.ExecuteResponse></SOAP-ENV:Body></SOAP-ENV:Envelope>`;

const RESPUESTA_ERROR = RESPUESTA_COTIZACIONES
  .replace('<cot:status>1</cot:status>', '<cot:status>0</cot:status>')
  .replace('<cot:codigoerror>0</cot:codigoerror>', '<cot:codigoerror>100</cot:codigoerror>')
  .replace('<cot:mensaje/>', '<cot:mensaje>No existen cotizaciones para la fecha</cot:mensaje>');

const RESPUESTA_CIERRE = `<?xml version="1.0"?><SOAP-ENV:Envelope xmlns:SOAP-ENV="http://schemas.xmlsoap.org/soap/envelope/">
<SOAP-ENV:Body><n:wsultimocierre.ExecuteResponse xmlns:n="Cotiza"><n:Salida><n:Fecha>2026-07-03</n:Fecha></n:Salida></n:wsultimocierre.ExecuteResponse></SOAP-ENV:Body></SOAP-ENV:Envelope>`;

let server: Server;
let baseUrl: string;
const pedidos: { path: string; body: string }[] = [];
let modoError = false;

beforeAll(async () => {
  server = createServer((req, res) => {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      pedidos.push({ path: req.url ?? '', body });
      res.setHeader('Content-Type', 'text/xml');
      if (modoError) return res.end(RESPUESTA_ERROR);
      res.end(req.url?.includes('ultimocierre') ? RESPUESTA_CIERRE : RESPUESTA_COTIZACIONES);
    });
  });
  await new Promise<void>((r) => server.listen(0, () => r()));
  baseUrl = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
});
afterAll(() => server.close());

describe('BcuClient', () => {
  it('consulta cotizaciones y las tipa', async () => {
    const bcu = new BcuClient({ baseUrl });
    const r = await bcu.cotizaciones({ monedas: [MONEDAS.DOLAR_USA, MONEDAS.EURO], desde: '2026-07-03' });

    expect(r).toHaveLength(2);
    expect(r[0]).toMatchObject({
      fecha: '2026-07-03', moneda: 2225, codigoIso: 'USD',
      compra: 39.85, venta: 40.35, emisor: 'Estados Unidos',
    });
    expect(r[1]!.emisor).toBeUndefined();

    const pedido = pedidos.at(-1)!;
    expect(pedido.path).toContain('awsbcucotizaciones');
    expect(pedido.body).toContain('<cot:item>2225</cot:item>');
    expect(pedido.body).toContain('<cot:FechaDesde>2026-07-03</cot:FechaDesde>');
    expect(pedido.body).toContain('<cot:Grupo>0</cot:Grupo>');
  });

  it('ultimoCierre devuelve la fecha', async () => {
    const bcu = new BcuClient({ baseUrl });
    expect(await bcu.ultimoCierre()).toBe('2026-07-03');
  });

  it('cotizacion() sin fecha usa el último cierre', async () => {
    const bcu = new BcuClient({ baseUrl });
    const c = await bcu.cotizacion(MONEDAS.DOLAR_USA);
    expect(c.codigoIso).toBe('USD');
    const consultas = pedidos.slice(-2);
    expect(consultas[0]!.path).toContain('ultimocierre');
    expect(consultas[1]!.body).toContain('2026-07-03');
  });

  it('convierte errores del servicio en excepciones con mensaje', async () => {
    modoError = true;
    const bcu = new BcuClient({ baseUrl });
    await expect(bcu.cotizaciones({ monedas: [2225], desde: '2026-01-01' })).rejects.toThrow(
      /No existen cotizaciones/,
    );
    modoError = false;
  });
});

// Test de integración real contra BCU — opt-in: BCU_E2E=1 npm test
describe.skipIf(!process.env['BCU_E2E'])('BCU real (e2e)', () => {
  it('trae la cotización del dólar del último cierre', async () => {
    const bcu = new BcuClient();
    const cierre = await bcu.ultimoCierre();
    expect(cierre).toMatch(/^\d{4}-\d{2}-\d{2}/);
    const c = await bcu.cotizacion(MONEDAS.DOLAR_USA, cierre);
    expect(c.codigoIso).toBe('USD');
    expect(c.compra).toBeGreaterThan(10);
    expect(c.venta).toBeGreaterThan(c.compra);
  }, 30_000);
});
