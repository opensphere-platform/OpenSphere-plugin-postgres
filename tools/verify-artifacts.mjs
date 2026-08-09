import { createHash, createPublicKey, verify } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const trackedChanges = execFileSync('git', ['status', '--short', '--untracked-files=no'], { cwd: root, encoding: 'utf8' }).trim();
if (trackedChanges) throw new Error(`verify:artifacts requires a clean tracked source tree:\n${trackedChanges}`);
const hash = (value) => createHash('sha256').update(value).digest('hex');
const keyPath = process.env.DUPA_SIGNING_KEY;
if (!keyPath) throw new Error('DUPA_SIGNING_KEY must point to the edge-local P-256 signing key');
const publicKey = createPublicKey(readFileSync(keyPath));
const validSignature = (value, signaturePath) => verify(
  'sha256', Buffer.from(value), { key: publicKey, dsaEncoding: 'ieee-p1363' },
  Buffer.from(readFileSync(signaturePath, 'utf8').trim(), 'base64'),
);
const manifestText = readFileSync(resolve(root, 'ui-shell/ui-shell.manifest.json'), 'utf8');
const manifest = JSON.parse(manifestText);
const descriptorPath = resolve(root, 'module-package.json');
const descriptorText = readFileSync(descriptorPath, 'utf8');
const descriptor = JSON.parse(descriptorText);
const entry = readFileSync(resolve(root, 'dist/postgres/browser', manifest.entry));
const packageYaml = readFileSync(resolve(root, 'uipluginpackage.yaml'), 'utf8');

if (manifest.id !== 'postgres' || manifest.hostRef !== 'foundation') throw new Error('manifest identity/hostRef mismatch');
if (manifest.apiBase !== '/api/plugins/postgres') throw new Error('manifest canonical apiBase mismatch');
if (!manifest.permissions?.includes('api:proxy')) throw new Error('api:proxy permission missing');
if (manifest.contributions?.api?.enabled !== false) throw new Error('governed Foundation API contribution must remain disabled');
if (descriptor.api?.basePath !== manifest.apiBase) throw new Error('descriptor apiBase mismatch');
if (manifest.entrySha256 !== hash(entry)) throw new Error('entry hash mismatch');
if (descriptor.manifest.sha256 !== hash(manifestText)) throw new Error('manifest hash mismatch');
const yamlManifestHash = packageYaml.match(/\n    sha256:\s*["']?([a-f0-9]{64})["']?/)?.[1];
if (yamlManifestHash !== descriptor.manifest.sha256) throw new Error('UIPluginPackage manifest hash mismatch');
if (!validSignature(descriptorText, resolve(root, 'module-package.json.sig'))) throw new Error('descriptor signature verification failed');
if (!validSignature(manifestText, resolve(root, 'ui-shell/ui-shell.manifest.json.sig'))) throw new Error('manifest signature verification failed');
if (!entry.includes('osp-foundation-postgres')) throw new Error('custom element contract missing from entry');
console.log('postgres plugin artifacts verified');
