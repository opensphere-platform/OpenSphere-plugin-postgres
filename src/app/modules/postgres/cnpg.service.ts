import { Injectable, computed, signal } from '@angular/core';
import { apiBase, FND_NS, hostFetch } from '../../api-base';
import { PollBackoff } from '../../shared/poll-backoff';
import { Instance, Phase, State, age, phaseClass } from './cnpg.types';

export interface PgTransactionMetrics {
  /** epoch 초. Carbon time scale이 Date로 소비한다. */
  timestamps: number[];
  commit: number[];
  rollback: number[];
}

export interface PgMonitoringMetrics {
  timestamps: number[];
  commit: number[]; rollback: number[]; connections: number[]; idleInTransaction: number[];
  cacheHitPct: number[]; databaseBytes: number[]; walBytesPerSecond: number[];
  replicationLagSeconds: number[]; deadlocksPerSecond: number[]; conflictsPerSecond: number[];
  cpuCores: number[]; memoryBytes: number[]; pvcUsedBytes: number[]; pvcCapacityBytes: number[];
}

export interface PgPvcRow {
  name: string; status: string; capacity: string; storageClass: string; volume: string;
}

export type PgRangeId = '1h' | '6h' | '24h' | '7d';

export interface PgRange {
  id: PgRangeId; label: string; windowSeconds: number; stepSeconds: number; refreshSeconds: number;
}

/**
 * 조회 구간 카탈로그.
 *
 * step은 구간이 넓어질수록 굵어진다 — Carbon Charts는 SVG 렌더러라 표본 하나가 DOM
 * 노드 하나다. 아래 조합은 어떤 구간에서도 표본을 400점 아래로 묶는다
 * (60 / 360 / 288 / 336). 7일은 kube-prometheus-stack 기본 보존기간(7d)의 경계라
 * 앞쪽 구간이 비어 보일 수 있고, 그건 결측으로 표시된다.
 */
export const PG_RANGES: readonly PgRange[] = [
  { id: '1h', label: '최근 1시간', windowSeconds: 3600, stepSeconds: 60, refreshSeconds: 30 },
  { id: '6h', label: '최근 6시간', windowSeconds: 21600, stepSeconds: 60, refreshSeconds: 60 },
  { id: '24h', label: '최근 24시간', windowSeconds: 86400, stepSeconds: 300, refreshSeconds: 120 },
  { id: '7d', label: '최근 7일', windowSeconds: 604800, stepSeconds: 1800, refreshSeconds: 300 },
] as const;

const EMPTY_METRICS: PgMonitoringMetrics = {
  timestamps: [], commit: [], rollback: [], connections: [], idleInTransaction: [], cacheHitPct: [],
  databaseBytes: [], walBytesPerSecond: [], replicationLagSeconds: [], deadlocksPerSecond: [],
  conflictsPerSecond: [], cpuCores: [], memoryBytes: [], pvcUsedBytes: [], pvcCapacityBytes: [],
};

// Foundation control-plane data bundle의 정본 이름(bundle_data.go: pgClusterName).
// bootstrap 시절의 opensphere-pg를 추적하지 않는다. PFS plugin의 소유 리소스만 관리한다.
const NAME = 'pgc-foundation-data-pg';

// 단일 데이터 진입점 — 모든 fetch·15s 단일 폴러·파생 signals·6-state graceful.
// 컴포넌트는 구독만(자체 폴링 금지). Cluster CR 미열람 시 Pods에서 phase/primary/ready 도출(부분 동작).
@Injectable({ providedIn: 'root' })
export class CnpgService {
  readonly provider = signal<'stackgres'>('stackgres');
  private readonly targetNamespace = signal(FND_NS);
  private readonly targetName = signal(NAME);
  get ns(): string { return this.targetNamespace(); }
  get name(): string { return this.targetName(); }

