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

test('PostgreSQL separates selected-runtime navigation from management workspaces', () => {
  const component = read('src/app/modules/postgres/postgres-plugin.component.ts');
  const css = read('src/app/app.component.css');
  const primary = [
    ['overview', 'Overview'], ['monitoring', 'Monitoring'], ['topology', 'Topology'],
    ['databases', 'Database'], ['backups', 'Data Protection'], ['operations', 'Operations'],
    ['events', 'Events'], ['documentation', 'Documentation'],
  ];
  let cursor = -1;
  for (const [id, label] of primary) {
    const next = component.indexOf(`{ id: '${id}', label: '${label}'`, cursor + 1);
    assert.ok(next > cursor, `${label} should remain in primary menu order`);
    cursor = next;
  }
  assert.match(component, /databases: \['databases', 'admin'\]/);
  assert.match(component, /operations: \['operations', 'cluster', 'config', 'upgrade'\]/);
  for (const marker of ['전체 클러스터', '설정 카탈로그', 'PostgreSQL 생성', '엔진 관리']) assert.match(component, new RegExp(marker));
  assert.match(component, /class="pgp-navigation-row"/);
  assert.match(component, /class="pgp-management-actions"/);
  for (const route of ['fleet', 'profiles', 'provisioning', 'operator']) assert.match(component, new RegExp(`href="/pfss/postgres/${route}"`));
  assert.match(css, /\.pgp-management-action\s*>\s*span\s*\{/);
  assert.doesNotMatch(css, /\.pgp-management-action\s+span\s*\{/);
  assert.match(css, /\.pgp-management-action:focus-visible/);
  assert.match(component, /isManagementView\(\)/);
  assert.match(component, /requested === 'claims' \? 'provisioning'/);
  assert.match(component, /routeBase="\/pfss\/postgres"/);
  const shell = read('src/app/shared/plugin-page-shell.component.ts');
  assert.match(shell, /<a \*ngFor="let tab of tabs"/);
  assert.match(shell, /\[attr\.href\]="tabHref\(tab\.id\)"/);
  assert.match(shell, /window\.dispatchEvent\(new PopStateEvent\('popstate'/);
  assert.doesNotMatch(component, /CloudNativePG|cluster\.displayName \}\} · \{\{ cluster\.provider/);
});

test('provisioning is namespace-first and uses one canonical PostgresClaim v1beta1 flow', () => {
  const component = read('src/app/modules/postgres/postgres-plugin.component.ts');
  const fleet = read('src/app/modules/postgres/postgres-fleet.service.ts');
  assert.match(component, /tab\(\) === 'provisioning'/);
  assert.match(component, /\[value\]="selectedNamespace\(\)" disabled/);
  for (const marker of ['운영 Plan', 'PostgreSQL major', '삭제 정책', '스토리지 override', 'Instance Profile', 'PostgreSQL Profile', 'Pooling Profile', '백업 Object Storage', 'YAML 미리보기']) {
    assert.match(component, new RegExp(marker));
  }
  assert.doesNotMatch(component, /<pg-claims/);
  assert.match(component, /apiVersion: provisioning\.opensphere\.io\/v1beta1/);
  assert.match(fleet, /provisioning\.opensphere\.io\/v1beta1\/namespaces/);
  assert.match(fleet, /spec\.version = draft\.version/);
  assert.match(component, /External Channels에서 등록한 백업 대상/);
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

test('Profile Catalog is namespace scoped and keeps StackGres objects authoritative', () => {
  const component = read('src/app/modules/postgres/postgres-plugin.component.ts');
  const catalog = read('src/app/modules/postgres/tabs/pg-profile-catalog.tab.ts');
  const fleet = read('src/app/modules/postgres/postgres-fleet.service.ts');
  assert.match(component, /<pg-profile-catalog \[namespace\]="selectedNamespace\(\)"/);
  assert.match(component, /tab\(\) === 'profiles'/);
  assert.doesNotMatch(component, /<h2>Profiles & Configuration<\/h2>/);
  assert.match(catalog, /Profile Catalog/);
  assert.match(catalog, /External Channels 백업 대상/);
  assert.match(catalog, /selectedCategory/);
  assert.match(catalog, /SGInstanceProfile|profile\.apiKind/);
  assert.match(catalog, /적용 미리보기/);
  assert.match(catalog, /백업 Object Storage/);
  assert.match(catalog, /Namespace credential Secret/);
  assert.match(fleet, /\/api\/foundation\/postgres\/profiles/);
  assert.match(fleet, /\/api\/foundation\/postgres\/backup-targets/);
  assert.match(fleet, /previewProfile\(draft/);
  assert.match(fleet, /deleteProfile\(namespace/);
});

test('StackGres is visible as the PostgreSQL operating provider without replacing product language', () => {
  const component = read('src/app/modules/postgres/postgres-plugin.component.ts');
  assert.match(component, /name: 'PostgreSQL', logo: LOGO/);
  assert.doesNotMatch(component, /STACKGRES_LOGO|alt="StackGres"/);
  assert.match(component, /stack: 'PFS \/ StackGres'/);
  for (const area of ['Admin UI & API', 'Authentication', 'Certificates', 'Container Registry', 'Extensions', 'Grafana', 'Image pull policy', 'Jobs', 'Service account']) {
    assert.match(component, new RegExp(area));
  }
  assert.match(component, /tab\(\) === 'operator'" class="pgp-workspace pgp-workspace--full"/);
  assert.doesNotMatch(component, /tab\(\) === 'operator' && selectedContextCluster/);
});

test('backup creation stays on the audited Foundation operation boundary', () => {
  const backups = read('src/app/modules/postgres/tabs/pg-backups.tab.ts');
  assert.match(backups, /\/api\/foundation\/postgres\/backups/);
  assert.match(backups, /변경 사유/);
  assert.match(backups, /클러스터 이름 확인/);
  assert.doesNotMatch(backups, /\/api\/k8s\/apis\/stackgres\.io\/v1\/namespaces\//);
});

test('maintenance work uses typed StackGres operations with a preview gate', () => {
  const component = read('src/app/modules/postgres/postgres-plugin.component.ts');
  const operations = read('src/app/modules/postgres/tabs/pg-operations.tab.ts');
  assert.match(component, /<pg-operations><\/pg-operations>/);
  assert.match(operations, /\/api\/foundation\/postgres\/operations/);
  assert.match(operations, /미리보기/);
  assert.match(operations, /Restart/);
  assert.match(operations, /Vacuum/);
  assert.match(operations, /Repack/);
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
  for (const control of ['ZOOM_IN', 'ZOOM_OUT', 'RESET_ZOOM']) {
    assert.match(chart, new RegExp(`ToolbarControlTypes\\.${control}`), `toolbar must keep ${control}`);
  }
  // 폴링마다 options를 새로 넘기면 model.setOptions()가 사용자의 줌 도메인을 되돌린다.
  assert.match(chart, /구조 입력이 바뀔 때만 options를 갈아끼운다/);
});

test('plugin-owned overflow provides table and CSV without Carbon Shadow DOM click coupling', () => {
  const chart = read('src/app/modules/postgres/ui/pg-timeseries.ts');
  assert.match(chart, /class="pg-chart-menu-trigger"/);
  assert.match(chart, /aria-label="More options"/);
  assert.match(chart, /readonly menuOpen = signal\(false\)/);
  assert.match(chart, /menuOpen\.update\(\(open\) => !open\)/);
  assert.doesNotMatch(chart, /<details #utilityMenu>/);
  assert.match(chart, /role="menuitem"[\s\S]*표로 보기/);
  assert.match(chart, /role="menuitem"[\s\S]*CSV 내려받기/);
  assert.match(chart, /downloadCsv\(\): void/);
  assert.doesNotMatch(chart, /ToolbarControlTypes\.SHOW_AS_DATATABLE/);
  assert.doesNotMatch(chart, /ToolbarControlTypes\.EXPORT_CSV/);
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
