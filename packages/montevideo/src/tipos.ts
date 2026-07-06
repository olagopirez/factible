/**
 * Tipos de dominio para las APIs de la Intendencia de Montevideo.
 *
 * Bus está fijado contra una respuesta real de /transportepublico/buses
 * (e2e del 2026-07-05). Arribo y Playa siguen provisorios — ver README §Estado.
 */

/**
 * Registro crudo tal como lo devuelve la API (campos en inglés).
 * Ejemplo real: { eType: "buses", company: "CUTCSA", busId: 104, line: "103",
 * lineVariantId: 343, location: { type: "Point", coordinates: [lon, lat] },
 * origin, destination, subline, special, speed, access, thermalConfort,
 * emissions, timestamp: "2026-07-05T21:02:15.000-03" }
 */
export type BusCrudo = Record<string, unknown>;

/** Posición de un bus del STM en tiempo real. */
export interface Bus {
  /** Identificador del coche (ej: 104). */
  busId: number;
  /** Empresa operadora (ej: "CUTCSA"). */
  empresa: string;
  /** Línea (ej: "103", "D10"). */
  linea: string;
  /** Variante de la línea (lineVariantId). */
  varianteId?: number;
  /** Sublínea (ej: "PZA. ESPAÑA - LOS AROMOS"). */
  sublinea?: string;
  origen?: string;
  destino?: string;
  latitud: number;
  longitud: number;
  /** Velocidad reportada en km/h. */
  velocidad?: number;
  /** Servicio especial. */
  especial?: boolean;
  /** Accesibilidad (ej: "COMÚN"). */
  acceso?: string;
  /** Confort térmico (ej: "Sin datos"). */
  confortTermico?: string;
  /** Norma de emisiones (ej: "Euro III"). */
  emisiones?: string;
  /** Momento de la última posición reportada. */
  timestamp?: Date;
  /** Registro original de la API, por si aparecen campos nuevos. */
  crudo: BusCrudo;
}

/** Parada del STM. */
export interface Parada {
  id: number;
  calle?: string;
  esquina?: string;
  latitud?: number;
  longitud?: number;
}

/** Tiempo estimado de arribo de una línea a una parada. */
export interface Arribo {
  parada: number;
  linea: string;
  /** Minutos estimados hasta el arribo. */
  minutos: number;
  /** Bus asignado a ese arribo, si la API lo identifica. */
  busId?: string;
}

/** Estado sanitario / bañabilidad de una playa. */
export interface Playa {
  nombre: string;
  /** Apta para baños según el índice de bañabilidad. */
  apta: boolean;
  /** Detalle del estado sanitario reportado. */
  estado?: string;
  /** Última actualización del dato. */
  actualizado?: Date;
}
