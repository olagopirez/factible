/**
 * Cliente de Montevideo API (Intendencia de Montevideo).
 * Spec de conexión: Manual v1.0 (spec/) — OAuth2 Client Credentials + REST.
 *
 * Implementado contra el manual oficial:
 *   - Capa de autenticación completa (TokenManager, renovación automática).
 *   - GET autenticado genérico con reintento ante token expirado.
 *   - buses(): GET /api/transportepublico/buses?lines=...
 *
 * buses() y playas()/casillas() están validados e2e contra las APIs reales
 * (2026-07-05). El resto de transporte (paradas, variantes, arribos/TEA) está
 * implementado contra la doc oficial del servicio (spec/Documentacion_servicios_
 * transporte_publico.pdf). Playas es un servicio aparte del portal: requiere su
 * propia Aplicación.
 */
import { TokenManager, type Credenciales } from './auth.js';
import type { Arribo, Bus, BusCrudo, Casilla, LineaEnParada, LineaVariante, Parada, Playa } from './tipos.js';

export const BASE_URL = 'https://api.montevideo.gub.uy/api';

export interface MontevideoConfig {
  credenciales: Credenciales;
  /** Overrides para tests/mocks. */
  baseUrl?: string;
  tokenUrl?: string;
  timeoutMs?: number;
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

  /**
   * Próximos buses a llegar a una parada (TEA).
   * GET /buses/busstops/{paradaId}/upcomingbuses — la doc exige indicar qué
   * líneas se quieren ver (`lines`).
   */
  async arribos(
    paradaId: number,
    filtro: {
      /** Líneas a consultar — obligatorio según la doc. */
      lineas: (string | number)[];
      /** Variantes de línea (lineVariantIds). */
      variantes?: number[];
      /** Resultados por línea (amountperline, default 1 en la API). */
      cantidadPorLinea?: number;
    },
  ): Promise<Arribo[]> {
    const params: Record<string, string> = { lines: filtro.lineas.join(',') };
    if (filtro.variantes?.length) params['lineVariantIds'] = filtro.variantes.join(',');
    if (filtro.cantidadPorLinea !== undefined) params['amountperline'] = String(filtro.cantidadPorLinea);
    const datos = await this.get<unknown>(`/transportepublico/buses/busstops/${paradaId}/upcomingbuses`, params);
    return normalizarLista(datos).map(mapearVariante);
  }

  /** Lista de paradas del STM (GET /buses/busstops). */
  async paradas(): Promise<Parada[]> {
    const datos = await this.get<unknown>('/transportepublico/buses/busstops');
    return normalizarLista(datos).map(mapearParada);
  }

  /** Líneas que pasan por una parada (GET /buses/busstops/{id}/lines). */
  async lineasPorParada(paradaId: number): Promise<LineaEnParada[]> {
    const datos = await this.get<unknown>(`/transportepublico/buses/busstops/${paradaId}/lines`);
    return normalizarLista(datos).map((crudo) => {
      const item: LineaEnParada = { linea: String(crudo['line'] ?? ''), crudo };
      const lineaId = opcional<string>(crudo['lineId'], 'string');
      if (lineaId !== undefined) item.lineaId = lineaId;
      return item;
    });
  }

  /**
   * Variantes de línea (GET /buses/linevariants). Con `varianteId` consulta
   * el detalle de una variante puntual.
   */
  async variantes(varianteId?: number): Promise<LineaVariante[]> {
    const path =
      varianteId === undefined
        ? '/transportepublico/buses/linevariants'
        : `/transportepublico/buses/linevariants/${varianteId}`;
    const datos = await this.get<unknown>(path);
    return normalizarLista(datos).map(mapearVariante);
  }

  /**
   * Lista de playas de Montevideo (GET /beaches).
   * ⚠️ Servicio aparte del portal: requiere una Aplicación asociada al
   * servicio "Playas" (credenciales distintas de las de transporte).
   */
  async playas(): Promise<Playa[]> {
    const datos = await this.get<unknown>(`${PLAYAS_PATH}/beaches`);
    return normalizarLista(datos).map(mapearPlaya);
  }

  /**
   * Casillas de guardavidas con el estado de la bandera de seguridad y la
   * calidad del agua (GET /beaches/lifeguardstations).
   */
  async casillas(): Promise<Casilla[]> {
    const datos = await this.get<unknown>(`${PLAYAS_PATH}/beaches/lifeguardstations`);
    return normalizarLista(datos).map(mapearCasilla);
  }
}

