import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const hash = (value) => createHash('sha256').update(value).digest('hex');
const manifestText = readFileSync(resolve(root, 'ui-shell/ui-shell.manifest.json'), 'utf8');
const manifest = JSON.parse(manifestText);
const descriptor = JSON.parse(readFileSync(resolve(root, 'module-package.json'), 'utf8'));
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
if (!readFileSync(resolve(root, 'module-package.json.sig'), 'utf8').trim()) throw new Error('descriptor signature missing');
if (!readFileSync(resolve(root, 'ui-shell/ui-shell.manifest.json.sig'), 'utf8').trim()) throw new Error('manifest signature missing');
if (!entry.includes('osp-foundation-postgres')) throw new Error('custom element contract missing from entry');
console.log('postgres plugin artifacts verified');
