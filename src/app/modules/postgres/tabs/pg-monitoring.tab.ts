import { CommonModule } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { CnpgService, PgMonitoringMetrics, PgRangeId } from '../cnpg.service';
import { Phase } from '../cnpg.types';
import { PgSeries, PgTimeseries } from '../ui/pg-timeseries';
import { PgMetric } from '../ui/pg-metric';

type SeriesKey = Exclude<keyof PgMonitoringMetrics, 'timestamps'>;

const BRAND = 'var(--os-brand-500)';
const ACCENT = 'var(--os-accent)';
const WARN = 'var(--os-warn)';
const DANGER = 'var(--os-danger)';

@Component({
  selector: 'pg-monitoring',
  standalone: true,
  imports: [CommonModule, PgTimeseries, PgMetric],
  template: `
    <section class="pg-monitoring" aria-labelledby="pg-monitoring-title">
      <header class="pg-monitoring-head">
        <div class="pg-monitoring-title"><span>OPERATIONS · PROMETHEUS</span><h2 id="pg-monitoring-title">PostgreSQL Monitoring</h2><p>{{ providerLabel() }} exporter와 Kubernetes 볼륨·컨테이너 시계열을 표시합니다.</p></div>
        <div class="pg-monitoring-controls">
          <label class="pg-monitoring-range">
            <span>기간</span>
            <select [value]="svc.rangeId()" (change)="setRange($any($event.target).value)" aria-label="조회 구간 선택">
              <option *ngFor="let item of svc.ranges" [value]="item.id">{{ item.label }}</option>
            </select>
          </label>
          <div class="pg-monitoring-sync"><strong [class.ok]="svc.metricsState() === 'ok'">{{ statusLabel() }}</strong><small>{{ svc.metricsHint() }}</small></div>
          <button class="btn btn-sm btn-outline" type="button" [disabled]="svc.busy()" (click)="svc.refresh()">{{ svc.busy() ? '갱신 중' : '새로고침' }}</button>
        </div>
      </header>

      <div class="os-metrics pg-monitoring-metrics">
        <pg-metric label="활성 연결" [value]="numberValue('connections')" sub="backends total"></pg-metric>
        <pg-metric label="Idle in transaction" [value]="numberValue('idleInTransaction')" sub="열린 채 대기 중인 트랜잭션"></pg-metric>
        <pg-metric label="Commit" [value]="rateValue('commit')" sub="transactions / second"></pg-metric>
        <pg-metric label="Rollback" [value]="rateValue('rollback')" sub="transactions / second"></pg-metric>
        <pg-metric label="Cache hit" [value]="percentValue('cacheHitPct')" [status]="cacheStatus()" sub="buffer hit ratio"></pg-metric>
        <pg-metric label="Database size" [value]="bytesValue('databaseBytes')" sub="all databases"></pg-metric>
        <pg-metric label="Replication lag" [value]="secondsValue('replicationLagSeconds')" [status]="lagStatus()" sub="maximum"></pg-metric>
        <pg-metric label="WAL 변화율" [value]="bytesRateValue('walBytesPerSecond')" sub="bytes / second"></pg-metric>
        <pg-metric label="CPU" [value]="cpuValue()" sub="postgres containers"></pg-metric>
        <pg-metric label="Memory" [value]="bytesValue('memoryBytes')" sub="working set"></pg-metric>
        <pg-metric label="PVC usage" [value]="pvcUsage()" [status]="pvcStatus()" sub="data volumes"></pg-metric>
        <pg-metric label="Deadlocks" [value]="rateValue('deadlocksPerSecond')" [status]="deadlockStatus()" sub="per second"></pg-metric>
      </div>

      <div class="pg-monitoring-grid" *ngIf="svc.metricsState() === 'ok'; else metricsUnavailable">
        <article class="card"><div class="card-header"><span>트랜잭션 처리량</span><small>commit / rollback</small></div><div class="card-block">
          <pg-timeseries *ngIf="hasAny(['commit','rollback']); else noSeries" [timestamps]="timestamps()" [series]="transactionSeries()" valueTitle="tx / s" [includeZero]="true" ariaLabel="PostgreSQL commit과 rollback 초당 처리량"></pg-timeseries>
        </div></article>
        <article class="card"><div class="card-header"><span>연결 상태</span><small>active / idle in transaction</small></div><div class="card-block">
          <pg-timeseries *ngIf="hasAny(['connections','idleInTransaction']); else noSeries" [timestamps]="timestamps()" [series]="connectionSeries()" valueTitle="backends" [includeZero]="true" ariaLabel="PostgreSQL 활성 연결과 idle in transaction 연결"></pg-timeseries>
        </div></article>
        <article class="card"><div class="card-header"><span>WAL 크기 변화율</span><small>MiB/s · deriv</small></div><div class="card-block">
          <pg-timeseries *ngIf="hasAny(['walBytesPerSecond']); else noSeries" [timestamps]="timestamps()" [series]="walSeries()" valueTitle="MiB / s" ariaLabel="PostgreSQL WAL 디렉터리 크기 변화율"></pg-timeseries>
        </div></article>
        <article class="card"><div class="card-header"><span>복제 지연</span><small>seconds</small></div><div class="card-block">
          <pg-timeseries *ngIf="hasAny(['replicationLagSeconds']); else noSeries" [timestamps]="timestamps()" [series]="replicationSeries()" valueTitle="seconds" ariaLabel="PostgreSQL 복제 지연"></pg-timeseries>
        </div></article>
        <article class="card"><div class="card-header"><span>CPU 사용량</span><small>cores</small></div><div class="card-block">
          <pg-timeseries *ngIf="hasAny(['cpuCores']); else noSeries" [timestamps]="timestamps()" [series]="cpuSeries()" valueTitle="cores" [includeZero]="true" ariaLabel="PostgreSQL CPU 코어 사용량"></pg-timeseries>
        </div></article>
        <article class="card"><div class="card-header"><span>메모리 사용량</span><small>MiB working set</small></div><div class="card-block">
          <pg-timeseries *ngIf="hasAny(['memoryBytes']); else noSeries" [timestamps]="timestamps()" [series]="memorySeries()" valueTitle="MiB" ariaLabel="PostgreSQL 메모리 사용량"></pg-timeseries>
        </div></article>
        <article class="card"><div class="card-header"><span>데이터 볼륨 사용률</span><small>PVC percent</small></div><div class="card-block">
          <pg-timeseries *ngIf="hasAny(['pvcUsedBytes','pvcCapacityBytes']); else noSeries" [timestamps]="timestamps()" [series]="pvcSeries()" valueTitle="percent" ariaLabel="PostgreSQL PVC 사용률"></pg-timeseries>
        </div></article>
        <article class="card"><div class="card-header"><span>데이터베이스 오류 징후</span><small>deadlocks / conflicts</small></div><div class="card-block">
          <pg-timeseries *ngIf="hasAny(['deadlocksPerSecond','conflictsPerSecond']); else noSeries" [timestamps]="timestamps()" [series]="errorSeries()" valueTitle="events / s" [includeZero]="true" ariaLabel="PostgreSQL deadlock과 conflict 발생률"></pg-timeseries>
        </div></article>
      </div>
      <ng-template #metricsUnavailable><div class="pg-monitoring-empty"><strong>{{ svc.metricsState() === 'error' ? 'Prometheus 조회 실패' : '시계열 수집 대기' }}</strong><p>{{ svc.metricsHint() }}</p></div></ng-template>
      <ng-template #noSeries><div class="pg-monitoring-empty pg-monitoring-empty--card"><strong>수집된 시계열 없음</strong><p>해당 메트릭은 0으로 대체하지 않습니다.</p></div></ng-template>

      <footer class="pg-monitoring-source"><b>데이터 경로</b><span>{{ providerLabel() }} exporter → Shared Observability Prometheus → Console read-only query_range</span><span>{{ svc.range().label }} · {{ stepLabel() }} 간격 · {{ pointCount() }}개 표본</span><span>차트에서 드래그하거나 툴바의 확대/축소로 구간을 좁힐 수 있습니다.</span><span *ngIf="svc.rangeId() === '7d'">7일은 Prometheus 기본 보존기간의 경계입니다 — 앞 구간이 비어 있으면 보존 설정을 확인하세요.</span></footer>
    </section>
  `,
  styles: [`
    .pg-monitoring { container-type: inline-size; margin-top: 1rem; }
    .pg-monitoring-head { display: flex; height: auto; min-height: 4.5rem; justify-content: space-between; gap: 1rem; align-items: center; padding: .75rem 1rem; color: #fff; background: #102a43; }
    .pg-monitoring-title { min-width: 0; }
    .pg-monitoring-head span { display: block; color: #78a9ff; font-size: .6rem; font-weight: 700; line-height: 1.25; letter-spacing: .08em; }
    .pg-monitoring-head h2 { margin: .12rem 0 .18rem; color: #fff; font-size: 1.05rem; font-weight: 600; line-height: 1.3; }
    .pg-monitoring-head p { margin: 0; color: #d9e2ec; font-size: .7rem; line-height: 1.35; }
    .pg-monitoring-controls { display: flex; align-items: center; gap: .75rem; flex: 0 0 auto; }
    .pg-monitoring-range { display: grid; gap: .15rem; }
    .pg-monitoring-range > span { color: #d9e2ec; font-size: .6rem; font-weight: 400; letter-spacing: 0; }
    .pg-monitoring-range select { min-width: 8rem; height: 1.9rem; padding: 0 .4rem; border: 1px solid #486581; background: #0b1f33; color: #fff; font-size: .72rem; }
    .pg-monitoring-sync { display: grid; gap: .1rem; min-width: 13rem; text-align: right; }
    .pg-monitoring-sync strong { color: #ffb3a7; font-size: .68rem; } .pg-monitoring-sync strong.ok { color: #7ee2b8; }
    .pg-monitoring-sync small { color: #d9e2ec; font-size: .6rem; }
    .pg-monitoring-metrics { margin: .85rem 0; grid-template-columns: repeat(6, minmax(0, 1fr)); align-items: stretch; }
    .pg-monitoring-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: .8rem; }
    .pg-monitoring-grid .card { min-width: 0; margin: 0; }
    .pg-monitoring-grid .card-header { display: flex; justify-content: space-between; min-height: 2.6rem; align-items: center; border-bottom: 1px solid #d7dcdf; font-size: .82rem; font-weight: 600; }
    .pg-monitoring-grid .card-header small { color: #5b6971; font-size: .6rem; font-weight: 400; }
    .pg-monitoring-grid .card-block { min-height: 19rem; padding: .75rem; }
    .pg-monitoring-empty { display: grid; min-height: 12rem; place-content: center; padding: 1rem; text-align: center; color: #5b6971; background: #f5f7f9; }
    .pg-monitoring-empty strong { color: #394b54; } .pg-monitoring-empty p { margin: .25rem 0 0; font-size: .66rem; }
    .pg-monitoring-source { display: flex; flex-wrap: wrap; gap: .3rem 1rem; margin-top: .8rem; padding: .65rem .8rem; border-left: 3px solid #0f62fe; color: #5b6971; background: #f5f9ff; font-size: .62rem; }
    .pg-monitoring-source b { color: #1b2a32; }
    @container (max-width: 75rem) { .pg-monitoring-metrics { grid-template-columns: repeat(4, minmax(0, 1fr)); } }
    @container (max-width: 60rem) { .pg-monitoring-metrics { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
    @container (max-width: 42rem) { .pg-monitoring-metrics { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
    @container (max-width: 24rem) { .pg-monitoring-metrics { grid-template-columns: 1fr; } }
    @media (max-width: 1050px) { .pg-monitoring-grid { grid-template-columns: 1fr; } }
    @media (max-width: 720px) { .pg-monitoring-head { align-items: start; flex-direction: column; } .pg-monitoring-controls { width: 100%; flex-wrap: wrap; } .pg-monitoring-sync { min-width: 0; text-align: left; } }
  `],
})
export class PgMonitoringTab {
  readonly svc = inject(CnpgService);
  readonly timestamps = computed(() => this.svc.monitoringMetrics().timestamps);
  readonly pointCount = computed(() => this.timestamps().length);

