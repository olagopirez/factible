# @factible/id-uruguay

**Login con cédula** para tu aplicación: cliente OpenID Connect server-side para **ID Uruguay / Usuario gub.uy** (AGESIC).

```ts
import { IdUruguayClient, NIVELES_ACR } from '@factible/id-uruguay';

const idUruguay = new IdUruguayClient({
  clientId: process.env.IDU_CLIENT_ID!,
  clientSecret: process.env.IDU_CLIENT_SECRET!,
  redirectUri: 'https://miapp.uy/callback',
  ambiente: 'testing', // o 'produccion'
});

// 1. Redirigir al usuario a autenticarse
const url = await idUruguay.urlAutorizacion({ state, nonce, acr: NIVELES_ACR.NID_2 });

// 2. En el callback: canjear el código (el id_token se verifica contra el JWKS: firma, issuer, audience, nonce)
const tokens = await idUruguay.intercambiarCodigo({ code, nonce });

// 3. Perfil del usuario
const usuario = await idUruguay.usuario(tokens.accessToken);
usuario.ci;             // '12345672' — extraída del uid y validada con @factible/validar
usuario.nombreCompleto; // 'Juana de América'
```

## Desarrollá sin credenciales

Incluye `MockIdUruguay`: un servidor OIDC local que simula a AGESIC (descubrimiento, authorize, token con JWT RS256 real, userinfo, JWKS). Tu flujo de login se testea completo sin esperar el trámite:

```ts
import { MockIdUruguay } from '@factible/id-uruguay';

const mock = new MockIdUruguay();
const issuerUrl = await mock.iniciar();
const cliente = new IdUruguayClient({ ...config, issuerUrl });
const { code } = mock.autorizar(await cliente.urlAutorizacion({ state, nonce }));
```

## Estado

🟡 **Beta.** Construido contra la [documentación pública de AGESIC](https://centroderecursos.agesic.gub.uy/web/seguridad/wiki/-/wiki/Main/ID+Uruguay+-+Integraci%C3%B3n+con+OpenID+Connect) (OIDC estándar + descubrimiento automático), verificado contra el mock. Pendiente de probar con credenciales reales del ambiente de testing (trámite ante AGESIC en curso). Las credenciales se solicitan a soporte@agesic.gub.uy.

Parte del ecosistema [factible](../../README.md). MIT.
