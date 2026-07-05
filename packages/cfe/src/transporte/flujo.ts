/**
 * Flujo completo de envío a DGI: sobre → ACKSobre → (espera) → consulta → ACKCFE.
 */
import { parseAcuseCfe, parseAcuseSobre, type AcuseCfe, type AcuseSobre } from '../acuses/acuses.js';
import type { DgiTransport } from './transporte.js';

export interface ResultadoEnvio {
  acuseSobre: AcuseSobre;
  /** Presente solo si el sobre fue aceptado y se consultó el resultado. */
  acuseCfe?: AcuseCfe;
}

export interface OpcionesEnvio {
  /**
   * Consultar automáticamente el resultado por CFE cuando el sobre es aceptado
   * (espera hasta la Fechahora indicada por DGI). Default: true.
   */
  esperarResultado?: boolean;
  /** Máximo de reintentos de consulta si DGI aún no tiene el resultado. */
  reintentos?: number;
  /** Inyectable para tests. */
  dormir?: (ms: number) => Promise<void>;
}

const dormirDefault = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Envía un sobre firmado y (opcionalmente) espera el resultado por comprobante. */
export async function enviarSobreADgi(
  transporte: DgiTransport,
  sobreXml: string,
  opciones: OpcionesEnvio = {},
): Promise<ResultadoEnvio> {
  const dormir = opciones.dormir ?? dormirDefault;
  const acuseSobre = parseAcuseSobre(await transporte.enviarSobre(sobreXml));

  if (!acuseSobre.aceptado || opciones.esperarResultado === false) {
    return { acuseSobre };
  }
  if (!acuseSobre.consulta) {
    throw new Error('ACKSobre aceptado pero sin ParamConsulta (token) — respuesta inesperada de DGI');
  }

  const espera = acuseSobre.consulta.desde.getTime() - Date.now();
  if (espera > 0) await dormir(espera);

  let intentos = (opciones.reintentos ?? 3) + 1;
  let ultimoError: unknown;
  while (intentos-- > 0) {
    try {
      const xml = await transporte.consultarEstadoEnvio(acuseSobre.idReceptor, acuseSobre.consulta.token);
      return { acuseSobre, acuseCfe: parseAcuseCfe(xml) };
    } catch (e) {
      ultimoError = e;
      if (intentos > 0) await dormir(5_000);
    }
  }
  throw new Error(`No se pudo consultar el resultado del envío: ${String(ultimoError)}`);
}
