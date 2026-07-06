import { createServer, type Server } from 'node:http';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { MontevideoClient } from '../src/index.js';

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

      // Endpoints específicos antes que el genérico /buses.
      // Payloads fieles a los ejemplos de la doc oficial (spec/Documentacion_
      // servicios_transporte_publico.pdf).
      // Shape fiel a una respuesta real de upcomingbuses (e2e 2026-07-05) —
      // la doc oficial muestra un modelo incompleto sin eta/distance/position.
      if (req.url.includes('/buses/busstops/546/upcomingbuses')) {
        return json([
          {
            busId: 50,
            companyName: 'COETC',
            lineVariantId: 37,
            line: '405',
            origin: 'PEÑAROL',
            destination: 'PARQUE RODÓ',
            subline: 'PEÑAROL - PARQUE RODÓ',
            special: false,
            eta: 4,
            distance: 23921,
            position: 84,
            access: 'COMÚN',
            thermalConfort: 'Sin datos',
            emissions: 'Euro III',
            location: { type: 'Point', coordinates: [-56.170216, -34.912666] },
          },
        ]);
      }
      if (req.url.includes('/buses/busstops/546/lines')) {
        return json([{ line: '123SD', lineId: '324' }]);
      }
      if (req.url.includes('/buses/busstops')) {
        return json([
          {
            busstopId: 546,
            street1: 'CORUÑA',
            street2: 'PURIFICACION',
            street1Id: 2187,
            street2Id: 5733,
            location: { type: 'Point', coordinates: [-56.196167, -34.903778] },
          },
        ]);
      }
      if (req.url.includes('/buses/linevariants')) {
        return json([
          {
            lineVariantId: 1234,
            line: '123SD',
            lineId: '324',
            origin: 'CIUDAD VIEJA',
            destination: 'MALVIN',
            subline: 'CIUDAD VIEJA - MALVIN',
            special: true,
          },
        ]);
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
          // Fuera de temporada las casillas vienen SIN banderas (observado
          // contra la API real el 2026-07-05, invierno):
          {
            id: 'MVD:lifeguardstation:1',
            name: 'Marti',
            address: 'Jose Marti Republica del Peru y Marti.',
            beach: 'pocitos',
            location: { type: 'Point', coordinates: [-56.14743268, -34.91392318] },
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

  it('fuera de temporada las casillas vienen sin banderas y el mapeo lo tolera', async () => {
    const casillas = await cliente().casillas();
    const invierno = casillas[1]!;

    expect(invierno.nombre).toBe('Marti');
    expect(invierno.playa).toBe('pocitos');
    expect(invierno.banderaSeguridad).toBeUndefined();
    expect(invierno.banderaSanitaria).toBeUndefined();
  });

  it('consulta arribos (TEA) a una parada con líneas obligatorias', async () => {
    const arribos = await cliente().arribos(546, { lineas: ['405'], cantidadPorLinea: 2 });

    expect(arribos).toHaveLength(1);
    expect(arribos[0]).toMatchObject({
      eta: 4, // minutos hasta el arribo
      distancia: 23921,
      posicion: 84,
      busId: 50,
      empresa: 'COETC',
      varianteId: 37,
      linea: '405',
      origen: 'PEÑAROL',
      destino: 'PARQUE RODÓ',
      especial: false,
    });
    expect(arribos[0]!.latitud).toBeCloseTo(-34.912666);
    const pedido = pedidosApi.at(-1)!.path;
    expect(pedido).toContain('/busstops/546/upcomingbuses');
    expect(pedido).toContain('lines=405');
    expect(pedido).toContain('amountperline=2');
  });

  it('lista paradas y líneas por parada', async () => {
    const mvd = cliente();

    const [parada] = await mvd.paradas();
    expect(parada).toMatchObject({ paradaId: 546, calle1: 'CORUÑA', calle2: 'PURIFICACION' });
    expect(parada!.latitud).toBeCloseTo(-34.903778);

    const lineas = await mvd.lineasPorParada(546);
    expect(lineas).toEqual([{ linea: '123SD', lineaId: '324', crudo: { line: '123SD', lineId: '324' } }]);
  });

  it('lista variantes de línea, y el detalle por id', async () => {
    const mvd = cliente();

    const [variante] = await mvd.variantes();
    expect(variante).toMatchObject({ varianteId: 1234, linea: '123SD', sublinea: 'CIUDAD VIEJA - MALVIN' });

    await mvd.variantes(1234);
    expect(pedidosApi.at(-1)!.path).toContain('/buses/linevariants/1234');
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

  it('lista paradas y consulta arribos reales', async () => {
    const mvd = new MontevideoClient({
      credenciales: {
        clientId: process.env['MVD_CLIENT_ID']!,
        clientSecret: process.env['MVD_CLIENT_SECRET']!,
      },
    });

    const paradas = await mvd.paradas();
    expect(paradas.length).toBeGreaterThan(0);
    expect(paradas[0]!.paradaId).toBeTypeOf('number');
    console.log('parada mapeada:', JSON.stringify({ ...paradas[0], crudo: undefined }));

    // TEA: tomar un bus en circulación y probar contra las paradas más
    // cercanas a su posición (garantiza que la línea pasa por ahí).
    const buses = await mvd.buses();
    const bus = buses.find((b) => (b.velocidad ?? 0) > 0) ?? buses[0]!;
    const dist = (p: { latitud: number; longitud: number }) =>
      (p.latitud - bus.latitud) ** 2 + (p.longitud - bus.longitud) ** 2;
    const cercanas = [...paradas].sort((a, b) => dist(a) - dist(b)).slice(0, 5);

    for (const parada of cercanas) {
      // lineasPorParada devolvió 400 en el primer intento real — explorar en
      // qué casos funciona:
      try {
        const lineas = await mvd.lineasPorParada(parada.paradaId);
        console.log(`lineasPorParada(${parada.paradaId}):`, JSON.stringify(lineas.map((l) => l.linea)));
      } catch (e) {
        console.warn(`lineasPorParada(${parada.paradaId}) falló:`, String(e).slice(0, 120));
      }
      try {
        const arribos = await mvd.arribos(parada.paradaId, { lineas: [bus.linea] });
        // La doc no muestra el campo del ETA (ver TODO en tipos.ts) — el
        // registro crudo lo confirma:
        console.log(`arribo crudo (parada ${parada.paradaId}, línea ${bus.linea}):`, JSON.stringify(arribos[0]?.crudo ?? null));
        if (arribos.length > 0) break;
      } catch (e) {
        console.warn(`arribos(${parada.paradaId}) falló:`, String(e).slice(0, 120));
      }
    }
  }, 60_000);
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
