# @factible/montevideo

APIs de la **Intendencia de Montevideo**: posiciones de los buses del STM en tiempo real, tiempos de arribo a paradas (los mismos servicios de la app "Cómo Ir") y estado de bañabilidad de las playas.

```ts
import { MontevideoClient } from '@factible/montevideo';

const mvd = new MontevideoClient({
  credenciales: {
    clientId: process.env.MVD_CLIENT_ID!,     // "ID de cliente" de tu Aplicación
    clientSecret: process.env.MVD_CLIENT_SECRET!, // "Secreto del cliente"
  },
});

const buses = await mvd.buses({ lineas: [103] }); // Bus[] tipado, en tiempo real
console.log(buses[0]);
// { busId: 104, empresa: 'CUTCSA', linea: '103', destino: 'PLAZA ESPAÑA',
//   latitud: -34.909542, longitud: -56.201515, velocidad: 0, ... }

// Paradas, líneas y TEA (¿cuándo llega a mi parada?):
const paradas = await mvd.paradas();
const lineas = await mvd.lineasPorParada(546);
const tea = await mvd.arribos(546, { lineas: ['103'] });
const variantes = await mvd.variantes();

// Playas (requiere una Aplicación aparte, asociada al servicio "Playas"):
const playas = await mvd.playas();       // lista de playas con coordenadas
const casillas = await mvd.casillas();   // banderas por casilla de guardavidas
// { nombre: 'Batlle y Ordoñez', playa: 'Pocitos', banderaSeguridad: 'green',
//   banderaSanitaria: true, causaSanitariaDesc: 'Mortandad de peces', ... }
```

## Estado

🟢 **Buses y playas validados end-to-end contra las APIs reales** (2026-07-05). Specs en `spec/`: manual de conexión v1.0 + doc del servicio de transporte (`/api/transportepublico` v1.0.0).

- [x] Autenticación OAuth2 Client Credentials contra Keycloak (Basic con fallback automático a `client_secret_post`), caché de token, renovación automática y reintento transparente ante 401. **Validada contra el Keycloak real.**
- [x] `buses({ lineas })` — `/transportepublico/buses?lines=`. Devuelve `Bus[]` tipado (dominio en español) con shape fijado contra una respuesta real; el registro original queda en `bus.crudo`.
- [x] `get(path, params)` público: cualquier endpoint del portal, autenticado.
- [x] Mock del portal (Keycloak + API) fiel a las respuestas reales.
- [x] `paradas()`, `lineasPorParada()`, `variantes()` y `arribos()` (TEA, `/buses/busstops/{id}/upcomingbuses`) — contra la doc oficial del servicio. ⚠️ TODO: el modelo documentado de arribos no muestra el campo del ETA en minutos; confirmar con el e2e (que imprime el registro crudo).
- [x] `playas()` y `casillas()` — servicio de playas (`/api/environment`, v1.0.0): lista de playas y estado de banderas (seguridad + sanitaria) por casilla. **Validado e2e contra la API real** (2026-07-05). ⚠️ Servicio aparte: requiere su propia Aplicación asociada a "Playas". Fuera de temporada las casillas vienen sin banderas (campos opcionales).
- [ ] Confirmar shape real de arribos/TEA con el e2e de transporte.
- [ ] Publicar en npm al mergear.

GTFS: el servicio también expone la información estática del sistema en formato GTFS (beta): `GET /buses/gtfs/static/latest/google_transit.zip` (y `version.txt`) — consumible con `get()`.

Acceso: cuenta gratuita autoservicio en [api.montevideo.gub.uy](https://api.montevideo.gub.uy) → Mis aplicaciones → crear Aplicación sobre el servicio **Transporte publico** → copiar ID y Secreto del cliente. (La Redirect URL que pide el formulario no se usa en este flujo; cualquier URL válida sirve.)

E2E: `MVD_CLIENT_ID=... MVD_CLIENT_SECRET=... MVD_E2E=1 npx vitest run`

Parte del ecosistema [factible](../../README.md). MIT.
