/**
 * Firma XMLDSig de CFEs.
 *
 * Según el comentario del XSD oficial (CFEType.xsd): "Para la firma debe usarse
 * X509IssuerSerial (para la KeyInfo/X509Data) que deberán corresponderse con el
 * certificado incluido en el EnvioCFE".
 *
 * La firma es enveloped, referencia URI="" (todo el documento CFE) y se agrega
 * como último hijo de <CFE> — posición exigida por la secuencia de CFEDefType.
 *
 * ⚠️ TODO homologación: confirmar con DGI los algoritmos aceptados. Default:
 * RSA-SHA256 + C14N. Si el ambiente de testing exige SHA-1 (spec original 2012),
 * pasar `algoritmo: 'sha1'`.
 */
import { X509Certificate } from 'node:crypto';
import { SignedXml } from 'xml-crypto';

export interface Certificado {
  /** Clave privada PEM. */
  privateKey: string;
  /** Certificado X.509 PEM. */
  cert: string;
}

export interface OpcionesFirma {
  algoritmo?: 'sha256' | 'sha1';
}

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

const C14N = 'http://www.w3.org/TR/2001/REC-xml-c14n-20010315';
const ENVELOPED = 'http://www.w3.org/2000/09/xmldsig#enveloped-signature';

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** KeyInfo con X509IssuerSerial + X509Certificate, como exige DGI. */
function keyInfoDgi(certPem: string): string {
  const x509 = new X509Certificate(certPem);
  // Formato del ejemplo oficial de DGI: "CN=..., OU=..., O=..., C=UY" (coma + espacio)
  const issuerName = x509.issuer.split('\n').reverse().join(', ');
  const serialDecimal = BigInt(`0x${x509.serialNumber}`).toString(10);
  const certBody = certPem.replace(/-----(BEGIN|END) CERTIFICATE-----|\s/g, '');
  return (
    '<X509Data><X509IssuerSerial>' +
    `<X509IssuerName>${esc(issuerName)}</X509IssuerName>` +
    `<X509SerialNumber>${serialDecimal}</X509SerialNumber>` +
    '</X509IssuerSerial>' +
    `<X509Certificate>${certBody}</X509Certificate></X509Data>`
  );
}

/** Firma enveloped genérica sobre la raíz indicada (CFE, Reporte). */
function firmarRaiz(xml: string, raiz: string, certificado: Certificado, opciones: OpcionesFirma = {}): string {
  const algo = ALGO[opciones.algoritmo ?? 'sha256'];

  const sig = new SignedXml({
    privateKey: certificado.privateKey,
    publicCert: certificado.cert,
    canonicalizationAlgorithm: C14N,
    signatureAlgorithm: algo.signature,
    getKeyInfoContent: () => keyInfoDgi(certificado.cert),
  });

  sig.addReference({
    xpath: `/*[local-name(.)='${raiz}']`,
    digestAlgorithm: algo.digest,
    transforms: [ENVELOPED, C14N],
    // URI="" (todo el documento): evita que xml-crypto agregue un atributo Id
    // a la raíz, que los XSD de DGI no admiten.
    isEmptyUri: true,
  });

  // Sin prefijo: el ejemplo oficial de DGI usa <Signature xmlns="...xmldsig#">
  sig.computeSignature(xml, {
    location: { reference: `/*[local-name(.)='${raiz}']`, action: 'append' },
  });

  return sig.getSignedXml();
}

/** Firma el XML de un CFE (output de buildCfeXml). Devuelve el XML con Signature. */
export function firmarCfe(cfeXml: string, certificado: Certificado, opciones: OpcionesFirma = {}): string {
  return firmarRaiz(cfeXml, 'CFE', certificado, opciones);
}

/** Firma el XML de un reporte diario (output de crearReporteDiario). */
export function firmarReporte(reporteXml: string, certificado: Certificado, opciones: OpcionesFirma = {}): string {
  return firmarRaiz(reporteXml, 'Reporte', certificado, opciones);
}

/**
 * Verifica la firma de un CFE contra el certificado embebido.
 * Devuelve false tanto si la firma no coincide como si el contenido fue alterado.
 */
export function verificarFirmaCfe(xmlFirmado: string): boolean {
  const match = xmlFirmado.match(/<X509Certificate>([^<]+)<\/X509Certificate>/);
  if (!match) throw new Error('El CFE no contiene certificado embebido (X509Certificate)');
  const pem = `-----BEGIN CERTIFICATE-----\n${match[1]}\n-----END CERTIFICATE-----`;

  const sig = new SignedXml({ publicCert: pem });
  const sigMatch = xmlFirmado.match(/<(?:[\w]+:)?Signature[\s\S]*<\/(?:[\w]+:)?Signature>/);
  if (!sigMatch) throw new Error('El CFE no contiene Signature');
  sig.loadSignature(sigMatch[0]);
  try {
    return sig.checkSignature(xmlFirmado);
  } catch {
    return false;
  }
}
