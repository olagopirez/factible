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

🚧 **Esqueleto — no funcional todavía.** Los métodos lanzan `PendienteDeSpec` a propósito.

Triaje aprobado: el portal [api.montevideo.gub.uy](https://api.montevideo.gub.uy/docs) es de los pocos del Estado con documentación para desarrolladores, y el acceso es **cuenta gratuita autoservicio** (uso intensivo: pci@imm.gub.uy). Lo que falta para completar el cliente:

- [ ] Registrar cuenta en el portal y relevar la doc autenticada: mecanismo de auth (¿API key? ¿OAuth2?), rutas exactas y shapes de respuesta.
- [ ] Implementar `buses()`, `arribos()` y `playas()` contra esa spec.
- [ ] Mock fiel a las respuestas reales (regla del ecosistema: los mocks no mienten).
- [ ] Validar contra la API en vivo y ajustar los tipos provisorios de `src/tipos.ts`.

Parte del ecosistema [factible](../../README.md). MIT.
