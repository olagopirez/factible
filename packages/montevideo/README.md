# @factible/montevideo

APIs de la **Intendencia de Montevideo**: posiciones de los buses del STM en tiempo real, tiempos de arribo a paradas (los mismos servicios de la app "Cómo Ir") y estado de bañabilidad de las playas.

```ts
// API objetivo (en construcción)
import { MontevideoClient } from '@factible/montevideo';

const mvd = new MontevideoClient({ credenciales: { apiKey: process.env.IM_API_KEY! } });

const buses = await mvd.buses({ linea: '103' }); // posiciones en tiempo real
const tea = await mvd.arribos(1234);             // ¿cuándo llega a mi parada?
const playas = await mvd.playas();               // ¿está apta Pocitos hoy?
```

## Estado

🟡 **Capa de conexión implementada contra el manual oficial** (`spec/Manual_de_conexion_a_Montevideo_API_v1.0.pdf`):

- [x] Autenticación OAuth2 Client Credentials contra Keycloak, con caché de token, renovación automática y reintento transparente ante 401.
- [x] `buses({ lineas })` — endpoint del manual (`/transportepublico/buses?lines=`). Devuelve `BusCrudo[]` (shape sin tipar hasta ver respuestas reales).
- [x] `get(path, params)` público: cualquier endpoint del portal, autenticado.
- [x] Mock del portal (Keycloak + API) fiel al manual, para desarrollar sin credenciales.
- [ ] Fijar tipos definitivos de `Bus` con una respuesta real (`MVD_CLIENT_ID=... MVD_CLIENT_SECRET=... MVD_E2E=1 npx vitest run` imprime el shape).
- [ ] Relevar endpoints de TEA (arribos) y playas en la doc autenticada del portal.
- [ ] Validación e2e completa → promover a beta.

Acceso: cuenta gratuita autoservicio en [api.montevideo.gub.uy](https://api.montevideo.gub.uy) → Mis aplicaciones → crear Aplicación → ID y Secreto del cliente.

Parte del ecosistema [factible](../../README.md). MIT.
