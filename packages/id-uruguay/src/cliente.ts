/**
 * Cliente OpenID Connect server-side para ID Uruguay / Usuario gub.uy (AGESIC).
 *
 * Flujo: Authorization Code. El cliente se autoconfigura desde el documento de
 * descubrimiento estándar (/.well-known/openid-configuration) y verifica los
 * id_token contra el JWKS publicado.
 *
 * ⚠️ Construido contra la documentación pública de AGESIC; pendiente de probar
 * con credenciales reales del ambiente de testing (trámite en curso).
 */
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';
import { validarCi } from '@factible/validar';

/** Niveles de seguridad de identidad digital (ACR) definidos por ID Uruguay. */
export const NIVELES_ACR = {
  /** Autorregistrado, sin verificación. */
  NID_0: 'urn:iduruguay:nid:0',
  /** Verificado presencialmente o con métodos básicos. */
  NID_1: 'urn:iduruguay:nid:1',
  /** Verificación de identidad intermedia. */
  NID_2: 'urn:iduruguay:nid:2',
  /** Identidad digital de máximo nivel (ej: cédula con chip). */
  NID_3: 'urn:iduruguay:nid:3',
} as const;

export type NivelAcr = (typeof NIVELES_ACR)[keyof typeof NIVELES_ACR];

/** Scopes soportados por ID Uruguay. */
export type ScopeIdUruguay = 'openid' | 'personal_info' | 'profile' | 'email' | 'document' | 'auth_info';

const ISSUERS = {
  testing: 'https://auth-testing.iduruguay.gub.uy/oidc/v1',
  produccion: 'https://auth.iduruguay.gub.uy/oidc/v1',
} as const;

export interface IdUruguayConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  ambiente: 'testing' | 'produccion';
  /** Default: ['openid', 'personal_info']. */
  scopes?: ScopeIdUruguay[];
  /** Override del issuer (tests / mock). */
  issuerUrl?: string;
  timeoutMs?: number;
}

interface Descubrimiento {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  userinfo_endpoint: string;
  jwks_uri: string;
  end_session_endpoint?: string;
}

export interface Tokens {
  accessToken: string;
  idToken: string;
  /** Claims verificados del id_token. */
  claims: JWTPayload & { acr?: string };
  expiresIn?: number;
  refreshToken?: string;
}

/** Perfil devuelto por el endpoint userinfo (claims según scopes solicitados). */
export interface Usuario {
  /** Identificador único, formato "uy-ci-12345672". */
  uid: string;
  /** CI extraída del uid (sin puntos ni guión), si el uid es de tipo cédula uruguaya y válida. */
  ci?: string;
  nombreCompleto?: string;
  primerNombre?: string;
  primerApellido?: string;
  email?: string;
  /** Documento completo si se pidió scope 'document'. */
  numeroDocumento?: string;
  paisDocumento?: string;
  tipoDocumento?: string;
  /** Resto de claims crudos de userinfo. */
  claims: Record<string, unknown>;
}

export class IdUruguayClient {
  private descubrimiento?: Descubrimiento;
  private jwks?: ReturnType<typeof createRemoteJWKSet>;

  constructor(private readonly config: IdUruguayConfig) {}

  private issuer(): string {
    return this.config.issuerUrl ?? ISSUERS[this.config.ambiente];
  }

  /** Obtiene (y cachea) la configuración OIDC publicada por ID Uruguay. */
  async descubrir(): Promise<Descubrimiento> {
    if (!this.descubrimiento) {
      const res = await fetch(`${this.issuer()}/.well-known/openid-configuration`, {
        signal: AbortSignal.timeout(this.config.timeoutMs ?? 10_000),
      });
      if (!res.ok) throw new Error(`Descubrimiento OIDC falló: HTTP ${res.status}`);
      this.descubrimiento = (await res.json()) as Descubrimiento;
      this.jwks = createRemoteJWKSet(new URL(this.descubrimiento.jwks_uri));
    }
    return this.descubrimiento;
  }

