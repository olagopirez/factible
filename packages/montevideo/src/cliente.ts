/**
 * Cliente de Montevideo API (Intendencia de Montevideo).
 * Spec de conexión: Manual v1.0 (spec/) — OAuth2 Client Credentials + REST.
 *
 * Implementado contra el manual oficial:
 *   - Capa de autenticación completa (TokenManager, renovación automática).
 *   - GET autenticado genérico con reintento ante token expirado.
 *   - buses(): GET /api/transportepublico/buses?lines=...
 *
 * buses() está validado e2e contra la API real (2026-07-05) y devuelve Bus
 * tipado. arribos() y playas() esperan relevar sus endpoints (playas es un
 * servicio aparte del portal: requiere su propia Aplicación).
 */
import { TokenManager, type Credenciales } from './auth.js';
import type { Arribo, Bus, BusCrudo, Playa } from './tipos.js';

export const BASE_URL = 'https://api.montevideo.gub.uy/api';

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
   * Posiciones en tiempo real de los buses del STM, tipadas.
   * Endpoint del manual: /transportepublico/buses?lines=522
   * Shape fijado contra una respuesta real de la API (e2e 2026-07-05).
   */
  async buses(filtro?: { lineas?: (string | number)[] }): Promise<Bus[]> {
    const params: Record<string, string> = {};
    if (filtro?.lineas?.length) params['lines'] = filtro.lineas.join(',');
    const datos = await this.get<unknown>('/transportepublico/buses', params);
    return normalizarLista(datos).map(mapearBus);
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

/** La API devuelve lista directa; se tolera también una lista envuelta en un objeto. */
function normalizarLista(datos: unknown): BusCrudo[] {
  if (Array.isArray(datos)) return datos as BusCrudo[];
  if (datos && typeof datos === 'object') {
    const posible = Object.values(datos).find(Array.isArray);
    if (posible) return posible as BusCrudo[];
  }
  return [datos as BusCrudo];
}

/**
 * Mapea el registro crudo de la API (campos en inglés, ver BusCrudo) al
 * dominio. Campos ausentes o con tipo inesperado quedan undefined en vez de
 * romper: el registro original va siempre en `crudo`.
 */
export function mapearBus(crudo: BusCrudo): Bus {
  const loc = crudo['location'] as { coordinates?: unknown } | undefined;
  const coords = Array.isArray(loc?.coordinates) ? loc.coordinates : [];
  // GeoJSON Point: [longitud, latitud]
  const longitud = Number(coords[0] ?? NaN);
  const latitud = Number(coords[1] ?? NaN);

  const opcional = <T>(v: unknown, tipo: 'string' | 'number' | 'boolean'): T | undefined =>
    typeof v === tipo ? (v as T) : undefined;

  const bus: Bus = {
    busId: Number(crudo['busId'] ?? NaN),
    empresa: String(crudo['company'] ?? ''),
    linea: String(crudo['line'] ?? ''),
    latitud,
    longitud,
    crudo,
  };

  const varianteId = opcional<number>(crudo['lineVariantId'], 'number');
  if (varianteId !== undefined) bus.varianteId = varianteId;
  const sublinea = opcional<string>(crudo['subline'], 'string');
  if (sublinea !== undefined) bus.sublinea = sublinea;
  const origen = opcional<string>(crudo['origin'], 'string');
  if (origen !== undefined) bus.origen = origen;
  const destino = opcional<string>(crudo['destination'], 'string');
  if (destino !== undefined) bus.destino = destino;
  const velocidad = opcional<number>(crudo['speed'], 'number');
  if (velocidad !== undefined) bus.velocidad = velocidad;
  const especial = opcional<boolean>(crudo['special'], 'boolean');
  if (especial !== undefined) bus.especial = especial;
  const acceso = opcional<string>(crudo['access'], 'string');
  if (acceso !== undefined) bus.acceso = acceso;
  const confortTermico = opcional<string>(crudo['thermalConfort'], 'string');
  if (confortTermico !== undefined) bus.confortTermico = confortTermico;
  const emisiones = opcional<string>(crudo['emissions'], 'string');
  if (emisiones !== undefined) bus.emisiones = emisiones;

  const timestamp = parsearTimestamp(crudo['timestamp']);
  if (timestamp !== undefined) bus.timestamp = timestamp;

  return bus;
}

/**
 * La API usa offset sin minutos ("2026-07-05T21:02:15.000-03"), que no es
 * ISO 8601 estricto: se normaliza a "-03:00" antes de parsear.
 */
function parsearTimestamp(v: unknown): Date | undefined {
  if (typeof v !== 'string' || !v) return undefined;
  const normalizado = v.replace(/([+-]\d{2})$/, '$1:00');
  const fecha = new Date(normalizado);
  return Number.isNaN(fecha.getTime()) ? undefined : fecha;
}
