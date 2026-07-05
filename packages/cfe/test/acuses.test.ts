import { describe, expect, it } from 'vitest';
import { MOTIVOS_RECHAZO_CFE, parseAcuseCfe, parseAcuseSobre } from '../src/acuses/acuses.js';

const NS = 'xmlns="http://cfe.dgi.gub.uy"';

const ackSobreOk = `<?xml version="1.0" encoding="UTF-8"?>
<ACKSobre ${NS} version="1.0">
  <Caratula>
    <RUCReceptor>219999830019</RUCReceptor>
    <RUCEmisor>211234560012</RUCEmisor>
    <IDRespuesta>555001</IDRespuesta>
    <NomArch>Sob_211234560012_1.xml</NomArch>
    <FecHRecibido>2026-07-04T16:00:00-03:00</FecHRecibido>
    <IDEmisor>1</IDEmisor>
    <IDReceptor>900123</IDReceptor>
    <CantidadCFE>2</CantidadCFE>
    <Tmst>2026-07-04T16:00:01-03:00</Tmst>
  </Caratula>
  <Detalle>
    <Estado>AS</Estado>
    <ParamConsulta>
      <Token>QUJDMTIz</Token>
      <Fechahora>2026-07-04T16:10:00-03:00</Fechahora>
    </ParamConsulta>
  </Detalle>
</ACKSobre>`;

const ackSobreRechazado = ackSobreOk
  .replace('<Estado>AS</Estado>', '<Estado>BS</Estado><MotivosRechazo><Motivo>S05</Motivo><Glosa>No coinciden cantidad CFE de carátula y contenido</Glosa></MotivosRechazo>')
  .replace(/<ParamConsulta>[\s\S]*<\/ParamConsulta>/, '');

const ackCfe = `<?xml version="1.0" encoding="UTF-8"?>
<ACKCFE ${NS} version="1.0">
  <Caratula>
    <RUCReceptor>219999830019</RUCReceptor>
    <RUCEmisor>211234560012</RUCEmisor>
    <IDRespuesta>555002</IDRespuesta>
    <NomArch>Sob_211234560012_1.xml</NomArch>
    <FecHRecibido>2026-07-04T16:00:00-03:00</FecHRecibido>
    <IDEmisor>1</IDEmisor>
    <IDReceptor>900123</IDReceptor>
    <CantenSobre>2</CantenSobre>
    <CantResponden>2</CantResponden>
    <CantCFEAceptados>1</CantCFEAceptados>
    <CantCFERechazados>1</CantCFERechazados>
    <Tmst>2026-07-04T16:10:05-03:00</Tmst>
  </Caratula>
  <ACKCFE_Det>
    <Nro_ordinal>1</Nro_ordinal>
    <TipoCFE>101</TipoCFE>
    <Serie>A</Serie>
    <NroCFE>42</NroCFE>
    <FechaCFE>2026-07-04</FechaCFE>
    <Estado>AE</Estado>
  </ACKCFE_Det>
  <ACKCFE_Det>
    <Nro_ordinal>2</Nro_ordinal>
    <TipoCFE>101</TipoCFE>
    <Serie>A</Serie>
    <NroCFE>43</NroCFE>
    <FechaCFE>2026-07-04</FechaCFE>
    <Estado>BE</Estado>
    <MotivosRechazoCF><Motivo>E05</Motivo></MotivosRechazoCF>
  </ACKCFE_Det>
</ACKCFE>`;

describe('parseAcuseSobre', () => {
  it('parsea sobre aceptado con token de consulta', () => {
    const a = parseAcuseSobre(ackSobreOk);
    expect(a.aceptado).toBe(true);
    expect(a.estado).toBe('AS');
    expect(a.cantidadCfe).toBe(2);
    expect(a.consulta?.token).toBe('QUJDMTIz');
    expect(a.consulta?.desde.toISOString()).toBe('2026-07-04T19:10:00.000Z');
    expect(a.motivosRechazo).toEqual([]);
  });

  it('parsea sobre rechazado con motivos', () => {
    const a = parseAcuseSobre(ackSobreRechazado);
    expect(a.aceptado).toBe(false);
    expect(a.consulta).toBeUndefined();
    expect(a.motivosRechazo).toEqual([
      { motivo: 'S05', glosa: 'No coinciden cantidad CFE de carátula y contenido' },
    ]);
  });

  it('rechaza XML con raíz incorrecta', () => {
    expect(() => parseAcuseSobre(ackCfe)).toThrow(/ACKSobre/);
  });
});

describe('parseAcuseCfe', () => {
  it('parsea resultado por comprobante con glosa de tabla oficial', () => {
    const a = parseAcuseCfe(ackCfe);
    expect(a.aceptados).toBe(1);
    expect(a.rechazados).toBe(1);
    expect(a.detalles).toHaveLength(2);
    expect(a.detalles[0]).toMatchObject({ numero: 42, aceptado: true, estado: 'AE' });
    expect(a.detalles[1]).toMatchObject({
      numero: 43,
      aceptado: false,
      motivosRechazo: [{ motivo: 'E05', glosa: MOTIVOS_RECHAZO_CFE['E05'] }],
    });
  });
});
