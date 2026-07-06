/**
 * @factible/montevideo — APIs de la Intendencia de Montevideo (STM en tiempo real, playas).
 */
export {
  MontevideoClient,
  BASE_URL,
  PLAYAS_PATH,
  mapearBus,
  mapearPlaya,
  mapearCasilla,
  mapearParada,
  mapearVariante,
} from './cliente.js';
export type { MontevideoConfig } from './cliente.js';
export { TokenManager, TOKEN_URL } from './auth.js';
export type { Credenciales } from './auth.js';
export type { Bus, BusCrudo, Parada, LineaVariante, LineaEnParada, Arribo, Playa, Casilla } from './tipos.js';
