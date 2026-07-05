/**
 * Cliente de Montevideo API (Intendencia de Montevideo).
 * Spec de conexión: Manual v1.0 (spec/) — OAuth2 Client Credentials + REST.
 *
 * Implementado contra el manual oficial:
 *   - Capa de autenticación completa (TokenManager, renovación automática).
 *   - GET autenticado genérico con reintento ante token expirado.
 *   - buses(): GET /api/transportepublico/buses?lines=...
 *
 * ⚠️ El shape exacto de las respuestas no está en el manual — buses() devuelve
 * los datos crudos tipados como BusCrudo hasta validar contra la API real
 * (ver README §Estado). arribos() y playas() esperan relevar sus endpoints.
 */
import { TokenManager, type Credenciales } from './auth.js';
import type { Arribo, Playa } from './tipos.js';

export const BASE_URL = 'https://api.montevideo.gub.uy/api';

/**
 * Posición de bus tal como la devuelve la API. Los campos exactos se fijan
 * al validar contra el servicio real; mientras tanto es un registro abierto.
 */
export type BusCrudo = Record<string, unknown>;

export interface MontevideoConfig {
  credenciales: Credenciales;
  /** Overrides para tests/mocks. */
  baseUrl?: string;
  tokenUrl?: string;
  timeoutMs?: number;
}

export class PendienteDeSpec extends Error {
  constructor(metodo: string, detalle: string) {
    super(`${metodo}: ${detalle}`);
  }
}

export class MontevideoClient {
  private readonly tokens: TokenManager;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;

  constructor(config: MontevideoConfig) {
    this.tokens = new TokenManager(config.credenciales, config.tokenUrl, config.timeoutMs);
    this.baseUrl = config.baseUrl ?? BASE_URL;
    this.timeoutMs = config.timeoutMs ?? 15_000;
  }

  /**
   * GET autenticado contra la API. Público a propósito: permite consumir
   * cualquier endpoint del portal aunque este cliente aún no lo tipee.
   */
  async get<T = unknown>(path: string, params?: Record<string, string>): Promise<T> {
    const url = new URL(`${this.baseUrl}${path}`);
    for (const [k, v] of Object.entries(params ?? {})) url.searchParams.set(k, v);

    let res = await this.fetchConToken(url);
    if (res.status === 401) {
      // Token vencido entre el chequeo y el uso: renovar y reintentar una vez.
      this.tokens.invalidar();
      res = await this.fetchConToken(url);
    }
    if (!res.ok) {
      const cuerpo = await res.text().catch(() => '');
      throw new Error(`Montevideo API respondió HTTP ${res.status} en ${path}: ${cuerpo.slice(0, 200)}`);
    }
    return (await res.json()) as T;
  }

  private async fetchConToken(url: URL): Promise<Response> {
    const token = await this.tokens.obtener();
    return fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(this.timeoutMs),
    });
  }

  /**
   * Posiciones en tiempo real de los buses del STM.
   * Endpoint del manual: /transportepublico/buses?lines=522
   */
  async buses(filtro?: { lineas?: (string | number)[] }): Promise<BusCrudo[]> {
    const params: Record<string, string> = {};
    if (filtro?.lineas?.length) params['lines'] = filtro.lineas.join(',');
    const datos = await this.get<unknown>('/transportepublico/buses', params);
    // La API puede devolver lista directa o envuelta — se normaliza al validar el shape real.
    if (Array.isArray(datos)) return datos as BusCrudo[];
    if (datos && typeof datos === 'object') {
      const posible = Object.values(datos).find(Array.isArray);
      if (posible) return posible as BusCrudo[];
    }
    return [datos as BusCrudo];
  }

  /** Tiempo estimado de arribo a una parada — endpoint aún no relevado del portal. */
  async arribos(_parada: number): Promise<Arribo[]> {
    throw new PendienteDeSpec('arribos()', 'endpoint de TEA pendiente de relevar en la doc autenticada del portal');
  }

  /** Estado de playas — endpoint aún no relevado del portal. */
  async playas(): Promise<Playa[]> {
    throw new PendienteDeSpec('playas()', 'endpoint de playas pendiente de relevar en la doc autenticada del portal');
  }
}
