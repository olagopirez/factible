/**
 * @factible/montevideo — APIs de la Intendencia de Montevideo (STM en tiempo real, playas).
 */
export { MontevideoClient, PendienteDeSpec, BASE_URL, mapearBus } from './cliente.js';
export type { MontevideoConfig } from './cliente.js';
export { TokenManager, TOKEN_URL } from './auth.js';
export type { Credenciales } from './auth.js';
export type { Bus, BusCrudo, Parada, Arribo, Playa } from './tipos.js';
