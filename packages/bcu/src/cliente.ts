/**
 * Cliente de los web services públicos de cotizaciones del BCU.
 * Servicios: awsbcucotizaciones (cotizaciones), awsbcumonedas (monedas), awsultimocierre (último cierre).
 * Sin autenticación — API pública del Banco Central.
 *
 * Contrato relevado del WSDL público y verificable contra el servicio real
 * (test de integración opt-in: BCU_E2E=1 npm test).
 */

export interface Cotizacion {
  /** Fecha de la cotización (yyyy-mm-dd). */
  fecha: string;
  /** Código BCU de la moneda (ej: 2225 = USD). */
  moneda: number;
  nombre: string;
  codigoIso: string;
  emisor?: string;
  /** Tipo de cambio comprador. */
  compra: number;
  /** Tipo de cambio vendedor. */
  venta: number;
  /** Arbitraje activo. */
  arbitraje?: number;
}

export interface Moneda {
  codigo: number;
  nombre: string;
}

export interface ConsultaCotizaciones {
  /** Códigos BCU de monedas (ver constantes MONEDAS o el servicio monedas()). */
  monedas: number[];
  /** Fecha inicial (Date o yyyy-mm-dd). */
  desde: Date | string;
  /** Fecha final. Default: igual a desde. */
  hasta?: Date | string;
  /** Grupo BCU: 0 todos, 1 mercado internacional, 2 mercado local. Default 0. */
  grupo?: 0 | 1 | 2;
}

/** Códigos BCU de monedas de uso frecuente. Lista completa: cliente.monedas(). */
export const MONEDAS = {
  DOLAR_USA: 2225,
  EURO: 1111,
  PESO_ARGENTINO: 501,
  REAL_BRASILENO: 1001,
  UNIDAD_INDEXADA: 9800,
} as const;

const BASE = 'https://cotizaciones.bcu.gub.uy/wscotizaciones/servlet';

export interface BcuClientConfig {
  /** Override de la URL base (tests / proxies). */
  baseUrl?: string;
  timeoutMs?: number;
}

const fecha = (d: Date | string) => (typeof d === 'string' ? d : d.toISOString().slice(0, 10));

const texto = (bloque: string, tag: string): string | undefined => {
  const m = bloque.match(new RegExp(`<(?:\\w+:)?${tag}[^>]*>([^<]*)</(?:\\w+:)?${tag}>`, 'i'));
  return m?.[1];
};

export class BcuClient {
  constructor(private readonly config: BcuClientConfig = {}) {}

  /** Cotizaciones para monedas y rango de fechas. */
  async cotizaciones(consulta: ConsultaCotizaciones): Promise<Cotizacion[]> {
    const items = consulta.monedas.map((m) => `<cot:item>${m}</cot:item>`).join('');
    const body =
      `<cot:Entrada><cot:Moneda>${items}</cot:Moneda>` +
      `<cot:FechaDesde>${fecha(consulta.desde)}</cot:FechaDesde>` +
      `<cot:FechaHasta>${fecha(consulta.hasta ?? consulta.desde)}</cot:FechaHasta>` +
      `<cot:Grupo>${consulta.grupo ?? 0}</cot:Grupo></cot:Entrada>`;

    const xml = await this.invocar('awsbcucotizaciones', 'wsbcucotizaciones', body);
    this.chequearStatus(xml);

    const datos = xml.match(/<(?:\w+:)?datoscotizaciones\.dato>[\s\S]*?<\/(?:\w+:)?datoscotizaciones\.dato>/gi) ?? [];
    return datos.map((b) => {
      const cot: Cotizacion = {
        fecha: texto(b, 'Fecha') ?? '',
        moneda: Number(texto(b, 'Moneda')),
        nombre: (texto(b, 'Nombre') ?? '').trim(),
        codigoIso: (texto(b, 'CodigoISO') ?? '').trim(),
        compra: Number(texto(b, 'TCC')),
        venta: Number(texto(b, 'TCV')),
      };
      const emisor = texto(b, 'Emisor')?.trim();
      if (emisor) cot.emisor = emisor;
      const arb = texto(b, 'ArbAct');
      if (arb !== undefined && arb !== '') cot.arbitraje = Number(arb);
      return cot;
    });
  }

  /** Cotización puntual: la más reciente disponible para una moneda en una fecha (o el último cierre). */
  async cotizacion(moneda: number, dia?: Date | string): Promise<Cotizacion> {
    const d = dia ?? (await this.ultimoCierre());
    const r = await this.cotizaciones({ monedas: [moneda], desde: d });
    const c = r[0];
    if (!c) throw new Error(`Sin cotización para moneda ${moneda} el ${fecha(d)} (¿día no hábil? probá con ultimoCierre())`);
    return c;
  }

  /** Fecha del último cierre publicado por BCU (yyyy-mm-dd). */
  async ultimoCierre(): Promise<string> {
    const xml = await this.invocar('awsultimocierre', 'wsultimocierre', '');
    const f = texto(xml, 'Fecha');
    if (!f) throw new Error('Respuesta de último cierre sin <Fecha>');
    return f;
  }

  /** Lista de monedas disponibles en BCU. */
  async monedas(grupo: 0 | 1 | 2 = 0): Promise<Moneda[]> {
    const xml = await this.invocar('awsbcumonedas', 'wsbcumonedas', `<cot:Entrada><cot:Grupo>${grupo}</cot:Grupo></cot:Entrada>`);
    const datos = xml.match(/<(?:\w+:)?wsmonedasout\.dato>[\s\S]*?<\/(?:\w+:)?wsmonedasout\.dato>/gi) ?? [];
    return datos.map((b) => ({
      codigo: Number(texto(b, 'Codigo')),
      nombre: (texto(b, 'Nombre') ?? '').trim(),
    }));
  }

  private async invocar(servlet: string, operacion: string, inner: string): Promise<string> {
    const envelope =
      '<?xml version="1.0" encoding="UTF-8"?>' +
      '<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:cot="Cotiza">' +
      `<soapenv:Header/><soapenv:Body><cot:${operacion}.Execute>${inner}</cot:${operacion}.Execute></soapenv:Body></soapenv:Envelope>`;

    const res = await fetch(`${this.config.baseUrl ?? BASE}/${servlet}`, {
      method: 'POST',
      headers: { 'Content-Type': 'text/xml; charset=utf-8', SOAPAction: '' },
      body: envelope,
      signal: AbortSignal.timeout(this.config.timeoutMs ?? 15_000),
    });
    const cuerpo = await res.text();
    if (!res.ok) throw new Error(`BCU respondió HTTP ${res.status}: ${cuerpo.slice(0, 200)}`);
    return cuerpo;
  }

  private chequearStatus(xml: string): void {
    const status = texto(xml, 'status');
    const mensaje = texto(xml, 'mensaje');
    // status 1 = OK según el contrato del servicio
    if (status !== undefined && status !== '1' && mensaje) {
      throw new Error(`BCU: ${mensaje} (status ${status}, código ${texto(xml, 'codigoerror') ?? '?'})`);
    }
  }
}