  // raw
  readonly cluster = signal<any>(null);
  readonly pods = signal<any[]>([]);
  readonly backups = signal<any[]>([]);
  readonly scheduled = signal<any[]>([]);
  readonly databases = signal<any[]>([]);
  readonly events = signal<any[]>([]);
  readonly services = signal<any[]>([]);
  readonly pvcs = signal<any[]>([]);
  readonly postgresConfig = signal<any>(null);
  readonly profileConfig = signal<any>(null);

  // per-resource state
  readonly clusterState = signal<State>('loading');
  readonly backupState = signal<State>('loading');
  readonly dbState = signal<State>('loading');
  readonly eventState = signal<State>('loading');
  readonly metricsState = signal<State>('loading');
  readonly metricsHint = signal<string>('Prometheus 시계열을 확인하고 있습니다.');
  readonly metricsLastSync = signal<string>('');
  readonly monitoringMetrics = signal<PgMonitoringMetrics>(structuredClone(EMPTY_METRICS));
  readonly transactionMetrics = computed<PgTransactionMetrics>(() => ({
    timestamps: this.monitoringMetrics().timestamps,
    commit: this.monitoringMetrics().commit,
    rollback: this.monitoringMetrics().rollback,
  }));

  // ── 조회 구간 ──
  readonly ranges = PG_RANGES;
  readonly rangeId = signal<PgRangeId>('1h');
  readonly range = computed<PgRange>(() => PG_RANGES.find((item) => item.id === this.rangeId()) ?? PG_RANGES[0]);
  private lastMetricsFetchMs = 0;

  /** 구간 변경 — 시계열만 즉시 다시 읽는다(k8s 상태는 기존 폴링 주기 유지). */
  selectRange(id: PgRangeId): void {
    if (!PG_RANGES.some((item) => item.id === id) || id === this.rangeId()) return;
    this.rangeId.set(id);
    this.monitoringMetrics.set(structuredClone(EMPTY_METRICS));
    this.metricsState.set('loading');
    this.lastMetricsFetchMs = 0;
    void this.loadPrometheusMetrics();
  }

  readonly autoRefresh = signal(true);
  readonly lastSync = signal<string>('');
  readonly busy = signal(false);

  private timer: any = null;
  private started = false;
  private backoff = new PollBackoff();
  private targetGeneration = 0;

  start(): void {
    if (this.started) { return; }
    this.started = true;
    this.refresh();
    // 타이머는 시계열 스로틀을 존중한다. 사용자가 누른 새로고침(refresh)은 무조건 다시 읽는다.
    this.timer = setInterval(() => { if (this.autoRefresh()) { void this.reload(false); } }, 15000);
  }
  stop(): void { if (this.timer) { clearInterval(this.timer); this.timer = null; } this.started = false; }
  toggleAuto(): void { this.autoRefresh.update((v) => !v); }

  /** 설치 직후 nocrd 백오프를 지우고 Cluster 발견을 즉시 재시도한다. */
  forceRefresh(): void {
    this.backoff = new PollBackoff();
    void this.refresh();
  }

  selectTarget(provider: 'stackgres', namespace: string, name: string): void {
    if (provider === this.provider() && namespace === this.ns && name === this.name) return;
    this.targetGeneration++;
    this.provider.set(provider);
    this.targetNamespace.set(namespace);
    this.targetName.set(name);
    this.cluster.set(null); this.pods.set([]); this.backups.set([]); this.scheduled.set([]);
    this.databases.set([]); this.events.set([]); this.services.set([]); this.pvcs.set([]);
    this.postgresConfig.set(null); this.profileConfig.set(null);
    this.clusterState.set('loading'); this.backupState.set('loading'); this.dbState.set('loading');
    this.eventState.set('loading'); this.metricsState.set('loading');
    this.monitoringMetrics.set(structuredClone(EMPTY_METRICS));
    this.lastMetricsFetchMs = 0;
    this.backoff = new PollBackoff();
    void this.refresh();
  }

  /** 사용자 조작(새로고침 버튼·retry) — 시계열 스로틀을 건너뛰고 항상 다시 읽는다. */
  refresh(): Promise<void> { return this.reload(true); }

