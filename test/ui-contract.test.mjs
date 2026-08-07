import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const read = (file) => readFileSync(resolve(root, file), 'utf8');

test('PostgreSQL plugin owns the external Foundation-hosted custom element', () => {
  const main = read('src/main.ts');
  const manifest = JSON.parse(read('ui-shell/ui-shell.manifest.json'));
  assert.equal(manifest.id, 'postgres');
  assert.equal(manifest.hostRef, 'foundation');
  assert.match(main, /osp-foundation-postgres/);
  assert.match(main, /export async function activate/);
  assert.match(main, /sourceId: 'plugin:postgres'/);
});

test('PostgreSQL keeps the complete operations menu in canonical order', () => {
  const component = read('src/app/modules/postgres/postgres-plugin.component.ts');
  const expected = [
    ['overview', 'Overview'], ['monitoring', 'Monitoring'], ['operator', 'Operator'],
    ['cluster', 'Cluster plan'], ['topology', 'Topology'], ['config', 'Configuration'],
    ['databases', 'Databases & Roles'], ['admin', 'pgAdmin'], ['backups', 'Backups'],
    ['events', 'Events'], ['claims', 'Claims'], ['upgrade', 'Upgrade'], ['documentation', 'Documentation'],
  ];
  let cursor = -1;
  for (const [id, label] of expected) {
    const next = component.indexOf(`{ id: '${id}', label: '${label}'`, cursor + 1);
    assert.ok(next > cursor, `${label} should remain in menu order`);
    cursor = next;
  }
  assert.doesNotMatch(component, /CloudNativePG|cluster\.displayName \}\} · \{\{ cluster\.provider/);
});

test('namespace-first fleet and pgAdmin layout contracts are preserved', () => {
  const component = read('src/app/modules/postgres/postgres-plugin.component.ts');
  const admin = read('src/app/modules/postgres/admin/pg-admin.tab.ts');
  const service = read('src/app/modules/postgres/admin/pg-admin.service.ts');
  assert.match(component, /aria-label="Namespace 선택"/);
  assert.match(component, /aria-label="PostgreSQL 인스턴스 선택"/);
  assert.match(component, /이 Namespace에는 PostgreSQL이 없습니다/);
  assert.match(component, /PFSS PostgreSQL Fleet/);
  for (const marker of ['Object Explorer', 'Data View', 'Query Tool', 'Query History']) assert.match(admin, new RegExp(marker));
  assert.match(admin, /\.pga-tree\{min-height:0;overflow:auto/);
  assert.match(admin, /<div class="pga-menu"><strong>pgAdmin<\/strong><\/div>/);
  assert.doesNotMatch(admin, /<span>File<\/span>|<span>Object<\/span>|<span>Tools<\/span>|<span>Help<\/span>/);
  assert.match(service, /dataResult = signal<PgQueryResult \| null>/);
});

test('monitoring and StackGres-only runtime contracts are preserved', () => {
  const monitoring = read('src/app/modules/postgres/tabs/pg-monitoring.tab.ts');
  const service = read('src/app/modules/postgres/cnpg.service.ts');
  for (const marker of ['OPERATIONS · PROMETHEUS', '활성 연결', 'WAL 생성량', '복제 지연', 'CPU 사용량', '메모리 사용량']) {
    assert.match(monitoring, new RegExp(marker));
  }
  assert.match(monitoring, /grid-template-columns: repeat\(6, minmax\(0, 1fr\)\)/);
  assert.match(service, /selectTarget\(provider: 'stackgres'/);
  assert.match(read('src/app/modules/postgres/postgres-plugin.component.ts'), /ngOnInit\(\): void \{[\s\S]*this\.pg\.start\(\)/);
  assert.doesNotMatch(service, /postgresql\.cnpg\.io|cnpg\.io\/cluster|cnpg_/);
  assert.match(service, /stackgres\.io\/cluster-name/);
});
