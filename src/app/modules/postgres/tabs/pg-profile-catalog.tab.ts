import { CommonModule } from '@angular/common';
import { Component, Input, OnChanges, SimpleChanges, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ClarityModule } from '@clr/angular';
import { PostgresFleetService, PostgresProfile, PostgresProfileDraft, PostgresProfileKind } from '../postgres-fleet.service';

type EditorKind = PostgresProfileKind;

@Component({
  selector: 'pg-profile-catalog',
  standalone: true,
  imports: [CommonModule, FormsModule, ClarityModule],
  styles: [`
    :host { display:block; margin-top:1.25rem; }
    .pgpc-head { display:flex; align-items:end; justify-content:space-between; gap:1rem; border-top:1px solid var(--clr-color-neutral-300); padding-top:1rem; }
    .pgpc-head h2 { margin:.1rem 0; font-size:1.1rem; }.pgpc-head p { margin:.2rem 0 0; color:var(--clr-color-neutral-700); }
    .pgpc-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:.75rem; margin:.85rem 0; }
    .pgpc-card { border:1px solid var(--clr-color-neutral-300); padding:.8rem; min-width:0; background:white; }
    .pgpc-card h3 { margin:0 0 .55rem; font-size:.95rem; }.pgpc-card dl { display:grid; grid-template-columns:max-content 1fr; gap:.35rem .7rem; margin:0; }.pgpc-card dt { color:var(--clr-color-neutral-700); }.pgpc-card dd { margin:0; overflow-wrap:anywhere; }
    .pgpc-empty { color:var(--clr-color-neutral-700); padding:1rem 0; }.pgpc-actions { display:flex; gap:.4rem; flex-wrap:wrap; }.pgpc-consumers { font-size:.8rem; color:var(--clr-color-neutral-700); }
    .pgpc-form { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:.75rem; }.pgpc-form label { display:grid; gap:.25rem; font-weight:600; }.pgpc-form input,.pgpc-form select,.pgpc-form textarea { width:100%; }.pgpc-form textarea { min-height:7rem; font-family:var(--clr-font-mono); font-size:.8rem; }.pgpc-full { grid-column:1 / -1; }.pgpc-preview { max-height:15rem; overflow:auto; margin:0; padding:.75rem; background:#f4f6f8; font-size:.75rem; }
    @media (max-width: 900px) { .pgpc-grid,.pgpc-form{grid-template-columns:1fr;} }
  `],
  template: `
    <section aria-label="PostgreSQL Profile Catalog">
      <div class="pgpc-head">
        <div><span class="vl-eyebrow">Reusable configuration</span><h2>Profile Catalog</h2><p>이 Namespace에서 재사용할 인스턴스 자원, PostgreSQL, 연결 풀링, 백업 Object Storage 설정입니다.</p></div>
        <div class="pgpc-actions"><button class="btn btn-sm" type="button" (click)="refresh()" [disabled]="loading()">새로고침</button><button class="btn btn-sm btn-primary" type="button" (click)="openCreate()">Profile 추가</button></div>
      </div>
      <clr-alert *ngIf="error()" clrAlertType="danger" [clrAlertClosable]="false"><clr-alert-item><span class="alert-text">{{ error() }}</span></clr-alert-item></clr-alert>
      <div *ngIf="loading()" class="pgpc-empty">Profile Catalog를 확인하고 있습니다.</div>
      <div *ngIf="!loading() && !profiles().length" class="pgpc-empty">등록된 재사용 Profile이 없습니다. 기존 Claim 소유 Profile은 여기에서 편집하지 않습니다.</div>
      <div class="pgpc-grid" *ngIf="!loading() && profiles().length">
        <article class="pgpc-card" *ngFor="let profile of profiles()">
          <h3>{{ kindLabel(profile.kind) }} · {{ profile.name }}</h3>
          <dl>
            <dt>적용</dt><dd>{{ summary(profile) }}</dd>
            <dt>상태</dt><dd>{{ profile.claimOwned ? 'Claim 소유 · 읽기 전용' : profile.managed ? 'Foundation 관리' : '외부 관리' }}</dd>
            <dt>참조</dt><dd>{{ profile.consumers.length ? profile.consumers.join(', ') : '없음' }}</dd>
          </dl>
          <div class="pgpc-actions" style="margin-top:.7rem"><button class="btn btn-sm" type="button" (click)="openEdit(profile)" [disabled]="profile.claimOwned">편집</button><button class="btn btn-sm btn-danger-outline" type="button" (click)="openDelete(profile)" [disabled]="profile.claimOwned || profile.consumers.length">삭제</button></div>
          <div class="pgpc-consumers" *ngIf="profile.consumers.length">참조 중인 Profile은 삭제할 수 없습니다.</div>
        </article>
      </div>
    </section>

    <clr-modal [(clrModalOpen)]="editorOpen" [clrModalClosable]="!saving">
      <h3 class="modal-title">{{ editing() ? 'Profile 편집' : 'Profile 추가' }}</h3>
      <div class="modal-body">
        <p>적용 전 미리보기에서 생성 또는 변경될 StackGres 리소스와 참조 중인 클러스터를 확인합니다.</p>
        <div class="pgpc-form">
          <label><span>종류</span><select [(ngModel)]="kind" [disabled]="!!editing()"><option value="instance">인스턴스 자원</option><option value="postgres">PostgreSQL 설정</option><option value="pooling">연결 풀링</option><option value="objectStorage">백업 Object Storage</option></select></label>
          <label><span>이름</span><input [(ngModel)]="name" [disabled]="!!editing()" placeholder="orders-production" /></label>
          <ng-container *ngIf="kind === 'instance'"><label><span>CPU limit</span><input [(ngModel)]="cpu" placeholder="1" /></label><label><span>Memory limit</span><input [(ngModel)]="memory" placeholder="2Gi" /></label><label><span>CPU request</span><input [(ngModel)]="requestCpu" placeholder="500m" /></label><label><span>Memory request</span><input [(ngModel)]="requestMemory" placeholder="1Gi" /></label></ng-container>
          <ng-container *ngIf="kind === 'postgres'"><label><span>PostgreSQL 버전</span><input [(ngModel)]="postgresVersion" placeholder="18" /></label><label class="pgpc-full"><span>postgresql.conf (한 줄에 key=value)</span><textarea [(ngModel)]="postgresqlConf" placeholder="max_connections=200&#10;wal_compression=on"></textarea></label></ng-container>
          <ng-container *ngIf="kind === 'pooling'"><label><span>Pool mode</span><select [(ngModel)]="poolMode"><option value="transaction">transaction</option><option value="session">session</option></select></label><label><span>Max client connections</span><input [(ngModel)]="maxClientConn" type="number" min="1" max="10000" /></label></ng-container>
          <ng-container *ngIf="kind === 'objectStorage'"><label><span>Storage type</span><select [(ngModel)]="storageType"><option value="s3Compatible">S3 compatible</option><option value="s3">Amazon S3</option></select></label><label><span>Bucket</span><input [(ngModel)]="storageBucket" placeholder="postgres-backups" /></label><label><span>Endpoint (S3 compatible)</span><input [(ngModel)]="storageEndpoint" placeholder="https://minio.example.com" /></label><label><span>Region</span><input [(ngModel)]="storageRegion" placeholder="ap-northeast-2" /></label><label><span>Access key Secret</span><input [(ngModel)]="storageSecretName" placeholder="backup-credentials" /></label><label><span>Access key field</span><input [(ngModel)]="storageAccessKeyField" placeholder="accessKeyId" /></label><label><span>Secret key field</span><input [(ngModel)]="storageSecretKeyField" placeholder="secretAccessKey" /></label><label><span>Path-style addressing</span><input type="checkbox" [(ngModel)]="storagePathStyle" /></label></ng-container>
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
  readonly loading = computed(() => this.fleet.profilesState() === 'loading');
  readonly error = computed(() => this.fleet.profilesError());
  readonly profiles = computed(() => this.fleet.profiles());
  readonly editing = signal<PostgresProfile | null>(null);
  readonly deleting = signal<PostgresProfile | null>(null);
  readonly preview = signal<any>(null);
  readonly editorError = signal('');
  editorOpen = false; deleteOpen = false; saving = false;
  kind: EditorKind = 'instance'; name = ''; cpu = '1'; memory = '2Gi'; requestCpu = '500m'; requestMemory = '1Gi';
  postgresVersion = '18'; postgresqlConf = 'max_connections=200\nwal_compression=on'; poolMode = 'transaction'; maxClientConn = '200'; storageType = 's3Compatible'; storageBucket = ''; storageEndpoint = ''; storageRegion = ''; storageSecretName = ''; storageAccessKeyField = 'accessKeyId'; storageSecretKeyField = 'secretAccessKey'; storagePathStyle = true; reason = '';
  deleteConfirm = ''; deleteReason = '';

  ngOnChanges(changes: SimpleChanges): void { if (changes['namespace']?.currentValue) void this.refresh(); }
  refresh(): void { if (this.namespace) void this.fleet.refreshProfiles(this.namespace); }
  kindLabel(kind: EditorKind): string { return ({ instance: '인스턴스 자원', postgres: 'PostgreSQL 설정', pooling: '연결 풀링', objectStorage: '백업 Object Storage' })[kind]; }
  summary(profile: PostgresProfile): string {
    if (profile.kind === 'instance') return `${profile.spec?.requests?.cpu || profile.spec?.cpu || '—'} CPU / ${profile.spec?.requests?.memory || profile.spec?.memory || '—'}`;
    if (profile.kind === 'postgres') return `PostgreSQL ${profile.spec?.postgresVersion || '—'} · ${Object.keys(profile.spec?.['postgresql.conf'] || {}).length} parameters`;
    if (profile.kind === 'pooling') return `${profile.spec?.pgBouncer?.['pgbouncer.ini']?.pgbouncer?.pool_mode || '—'} · max ${profile.spec?.pgBouncer?.['pgbouncer.ini']?.pgbouncer?.max_client_conn || '—'}`;
    return `${profile.spec?.type || '—'} · ${profile.spec?.[profile.spec?.type]?.bucket || '—'}`;
  }
  openCreate(): void { this.resetEditor(); this.editorOpen = true; }
  openEdit(profile: PostgresProfile): void {
    this.resetEditor(); this.editing.set(profile); this.kind = profile.kind; this.name = profile.name;
    if (profile.kind === 'instance') { this.cpu = profile.spec?.cpu || ''; this.memory = profile.spec?.memory || ''; this.requestCpu = profile.spec?.requests?.cpu || ''; this.requestMemory = profile.spec?.requests?.memory || ''; }
    if (profile.kind === 'postgres') { this.postgresVersion = profile.spec?.postgresVersion || '18'; this.postgresqlConf = Object.entries(profile.spec?.['postgresql.conf'] || {}).map(([key, value]) => `${key}=${value}`).join('\n'); }
    if (profile.kind === 'pooling') { this.poolMode = profile.spec?.pgBouncer?.['pgbouncer.ini']?.pgbouncer?.pool_mode || 'transaction'; this.maxClientConn = String(profile.spec?.pgBouncer?.['pgbouncer.ini']?.pgbouncer?.max_client_conn || '200'); }
    if (profile.kind === 'objectStorage') { const storage = profile.spec?.[profile.spec?.type] || {}; const selectors = storage?.awsCredentials?.secretKeySelectors || {}; this.storageType = profile.spec?.type || 's3Compatible'; this.storageBucket = storage.bucket || ''; this.storageEndpoint = storage.endpoint || ''; this.storageRegion = storage.region || ''; this.storageSecretName = selectors.accessKeyId?.name || selectors.secretAccessKey?.name || ''; this.storageAccessKeyField = selectors.accessKeyId?.key || 'accessKeyId'; this.storageSecretKeyField = selectors.secretAccessKey?.key || 'secretAccessKey'; this.storagePathStyle = storage.enablePathStyleAddressing !== false; }
    this.editorOpen = true;
  }
  openDelete(profile: PostgresProfile): void { this.deleting.set(profile); this.deleteConfirm = ''; this.deleteReason = ''; this.editorError.set(''); this.deleteOpen = true; }
  private resetEditor(): void { this.editing.set(null); this.preview.set(null); this.editorError.set(''); this.kind = 'instance'; this.name = ''; this.cpu = '1'; this.memory = '2Gi'; this.requestCpu = '500m'; this.requestMemory = '1Gi'; this.postgresVersion = '18'; this.postgresqlConf = 'max_connections=200\nwal_compression=on'; this.poolMode = 'transaction'; this.maxClientConn = '200'; this.storageType = 's3Compatible'; this.storageBucket = ''; this.storageEndpoint = ''; this.storageRegion = ''; this.storageSecretName = ''; this.storageAccessKeyField = 'accessKeyId'; this.storageSecretKeyField = 'secretAccessKey'; this.storagePathStyle = true; this.reason = ''; }
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
    if (this.kind === 'objectStorage' && this.storageType === 's3Compatible') { if (this.storageEndpoint.trim()) storage.endpoint = this.storageEndpoint.trim(); storage.enablePathStyleAddressing = this.storagePathStyle; }
    return { namespace: this.namespace, kind: this.kind, name, reason, spec: { type: this.storageType, [this.storageType]: storage } };
  }
  async loadPreview(): Promise<void> { try { this.editorError.set(''); this.preview.set(await this.fleet.previewProfile(this.draft())); } catch (error: any) { this.preview.set(null); this.editorError.set(error?.message || String(error)); } }
  async apply(): Promise<void> { try { this.saving = true; this.editorError.set(''); await this.fleet.applyProfile(this.draft()); this.editorOpen = false; } catch (error: any) { this.editorError.set(error?.message || String(error)); } finally { this.saving = false; } }
  async remove(): Promise<void> { const profile = this.deleting(); if (!profile) return; try { this.saving = true; this.editorError.set(''); await this.fleet.deleteProfile(this.namespace, profile.kind, profile.name, this.deleteReason, this.deleteConfirm); this.deleteOpen = false; } catch (error: any) { this.editorError.set(error?.message || String(error)); } finally { this.saving = false; } }
  previewText(result: any): string { return JSON.stringify({ operation: result.operation, resource: result.resource, impact: result.impact }, null, 2); }
}
