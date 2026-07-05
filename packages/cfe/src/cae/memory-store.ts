/**
 * CaeStore en memoria: para tests, desarrollo y procesos single-instance.
 *
 * Contrato para implementaciones persistentes (SQL):
 *   - `siguienteNumero` debe ser ATÓMICO: dos emisiones concurrentes jamás
 *     pueden recibir el mismo número (en SQL: UPDATE ... RETURNING o SELECT FOR UPDATE).
 *   - Debe rechazar la emisión si el rango está agotado o el CAE vencido.
 *   - La numeración es por tipo de CFE (cada tipo tiene su propio CAE/serie/rango).
 */
import type { Cae, CaeStore } from '../types/cae.js';
import type { TipoCFE } from '../types/cfe.js';

interface Rango {
  cae: Cae;
  proximo: number;
}

export class MemoryCaeStore implements CaeStore {
  private rangos = new Map<TipoCFE, Rango[]>();
  private lock = Promise.resolve();

  async agregarRango(cae: Cae): Promise<void> {
    const lista = this.rangos.get(cae.tipoCFE) ?? [];
    lista.push({ cae, proximo: cae.numeroDesde });
    this.rangos.set(cae.tipoCFE, lista);
  }

  async siguienteNumero(tipo: TipoCFE): Promise<{ cae: Cae; numero: number }> {
    // Serializa las asignaciones para garantizar atomicidad ante concurrencia.
    const resultado = this.lock.then(() => this.asignar(tipo));
    this.lock = resultado.then(
      () => undefined,
      () => undefined,
    );
    return resultado;
  }

  private asignar(tipo: TipoCFE): { cae: Cae; numero: number } {
    const ahora = new Date();
    const lista = this.rangos.get(tipo) ?? [];
    for (const rango of lista) {
      if (rango.cae.fechaExpiracion < ahora) continue;
      if (rango.proximo > rango.cae.numeroHasta) continue;
      const numero = rango.proximo;
      rango.proximo += 1;
      return { cae: rango.cae, numero };
    }
    throw new Error(
      `Sin numeración CAE disponible para tipo ${tipo}: rango agotado, vencido o no cargado. ` +
        'Solicitar nuevo CAE en Servicios en Línea → Constancias → e-Factura.',
    );
  }

  async disponibles(tipo: TipoCFE): Promise<number> {
    const ahora = new Date();
    return (this.rangos.get(tipo) ?? [])
      .filter((r) => r.cae.fechaExpiracion >= ahora)
      .reduce((acc, r) => acc + Math.max(0, r.cae.numeroHasta - r.proximo + 1), 0);
  }
}
