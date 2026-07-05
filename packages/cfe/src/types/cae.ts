/**
 * CAE — Constancia de Autorización de Emisión (Formato CAE v05).
 * DGI otorga rangos de numeración por tipo de CFE; cada emisión consume un número.
 */
import type { TipoCFE } from './cfe.js';

export interface Cae {
  id: string; // nro. de autorización
  tipoCFE: TipoCFE;
  serie: string;
  numeroDesde: number;
  numeroHasta: number;
  fechaExpiracion: Date;
}

/**
 * Abstracción de almacenamiento/consumo de numeración.
 * Implementaciones: memoria (tests), SQL (producción del usuario).
 * Debe ser atómica: dos emisiones concurrentes no pueden consumir el mismo número.
 */
export interface CaeStore {
  siguienteNumero(tipo: TipoCFE): Promise<{ cae: Cae; numero: number }>;
  agregarRango(cae: Cae): Promise<void>;
  disponibles(tipo: TipoCFE): Promise<number>;
}
