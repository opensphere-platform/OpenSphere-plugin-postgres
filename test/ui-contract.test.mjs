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
  assert.equal(manifest.apiBase, '/api/plugins/postgres');
  assert.ok(manifest.permissions.includes('api:proxy'));
  assert.equal(manifest.contributions.api.enabled, false);
  assert.match(main, /osp-foundation-postgres/);
  assert.match(main, /export async function activate/);
  assert.match(main, /sourceId: 'plugin:postgres'/);
});

test('plugin-owned reads use the canonical proxy while governed writes remain on Foundation', () => {
  const packager = read('tools/package-module.mjs');
  const manifest = JSON.parse(read('ui-shell/ui-shell.manifest.json'));
  assert.equal(manifest.apiBase, '/api/plugins/postgres');
  assert.match(packager, /api: manifest\.apiBase \? \{ basePath: manifest\.apiBase \} : undefined/);
  assert.equal(manifest.contributions.api.enabled, false);
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
  // WAL은 gauge라 rate()가 아니라 deriv()로 읽는다 — 카드 제목도 "생성량"이 아닌 "변화율"이다.
  for (const marker of ['OPERATIONS · PROMETHEUS', '활성 연결', 'WAL 크기 변화율', '복제 지연', 'CPU 사용량', '메모리 사용량']) {
    assert.match(monitoring, new RegExp(marker));
  }
  assert.match(service, /deriv\(pg_wal_size_bytes/);
  assert.doesNotMatch(service, /rate\(pg_wal_size_bytes/);
  assert.match(monitoring, /grid-template-columns: repeat\(6, minmax\(0, 1fr\)\)/);
  assert.match(service, /selectTarget\(provider: 'stackgres'/);
  assert.match(read('src/app/modules/postgres/postgres-plugin.component.ts'), /ngOnInit\(\): void \{[\s\S]*this\.pg\.start\(\)/);
  assert.doesNotMatch(service, /postgresql\.cnpg\.io|cnpg\.io\/cluster|cnpg_/);
  assert.match(service, /stackgres\.io\/cluster-name/);
});

test('charts render through a single pinned Carbon vendor', () => {
  const pkg = JSON.parse(read('package.json'));
  assert.equal(pkg.dependencies['@carbon/charts'], '1.27.18');
  assert.equal(pkg.dependencies['@carbon/charts-angular'], '1.27.18');
  assert.equal(pkg.dependencies['chart.js'], undefined, 'chart.js must not return as a second chart vendor');
  for (const file of [
    'src/app/modules/postgres/ui/pg-timeseries.ts',
    'src/app/modules/postgres/tabs/pg-monitoring.tab.ts',
    'src/app/modules/postgres/tabs/pg-overview.tab.ts',
  ]) assert.doesNotMatch(read(file), /chart\.js/, `${file} must not import a second chart engine`);
});

test('time-series charts expose range selection and zoom', () => {
  const monitoring = read('src/app/modules/postgres/tabs/pg-monitoring.tab.ts');
  const chart = read('src/app/modules/postgres/ui/pg-timeseries.ts');
  const service = read('src/app/modules/postgres/cnpg.service.ts');
  assert.match(monitoring, /aria-label="조회 구간 선택"/);
  assert.match(service, /selectRange\(id: PgRangeId\)/);
  assert.match(chart, /zoomBar: \{ top: \{ enabled/);
  for (const control of ['ZOOM_IN', 'ZOOM_OUT', 'RESET_ZOOM', 'SHOW_AS_DATATABLE']) {
    assert.match(chart, new RegExp(`ToolbarControlTypes\\.${control}`), `toolbar must keep ${control}`);
  }
  // 폴링마다 options를 새로 넘기면 model.setOptions()가 사용자의 줌 도메인을 되돌린다.
  assert.match(chart, /구조 입력이 바뀔 때만 options를 갈아끼운다/);
});

test('Carbon overflow menu stays open after a mouse click inside the plugin shadow root', () => {
  const chart = read('src/app/modules/postgres/ui/pg-timeseries.ts');
  assert.match(chart, /@HostListener\('click', \['\$event'\]\)/);
  assert.match(chart, /closest\('\.cds--overflow-menu__trigger'\)/);
  assert.match(chart, /event\.stopPropagation\(\)/);
});

test('Clarity/Carbon class collision on .header stays neutralised', () => {
  const css = read('src/app/app.component.css');
  // Clarity의 `header, .header`가 Carbon 차트 레이아웃의 `.header`를 덮으면 모든 차트 위에
  // 앱 헤더 배경이 칠해지고 높이가 끌려간다. 두 벤더가 한 shadow root에 있는 한 계속 유효한 위험이다.
  assert.match(css, /@import '@clr\/ui\/clr-ui\.min\.css';/);
  assert.match(css, /@import '@carbon\/charts\/styles\.css';/);
  const guard = css.match(/\.cds--cc--chart-wrapper \.header\[class\*='cds--cc--layout'\]\s*\{[^}]*\}/);
  assert.ok(guard, 'Carbon chart header guard must stay next to the vendor imports');
  for (const declaration of ['height: auto', 'background-color: transparent']) {
    assert.ok(guard[0].includes(declaration), `header guard must keep "${declaration}"`);
  }
});

test('every range stays inside the SVG sample budget', () => {
  const service = read('src/app/modules/postgres/cnpg.service.ts');
  const catalog = service.match(/export const PG_RANGES[\s\S]*?\n\] as const;/);
  assert.ok(catalog, 'PG_RANGES catalog must stay declared in the service');
  const ranges = [...catalog[0].matchAll(/id: '([^']+)'[^}]*?windowSeconds: (\d+), stepSeconds: (\d+)/g)]
    .map(([, id, windowSeconds, stepSeconds]) => ({ id, windowSeconds: Number(windowSeconds), stepSeconds: Number(stepSeconds) }));
  assert.equal(ranges.length, 4);
  for (const range of ranges) {
    const points = range.windowSeconds / range.stepSeconds;
    assert.ok(Number.isInteger(points), `${range.id} window must divide evenly by step`);
    // Carbon Charts는 SVG 렌더러다. 표본 하나가 DOM 노드 하나이므로 구간이 넓어질수록
    // step을 굵혀 표본 수를 묶는다. 이 상한이 깨지면 7일 구간에서 화면이 죽는다.
    assert.ok(points <= 400, `${range.id} draws ${points} samples, over the 400-sample budget`);
  }
});
