import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { IdUruguayClient, MockIdUruguay, NIVELES_ACR } from '../src/index.js';

let mock: MockIdUruguay;
let issuerUrl: string;

beforeAll(async () => {
  mock = new MockIdUruguay();
  issuerUrl = await mock.iniciar();
});
afterAll(() => mock.detener());

function cliente(issuer = issuerUrl) {
  return new IdUruguayClient({
    clientId: 'mi-app',
    clientSecret: 'secreto',
    redirectUri: 'http://localhost:3000/callback',
    ambiente: 'testing',
    issuerUrl: issuer,
    scopes: ['openid', 'personal_info', 'email'],
  });
}

describe('IdUruguayClient', () => {
  it('arma la URL de autorización con scopes, state, nonce y ACR', async () => {
    const url = await cliente().urlAutorizacion({ state: 'st-1', nonce: 'n-1', acr: NIVELES_ACR.NID_2 });
    const u = new URL(url);
    expect(u.pathname).toBe('/authorize');
    expect(u.searchParams.get('client_id')).toBe('mi-app');
    expect(u.searchParams.get('scope')).toBe('openid personal_info email');
    expect(u.searchParams.get('state')).toBe('st-1');
    expect(u.searchParams.get('acr_values')).toBe('urn:iduruguay:nid:2');
  });

  it('flujo completo: autorización → código → tokens verificados → userinfo con CI validada', async () => {
    const c = cliente();
    const url = await c.urlAutorizacion({ state: 'st-2', nonce: 'n-2' });
    const { code, state } = mock.autorizar(url);
    expect(state).toBe('st-2');

    const tokens = await c.intercambiarCodigo({ code, nonce: 'n-2' });
    expect(tokens.accessToken).toBeTruthy();
    expect(tokens.claims.sub).toBe('uy-ci-12345672');
    expect(tokens.claims.acr).toBe('urn:iduruguay:nid:1');

    const usuario = await c.usuario(tokens.accessToken);
    expect(usuario.uid).toBe('uy-ci-12345672');
    expect(usuario.ci).toBe('12345672'); // CI extraída y validada con @factible/validar
    expect(usuario.nombreCompleto).toBe('Juana de América');
    expect(usuario.email).toBe('juana@ejemplo.uy');
  });

  it('rechaza nonce que no coincide (anti-replay)', async () => {
    const c = cliente();
    const { code } = mock.autorizar(await c.urlAutorizacion({ state: 's', nonce: 'nonce-real' }));
    await expect(c.intercambiarCodigo({ code, nonce: 'nonce-falso' })).rejects.toThrow(/nonce/);
  });

  it('rechaza un código ya usado', async () => {
    const c = cliente();
    const { code } = mock.autorizar(await c.urlAutorizacion({ state: 's', nonce: 'n' }));
    await c.intercambiarCodigo({ code, nonce: 'n' });
    await expect(c.intercambiarCodigo({ code, nonce: 'n' })).rejects.toThrow(/código/);
  });

  it('rechaza id_token vencido', async () => {
    const vencido = new MockIdUruguay({ expiraEnSegundos: -60 });
    const issuer = await vencido.iniciar();
    try {
      const c = cliente(issuer);
      const { code } = vencido.autorizar(await c.urlAutorizacion({ state: 's', nonce: 'n' }));
      await expect(c.intercambiarCodigo({ code, nonce: 'n' })).rejects.toThrow();
    } finally {
      await vencido.detener();
    }
  });

  it('uid con CI inválida no expone el campo ci', async () => {
    const raro = new MockIdUruguay({ usuario: { uid: 'uy-ci-12345678', name: 'CI con dv incorrecto' } });
    const issuer = await raro.iniciar();
    try {
      const c = cliente(issuer);
      const { code } = raro.autorizar(await c.urlAutorizacion({ state: 's', nonce: 'n' }));
      const tokens = await c.intercambiarCodigo({ code, nonce: 'n' });
      const usuario = await c.usuario(tokens.accessToken);
      expect(usuario.uid).toBe('uy-ci-12345678');
      expect(usuario.ci).toBeUndefined();
    } finally {
      await raro.detener();
    }
  });

  it('userinfo con token inválido falla', async () => {
    await expect(cliente().usuario('token-trucho')).rejects.toThrow(/401/);
  });
});
