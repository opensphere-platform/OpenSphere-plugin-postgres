import { CommonModule } from '@angular/common';
import { Component, Input, OnChanges, SimpleChanges, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ClarityModule } from '@clr/angular';
import Catalog16 from '@carbon/icons/es/catalog/16';
import BareMetalServer16 from '@carbon/icons/es/bare-metal-server/16';
import DataBase16 from '@carbon/icons/es/data--base/16';
import Connection16 from '@carbon/icons/es/connection/16';
import Cloud16 from '@carbon/icons/es/cloud/16';
import { CarbonIcon } from '../../../carbon-icon';
import { ExternalBackupTarget, PostgresFleetService, PostgresProfile, PostgresProfileDraft, PostgresProfileKind } from '../postgres-fleet.service';

type EditorKind = PostgresProfileKind;
type CatalogFilter = 'all' | EditorKind;

@Component({
  selector: 'pg-profile-catalog',
  standalone: true,
  imports: [CommonModule, FormsModule, ClarityModule, CarbonIcon],
  styles: [`
    :host { display:block; min-width:0; }
    .pgpc-head { display:flex; align-items:end; justify-content:space-between; gap:1rem; }
    .pgpc-head h2 { margin:.1rem 0; font-size:1.2rem; font-weight:500; }
    .pgpc-head p { margin:.2rem 0 0; color:var(--clr-color-neutral-700); }
    .pgpc-context { display:inline-flex; align-items:center; min-height:1.35rem; padding:0 .5rem; border:1px solid #8d8d8d; border-radius:1rem; color:#525252; font-size:.68rem; }
    .pgpc-actions { display:flex; gap:.4rem; flex-wrap:wrap; align-items:center; }
    .pgpc-categories { display:grid; grid-template-columns:repeat(5,minmax(0,1fr)); gap:.6rem; margin:1rem 0; }
    .pgpc-category { display:grid; grid-template-columns:2.1rem minmax(0,1fr) auto; align-items:center; gap:.65rem; min-height:4.25rem; padding:.65rem .75rem; border:1px solid #d6d9dc; border-bottom:3px solid transparent; background:#fff; color:#161616; text-align:left; cursor:pointer; }
    .pgpc-category:hover { border-color:#8d8d8d; background:#f7f7f7; }
    .pgpc-category.active { border-color:#8d8d8d; border-bottom-color:#0f62fe; background:#edf5ff; }
    .pgpc-category-icon,.pgpc-card-icon { display:grid; place-items:center; width:2.1rem; height:2.1rem; border-radius:50%; color:#0f62fe; background:#edf5ff; }
    .pgpc-category.active .pgpc-category-icon { color:#fff; background:#0f62fe; }
    .pgpc-category-copy { display:grid; gap:.12rem; min-width:0; }
    .pgpc-category-copy b { font-size:.75rem; font-weight:600; }
    .pgpc-category-copy small { overflow:hidden; color:#6f6f6f; font-size:.62rem; text-overflow:ellipsis; white-space:nowrap; }
    .pgpc-category-count { color:#525252; font-size:1.05rem; font-weight:400; }
    .pgpc-grid { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:.75rem; margin:.85rem 0; }
    .pgpc-card { display:grid; grid-template-rows:auto 1fr auto; min-width:0; border:1px solid #d6d9dc; background:#fff; }
    .pgpc-card-head { display:grid; grid-template-columns:2.1rem minmax(0,1fr) auto; align-items:center; gap:.65rem; padding:.8rem .85rem .65rem; border-bottom:1px solid #e0e0e0; }
    .pgpc-card-title { min-width:0; }.pgpc-card-title h3 { overflow:hidden; margin:0; font-size:.86rem; font-weight:600; text-overflow:ellipsis; white-space:nowrap; }.pgpc-card-title small { color:#6f6f6f; font: .62rem/1.3 var(--clr-font-mono); }
    .pgpc-state { color:#198038; font-size:.64rem; font-weight:600; white-space:nowrap; }
    .pgpc-state.readonly { color:#8a3ffc; }
    .pgpc-card-body { padding:.75rem .85rem; }
    .pgpc-card dl { display:grid; grid-template-columns:max-content 1fr; gap:.35rem .7rem; margin:0; }.pgpc-card dt { color:#6f6f6f; font-size:.68rem; }.pgpc-card dd { margin:0; overflow-wrap:anywhere; font-size:.72rem; }
    .pgpc-card-foot { display:flex; align-items:center; justify-content:space-between; gap:.5rem; min-height:2.6rem; padding:.4rem .55rem .4rem .85rem; border-top:1px solid #e0e0e0; }
    .pgpc-consumers { color:#6f6f6f; font-size:.63rem; }
    .pgpc-empty { display:grid; place-items:center; min-height:8rem; margin-top:.75rem; border:1px dashed #c6c6c6; color:#6f6f6f; text-align:center; }
    .pgpc-external { margin:.9rem 0 1rem; padding:.9rem; border-left:4px solid #0f62fe; background:#f4f4f4; }
    .pgpc-external-head { display:flex; align-items:end; justify-content:space-between; gap:1rem; }.pgpc-external-head h3 { margin:0; font-size:.92rem; }.pgpc-external-head p { margin:.15rem 0 0; color:#525252; font-size:.68rem; }
    .pgpc-target-grid { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:.65rem; margin-top:.75rem; }
    .pgpc-target { display:grid; grid-template-columns:2.1rem minmax(0,1fr); gap:.65rem; min-width:0; padding:.7rem; border:1px solid #d6d9dc; background:#fff; }
    .pgpc-target b,.pgpc-target span,.pgpc-target small { display:block; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }.pgpc-target b { font-size:.73rem; }.pgpc-target span { margin-top:.12rem; color:#525252; font-size:.65rem; }.pgpc-target small { margin-top:.3rem; color:#6f6f6f; font-size:.61rem; }
    .pgpc-target-state { color:#a2191f !important; }.pgpc-target-state.ready { color:#198038 !important; }
    .pgpc-form { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:.75rem; }.pgpc-form label { display:grid; align-content:start; gap:.25rem; font-weight:600; }.pgpc-form input,.pgpc-form select,.pgpc-form textarea { width:100%; }.pgpc-form textarea { min-height:7rem; font-family:var(--clr-font-mono); font-size:.8rem; }.pgpc-form small { color:#6f6f6f; font-weight:400; }.pgpc-full { grid-column:1 / -1; }.pgpc-preview { max-height:15rem; overflow:auto; margin:0; padding:.75rem; background:#f4f6f8; font-size:.75rem; }
    .pgpc-selected-target { grid-column:1 / -1; display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:.5rem; padding:.65rem .75rem; border-left:3px solid #0f62fe; background:#edf5ff; }.pgpc-selected-target div { min-width:0; }.pgpc-selected-target small,.pgpc-selected-target b { display:block; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }.pgpc-selected-target small { color:#525252; }.pgpc-selected-target b { margin-top:.12rem; font-size:.7rem; }
    @media (max-width:1200px) { .pgpc-categories{grid-template-columns:repeat(3,minmax(0,1fr));}.pgpc-grid,.pgpc-target-grid{grid-template-columns:repeat(2,minmax(0,1fr));} }
    @media (max-width:760px) { .pgpc-head,.pgpc-external-head{align-items:start;flex-direction:column}.pgpc-categories,.pgpc-grid,.pgpc-target-grid,.pgpc-form,.pgpc-selected-target{grid-template-columns:1fr;} }
  `],
  template: `
    <section aria-label="PostgreSQL Profile Catalog">
      <div class="pgpc-head">
        <div><span class="vl-eyebrow">Reusable configuration</span><h2>Profile Catalog</h2><p>운영 목적별 Profile을 분류해 탐색하고 선택한 Namespace에서 재사용합니다.</p></div>
        <div class="pgpc-actions"><span class="pgpc-context">{{ namespace }}</span><button class="btn btn-sm" type="button" (click)="refresh()" [disabled]="loading()">새로고침</button><button class="btn btn-sm btn-primary" type="button" (click)="openCreate()">Profile 추가</button></div>
      </div>

      <nav class="pgpc-categories" aria-label="Profile 종류">
        <button class="pgpc-category" type="button" *ngFor="let category of categories" [class.active]="selectedCategory()===category.id" [attr.aria-pressed]="selectedCategory()===category.id" (click)="selectedCategory.set(category.id)">
          <span class="pgpc-category-icon"><os-cicon [icon]="category.icon" [size]="18"></os-cicon></span>
          <span class="pgpc-category-copy"><b>{{ category.label }}</b><small>{{ category.description }}</small></span>
          <span class="pgpc-category-count">{{ profileCount(category.id) }}</span>
        </button>
      </nav>

      <clr-alert *ngIf="error()" clrAlertType="danger" [clrAlertClosable]="false"><clr-alert-item><span class="alert-text">{{ error() }}</span></clr-alert-item></clr-alert>

      <section class="pgpc-external" *ngIf="selectedCategory()==='objectStorage'" aria-label="External Channels 백업 대상">
        <div class="pgpc-external-head"><div><h3>External Channels 백업 대상</h3><p>Console에 등록된 저장 위치의 Endpoint·Region·Bucket을 백업 Profile에 재사용합니다.</p></div><a class="btn btn-sm btn-link" href="/manage/external-channels">외부 채널 관리</a></div>
        <div class="pgpc-empty" *ngIf="fleet.backupTargetsState()==='loading'">백업 대상을 확인하고 있습니다.</div>
        <clr-alert *ngIf="fleet.backupTargetsError()" clrAlertType="warning" [clrAlertClosable]="false"><clr-alert-item><span class="alert-text">{{ fleet.backupTargetsError() }}</span></clr-alert-item></clr-alert>
        <div class="pgpc-target-grid" *ngIf="fleet.backupTargets().length">
          <article class="pgpc-target" *ngFor="let target of fleet.backupTargets()"><span class="pgpc-card-icon"><os-cicon [icon]="CloudIcon" [size]="18"></os-cicon></span><div><b>{{ target.name }}</b><span>{{ target.bucketName }} · {{ target.region || 'default' }}</span><small>{{ target.endpoint }}</small><small class="pgpc-target-state" [class.ready]="backupTargetReady(target)">{{ backupTargetLabel(target) }}</small></div></article>
        </div>
        <div class="pgpc-empty" *ngIf="fleet.backupTargetsState()==='empty'">등록된 외부 백업 대상이 없습니다.</div>
      </section>

      <div *ngIf="loading()" class="pgpc-empty">Profile Catalog를 확인하고 있습니다.</div>
      <div *ngIf="!loading() && !filteredProfiles().length" class="pgpc-empty"><div><b>{{ selectedCategoryLabel() }} Profile이 없습니다.</b><br />Profile 추가에서 이 분류의 설정을 만들 수 있습니다.</div></div>
      <div class="pgpc-grid" *ngIf="!loading() && filteredProfiles().length">
        <article class="pgpc-card" *ngFor="let profile of filteredProfiles()">
          <div class="pgpc-card-head"><span class="pgpc-card-icon"><os-cicon [icon]="kindIcon(profile.kind)" [size]="18"></os-cicon></span><div class="pgpc-card-title"><h3>{{ profile.name }}</h3><small>{{ profile.apiKind }}</small></div><span class="pgpc-state" [class.readonly]="profile.claimOwned">{{ profile.claimOwned ? 'READ ONLY' : profile.managed ? 'MANAGED' : 'EXTERNAL' }}</span></div>
          <div class="pgpc-card-body"><dl><dt>종류</dt><dd>{{ kindLabel(profile.kind) }}</dd><dt>구성</dt><dd>{{ summary(profile) }}</dd><dt>사용 중</dt><dd>{{ profile.consumers.length ? profile.consumers.join(', ') : '연결 없음' }}</dd></dl></div>
          <div class="pgpc-card-foot"><span class="pgpc-consumers">{{ profile.consumers.length ? profile.consumers.length + '개 인스턴스 참조' : '사용 가능' }}</span><div class="pgpc-actions"><button class="btn btn-sm btn-link" type="button" (click)="openEdit(profile)" [disabled]="profile.claimOwned">편집</button><button class="btn btn-sm btn-link" type="button" (click)="openDelete(profile)" [disabled]="profile.claimOwned || profile.consumers.length">삭제</button></div></div>
        </article>
      </div>
    </section>

    <clr-modal [(clrModalOpen)]="editorOpen" [clrModalClosable]="!saving">
      <h3 class="modal-title">{{ editing() ? 'Profile 편집' : 'Profile 추가' }}</h3>
      <div class="modal-body">
        <p>적용 전 미리보기에서 생성 또는 변경될 리소스와 참조 중인 인스턴스를 확인합니다.</p>
        <div class="pgpc-form">
          <label><span>종류</span><select [(ngModel)]="kind" [disabled]="!!editing()"><option value="instance">인스턴스 자원</option><option value="postgres">PostgreSQL 설정</option><option value="pooling">연결 풀링</option><option value="objectStorage">백업 Object Storage</option></select></label>
          <label><span>이름</span><input [(ngModel)]="name" [disabled]="!!editing()" placeholder="orders-production" /></label>
          <ng-container *ngIf="kind === 'instance'"><label><span>CPU limit</span><input [(ngModel)]="cpu" placeholder="1" /></label><label><span>Memory limit</span><input [(ngModel)]="memory" placeholder="2Gi" /></label><label><span>CPU request</span><input [(ngModel)]="requestCpu" placeholder="500m" /></label><label><span>Memory request</span><input [(ngModel)]="requestMemory" placeholder="1Gi" /></label></ng-container>
          <ng-container *ngIf="kind === 'postgres'"><label><span>PostgreSQL 버전</span><input [(ngModel)]="postgresVersion" placeholder="18" /></label><label class="pgpc-full"><span>postgresql.conf (한 줄에 key=value)</span><textarea [(ngModel)]="postgresqlConf" placeholder="max_connections=200&#10;wal_compression=on"></textarea></label></ng-container>
          <ng-container *ngIf="kind === 'pooling'"><label><span>Pool mode</span><select [(ngModel)]="poolMode"><option value="transaction">transaction</option><option value="session">session</option></select></label><label><span>Max client connections</span><input [(ngModel)]="maxClientConn" type="number" min="1" max="10000" /></label></ng-container>
          <ng-container *ngIf="kind === 'objectStorage'">
            <label class="pgpc-full"><span>External Channels 백업 대상</span><select [(ngModel)]="selectedBackupTargetId" (ngModelChange)="useBackupTarget($event)"><option value="">직접 입력</option><option *ngFor="let target of fleet.backupTargets()" [value]="target.id" [disabled]="!backupTargetReady(target)">{{ target.name }} · {{ target.bucketName }} · {{ backupTargetLabel(target) }}</option></select><small>Ready 상태이며 자격증명이 구성된 대상만 선택할 수 있습니다.</small></label>
            <div class="pgpc-selected-target" *ngIf="selectedBackupTarget() as target"><div><small>Endpoint</small><b>{{ target.endpoint }}</b></div><div><small>Bucket · Prefix</small><b>{{ target.bucketName }} · {{ target.pathPrefix || '—' }}</b></div><div><small>Credential</small><b>Configured · v{{ target.credential.version }}</b></div></div>
            <label><span>Storage type</span><select [(ngModel)]="storageType"><option value="s3Compatible">S3 compatible</option><option value="s3">Amazon S3</option></select></label><label><span>Bucket</span><input [(ngModel)]="storageBucket" placeholder="postgres-backups" /></label><label><span>Endpoint (S3 compatible)</span><input [(ngModel)]="storageEndpoint" placeholder="https://s3.example.com" /></label><label><span>Region</span><input [(ngModel)]="storageRegion" placeholder="default" /></label><label><span>Namespace credential Secret</span><input [(ngModel)]="storageSecretName" placeholder="backup-credentials" /><small>비밀값은 표시하지 않고 Kubernetes Secret 참조만 저장합니다.</small></label><label><span>Access key field</span><input [(ngModel)]="storageAccessKeyField" placeholder="accessKeyId" /></label><label><span>Secret key field</span><input [(ngModel)]="storageSecretKeyField" placeholder="secretAccessKey" /></label><label><span>Path-style addressing</span><input type="checkbox" [(ngModel)]="storagePathStyle" /></label>
          </ng-container>
          <label class="pgpc-full"><span>변경 사유</span><input [(ngModel)]="reason" placeholder="운영 리소스 요구사항 변경 (8자 이상)" /></label>
        </div>
        <clr-alert *ngIf="editorError()" clrAlertType="danger" [clrAlertClosable]="false"><clr-alert-item><span class="alert-text">{{ editorError() }}</span></clr-alert-item></clr-alert>
        <ng-container *ngIf="preview() as result"><h4>적용 미리보기</h4><pre class="pgpc-preview">{{ previewText(result) }}</pre></ng-container>
      </div>
      <div class="modal-footer"><button class="btn btn-outline" type="button" (click)="editorOpen=false" [disabled]="saving">취소</button><button class="btn" type="button" (click)="loadPreview()" [disabled]="saving">미리보기</button><button class="btn btn-primary" type="button" (click)="apply()" [disabled]="saving || !preview()">{{ saving ? '적용 중' : '적용' }}</button></div>
    </clr-modal>

    <clr-modal [(clrModalOpen)]="deleteOpen" [clrModalClosable]="!saving">
      <h3 class="modal-title">Profile 삭제</h3>
      <div class="modal-body"><p><strong>{{ deleting()?.name }}</strong> Profile을 삭제합니다. 이름을 정확히 입력하면 삭제가 요청됩니다.</p><label>확인 이름<input [(ngModel)]="deleteConfirm" /></label><label>삭제 사유<input [(ngModel)]="deleteReason" placeholder="운영 정책 변경으로 Profile 폐기" /></label><clr-alert *ngIf="editorError()" clrAlertType="danger" [clrAlertClosable]="false"><clr-alert-item><span class="alert-text">{{ editorError() }}</span></clr-alert-item></clr-alert></div>
      <div class="modal-footer"><button class="btn btn-outline" type="button" (click)="deleteOpen=false" [disabled]="saving">취소</button><button class="btn btn-danger" type="button" (click)="remove()" [disabled]="saving || deleteConfirm !== deleting()?.name">삭제</button></div>
    </clr-modal>
  `,
})
export class PgProfileCatalogTab implements OnChanges {
  @Input({ required: true }) namespace = '';
  readonly fleet = inject(PostgresFleetService);
  readonly CatalogIcon = Catalog16;
  readonly CloudIcon = Cloud16;
  readonly categories: { id: CatalogFilter; label: string; description: string; icon: any }[] = [
    { id: 'all', label: '전체', description: '모든 운영 Profile', icon: Catalog16 },
    { id: 'instance', label: '인스턴스', description: 'CPU · Memory', icon: BareMetalServer16 },
    { id: 'postgres', label: 'PostgreSQL', description: '버전 · DB 설정', icon: DataBase16 },
    { id: 'pooling', label: '연결 풀링', description: 'PgBouncer 정책', icon: Connection16 },
    { id: 'objectStorage', label: '백업 저장소', description: '외부 채널 · 보존', icon: Cloud16 },
  ];
  readonly loading = computed(() => this.fleet.profilesState() === 'loading');
  readonly error = computed(() => this.fleet.profilesError());
  readonly profiles = computed(() => this.fleet.profiles());
  readonly selectedCategory = signal<CatalogFilter>('all');
  readonly filteredProfiles = computed(() => this.selectedCategory() === 'all' ? this.profiles() : this.profiles().filter((profile) => profile.kind === this.selectedCategory()));
  readonly editing = signal<PostgresProfile | null>(null);
  readonly deleting = signal<PostgresProfile | null>(null);
  readonly preview = signal<any>(null);
  readonly editorError = signal('');
  editorOpen = false; deleteOpen = false; saving = false;
  kind: EditorKind = 'instance'; name = ''; cpu = '1'; memory = '2Gi'; requestCpu = '500m'; requestMemory = '1Gi';
  postgresVersion = '18'; postgresqlConf = 'max_connections=200\nwal_compression=on'; poolMode = 'transaction'; maxClientConn = '200'; storageType = 's3Compatible'; storageBucket = ''; storageEndpoint = ''; storageRegion = ''; storageSecretName = ''; storageAccessKeyField = 'accessKeyId'; storageSecretKeyField = 'secretAccessKey'; storagePathStyle = true; selectedBackupTargetId = ''; reason = '';
  deleteConfirm = ''; deleteReason = '';