  private async reload(forceMetrics: boolean): Promise<void> {
    if (forceMetrics) this.lastMetricsFetchMs = 0;
    this.busy.set(true);
    this.backoff.nextTick();
    await Promise.allSettled([
      this.loadCluster(), this.loadPods(), this.loadBackups(),
      this.loadScheduled(), this.loadDatabases(), this.loadEvents(), this.loadServices(), this.loadPvcs(),
    ]);
    await this.loadProviderConfiguration();
    await this.loadDatabases();
    await this.loadPrometheusMetrics();
    this.busy.set(false);
    try { this.lastSync.set(new Date().toLocaleTimeString()); } catch { /* noop */ }
  }

  private k(path: string): string { return `${apiBase()}/api/k8s/${path}`; }
  private p(path: string): string { return `${apiBase()}/api/prometheus/${path}`; }

  // key로 백오프 판단 — nocrd/noperm 확정 후엔 지수 백오프로 재조회 빈도만 낮춘다(state는 그대로 유지).
  private async getList(key: string, path: string, set: (v: any[]) => void, state?: (s: State) => void): Promise<void> {
    if (!this.backoff.due(key)) { return; }
    const generation = this.targetGeneration;
    try {
      const r = await hostFetch(this.k(path));
      if (generation !== this.targetGeneration) return;
      const s: State = r.status === 403 ? 'noperm' : r.status === 404 ? 'nocrd' : !r.ok ? 'error' : 'ok';
      this.backoff.report(key, s);
      if (s === 'noperm' || s === 'nocrd' || s === 'error') { state?.(s); return; }
      const items = (await r.json()).items || [];
      set(items);
      state?.(items.length ? 'ok' : 'empty');
    } catch { this.backoff.report(key, 'error'); state?.('error'); }
  }

  async loadCluster(): Promise<void> {
    if (!this.backoff.due('cluster')) { return; }
    const generation = this.targetGeneration;
    const namespace = this.ns;
    const name = this.name;
    try {
      const r = await hostFetch(this.k(`apis/stackgres.io/v1/namespaces/${namespace}/sgclusters/${name}`));
      if (generation !== this.targetGeneration) return;
      const s: State = r.status === 403 ? 'noperm' : !r.ok ? 'nocrd' : 'ok';
      this.backoff.report('cluster', s);
      this.clusterState.set(s);
      if (s === 'ok') { this.cluster.set(await r.json()); }
    } catch { this.backoff.report('cluster', 'error'); this.clusterState.set('error'); }
  }
  async loadPods(): Promise<void> {
    if (!this.backoff.due('pods')) { return; }
    const generation = this.targetGeneration;
    const namespace = this.ns;
    const name = this.name;
    try {
      const sel = encodeURIComponent(`stackgres.io/cluster-name=${name}`);
      const r = await hostFetch(this.k(`api/v1/namespaces/${namespace}/pods?labelSelector=${sel}`));
      if (generation !== this.targetGeneration) return;
      this.backoff.report('pods', r.ok ? 'ok' : r.status === 404 ? 'nocrd' : 'error');
      this.pods.set(r.ok ? ((await r.json()).items || []) : []);
    } catch { this.backoff.report('pods', 'error'); this.pods.set([]); }
  }
  loadBackups() {
    const path = `apis/stackgres.io/v1/namespaces/${this.ns}/sgbackups`;
    return this.getList('backups', path, (v) => this.backups.set(v.filter((item) => item.spec?.sgCluster === this.name)), (s) => this.backupState.set(s));
  }
  loadScheduled() {
    this.scheduled.set([]); return Promise.resolve();
  }
  loadDatabases() {
    const binding = this.cluster()?.spec?.configurations?.binding;
    this.databases.set(binding?.database ? [{ metadata: { name: `${this.name}-binding` }, spec: { name: binding.database, owner: binding.username }, status: { applied: this.allReady() } }] : []);
    this.dbState.set(this.databases().length ? 'ok' : 'empty');
    return Promise.resolve();
  }
  loadEvents() {
    const sel = encodeURIComponent(`involvedObject.name=${this.name}`);
    return this.getList('events', `api/v1/namespaces/${this.ns}/events?fieldSelector=${sel}`, (v) => this.events.set(v), (s) => this.eventState.set(s));
  }
  loadServices() {
    const sel = encodeURIComponent(`stackgres.io/cluster-name=${this.name}`);
    return this.getList('services', `api/v1/namespaces/${this.ns}/services?labelSelector=${sel}`, (v) => this.services.set(v));
  }

