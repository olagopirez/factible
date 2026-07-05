/**
 * @factible/montevideo — APIs de la Intendencia de Montevideo (STM en tiempo real, playas).
 */
export { MontevideoClient, PendienteDeSpec, BASE_URL } from './cliente.js';
export type { MontevideoConfig, BusCrudo } from './cliente.js';
export { TokenManager, TOKEN_URL } from './auth.js';
export type { Credenciales } from './auth.js';
export type { Bus, Parada, Arribo, Playa } from './tipos.js';
