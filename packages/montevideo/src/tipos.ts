/**
 * Tipos de dominio para las APIs de la Intendencia de Montevideo.
 *
 * ⚠️ PROVISORIOS: modelados desde la información pública del catálogo
 * (https://api.montevideo.gub.uy/docs). Los shapes exactos se ajustan contra la
 * documentación autenticada del portal — ver README §Estado.
 */

/** Posición de un bus del STM en tiempo real. */
export interface Bus {
  /** Identificador del coche. */
  id: string;
  /** Línea (ej: "103", "D10"). */
  linea: string;
  /** Sublínea/variante, si la API la distingue. */
  sublinea?: string;
  destino?: string;
  latitud: number;
  longitud: number;
  /** Velocidad en km/h, si la API la reporta. */
  velocidad?: number;
  /** Momento de la última posición reportada. */
  timestamp?: Date;
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