  loadPvcs() {
    const sel = encodeURIComponent(`stackgres.io/cluster-name=${this.name}`);
    return this.getList('pvcs', `api/v1/namespaces/${this.ns}/persistentvolumeclaims?labelSelector=${sel}`, (v) => this.pvcs.set(v));
  }

  private async loadProviderConfiguration(): Promise<void> {
    if (!this.cluster()) return;
    const generation = this.targetGeneration;
    const namespace = this.ns;
    const postgres = this.cluster()?.spec?.configurations?.sgPostgresConfig;
    const profile = this.cluster()?.spec?.sgInstanceProfile;
    const read = async (path: string) => {
      const response = await hostFetch(this.k(path));
      return response.ok ? response.json() : null;
    };
    const [postgresConfig, profileConfig] = await Promise.all([
      postgres ? read(`apis/stackgres.io/v1/namespaces/${namespace}/sgpgconfigs/${postgres}`) : null,
      profile ? read(`apis/stackgres.io/v1/namespaces/${namespace}/sginstanceprofiles/${profile}`) : null,
    ]);
    if (generation !== this.targetGeneration) return;
    this.postgresConfig.set(postgresConfig);
    this.profileConfig.set(profileConfig);
  }

  private async loadPrometheusMetrics(): Promise<void> {
    const generation = this.targetGeneration;
    if (!this.cluster()) {
      this.metricsState.set('empty');
      this.metricsHint.set('PostgreSQL Cluster가 생성되면 선택한 구간의 운영 시계열을 표시합니다.');
      this.monitoringMetrics.set(structuredClone(EMPTY_METRICS));
      return;
    }
    if (!this.monitoringEnabled()) {
      this.metricsState.set('empty');
      this.metricsHint.set('메트릭 exporter가 비활성화되어 있습니다. Cluster plan에서 Monitoring을 활성화하세요.');
      this.monitoringMetrics.set(structuredClone(EMPTY_METRICS));
      return;
    }
    const range = this.range();
    // 시계열은 k8s 상태(15초)와 다른 주기로 읽는다. step이 굵은 구간을 15초마다 통째로
    // 다시 받아봐야 같은 점이 돌아올 뿐이고, query_range는 instant query보다 비싸다.
    const now = Date.now();
    if (this.monitoringMetrics().timestamps.length && now - this.lastMetricsFetchMs < range.refreshSeconds * 1000) return;
    this.lastMetricsFetchMs = now;
    // step 정렬 — 폴링마다 창이 미끄러지면 Prometheus가 질의 결과를 재사용하지 못하고
    // x축 눈금도 매번 흔들린다. step 배수로 끊어 같은 창을 반복 조회한다.
    const end = Math.floor(Date.now() / 1000 / range.stepSeconds) * range.stepSeconds;
    const start = end - range.windowSeconds;
    // rate/deriv 구간은 step의 4배로 잡아 넓은 구간에서도 표본이 비지 않게 한다.
    const window = `${Math.max(300, range.stepSeconds * 4)}s`;
    const pod = `${this.name}-.*`;
    const namespace = this.ns;
    const pvc = `${this.name}-data-.*`;
    const expressions: Record<Exclude<keyof PgMonitoringMetrics, 'timestamps'>, string> = {
      commit: `sum(rate(pg_stat_database_xact_commit{pod=~"${pod}"}[${window}]))`,
      rollback: `sum(rate(pg_stat_database_xact_rollback{pod=~"${pod}"}[${window}]))`,
      connections: `sum(pg_stat_activity_count{pod=~"${pod}"})`,
      idleInTransaction: `sum(pg_stat_activity_count{pod=~"${pod}",state="idle in transaction"})`,
      cacheHitPct: `100 * sum(rate(pg_stat_database_blks_hit{pod=~"${pod}"}[${window}])) / clamp_min(sum(rate(pg_stat_database_blks_hit{pod=~"${pod}"}[${window}])) + sum(rate(pg_stat_database_blks_read{pod=~"${pod}"}[${window}])), 1)`,
      databaseBytes: `sum(pg_database_size_bytes{pod=~"${pod}"})`,
      // pg_wal_size_bytes는 gauge다. WAL이 재활용되며 줄어들 때 rate()는 그 감소를
      // counter reset으로 오인해 값을 부풀린다. gauge의 기울기는 deriv()로 구한다.
      walBytesPerSecond: `sum(deriv(pg_wal_size_bytes{pod=~"${pod}"}[${window}]))`,
      replicationLagSeconds: `max(pg_replication_lag{pod=~"${pod}"})`,
      deadlocksPerSecond: `sum(rate(pg_stat_database_deadlocks{pod=~"${pod}"}[${window}]))`,
      conflictsPerSecond: `sum(rate(pg_stat_database_conflicts{pod=~"${pod}"}[${window}]))`,
      cpuCores: `sum(rate(container_cpu_usage_seconds_total{namespace="${namespace}",pod=~"${pod}"}[${window}]))`,
      memoryBytes: `sum(container_memory_working_set_bytes{namespace="${namespace}",pod=~"${pod}"})`,
      pvcUsedBytes: `sum(kubelet_volume_stats_used_bytes{namespace="${namespace}",persistentvolumeclaim=~"${pvc}"})`,
      pvcCapacityBytes: `sum(kubelet_volume_stats_capacity_bytes{namespace="${namespace}",persistentvolumeclaim=~"${pvc}"})`,
    };
    try {
      const keys = Object.keys(expressions) as (Exclude<keyof PgMonitoringMetrics, 'timestamps'>)[];
      const results = await Promise.all(keys.map((key) => this.promRange(expressions[key], start, end, range.stepSeconds)));
      if (generation !== this.targetGeneration) return;
      const values = Object.fromEntries(keys.map((key, index) => [key, results[index]])) as Record<Exclude<keyof PgMonitoringMetrics, 'timestamps'>, [number, number][]>;
      const base = results.find((series) => series.length) || [];
      if (!base.length) {
        this.metricsState.set('empty');
        this.metricsHint.set('Exporter는 활성 상태지만 PostgreSQL 시계열이 아직 수집되지 않았습니다. Prometheus target을 확인하세요.');
        this.monitoringMetrics.set(structuredClone(EMPTY_METRICS));
        return;
      }
      const aligned = (key: Exclude<keyof PgMonitoringMetrics, 'timestamps'>) => this.alignSeries(base, values[key]);
      this.monitoringMetrics.set({
        timestamps: base.map(([time]) => time),
        commit: aligned('commit'), rollback: aligned('rollback'), connections: aligned('connections'), idleInTransaction: aligned('idleInTransaction'),
        cacheHitPct: aligned('cacheHitPct'), databaseBytes: aligned('databaseBytes'), walBytesPerSecond: aligned('walBytesPerSecond'),
        replicationLagSeconds: aligned('replicationLagSeconds'), deadlocksPerSecond: aligned('deadlocksPerSecond'), conflictsPerSecond: aligned('conflictsPerSecond'),
        cpuCores: aligned('cpuCores'), memoryBytes: aligned('memoryBytes'), pvcUsedBytes: aligned('pvcUsedBytes'), pvcCapacityBytes: aligned('pvcCapacityBytes'),
      });
      this.metricsState.set('ok');
      this.metricsHint.set(`StackGres exporter · ${range.label} · ${this.stepLabel(range.stepSeconds)} 간격`);
      this.metricsLastSync.set(new Date().toLocaleTimeString());
    } catch (error) {
      if (generation !== this.targetGeneration) return;
      this.metricsState.set('error');
      this.metricsHint.set(`Prometheus 조회 실패: ${String((error as Error)?.message ?? error)}`);
      this.monitoringMetrics.set(structuredClone(EMPTY_METRICS));
    }
  }

