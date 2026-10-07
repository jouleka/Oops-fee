'use strict';

const crypto = require('node:crypto');
require('reflect-metadata');
const x509 = require('@peculiar/x509');
const expoProjectInformationOID = '1.2.840.113556.1.8000.2554.43437.254.128.102.157.7894389.20439.2.1';
const ALGORITHM = { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' };
const PARSE_LIMITS = { berOptions: { maxDepth: 32, maxNodes: 2_000, maxContentLength: 64_000 } };

function assertRSA(key) {
  if (key.asymmetricKeyType !== 'rsa') throw new Error('Expo code signing requires an RSA key');
  return key;
}
function generateKeyPair() {
  return crypto.generateKeyPairSync('rsa', { modulusLength: 2048, publicExponent: 0x10001 });
}
function convertPrivateKeyPEMToPrivateKey(pem) { return assertRSA(crypto.createPrivateKey(pem)); }
function convertPublicKeyPEMToPublicKey(pem) { return assertRSA(crypto.createPublicKey(pem)); }
function convertKeyPairToPEM({ privateKey, publicKey }) {
  return {
    privateKeyPEM: assertRSA(privateKey).export({ type: 'pkcs8', format: 'pem' }).toString(),
    publicKeyPEM: assertRSA(publicKey).export({ type: 'spki', format: 'pem' }).toString(),
  };
}
function convertKeyPairPEMToKeyPair({ privateKeyPEM, publicKeyPEM }) {
  return { privateKey: convertPrivateKeyPEMToPrivateKey(privateKeyPEM), publicKey: convertPublicKeyPEMToPublicKey(publicKeyPEM) };
}
function convertCertificatePEMToCertificate(pem) {
  if (Buffer.byteLength(pem) > 100_000) throw new Error('Certificate exceeds security limit');
  const native = new crypto.X509Certificate(pem);
  const parsed = new x509.X509Certificate(native.raw, PARSE_LIMITS);
  return {
    native,
    x509: parsed,
    publicKey: native.publicKey,
    validity: { notBefore: parsed.notBefore, notAfter: parsed.notAfter },
  };
}
function convertCertificateToCertificatePEM(certificate) { return certificate.native.toString(); }
function convertCSRToCSRPEM(csr) { return csr.toString('pem'); }
function convertCSRPEMToCSR(pem) {
  if (Buffer.byteLength(pem) > 100_000) throw new Error('CSR exceeds security limit');
  const csr = new x509.Pkcs10CertificateRequest(pem, PARSE_LIMITS);
  assertRSA(crypto.createPublicKey({ key: Buffer.from(csr.publicKey.rawData), type: 'spki', format: 'der' }));
  return csr;
}
function equalPublicKeys(left, right) {
  return left.export({ type: 'spki', format: 'der' }).equals(right.export({ type: 'spki', format: 'der' }));
}
function validateSelfSignedCertificate(certificate, keyPair) {
  const now = new Date();
  const { native, x509: parsed, validity, publicKey } = certificate;
  // checkIssued also requires CA keyCertSign, which Expo's self-signed manifest
  // certificates intentionally omit. Verify the name and signature separately.
  if (native.issuer !== native.subject) throw new Error('Certificate issuer does not match subject');
  if (validity.notBefore > now || validity.notAfter < now) throw new Error('Certificate validity expired');
  const usage = parsed.getExtension(x509.KeyUsagesExtension);
  if (!usage || !(usage.usages & x509.KeyUsageFlags.digitalSignature)) {
    throw new Error('X509v3 Key Usage: Digital Signature not present');
  }
  const extended = parsed.getExtension(x509.ExtendedKeyUsageExtension);
  if (!extended || !extended.usages.includes(x509.ExtendedKeyUsage.codeSigning)) {
    throw new Error('X509v3 Extended Key Usage: Code Signing not present');
  }
  if (!native.verify(publicKey)) throw new Error('Certificate signature not valid');
  if (!equalPublicKeys(publicKey, keyPair.publicKey)) throw new Error('Certificate public key does not match key pair');
  if (!equalPublicKeys(crypto.createPublicKey(keyPair.privateKey), keyPair.publicKey)) throw new Error('keyPair key mismatch');
  assertRSA(publicKey);
  assertRSA(keyPair.privateKey);
}
function signBufferRSASHA256AndVerify(privateKey, certificate, buffer) {
  assertRSA(privateKey);
  assertRSA(certificate.publicKey);
  const signature = crypto.sign('sha256', buffer, { key: privateKey, padding: crypto.constants.RSA_PKCS1_PADDING });
  if (!crypto.verify('sha256', buffer, { key: certificate.publicKey, padding: crypto.constants.RSA_PKCS1_PADDING }, signature)) {
    throw new Error('Signature generated with private key not valid for certificate');
  }
  return signature.toString('base64');
}
async function webKeys(keyPair) {
  const { privateKey, publicKey } = keyPair;
  assertRSA(privateKey);
  assertRSA(publicKey);
  if (!equalPublicKeys(crypto.createPublicKey(privateKey), publicKey)) throw new Error('keyPair key mismatch');
  const [webPrivate, webPublic] = await Promise.all([
    crypto.webcrypto.subtle.importKey('pkcs8', privateKey.export({ type: 'pkcs8', format: 'der' }), ALGORITHM, false, ['sign']),
    crypto.webcrypto.subtle.importKey('spki', publicKey.export({ type: 'spki', format: 'der' }), ALGORITHM, true, ['verify']),
  ]);
  return { privateKey: webPrivate, publicKey: webPublic };
}
function codeSigningExtensions() {
  return [
    new x509.KeyUsagesExtension(x509.KeyUsageFlags.digitalSignature, true),
    new x509.ExtendedKeyUsageExtension([x509.ExtendedKeyUsage.codeSigning], true),
  ];
}
async function generateSelfSignedCodeSigningCertificate({ keyPair, validityNotBefore, validityNotAfter, commonName }) {
  if (!(validityNotBefore instanceof Date) || !(validityNotAfter instanceof Date)
      || !Number.isFinite(+validityNotBefore) || !Number.isFinite(+validityNotAfter) || validityNotAfter <= validityNotBefore) {
    throw new Error('validityNotAfter must be later than validityNotBefore');
  }
  const certificate = await x509.X509CertificateGenerator.createSelfSigned({
    serialNumber: crypto.randomBytes(9).toString('hex'),
    name: new x509.Name([{ CN: [{ utf8String: commonName }] }]),
    notBefore: validityNotBefore,
    notAfter: validityNotAfter,
    signingAlgorithm: ALGORITHM,
    keys: await webKeys(keyPair),
    extensions: codeSigningExtensions(),
  }, crypto.webcrypto);
  return convertCertificatePEMToCertificate(certificate.toString('pem'));
}
async function generateCSR(keyPair, commonName) {
  return x509.Pkcs10CertificateRequestGenerator.create({
    name: new x509.Name([{ CN: [{ utf8String: commonName }] }]),
    signingAlgorithm: ALGORITHM,
    keys: await webKeys(keyPair),
  }, crypto.webcrypto);
}
async function generateDevelopmentCertificateFromCSR(issuerPrivateKey, issuerCertificate, csr, appId, scopeKey) {
  assertRSA(crypto.createPublicKey({ key: Buffer.from(csr.publicKey.rawData), type: 'spki', format: 'der' }));
  if (!await csr.verify(crypto.webcrypto)) throw new Error('CSR not self-signed');
  if (!equalPublicKeys(crypto.createPublicKey(issuerPrivateKey), issuerCertificate.publicKey)) {
    throw new Error('Issuer private key does not match issuer certificate');
  }
  const notBefore = new Date(Date.now() - 86_400_000);
  const certificate = await x509.X509CertificateGenerator.create({
    serialNumber: crypto.randomBytes(9).toString('hex'),
    subject: csr.subjectName,
    issuer: issuerCertificate.x509.subjectName,
    notBefore,
    notAfter: new Date(notBefore.getTime() + 30 * 86_400_000),
    signingAlgorithm: ALGORITHM,
    publicKey: csr.publicKey,
    signingKey: (await webKeys({ privateKey: issuerPrivateKey, publicKey: issuerCertificate.publicKey })).privateKey,
    extensions: [
      ...codeSigningExtensions(),
      new x509.Extension(expoProjectInformationOID, false, Buffer.from(`${appId},${scopeKey}`, 'utf8')),
    ],
  }, crypto.webcrypto);
  return convertCertificatePEMToCertificate(certificate.toString('pem'));
}

module.exports = {
  expoProjectInformationOID, generateKeyPair, convertKeyPairToPEM, convertKeyPairPEMToKeyPair,
  convertPrivateKeyPEMToPrivateKey, convertPublicKeyPEMToPublicKey,
  convertCertificatePEMToCertificate, convertCertificateToCertificatePEM,
  convertCSRPEMToCSR, convertCSRToCSRPEM, validateSelfSignedCertificate,
  signBufferRSASHA256AndVerify, generateSelfSignedCodeSigningCertificate,
  generateCSR, generateDevelopmentCertificateFromCSR,
};
