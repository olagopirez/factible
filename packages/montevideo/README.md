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

// Próximamente (endpoints pendientes de relevar):
// const tea = await mvd.arribos(1234);  // ¿cuándo llega a mi parada?
// const playas = await mvd.playas();    // ¿está apta Pocitos hoy?
```

## Estado

🟢 **Buses validado end-to-end contra la API real** (2026-07-05). Spec de conexión: `spec/Manual_de_conexion_a_Montevideo_API_v1.0.pdf`.

- [x] Autenticación OAuth2 Client Credentials contra Keycloak (Basic con fallback automático a `client_secret_post`), caché de token, renovación automática y reintento transparente ante 401. **Validada contra el Keycloak real.**
- [x] `buses({ lineas })` — `/transportepublico/buses?lines=`. Devuelve `Bus[]` tipado (dominio en español) con shape fijado contra una respuesta real; el registro original queda en `bus.crudo`.
- [x] `get(path, params)` público: cualquier endpoint del portal, autenticado.
- [x] Mock del portal (Keycloak + API) fiel a las respuestas reales.
- [ ] Relevar endpoints de TEA (arribos) y playas. ⚠️ Playas es un **servicio aparte** en el portal: requiere su propia Aplicación asociada a ese servicio.
- [ ] Publicar en npm al mergear.

Acceso: cuenta gratuita autoservicio en [api.montevideo.gub.uy](https://api.montevideo.gub.uy) → Mis aplicaciones → crear Aplicación sobre el servicio **Transporte publico** → copiar ID y Secreto del cliente. (La Redirect URL que pide el formulario no se usa en este flujo; cualquier URL válida sirve.)

E2E: `MVD_CLIENT_ID=... MVD_CLIENT_SECRET=... MVD_E2E=1 npx vitest run`

Parte del ecosistema [factible](../../README.md). MIT.