  providerLabel(): string { return 'StackGres'; }
  stepLabel(): string { const s = this.svc.range().stepSeconds; return s % 3600 === 0 ? `${s / 3600}시간` : s % 60 === 0 ? `${s / 60}분` : `${s}초`; }
  setRange(value: string): void { this.svc.selectRange(value as PgRangeId); }

  private latest(key: SeriesKey): number | null { return this.svc.metricsLatest()[key]; }
  hasAny(keys: SeriesKey[]): boolean { return keys.some((key) => this.svc.monitoringMetrics()[key].some(Number.isFinite)); }
  numberValue(key: SeriesKey): string { const value = this.latest(key); return value == null ? '—' : Math.round(value).toLocaleString(); }
  rateValue(key: SeriesKey): string { const value = this.latest(key); return value == null ? '—' : `${this.round(value)}/s`; }
  percentValue(key: SeriesKey): string { const value = this.latest(key); return value == null ? '—' : `${this.round(value)}%`; }
  secondsValue(key: SeriesKey): string { const value = this.latest(key); return value == null ? '—' : `${this.round(value)}s`; }
  bytesRateValue(key: SeriesKey): string { const value = this.latest(key); return value == null ? '—' : `${this.formatBytes(value)}/s`; }
  bytesValue(key: SeriesKey): string { const value = this.latest(key); return value == null ? '—' : this.formatBytes(value); }
  cpuValue(): string { const value = this.latest('cpuCores'); return value == null ? '—' : `${this.round(value)} cores`; }
  pvcUsage(): string { const used = this.latest('pvcUsedBytes'); const capacity = this.latest('pvcCapacityBytes'); return used == null || capacity == null || capacity <= 0 ? '—' : `${this.round(used / capacity * 100)}%`; }

