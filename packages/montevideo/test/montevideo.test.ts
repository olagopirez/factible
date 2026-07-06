import { createServer, type Server } from 'node:http';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { MontevideoClient, PendienteDeSpec } from '../src/index.js';

/**
 * Mock del portal: Keycloak (token endpoint, client credentials por Basic auth,
 * tokens con expiración) + API de buses exigiendo Bearer vigente.
 * Fiel al Manual de conexión v1.0.
 */
let server: Server;
let baseUrl: string;
let tokenUrl: string;

let tokensEmitidos = 0;
let tokenVigente = '';
const pedidosApi: { path: string; auth: string }[] = [];

const CLIENT_ID = 'app-factible';
const CLIENT_SECRET = 'secreto-123';
let expiresIn = 300;

beforeAll(async () => {
  server = createServer((req, res) => {
    const json = (body: unknown, status = 200) => {
      res.statusCode = status;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(body));
    };

    // /token acepta Basic; /token-solo-post simula un Keycloak configurado
    // como client_secret_post (rechaza Basic, exige credenciales en el body).
    if ((req.url === '/token' || req.url === '/token-solo-post') && req.method === 'POST') {
      const soloPost = req.url === '/token-solo-post';
      let body = '';
      req.on('data', (c) => (body += c));
      req.on('end', () => {
        const params = new URLSearchParams(body);
        const basic = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64');
        const okBasic = !soloPost && req.headers.authorization === `Basic ${basic}`;
        const okPost = params.get('client_id') === CLIENT_ID && params.get('client_secret') === CLIENT_SECRET;
        if (!okBasic && !okPost) {
          return json({ error: 'invalid_client', error_description: 'Invalid client credentials' }, 400);
        }
        if (!params.get('grant_type')?.includes('client_credentials')) {
          return json({ error: 'unsupported_grant_type' }, 400);
        }
        tokensEmitidos += 1;
        tokenVigente = `tok-${tokensEmitidos}`;
        json({ access_token: tokenVigente, token_type: 'Bearer', expires_in: expiresIn });
      });
      return;
    }

    if (req.url?.startsWith('/api/transportepublico/buses')) {
      pedidosApi.push({ path: req.url, auth: req.headers.authorization ?? '' });
      if (req.headers.authorization !== `Bearer ${tokenVigente}`) {
        return json({ error: 'invalid_token' }, 401);
      }
      // Shape fiel a una respuesta real de la API (e2e 2026-07-05).
      return json([
        {
          eType: 'buses',
          company: 'CUTCSA',
          timestamp: '2026-07-05T21:02:15.000-03',
          busId: 104,
          line: '522',
          lineVariantId: 343,
          location: { type: 'Point', coordinates: [-56.201515, -34.909542] },
          origin: 'LOS AROMOS',
          destination: 'PLAZA ESPAÑA',
          subline: 'PZA. ESPAÑA - LOS AROMOS',
          special: false,
          speed: 0,
          access: 'COMÚN',
          thermalConfort: 'Sin datos',
          emissions: 'Euro III',
        },
        {
          eType: 'buses',
          company: 'CUTCSA',
          timestamp: '2026-07-05T21:02:18.000-03',
          busId: 271,
          line: '522',
          lineVariantId: 344,
          location: { type: 'Point', coordinates: [-56.16, -34.9] },
          origin: 'PLAZA ESPAÑA',
          destination: 'LOS AROMOS',
          subline: 'LOS AROMOS - PZA. ESPAÑA',
          special: false,
          speed: 32,
          access: 'COMÚN',
          thermalConfort: 'Sin datos',
          emissions: 'Euro V',
        },
      ]);
    }

    // Servicio de playas (base /api/environment, v1.0.0).
    // Payloads fieles a los ejemplos de la doc oficial del portal.
    if (req.url?.startsWith('/api/environment/beaches')) {
      if (req.headers.authorization !== `Bearer ${tokenVigente}`) {
        return json({ error: 'invalid_token' }, 401);
      }
      if (req.url.startsWith('/api/environment/beaches/lifeguardstations')) {
        return json([
          {
            id: 'MVD:lifeguardstation:12',
            name: 'Batlle y Ordoñez',
            address: 'Rambla Republica de Chile y Batlle y Ordoñez.',
            beach: 'Pocitos',
            healthFlag: 'true',
            healthFlagCause: '2',
            healthFlagCauseDesc: 'Mortandad de peces',
            healthFlagExpiration: '2020-01-30T23:00:00.00Z',
            safetyFlag: 'green',
            safetyFlagExpiration: '2020-01-30T23:00:00.00Z',
            linkComoIr: 'https://m.montevideo.gub.uy/comoir/destino?td*PLAYA&c1d*2016&ld*Playa%20Buceo',
            location: { type: 'Point', coordinates: [-56.196167, -34.903778] },
          },
        ]);
      }
      return json([
        {
          id: 'dda_casillas_playas.1',
          name: 'Pocitos',
          description: 'Rambla República del Perú y Gabriel Pereira.Pocitos',
          location: { type: 'Point', coordinates: [-56.196167, -34.903778] },
        },
      ]);
    }

    json({ error: 'not_found' }, 404);
  });
  await new Promise<void>((r) => server.listen(0, () => r()));
  const port = (server.address() as { port: number }).port;
  baseUrl = `http://127.0.0.1:${port}/api`;
  tokenUrl = `http://127.0.0.1:${port}/token`;
});
afterAll(() => server.close());

