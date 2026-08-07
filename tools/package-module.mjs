import { createHash, createPrivateKey, sign } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = resolve(import.meta.dirname, '..');
const keyPath = process.env.DUPA_SIGNING_KEY;
if (!keyPath) throw new Error('DUPA_SIGNING_KEY must point to the edge-local P-256 signing key');
const keyId = process.env.DUPA_SIGNING_KEY_ID || 'opensphere-edge-local-v1';
const key = createPrivateKey(readFileSync(keyPath));
const hash = (value) => createHash('sha256').update(value).digest('hex');
const signature = (value) => sign('sha256', Buffer.from(value), { key, dsaEncoding: 'ieee-p1363' }).toString('base64');

const entry = readFileSync(resolve(root, 'dist/postgres/browser/main.js'));
const manifestPath = resolve(root, 'ui-shell/ui-shell.manifest.json');
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
manifest.entrySha256 = hash(entry);
const manifestText = `${JSON.stringify(manifest, null, 2)}\n`;
writeFileSync(manifestPath, manifestText);
writeFileSync(resolve(root, 'ui-shell/ui-shell.manifest.json.sig'), `${signature(manifestText)}\n`);

const descriptor = {
  schemaVersion: 1,
  id: manifest.id,
  kind: manifest.kind,
  displayName: manifest.title,
  version: manifest.version,
  owner: 'opensphere-platform',
  description: manifest.description,
  hostRef: manifest.hostRef,
  hostApiVersion: manifest.hostApiVersion,
  hostCompat: manifest.hostCompat,
  shellCompat: manifest.shellCompat,
  sdkVersion: manifest.sdkVersion,
  permissions: manifest.permissions,
  permissionProfile: 'none',
  api: manifest.apiBase ? { basePath: manifest.apiBase } : undefined,
  runtime: {
    port: 8080,
    healthPath: '/healthz',
    serviceAccountName: 'opensphere-plugin-postgres',
    resources: { cpuRequest: '10m', memoryRequest: '32Mi', cpuLimit: '150m', memoryLimit: '192Mi' }
  },
  manifest: {
    path: '/plugins/ui-shell.manifest.json',
    sha256: hash(manifestText),
    signaturePath: '/plugins/ui-shell.manifest.json.sig'
  },
  trust: { keyId },
  contributions: manifest.contributions
};

const sdkEntry = resolve(process.env.OPENSPHERE_SDK || resolve(root, '../OpenSphere-SDK'), 'dist/index.js');
const { validateModulePackage } = await import(pathToFileURL(sdkEntry));
const issues = validateModulePackage(descriptor);
if (issues.length) throw new Error(`OpenSphere SDK rejected module package: ${JSON.stringify(issues)}`);
const descriptorText = JSON.stringify(descriptor);
writeFileSync(resolve(root, 'module-package.json'), descriptorText);
writeFileSync(resolve(root, 'module-package.json.sig'), `${signature(descriptorText)}\n`);

const yamlPath = resolve(root, 'uipluginpackage.yaml');
const yaml = readFileSync(yamlPath, 'utf8')
  .replace(/(\n    sha256:\s*)[a-f0-9]{64}/, `$1${descriptor.manifest.sha256}`)
  .replace(/(\n    keyId:\s*).+/, `$1${keyId}`);
writeFileSync(yamlPath, yaml);
console.log(`packaged ${descriptor.id}@${descriptor.version} manifest=${descriptor.manifest.sha256}`);
