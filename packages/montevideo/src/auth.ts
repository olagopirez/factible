/**
 * Autenticación contra Montevideo API: OAuth 2.0 Client Credentials.
 * Spec: Manual de conexión v1.0 (spec/Manual_de_conexion_a_Montevideo_API_v1.0.pdf).
 *
 * Token endpoint (Keycloak):
 *   https://mvdapi-auth.montevideo.gub.uy/auth/realms/pci/protocol/openid-connect/token
 *
 * El token expira; este manager lo cachea y lo renueva solo cuando hace falta.
 */

export const TOKEN_URL = 'https://mvdapi-auth.montevideo.gub.uy/auth/realms/pci/protocol/openid-connect/token';

export interface Credenciales {
  /** "ID de cliente" de tu Aplicación en el portal (Mis aplicaciones). */
  clientId: string;
  /** "Secreto del cliente" de la misma Aplicación. */
  clientSecret: string;
}

interface TokenActivo {
  accessToken: string;
  /** Epoch ms en que expira (con margen de seguridad ya restado). */
  expiraEn: number;
}

export class TokenManager {
  private token: TokenActivo | undefined;

  constructor(
    private readonly credenciales: Credenciales,
    private readonly tokenUrl: string = TOKEN_URL,
    private readonly timeoutMs: number = 10_000,
  ) {}

  /** Devuelve un access token vigente, renovándolo si expiró. */
  async obtener(): Promise<string> {
    if (this.token && Date.now() < this.token.expiraEn) {
      return this.token.accessToken;
    }

    // Keycloak acepta client_secret_basic o client_secret_post según cómo esté
    // configurado el cliente; el manual no lo especifica. Intentamos Basic y,
    // si el servidor rechaza las credenciales, reintentamos con secret en el body.
    let res = await this.pedirToken('basic');
    if (res.status === 400 || res.status === 401) {
      res = await this.pedirToken('post');
    }

    const cuerpo = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) {
      throw new Error(
        `Montevideo API rechazó las credenciales (HTTP ${res.status}): ${cuerpo['error_description'] ?? cuerpo['error'] ?? 'sin detalle'}. ` +
          'Verificá que uses el "ID de cliente" y "Secreto del cliente" de una Aplicación creada en ' +
          'https://api.montevideo.gub.uy → Mis aplicaciones (no tu usuario/contraseña del portal).',
      );
    }

    const accessToken = String(cuerpo['access_token'] ?? '');
    if (!accessToken) throw new Error('El token endpoint no devolvió access_token');
    const expiresIn = Number(cuerpo['expires_in'] ?? 300);

    // Margen de 30s para no usar tokens al borde de expirar.
    this.token = { accessToken, expiraEn: Date.now() + Math.max(expiresIn - 30, 5) * 1000 };
    return accessToken;
  }

  private pedirToken(modo: 'basic' | 'post'): Promise<Response> {
    const body = new URLSearchParams({ grant_type: 'client_credentials' });
    const headers: Record<string, string> = { 'Content-Type': 'application/x-www-form-urlencoded' };
    if (modo === 'basic') {
      headers['Authorization'] =
        `Basic ${Buffer.from(`${this.credenciales.clientId}:${this.credenciales.clientSecret}`).toString('base64')}`;
    } else {
      body.set('client_id', this.credenciales.clientId);
      body.set('client_secret', this.credenciales.clientSecret);
    }
    return fetch(this.tokenUrl, {
      method: 'POST',
      headers,
      body,
      signal: AbortSignal.timeout(this.timeoutMs),
    });
  }

  /** Descarta el token cacheado (ej: tras un 401 inesperado). */
  invalidar(): void {
    this.token = undefined;
  }
}
