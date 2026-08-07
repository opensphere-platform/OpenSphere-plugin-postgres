import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const hash = (value) => createHash('sha256').update(value).digest('hex');
const manifestText = readFileSync(resolve(root, 'ui-shell/ui-shell.manifest.json'), 'utf8');
const manifest = JSON.parse(manifestText);
const descriptor = JSON.parse(readFileSync(resolve(root, 'module-package.json'), 'utf8'));
const entry = readFileSync(resolve(root, 'dist/postgres/browser', manifest.entry));

if (manifest.id !== 'postgres' || manifest.hostRef !== 'foundation') throw new Error('manifest identity/hostRef mismatch');
if (manifest.entrySha256 !== hash(entry)) throw new Error('entry hash mismatch');
if (descriptor.manifest.sha256 !== hash(manifestText)) throw new Error('manifest hash mismatch');
if (!readFileSync(resolve(root, 'module-package.json.sig'), 'utf8').trim()) throw new Error('descriptor signature missing');
if (!readFileSync(resolve(root, 'ui-shell/ui-shell.manifest.json.sig'), 'utf8').trim()) throw new Error('manifest signature missing');
if (!entry.includes('osp-foundation-postgres')) throw new Error('custom element contract missing from entry');
console.log('postgres plugin artifacts verified');
