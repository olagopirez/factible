/**
 * Cliente de las APIs de la Intendencia de Montevideo.
 *
 * Estado: ESQUELETO — la documentación fina de endpoints (rutas, autenticación,
 * shapes de respuesta) está detrás del login del portal. Este cliente se
 * completa contra esa spec real; hasta entonces, los métodos lanzan
 * PendienteDeSpec para que nadie lo use por accidente.
 *
 * Acceso: cuenta gratuita autoservicio en https://api.montevideo.gub.uy
 * (rate limit razonable por defecto; uso intensivo: pci@imm.gub.uy).
 */
import type { Arribo, Bus, Playa } from './tipos.js';

export interface MontevideoConfig {
  /**
   * Credenciales del portal. El mecanismo exacto (API key / OAuth2) se
   * confirma contra la doc autenticada — por eso el tipo es amplio.
   */
  credenciales: { apiKey?: string; clientId?: string; clientSecret?: string };
  /** Override de la URL base (tests / mock). */
  baseUrl?: string;
  timeoutMs?: number;
}

export class PendienteDeSpec extends Error {
  constructor(metodo: string) {
    super(
      `${metodo}: pendiente de implementar contra la documentación autenticada del portal ` +
        '(https://api.montevideo.gub.uy). Ver README del paquete.',
    );
  }
}

export class MontevideoClient {
  constructor(private readonly config: MontevideoConfig) {}

  /** Posiciones en tiempo real de los buses del STM (opcionalmente filtradas por línea). */
  async buses(_filtro?: { linea?: string }): Promise<Bus[]> {
    throw new PendienteDeSpec('buses()');
  }

  /** Tiempo estimado de arribo (TEA) de las líneas a una parada. */
  async arribos(_parada: number): Promise<Arribo[]> {
    throw new PendienteDeSpec('arribos()');
  }

  /** Índice de bañabilidad y estado sanitario de las playas de Montevideo. */
  async playas(): Promise<Playa[]> {
    throw new PendienteDeSpec('playas()');
  }
}