  // 임계값은 실제 이상 징후에만 붙인다. "0보다 크면 경고"는 정상 운영에서 상시 점등돼
  // 경고 자체를 무의미하게 만든다.
  cacheStatus(): Phase { const value = this.latest('cacheHitPct'); return value == null ? '' : value >= 95 ? 'ok' : 'warn'; }
  lagStatus(): Phase { const value = this.latest('replicationLagSeconds'); return value == null ? '' : value >= 10 ? 'warn' : 'ok'; }
  deadlockStatus(): Phase { const value = this.latest('deadlocksPerSecond'); return value == null ? '' : value > 0 ? 'warn' : 'ok'; }
  pvcStatus(): Phase { const used = this.latest('pvcUsedBytes'); const capacity = this.latest('pvcCapacityBytes'); if (used == null || capacity == null || capacity <= 0) return ''; return used / capacity >= .8 ? 'warn' : 'ok'; }
  statusLabel(): string { return this.svc.metricsState() === 'ok' ? 'Prometheus connected' : this.svc.metricsState() === 'error' ? 'Prometheus unavailable' : 'Metrics pending'; }

  // 색은 플러그인 디자인 토큰에서만 가져온다. 차트마다 hex를 새로 고르면 화면끼리 어긋난다.
  // 의미가 있는 계열(오류·주의)만 semantic 토큰을 쓰고, 중립 단일 계열은 brand로 통일한다.
  readonly transactionSeries = computed<PgSeries[]>(() => this.series([['commit', 'Commit /s', BRAND], ['rollback', 'Rollback /s', DANGER]]));
  readonly connectionSeries = computed<PgSeries[]>(() => this.series([['connections', 'Active', BRAND], ['idleInTransaction', 'Idle in transaction', WARN]]));
  readonly walSeries = computed<PgSeries[]>(() => [{ label: 'WAL MiB/s', data: this.toMiB(this.svc.monitoringMetrics().walBytesPerSecond), color: BRAND }]);
  readonly replicationSeries = computed<PgSeries[]>(() => [{ label: 'Lag seconds', data: this.svc.monitoringMetrics().replicationLagSeconds, color: BRAND }]);
  readonly cpuSeries = computed<PgSeries[]>(() => [{ label: 'CPU cores', data: this.svc.monitoringMetrics().cpuCores, color: ACCENT }]);
  readonly memorySeries = computed<PgSeries[]>(() => [{ label: 'Memory MiB', data: this.toMiB(this.svc.monitoringMetrics().memoryBytes), color: BRAND }]);
  readonly pvcSeries = computed<PgSeries[]>(() => [{ label: 'PVC used %', data: this.percentage(this.svc.monitoringMetrics().pvcUsedBytes, this.svc.monitoringMetrics().pvcCapacityBytes), color: ACCENT }]);
  readonly errorSeries = computed<PgSeries[]>(() => this.series([['deadlocksPerSecond', 'Deadlocks /s', DANGER], ['conflictsPerSecond', 'Conflicts /s', WARN]]));

  private series(entries: [SeriesKey, string, string][]): PgSeries[] { return entries.filter(([key]) => this.hasAny([key])).map(([key, label, color]) => ({ label, data: this.svc.monitoringMetrics()[key], color })); }
  private toMiB(values: number[]): number[] { return values.map((value) => Number.isFinite(value) ? this.round(value / 1024 / 1024) : Number.NaN); }
  private percentage(used: number[], capacity: number[]): number[] { return used.map((value, index) => Number.isFinite(value) && Number.isFinite(capacity[index]) && capacity[index] > 0 ? this.round(value / capacity[index] * 100) : Number.NaN); }
  private round(value: number): number { return Math.round(value * 100) / 100; }
  private formatBytes(value: number): string { const sign = value < 0 ? '-' : ''; const size = Math.abs(value); if (size >= 1024 ** 3) return `${sign}${this.round(size / 1024 ** 3)} GiB`; if (size >= 1024 ** 2) return `${sign}${this.round(size / 1024 ** 2)} MiB`; if (size >= 1024) return `${sign}${this.round(size / 1024)} KiB`; return `${sign}${this.round(size)} B`; }
}
