/**
 * MockIdUruguay: servidor OIDC local que simula a ID Uruguay para desarrollo
 * y tests — tuyo y de quien use la lib. Implementa descubrimiento, authorize,
 * token (id_token RS256 real, verificable), userinfo y JWKS.
 */
import { createServer, type Server } from 'node:http';
import { exportJWK, generateKeyPair, SignJWT, type JWK } from 'jose';

export interface MockUsuario {
  uid: string;
  name?: string;
  given_name?: string;
  family_name?: string;
  email?: string;
  [claim: string]: unknown;
}

export interface MockIdUruguayConfig {
  /** Usuario que "se loguea". Default: Juana con CI válida. */
  usuario?: MockUsuario;
  /** ACR con el que responde. */
  acr?: string;
  /** Expiración del id_token en segundos. Default 3600; usá negativo para simular vencido. */
  expiraEnSegundos?: number;
}

const USUARIO_DEFAULT: MockUsuario = {
  uid: 'uy-ci-12345672',
  name: 'Juana de América',
  given_name: 'Juana',
  family_name: 'de América',
  email: 'juana@ejemplo.uy',
};

export class MockIdUruguay {
  private server?: Server;
  private clavePrivada?: CryptoKey;
  private jwkPublica?: JWK;
  private codigos = new Map<string, { nonce: string }>();
  private accessTokens = new Set<string>();
  private secuencia = 1;

  constructor(private readonly config: MockIdUruguayConfig = {}) {}

  /** Levanta el servidor en un puerto libre y devuelve la URL del issuer. */
  async iniciar(): Promise<string> {
    const { publicKey, privateKey } = await generateKeyPair('RS256');
    this.clavePrivada = privateKey as CryptoKey;
    this.jwkPublica = { ...(await exportJWK(publicKey)), kid: 'mock-1', alg: 'RS256', use: 'sig' };

    this.server = createServer((req, res) => void this.atender(req.url ?? '', req, res));
    await new Promise<void>((r) => this.server!.listen(0, () => r()));
    return this.issuer();
  }

  issuer(): string {
    const addr = this.server!.address() as { port: number };
    return `http://127.0.0.1:${addr.port}`;
  }

  async detener(): Promise<void> {
    await new Promise<void>((r) => this.server?.close(() => r()));
  }

  /** Simula el paso del usuario por la pantalla de login: devuelve el code que ID Uruguay redirigiría. */
  autorizar(urlAutorizacion: string): { code: string; state: string } {
    const u = new URL(urlAutorizacion);
    const nonce = u.searchParams.get('nonce') ?? '';
    const state = u.searchParams.get('state') ?? '';
    const code = `code-${this.secuencia++}`;
    this.codigos.set(code, { nonce });
    return { code, state };
  }

  private async atender(url: string, req: import('node:http').IncomingMessage, res: import('node:http').ServerResponse) {
    const json = (body: unknown, status = 200) => {
      res.statusCode = status;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(body));
    };

    if (url.startsWith('/.well-known/openid-configuration')) {
      return json({
        issuer: this.issuer(),
        authorization_endpoint: `${this.issuer()}/authorize`,
        token_endpoint: `${this.issuer()}/token`,
        userinfo_endpoint: `${this.issuer()}/userinfo`,
        jwks_uri: `${this.issuer()}/jwks`,
        end_session_endpoint: `${this.issuer()}/logout`,
      });
    }

    if (url.startsWith('/jwks')) {
      return json({ keys: [this.jwkPublica] });
    }

    if (url.startsWith('/token')) {
      let body = '';
      req.on('data', (c) => (body += c));
      req.on('end', async () => {
        const params = new URLSearchParams(body);
        const code = params.get('code') ?? '';
        const emitido = this.codigos.get(code);
        if (!emitido) return json({ error: 'invalid_grant', error_description: 'código desconocido o usado' }, 400);
        this.codigos.delete(code); // un código se usa una sola vez

        // client_id desde el Basic auth (como hace ID Uruguay)
        const basic = (req.headers.authorization ?? '').replace('Basic ', '');
        const clientId = Buffer.from(basic, 'base64').toString().split(':')[0] ?? '';

        const expira = this.config.expiraEnSegundos ?? 3600;
        const idToken = await new SignJWT({
          nonce: emitido.nonce,
          acr: this.config.acr ?? 'urn:iduruguay:nid:1',
        })
          .setProtectedHeader({ alg: 'RS256', kid: 'mock-1' })
          .setIssuer(this.issuer())
          .setAudience(clientId)
          .setSubject((this.config.usuario ?? USUARIO_DEFAULT).uid)
          .setIssuedAt()
          .setExpirationTime(Math.floor(Date.now() / 1000) + expira)
          .sign(this.clavePrivada!);

        const accessToken = `at-${this.secuencia++}`;
        this.accessTokens.add(accessToken);
        json({ access_token: accessToken, id_token: idToken, token_type: 'Bearer', expires_in: expira });
      });
      return;
    }

    if (url.startsWith('/userinfo')) {
      const auth = req.headers.authorization ?? '';
      const token = auth.replace('Bearer ', '');
      if (!this.accessTokens.has(token)) return json({ error: 'invalid_token' }, 401);
      const u = this.config.usuario ?? USUARIO_DEFAULT;
      return json({ sub: u.uid, ...u });
    }

    json({ error: 'not_found' }, 404);
  }
}
