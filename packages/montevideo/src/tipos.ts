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

/**
 * Playa de Montevideo (GET /beaches).
 * Shape según la doc oficial del servicio de playas del portal.
 */
export interface Playa {
  /** Ej: "dda_casillas_playas.1" */
  id: string;
  /** Ej: "Pocitos" */
  nombre: string;
  /** Ej: "Rambla República del Perú y Gabriel Pereira.Pocitos" */
  descripcion?: string;
  latitud: number;
  longitud: number;
  /** Registro original de la API. */
  crudo: Record<string, unknown>;
}

/**
 * Casilla de guardavidas con el estado de sus banderas
 * (GET /beaches/lifeguardstations).
 */
export interface Casilla {
  /** Ej: "MVD:lifeguardstation:12" */
  id: string;
  /** Ej: "Batlle y Ordoñez" */
  nombre: string;
  direccion?: string;
  /** Playa a la que pertenece (ej: "Pocitos"). */
  playa?: string;
  /** Bandera sanitaria izada (true = alerta sanitaria; ver causa). */
  banderaSanitaria?: boolean;
  /** Código de causa de la bandera sanitaria (ej: "2"). */
  causaSanitaria?: string;
  /** Descripción de la causa (ej: "Mortandad de peces"). */
  causaSanitariaDesc?: string;
  /** Vencimiento del estado sanitario reportado. */
  venceSanitaria?: Date;
  /** Bandera de seguridad: "green" | "yellow" | "red" (según la API). */
  banderaSeguridad?: string;
  /** Vencimiento del estado de la bandera de seguridad. */
  venceSeguridad?: Date;
  /** Link a Cómo Ir. */
  linkComoIr?: string;
  latitud: number;
  longitud: number;
  /** Registro original de la API. */
  crudo: Record<string, unknown>;
}