/** Base path del servicio de playas según el portal: /api/environment (v1.0.0). */
export const PLAYAS_PATH = '/environment';

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
  const { latitud, longitud } = coordenadas(crudo);

  // La respuesta real usa busId/company; la doc oficial muestra
  // vehicleIdentificationNumber/companyName — se toleran ambos.
  const bus: Bus = {
    busId: Number(crudo['busId'] ?? crudo['vehicleIdentificationNumber'] ?? NaN),
    empresa: String(crudo['company'] ?? crudo['companyName'] ?? ''),
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
 * Mapea una playa cruda (GET /beaches) al dominio.
 * Shape según la doc oficial del servicio de playas.
 */
export function mapearPlaya(crudo: Record<string, unknown>): Playa {
  const { latitud, longitud } = coordenadas(crudo);
  const playa: Playa = {
    id: String(crudo['id'] ?? ''),
    nombre: String(crudo['name'] ?? ''),
    latitud,
    longitud,
    crudo,
  };
  const descripcion = opcional<string>(crudo['description'], 'string');
  if (descripcion !== undefined) playa.descripcion = descripcion;
  return playa;
}

/**
 * Mapea una casilla cruda (GET /beaches/lifeguardstations) al dominio.
 * Nota: healthFlag llega como string ("true"/"false") según el ejemplo oficial.
 */
export function mapearCasilla(crudo: Record<string, unknown>): Casilla {
  const { latitud, longitud } = coordenadas(crudo);
  const casilla: Casilla = {
    id: String(crudo['id'] ?? ''),
    nombre: String(crudo['name'] ?? ''),
    latitud,
    longitud,
    crudo,
  };

  const direccion = opcional<string>(crudo['address'], 'string');
  if (direccion !== undefined) casilla.direccion = direccion;
  const playa = opcional<string>(crudo['beach'], 'string');
  if (playa !== undefined) casilla.playa = playa;

  const healthFlag = crudo['healthFlag'];
  if (typeof healthFlag === 'boolean') casilla.banderaSanitaria = healthFlag;
  else if (typeof healthFlag === 'string') casilla.banderaSanitaria = healthFlag === 'true';

  const causaSanitaria = opcional<string>(crudo['healthFlagCause'], 'string');
  if (causaSanitaria !== undefined) casilla.causaSanitaria = causaSanitaria;
  const causaSanitariaDesc = opcional<string>(crudo['healthFlagCauseDesc'], 'string');
  if (causaSanitariaDesc !== undefined) casilla.causaSanitariaDesc = causaSanitariaDesc;
  const venceSanitaria = parsearTimestamp(crudo['healthFlagExpiration']);
  if (venceSanitaria !== undefined) casilla.venceSanitaria = venceSanitaria;

  const banderaSeguridad = opcional<string>(crudo['safetyFlag'], 'string');
  if (banderaSeguridad !== undefined) casilla.banderaSeguridad = banderaSeguridad;
  const venceSeguridad = parsearTimestamp(crudo['safetyFlagExpiration']);
  if (venceSeguridad !== undefined) casilla.venceSeguridad = venceSeguridad;

  const linkComoIr = opcional<string>(crudo['linkComoIr'], 'string');
  if (linkComoIr !== undefined) casilla.linkComoIr = linkComoIr;

  return casilla;
}

/** Mapea una parada cruda (GET /buses/busstops) al dominio. */
export function mapearParada(crudo: Record<string, unknown>): Parada {
  const { latitud, longitud } = coordenadas(crudo);
  const parada: Parada = {
    paradaId: Number(crudo['busstopId'] ?? NaN),
    latitud,
    longitud,
    crudo,
  };
  const calle1 = opcional<string>(crudo['street1'], 'string');
  if (calle1 !== undefined) parada.calle1 = calle1;
  const calle2 = opcional<string>(crudo['street2'], 'string');
  if (calle2 !== undefined) parada.calle2 = calle2;
  const calle1Id = opcional<number>(crudo['street1Id'], 'number');
  if (calle1Id !== undefined) parada.calle1Id = calle1Id;
  const calle2Id = opcional<number>(crudo['street2Id'], 'number');
  if (calle2Id !== undefined) parada.calle2Id = calle2Id;
  return parada;
}

/**
 * Mapea una variante de línea cruda al dominio. Lo usan variantes() y
 * arribos() (la doc muestra el mismo modelo para upcomingbuses).
 */
export function mapearVariante(crudo: Record<string, unknown>): LineaVariante {
  const variante: LineaVariante = {
    varianteId: Number(crudo['lineVariantId'] ?? NaN),
    linea: String(crudo['line'] ?? ''),
    crudo,
  };
  const lineaId = opcional<string>(crudo['lineId'], 'string');
  if (lineaId !== undefined) variante.lineaId = lineaId;
  const origen = opcional<string>(crudo['origin'], 'string');
  if (origen !== undefined) variante.origen = origen;
  const destino = opcional<string>(crudo['destination'], 'string');
  if (destino !== undefined) variante.destino = destino;
  const sublinea = opcional<string>(crudo['subline'], 'string');
  if (sublinea !== undefined) variante.sublinea = sublinea;
  const especial = opcional<boolean>(crudo['special'], 'boolean');
  if (especial !== undefined) variante.especial = especial;
  return variante;
}

function opcional<T>(v: unknown, tipo: 'string' | 'number' | 'boolean'): T | undefined {
  return typeof v === tipo ? (v as T) : undefined;
}

/** Extrae [longitud, latitud] de un GeoJSON Point en `location`. */
function coordenadas(crudo: Record<string, unknown>): { latitud: number; longitud: number } {
  const loc = crudo['location'] as { coordinates?: unknown } | undefined;
  const coords = Array.isArray(loc?.coordinates) ? loc.coordinates : [];
  return { longitud: Number(coords[0] ?? NaN), latitud: Number(coords[1] ?? NaN) };
}

/**
 * La API de transporte usa offset sin minutos ("2026-07-05T21:02:15.000-03"),
 * que no es ISO 8601 estricto: se normaliza a "-03:00" antes de parsear.
 * (Playas usa "Z", que parsea directo.)
 */
function parsearTimestamp(v: unknown): Date | undefined {
  if (typeof v !== 'string' || !v) return undefined;
  const normalizado = v.replace(/([+-]\d{2})$/, '$1:00');
  const fecha = new Date(normalizado);
  return Number.isNaN(fecha.getTime()) ? undefined : fecha;
}