  ngOnChanges(changes: SimpleChanges): void { if (changes['namespace']?.currentValue) this.refresh(); }
  refresh(): void { if (this.namespace) { void this.fleet.refreshProfiles(this.namespace); void this.fleet.refreshBackupTargets(); } }
  profileCount(kind: CatalogFilter): number { return kind === 'all' ? this.profiles().length : this.profiles().filter((profile) => profile.kind === kind).length; }
  selectedCategoryLabel(): string { return this.categories.find((category) => category.id === this.selectedCategory())?.label || '전체'; }
  kindLabel(kind: EditorKind): string { return ({ instance: '인스턴스 자원', postgres: 'PostgreSQL 설정', pooling: '연결 풀링', objectStorage: '백업 저장소' })[kind]; }
  kindIcon(kind: EditorKind): any { return ({ instance: BareMetalServer16, postgres: DataBase16, pooling: Connection16, objectStorage: Cloud16 })[kind]; }
  backupTargetReady(target: ExternalBackupTarget): boolean { return target.enabled && target.healthState === 'Ready' && target.credential.configured; }
  backupTargetLabel(target: ExternalBackupTarget): string { return this.backupTargetReady(target) ? `Ready · Credential v${target.credential.version}` : `${target.healthState} · ${target.credential.configured ? 'Credential configured' : 'Credential missing'}`; }
  selectedBackupTarget(): ExternalBackupTarget | null { return this.fleet.backupTargets().find((target) => target.id === this.selectedBackupTargetId) || null; }
  useBackupTarget(id: string): void {
    const target = this.fleet.backupTargets().find((item) => item.id === id);
    if (!target || !this.backupTargetReady(target)) return;
    this.storageType = 's3Compatible'; this.storageBucket = target.bucketName; this.storageEndpoint = target.endpoint; this.storageRegion = target.region || 'default'; this.storagePathStyle = true;
    if (!this.name.trim()) this.name = `backup-${target.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48)}`;
  }
  summary(profile: PostgresProfile): string {
    if (profile.kind === 'instance') return `${profile.spec?.requests?.cpu || profile.spec?.cpu || '—'} CPU / ${profile.spec?.requests?.memory || profile.spec?.memory || '—'}`;
    if (profile.kind === 'postgres') return `PostgreSQL ${profile.spec?.postgresVersion || '—'} · ${Object.keys(profile.spec?.['postgresql.conf'] || {}).length} parameters`;
    if (profile.kind === 'pooling') return `${profile.spec?.pgBouncer?.['pgbouncer.ini']?.pgbouncer?.pool_mode || '—'} · max ${profile.spec?.pgBouncer?.['pgbouncer.ini']?.pgbouncer?.max_client_conn || '—'}`;
    return `${profile.spec?.type || '—'} · ${profile.spec?.[profile.spec?.type]?.bucket || '—'}`;
  }
  openCreate(): void { this.resetEditor(); if (this.selectedCategory() !== 'all') this.kind = this.selectedCategory() as EditorKind; this.editorOpen = true; }
  openEdit(profile: PostgresProfile): void {
    this.resetEditor(); this.editing.set(profile); this.kind = profile.kind; this.name = profile.name;
    if (profile.kind === 'instance') { this.cpu = profile.spec?.cpu || ''; this.memory = profile.spec?.memory || ''; this.requestCpu = profile.spec?.requests?.cpu || ''; this.requestMemory = profile.spec?.requests?.memory || ''; }
    if (profile.kind === 'postgres') { this.postgresVersion = profile.spec?.postgresVersion || '18'; this.postgresqlConf = Object.entries(profile.spec?.['postgresql.conf'] || {}).map(([key, value]) => `${key}=${value}`).join('\n'); }
    if (profile.kind === 'pooling') { this.poolMode = profile.spec?.pgBouncer?.['pgbouncer.ini']?.pgbouncer?.pool_mode || 'transaction'; this.maxClientConn = String(profile.spec?.pgBouncer?.['pgbouncer.ini']?.pgbouncer?.max_client_conn || '200'); }
    if (profile.kind === 'objectStorage') { const storage = profile.spec?.[profile.spec?.type] || {}; const selectors = storage?.awsCredentials?.secretKeySelectors || {}; this.storageType = profile.spec?.type || 's3Compatible'; this.storageBucket = storage.bucket || ''; this.storageEndpoint = storage.endpoint || ''; this.storageRegion = storage.region || ''; this.storageSecretName = selectors.accessKeyId?.name || selectors.secretAccessKey?.name || ''; this.storageAccessKeyField = selectors.accessKeyId?.key || 'accessKeyId'; this.storageSecretKeyField = selectors.secretAccessKey?.key || 'secretAccessKey'; this.storagePathStyle = storage.enablePathStyleAddressing !== false; }
    this.editorOpen = true;
  }
  openDelete(profile: PostgresProfile): void { this.deleting.set(profile); this.deleteConfirm = ''; this.deleteReason = ''; this.editorError.set(''); this.deleteOpen = true; }
  private resetEditor(): void { this.editing.set(null); this.preview.set(null); this.editorError.set(''); this.kind = 'instance'; this.name = ''; this.cpu = '1'; this.memory = '2Gi'; this.requestCpu = '500m'; this.requestMemory = '1Gi'; this.postgresVersion = '18'; this.postgresqlConf = 'max_connections=200\nwal_compression=on'; this.poolMode = 'transaction'; this.maxClientConn = '200'; this.storageType = 's3Compatible'; this.storageBucket = ''; this.storageEndpoint = ''; this.storageRegion = ''; this.storageSecretName = ''; this.storageAccessKeyField = 'accessKeyId'; this.storageSecretKeyField = 'secretAccessKey'; this.storagePathStyle = true; this.selectedBackupTargetId = ''; this.reason = ''; }
  private draft(): PostgresProfileDraft {
    const name = this.name.trim(); const reason = this.reason.trim();
    if (!name || !reason) throw new Error('Profile 이름과 변경 사유를 입력하세요.');
    if (this.kind === 'instance') return { namespace: this.namespace, kind: this.kind, name, reason, spec: { cpu: this.cpu.trim(), memory: this.memory.trim(), requests: { cpu: this.requestCpu.trim(), memory: this.requestMemory.trim() } } };
    if (this.kind === 'postgres') {
      const params: Record<string, string> = {};
      for (const raw of this.postgresqlConf.split('\n')) { const line = raw.trim(); if (!line) continue; const index = line.indexOf('='); if (index < 1) throw new Error(`postgresql.conf 형식 오류: ${line}`); params[line.slice(0, index).trim()] = line.slice(index + 1).trim(); }
      return { namespace: this.namespace, kind: this.kind, name, reason, spec: { postgresVersion: this.postgresVersion.trim(), 'postgresql.conf': params } };
    }
    if (this.kind === 'pooling') return { namespace: this.namespace, kind: this.kind, name, reason, spec: { pgBouncer: { 'pgbouncer.ini': { pgbouncer: { pool_mode: this.poolMode, max_client_conn: String(this.maxClientConn) } } } } };
    const storage: any = { bucket: this.storageBucket.trim(), awsCredentials: { secretKeySelectors: { accessKeyId: { name: this.storageSecretName.trim(), key: this.storageAccessKeyField.trim() }, secretAccessKey: { name: this.storageSecretName.trim(), key: this.storageSecretKeyField.trim() } } } };
    if (this.storageRegion.trim()) storage.region = this.storageRegion.trim();
    if (this.storageType === 's3Compatible') { if (this.storageEndpoint.trim()) storage.endpoint = this.storageEndpoint.trim(); storage.enablePathStyleAddressing = this.storagePathStyle; }
    return { namespace: this.namespace, kind: this.kind, name, reason, spec: { type: this.storageType, [this.storageType]: storage } };
  }
  async loadPreview(): Promise<void> { try { this.editorError.set(''); this.preview.set(await this.fleet.previewProfile(this.draft())); } catch (error: any) { this.preview.set(null); this.editorError.set(error?.message || String(error)); } }
  async apply(): Promise<void> { try { this.saving = true; this.editorError.set(''); await this.fleet.applyProfile(this.draft()); this.editorOpen = false; } catch (error: any) { this.editorError.set(error?.message || String(error)); } finally { this.saving = false; } }
  async remove(): Promise<void> { const profile = this.deleting(); if (!profile) return; try { this.saving = true; this.editorError.set(''); await this.fleet.deleteProfile(this.namespace, profile.kind, profile.name, this.deleteReason, this.deleteConfirm); this.deleteOpen = false; } catch (error: any) { this.editorError.set(error?.message || String(error)); } finally { this.saving = false; } }
  previewText(result: any): string { return JSON.stringify({ operation: result.operation, resource: result.resource, impact: result.impact }, null, 2); }
}
