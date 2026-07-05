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
      return json([
        { id: 'B1', line: '522', location: { coordinates: [-56.18, -34.89] } },
        { id: 'B2', line: '522', location: { coordinates: [-56.16, -34.9] } },
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

  it('arribos() y playas() declaran su spec pendiente', async () => {
    const mvd = cliente();
    await expect(mvd.arribos(1234)).rejects.toThrow(PendienteDeSpec);
    await expect(mvd.playas()).rejects.toThrow(/pendiente/);
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
    // Dejar visible un ejemplo real para fijar los tipos definitivos:
    console.log('shape de ejemplo:', JSON.stringify(buses[0], null, 2)?.slice(0, 600));
  }, 30_000);
});