function cliente(secret = CLIENT_SECRET) {
  return new MontevideoClient({
    credenciales: { clientId: CLIENT_ID, clientSecret: secret },
    baseUrl,
    tokenUrl,
  });
}

describe('MontevideoClient', () => {
  it('obtiene token por client credentials y consulta buses por línea', async () => {
    const mvd = cliente();
    const buses = await mvd.buses({ lineas: [522] });

    expect(buses).toHaveLength(2);
    expect(pedidosApi.at(-1)!.path).toContain('lines=522');
    expect(pedidosApi.at(-1)!.auth).toMatch(/^Bearer tok-/);
  });

  it('mapea el shape real de la API al dominio tipado', async () => {
    const [bus] = await cliente().buses({ lineas: [522] });

    expect(bus).toMatchObject({
      busId: 104,
      empresa: 'CUTCSA',
      linea: '522',
      varianteId: 343,
      origen: 'LOS AROMOS',
      destino: 'PLAZA ESPAÑA',
      sublinea: 'PZA. ESPAÑA - LOS AROMOS',
      especial: false,
      velocidad: 0,
      acceso: 'COMÚN',
      emisiones: 'Euro III',
    });
    // GeoJSON Point: [longitud, latitud]
    expect(bus!.latitud).toBeCloseTo(-34.909542);
    expect(bus!.longitud).toBeCloseTo(-56.201515);
    // Offset "-03" sin minutos, normalizado al parsear
    expect(bus!.timestamp?.toISOString()).toBe('2026-07-06T00:02:15.000Z');
    // El registro original queda accesible
    expect(bus!.crudo['eType']).toBe('buses');
  });

  it('reusa el token cacheado entre llamadas', async () => {
    const antes = tokensEmitidos;
    const mvd = cliente();
    await mvd.buses();
    await mvd.buses();
    await mvd.buses();
    expect(tokensEmitidos).toBe(antes + 1); // un solo token para las tres llamadas
  });

  it('ante un 401 (token invalidado por el servidor) renueva y reintenta transparente', async () => {
    const mvd = cliente();
    await mvd.buses();
    const antes = tokensEmitidos;

    tokenVigente = 'tok-invalidado-por-el-servidor'; // el server ya no acepta el token del cliente
    const buses = await mvd.buses(); // debe renovar y reintentar sin fallar

    expect(buses).toHaveLength(2);
    expect(tokensEmitidos).toBe(antes + 1);
  });

  it('credenciales inválidas fallan con mensaje útil', async () => {
    await expect(cliente('secreto-malo').buses()).rejects.toThrow(/credenciales|Mis aplicaciones/);
  });

  it('si el servidor exige client_secret_post, cae al fallback automáticamente', async () => {
    const mvd = new MontevideoClient({
      credenciales: { clientId: CLIENT_ID, clientSecret: CLIENT_SECRET },
      baseUrl,
      tokenUrl: tokenUrl.replace('/token', '/token-solo-post'),
    });
    const buses = await mvd.buses({ lineas: [522] });
    expect(buses).toHaveLength(2);
  });

  it('lista playas mapeadas al dominio', async () => {
    const [playa] = await cliente().playas();

    expect(playa).toMatchObject({
      id: 'dda_casillas_playas.1',
      nombre: 'Pocitos',
      descripcion: 'Rambla República del Perú y Gabriel Pereira.Pocitos',
    });
    expect(playa!.latitud).toBeCloseTo(-34.903778);
    expect(playa!.longitud).toBeCloseTo(-56.196167);
  });

  it('lista casillas con el estado de las banderas', async () => {
    const [casilla] = await cliente().casillas();

    expect(casilla).toMatchObject({
      id: 'MVD:lifeguardstation:12',
      nombre: 'Batlle y Ordoñez',
      playa: 'Pocitos',
      banderaSanitaria: true, // healthFlag llega como string "true"
      causaSanitaria: '2',
      causaSanitariaDesc: 'Mortandad de peces',
      banderaSeguridad: 'green',
      linkComoIr: 'https://m.montevideo.gub.uy/comoir/destino?td*PLAYA&c1d*2016&ld*Playa%20Buceo',
    });
    expect(casilla!.venceSanitaria?.toISOString()).toBe('2020-01-30T23:00:00.000Z');
  });

  it('arribos() declara su spec pendiente', async () => {
    await expect(cliente().arribos(1234)).rejects.toThrow(PendienteDeSpec);
  });
});