  /**
   * URL para redirigir al usuario a autenticarse con su cédula.
   * Generá `state` y `nonce` aleatorios por sesión y guardalos para validar la vuelta.
   */
  async urlAutorizacion(params: { state: string; nonce: string; acr?: NivelAcr }): Promise<string> {
    const d = await this.descubrir();
    const q = new URLSearchParams({
      response_type: 'code',
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri,
      scope: (this.config.scopes ?? ['openid', 'personal_info']).join(' '),
      state: params.state,
      nonce: params.nonce,
    });
    if (params.acr) q.set('acr_values', params.acr);
    return `${d.authorization_endpoint}?${q}`;
  }

  /**
   * Intercambia el código de autorización por tokens y VERIFICA el id_token:
   * firma contra el JWKS, issuer, audience, expiración y nonce.
   */
  async intercambiarCodigo(params: { code: string; nonce: string }): Promise<Tokens> {
    const d = await this.descubrir();
    const basic = Buffer.from(`${this.config.clientId}:${this.config.clientSecret}`).toString('base64');
    const res = await fetch(d.token_endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${basic}`,
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: params.code,
        redirect_uri: this.config.redirectUri,
      }),
      signal: AbortSignal.timeout(this.config.timeoutMs ?? 10_000),
    });
    const cuerpo = (await res.json()) as Record<string, string | number>;
    if (!res.ok) {
      throw new Error(`ID Uruguay rechazó el código: ${cuerpo['error'] ?? res.status} ${cuerpo['error_description'] ?? ''}`);
    }

    const idToken = String(cuerpo['id_token']);
    const { payload } = await jwtVerify(idToken, this.jwks!, {
      issuer: d.issuer,
      audience: this.config.clientId,
    });
    if (payload['nonce'] !== params.nonce) {
      throw new Error('El nonce del id_token no coincide — posible ataque de replay, sesión rechazada');
    }

    return {
      accessToken: String(cuerpo['access_token']),
      idToken,
      claims: payload,
      ...(cuerpo['expires_in'] !== undefined && { expiresIn: Number(cuerpo['expires_in']) }),
      ...(cuerpo['refresh_token'] !== undefined && { refreshToken: String(cuerpo['refresh_token']) }),
    };
  }

  /** Perfil del usuario autenticado (claims según los scopes solicitados). */
  async usuario(accessToken: string): Promise<Usuario> {
    const d = await this.descubrir();
    const res = await fetch(d.userinfo_endpoint, {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(this.config.timeoutMs ?? 10_000),
    });
    if (!res.ok) throw new Error(`userinfo falló: HTTP ${res.status}`);
    const claims = (await res.json()) as Record<string, unknown>;

    const uid = String(claims['uid'] ?? claims['sub'] ?? '');
    const ciMatch = uid.match(/^uy-ci-(\d{7,8})$/);
    const ci = ciMatch && validarCi(ciMatch[1]!) ? ciMatch[1]! : undefined;

    return {
      uid,
      ...(ci && { ci }),
      ...(claims['name'] !== undefined && { nombreCompleto: String(claims['name']) }),
      ...(claims['given_name'] !== undefined && { primerNombre: String(claims['given_name']) }),
      ...(claims['family_name'] !== undefined && { primerApellido: String(claims['family_name']) }),
      ...(claims['email'] !== undefined && { email: String(claims['email']) }),
      ...(claims['numero_documento'] !== undefined && { numeroDocumento: String(claims['numero_documento']) }),
      ...(claims['pais_documento'] !== undefined && { paisDocumento: String(claims['pais_documento']) }),
      ...(claims['tipo_documento'] !== undefined && { tipoDocumento: String(claims['tipo_documento']) }),
      claims,
    };
  }

  /** URL de cierre de sesión en ID Uruguay (si el ambiente lo publica). */
  async urlCierreSesion(idToken: string, postLogoutRedirectUri?: string): Promise<string> {
    const d = await this.descubrir();
    if (!d.end_session_endpoint) throw new Error('El ambiente no publica end_session_endpoint');
    const q = new URLSearchParams({ id_token_hint: idToken });
    if (postLogoutRedirectUri) q.set('post_logout_redirect_uri', postLogoutRedirectUri);
    return `${d.end_session_endpoint}?${q}`;
  }
}