  private stepLabel(seconds: number): string {
    if (seconds % 3600 === 0) return `${seconds / 3600}시간`;
    if (seconds % 60 === 0) return `${seconds / 60}분`;
    return `${seconds}초`;
  }

  private async promRange(expr: string, start: number, end: number, step: number): Promise<[number, number][]> {
    const query = new URLSearchParams({ query: expr, start: String(start), end: String(end), step: String(step) });
    const response = await hostFetch(this.p(`api/v1/query_range?${query.toString()}`));
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const body = await response.json();
    if (body.status !== 'success') throw new Error(body.error || 'Prometheus query failed');
    const values = body.data?.result?.[0]?.values ?? [];
    return values.map(([time, value]: [number, string]) => [Number(time), Number(value)] as [number, number]).filter(([, value]: [number, number]) => Number.isFinite(value));
  }

  private alignSeries(base: [number, number][], source: [number, number][]): number[] {
    const values = new Map(source.map(([time, value]) => [time, value]));
    return base.map(([time]) => values.get(time) ?? Number.NaN);
  }

  // ── computed (파생) ──
  readonly instances = computed<Instance[]>(() => {
    const primary = this.cluster()?.status?.currentPrimary
      || this.cluster()?.status?.podStatuses?.find((item: any) => item.primary)?.name;
    return this.pods()
      .map((p) => {
        const ready = (p.status?.conditions || []).some((c: any) => c.type === 'Ready' && c.status === 'True');
        const role = p.metadata?.labels?.['role'] || (p.metadata?.name === primary ? 'primary' : 'replica');
        const restarts = (p.status?.containerStatuses || []).reduce((a: number, c: any) => a + (c.restartCount || 0), 0);
        return {
          name: p.metadata?.name, role, ready,
          status: ready ? 'Ready' : (p.status?.phase || '?'),
          node: p.spec?.nodeName || '—', restarts, age: age(p.metadata?.creationTimestamp), ip: p.status?.podIP,
        } as Instance;
      })
      .sort((a, b) => (a.role === 'primary' ? -1 : b.role === 'primary' ? 1 : a.name.localeCompare(b.name)));
  });
  readonly allReady = computed(() => { const i = this.instances(); return i.length > 0 && i.every((x) => x.ready); });
  readonly primary = computed(() => this.cluster()?.status?.currentPrimary || this.cluster()?.status?.podStatuses?.find((item: any) => item.primary)?.name || this.instances().find((i) => i.role === 'primary')?.name || '');
  readonly readyN = computed<number>(() => this.cluster()?.status?.readyInstances ?? this.instances().filter((i) => i.ready).length);
  readonly totalN = computed<number>(() => this.cluster()?.spec?.instances ?? this.instances().length);
  readonly phase = computed<string>(() => {
    const ph = this.cluster()?.status?.phase;
    if (ph) { return ph; }
    const ins = this.instances();
    if (!ins.length) { return this.clusterState() === 'loading' ? '확인 중' : '미발견'; }
    return ins.every((i) => i.ready) ? 'Cluster in healthy state' : 'Degraded';
  });
  readonly phaseCls = computed<Phase>(() => phaseClass(this.phase(), this.allReady()));
  readonly image = computed<string>(() => `PostgreSQL ${this.cluster()?.status?.postgresVersion || this.cluster()?.spec?.postgres?.version || ''}`);
  readonly pgMajor = computed<string>(() => {
    const m = (this.image() || '').match(/postgresql[: ](\d+)/i)
      || (this.cluster()?.status?.postgresVersion ? String(this.cluster().status.postgresVersion).match(/^(\d+)/) : null)
      || (this.cluster()?.spec?.postgres?.version ? [null, String(this.cluster().spec.postgres.version)] : null)
      || (this.cluster()?.spec?.postgresql?.version ? [null, String(this.cluster().spec.postgresql.version)] : null);
    return m ? m[1]! : (this.cluster()?.spec?.imageCatalogRef?.major ? String(this.cluster().spec.imageCatalogRef.major) : '—');
  });
  readonly storage = computed<string>(() => this.cluster()?.spec?.pods?.persistentVolume?.size || this.cluster()?.spec?.storage?.size || '—');
  readonly storageClass = computed<string>(() => this.cluster()?.spec?.pods?.persistentVolume?.storageClass || this.cluster()?.spec?.storage?.storageClass || 'default');
  readonly params = computed<Record<string, string>>(() => this.postgresConfig()?.spec?.['postgresql.conf'] || this.cluster()?.spec?.postgresql?.parameters || {});
  readonly resources = computed<any>(() => {
    const profile = this.profileConfig()?.spec || {};
    return { requests: profile.requests || { cpu: profile.cpu, memory: profile.memory }, limits: { cpu: profile.cpu, memory: profile.memory } };
  });
  readonly managedRoles = computed<any[]>(() => {
    const binding = this.cluster()?.spec?.configurations?.binding;
    return binding?.username ? [{ name: binding.username, login: true, ensure: 'present', passwordSecret: binding.password }] : [];
  });
  readonly conditions = computed<any[]>(() => this.cluster()?.status?.conditions || []);
  readonly backupConfigured = computed<boolean>(() => !!this.cluster()?.spec?.configurations?.backups?.length);
  readonly monitoringEnabled = computed<boolean>(() => this.cluster()?.spec?.pods?.disableMetricsExporter !== true);
  readonly writeService = computed(() => `${this.name}.${this.ns}.svc:5432`);
  readonly readService = computed(() => `${this.name}-replicas.${this.ns}.svc:5432`);
  readonly credentialSecret = computed(() => this.cluster()?.status?.binding?.name || this.cluster()?.spec?.configurations?.binding?.password?.name || `${this.name}-app`);
  readonly pvcRows = computed<PgPvcRow[]>(() => this.pvcs().map((pvc) => ({
    name: String(pvc.metadata?.name || ''), status: String(pvc.status?.phase || '—'),
    capacity: String(pvc.status?.capacity?.storage || pvc.spec?.resources?.requests?.storage || '—'),
    storageClass: String(pvc.spec?.storageClassName || 'default'), volume: String(pvc.spec?.volumeName || '—'),
  })).sort((a, b) => a.name.localeCompare(b.name)));
  readonly metricsLatest = computed(() => {
    const metrics = this.monitoringMetrics();
    const latest = (values: number[]): number | null => {
      for (let index = values.length - 1; index >= 0; index--) if (Number.isFinite(values[index])) return values[index];
      return null;
    };
    return {
      commit: latest(metrics.commit), rollback: latest(metrics.rollback), connections: latest(metrics.connections), idleInTransaction: latest(metrics.idleInTransaction),
      cacheHitPct: latest(metrics.cacheHitPct), databaseBytes: latest(metrics.databaseBytes), walBytesPerSecond: latest(metrics.walBytesPerSecond),
      replicationLagSeconds: latest(metrics.replicationLagSeconds), deadlocksPerSecond: latest(metrics.deadlocksPerSecond), conflictsPerSecond: latest(metrics.conflictsPerSecond),
      cpuCores: latest(metrics.cpuCores), memoryBytes: latest(metrics.memoryBytes), pvcUsedBytes: latest(metrics.pvcUsedBytes), pvcCapacityBytes: latest(metrics.pvcCapacityBytes),
    };
  });
  readonly instanceProfile = computed<string>(() => {
    const r = this.resources();
    const cpu = r?.requests?.cpu || r?.limits?.cpu || '—';
    const mem = r?.requests?.memory || r?.limits?.memory || '—';
    return `${cpu} / ${mem}`;
  });
}