// E2E real contra Montevideo API — opt-in:
//   MVD_CLIENT_ID=xxx MVD_CLIENT_SECRET=yyy MVD_E2E=1 npx vitest run
describe.skipIf(!process.env['MVD_E2E'])('Montevideo API real (e2e)', () => {
  it('autentica y trae posiciones de buses reales', async () => {
    const mvd = new MontevideoClient({
      credenciales: {
        clientId: process.env['MVD_CLIENT_ID']!,
        clientSecret: process.env['MVD_CLIENT_SECRET']!,
      },
    });
    const buses = await mvd.buses();
    expect(Array.isArray(buses)).toBe(true);
    if (buses.length > 0) {
      const bus = buses[0]!;
      // Invariantes del mapeo sobre datos reales:
      expect(bus.busId).toBeTypeOf('number');
      expect(bus.linea).toBeTruthy();
      expect(bus.empresa).toBeTruthy();
      expect(Math.abs(bus.latitud)).toBeGreaterThan(30); // Montevideo ≈ -34.9
      expect(Math.abs(bus.longitud)).toBeGreaterThan(50); // ≈ -56.2
      console.log('bus mapeado:', JSON.stringify({ ...bus, crudo: undefined }));
    }
  }, 30_000);
});

// E2E del servicio de playas — requiere una Aplicación aparte (servicio "Playas"):
//   MVD_PLAYAS_CLIENT_ID=xxx MVD_PLAYAS_CLIENT_SECRET=yyy MVD_PLAYAS_E2E=1 npx vitest run
describe.skipIf(!process.env['MVD_PLAYAS_E2E'])('Playas real (e2e)', () => {
  it('lista playas y casillas con banderas', async () => {
    const mvd = new MontevideoClient({
      credenciales: {
        clientId: process.env['MVD_PLAYAS_CLIENT_ID']!,
        clientSecret: process.env['MVD_PLAYAS_CLIENT_SECRET']!,
      },
    });

    const playas = await mvd.playas();
    expect(playas.length).toBeGreaterThan(0);
    expect(playas[0]!.nombre).toBeTruthy();
    console.log('playa mapeada:', JSON.stringify({ ...playas[0], crudo: undefined }));

    const casillas = await mvd.casillas();
    expect(casillas.length).toBeGreaterThan(0);
    console.log('casilla mapeada:', JSON.stringify({ ...casillas[0], crudo: undefined }));
  }, 30_000);
});
