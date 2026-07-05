import { describe, expect, it } from 'vitest';
import { MontevideoClient, PendienteDeSpec } from '../src/index.js';

// Tests del esqueleto: garantizan que nadie use el cliente por accidente
// antes de que esté implementado contra la spec real del portal.
describe('MontevideoClient (esqueleto)', () => {
  const cliente = new MontevideoClient({ credenciales: { apiKey: 'x' } });

  it('los métodos lanzan PendienteDeSpec con mensaje útil', async () => {
    await expect(cliente.buses()).rejects.toThrow(PendienteDeSpec);
    await expect(cliente.arribos(1234)).rejects.toThrow(/api.montevideo.gub.uy/);
    await expect(cliente.playas()).rejects.toThrow(/pendiente/);
  });
});
