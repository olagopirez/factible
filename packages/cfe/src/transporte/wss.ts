/**
 * WS-Security para el WS de recepción de DGI.
 *
 * OBLIGATORIO: el servicio rechaza mensajes sin firma con el fault
 * "No signature in message!" (observado contra ePrueba el 2026-07-09).
 *
 * La estructura espeja el ejemplo oficial del manual "Web Services Externos —
 * Recepción" (T-5.020.00.001-004 v1.1, spec/ws-externos-recepcion.pdf) y las
 * propias respuestas firmadas de DGI:
 *   - Header > wsse:Security (mustUnderstand=1) con BinarySecurityToken X509v3
 *   - Signature: canonicalización exc-c14n, Reference al wsu:Id del Body con
 *     transform exc-c14n, KeyInfo > SecurityTokenReference > Reference al BST
 *   - el ejemplo oficial y las respuestas de DGI usan rsa-sha1; emitimos
 *     sha256 por defecto (configurable) — ⚠️ pendiente confirmar qué acepta.
 */
import { SignedXml } from 'xml-crypto';
import type { Certificado, OpcionesFirma } from '../signer/xmldsig.js';
import { escXml } from './transporte.js';

const WSSE =
  'http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd';
const WSU =
  'http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-utility-1.0.xsd';
const X509V3 =
  'http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-x509-token-profile-1.0#X509v3';
const BASE64 =
  'http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-soap-message-security-1.0#Base64Binary';
const EXC_C14N = 'http://www.w3.org/2001/10/xml-exc-c14n#';

const ALGO = {
  sha256: {
    signature: 'http://www.w3.org/2001/04/xmldsig-more#rsa-sha256',
    digest: 'http://www.w3.org/2001/04/xmlenc#sha256',
  },
  sha1: {
    signature: 'http://www.w3.org/2000/09/xmldsig#rsa-sha1',
    digest: 'http://www.w3.org/2000/09/xmldsig#sha1',
  },
} as const;

const ID_BST = 'SecurityToken-factible';
const ID_BODY = 'Body-factible';

/**
 * Construye el envelope SOAP de una operación DGI con el Body firmado
 * (WS-Security SignedParts, como exige el servicio).
 */
export function buildSoapEnvelopeWss(
  operacion: string,
  xmlData: string,
  certificado: Certificado,
  opciones: OpcionesFirma = {},
): string {
  const algo = ALGO[opciones.algoritmo ?? 'sha256'];
  const certB64 = certificado.cert.replace(/-----(BEGIN|END) CERTIFICATE-----|\s/g, '');

  const envelope =
    '<?xml version="1.0" encoding="UTF-8"?>' +
    '<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:dgi="http://dgi.gub.uy">' +
    '<soapenv:Header>' +
    `<wsse:Security xmlns:wsse="${WSSE}" soapenv:mustUnderstand="1">` +
    `<wsse:BinarySecurityToken wsu:Id="${ID_BST}" EncodingType="${BASE64}" ValueType="${X509V3}" xmlns:wsu="${WSU}">${certB64}</wsse:BinarySecurityToken>` +
    '</wsse:Security>' +
    '</soapenv:Header>' +
    `<soapenv:Body wsu:Id="${ID_BODY}" xmlns:wsu="${WSU}">` +
    `<dgi:WS_eFactura.${operacion}>` +
    `<dgi:Datain><dgi:xmlData>${escXml(xmlData)}</dgi:xmlData></dgi:Datain>` +
    `</dgi:WS_eFactura.${operacion}>` +
    '</soapenv:Body>' +
    '</soapenv:Envelope>';

  const sig = new SignedXml({
    idMode: 'wssecurity',
    privateKey: certificado.privateKey,
    publicCert: certificado.cert,
    canonicalizationAlgorithm: EXC_C14N,
    signatureAlgorithm: algo.signature,
    getKeyInfoContent: () =>
      `<wsse:SecurityTokenReference xmlns:wsse="${WSSE}"><wsse:Reference URI="#${ID_BST}" ValueType="${X509V3}"/></wsse:SecurityTokenReference>`,
  });

  sig.addReference({
    xpath: "//*[local-name(.)='Body']",
    transforms: [EXC_C14N],
    digestAlgorithm: algo.digest,
  });

  sig.computeSignature(envelope, {
    location: { reference: "//*[local-name(.)='Security']", action: 'append' },
  });

  return sig.getSignedXml();
}

/**
 * Cuerpo del xmlData de EFACCONSULTARESTADOENVIO, según el manual oficial:
 * <ConsultaCFE xmlns="http://dgi.gub.uy"><IdReceptor/><Token/></ConsultaCFE>
 */
export function xmlDataConsulta(idReceptor: number, token: string): string {
  return (
    '<ConsultaCFE xmlns="http://dgi.gub.uy">' +
    `<IdReceptor>${idReceptor}</IdReceptor>` +
    `<Token>${escXml(token)}</Token>` +
    '</ConsultaCFE>'
  );
}
