# @factible/bcu

Cotizaciones oficiales del **Banco Central del Uruguay**, tipadas y sin dependencias. API pública de BCU — sin credenciales ni trámites.

```ts
import { BcuClient, MONEDAS } from '@factible/bcu';

const bcu = new BcuClient();

// La cotización más reciente del dólar
const usd = await bcu.cotizacion(MONEDAS.DOLAR_USA);
usd.venta;  // 40.35
usd.compra; // 39.85

// Rango de fechas, varias monedas
const historico = await bcu.cotizaciones({
  monedas: [MONEDAS.DOLAR_USA, MONEDAS.EURO],
  desde: '2026-06-01',
  hasta: '2026-06-30',
});

await bcu.ultimoCierre(); // '2026-07-03'
await bcu.monedas();      // lista completa de monedas y códigos BCU
```

## Tests

Los tests corren contra un BCU simulado. Para verificar contra el servicio real:

```bash
BCU_E2E=1 npm test
```

Parte del ecosistema [factible](../../README.md). MIT.
