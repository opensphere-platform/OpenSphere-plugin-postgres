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
const BACKBLAZE_LOGO_PATH = 'M9.3108.0003c.6527 1.3502 1.5666 4.0812-1.3887 7.1738-1.8096 1.8796-3.078 3.8487-2.3496 6.0644.3642 1.1037 1.1864 2.5079 2.8867 2.7852.6107.1008 1.3425-.0006 1.7403-.1406 2.4538-.8544 2.098-3.4138 1.5546-5.0469-.07-.2129-.1915-.7333-.2363-.9238-.3726-1.6023.776-2.6562 1.129-3.8047.028-.0925.0534-.1819.0702-.2715.042-.21.067-.423.0781-.6387 0-1.8264-.9882-2.6303-1.7754-3.5996C10.1794.5643 9.3107.0003 9.3107.0003Zm6.2754 6.0175s-.709.3366-1.2188.8829c-.4454.4818-.8635.8789-1.2949 1.8593-.028.14-.0518.2863-.0742.4375-.2325 1.6416 1.1473 3.1446.7187 5.1895-.112.535-.3554.7123-.7812 1.6367-.5098 1.1065-.383 2.588.3594 3.5293.6723.8488 1.879 1.2321 3.0527.9492 2.1065-.5042 3.0646-2.2822 2.8965-4.2851-.1317-1.58-.8154-2.7536-2.754-4.961-.9607-1.0925-1.6072-2.409-1.5624-3.4062.1373-1.2074.6582-1.832.6582-1.832zM4.8928 15.1936c-.0222.0145-.0439.0614-.0586.1602a.0469.0469 0 0 1-.0059.0195v.01c-.1148.5406-.1649 1.823.1153 2.9687.353 1.4427 1.4175 3.902 4.412 5.129 2.5184 1.0336 5.718.5411 7.8497-1.627.5294-.5435.408-.4897-.4883-.2012v-.002c-1.1121.3558-3.5182.5463-4.7676-1-1.5239-1.8852-.4302-3.3633-1.3574-3.1504-3.6164.8348-5.2667-1.4657-5.5469-2.1016-.0023-.002-.0857-.2487-.1523-.205z';
const CEPH_LOGO_PATH = 'M11.959.257A11.912 11.912 0 003.503 3.76 11.92 11.92 0 000 12.217a11.934 11.934 0 001.207 5.243c.72 1.474 1.888 2.944 3.208 4.044.86-.47 1.35-.99 1.453-1.545.1-.533-.134-1.107-.737-1.805a9.031 9.031 0 01-2.219-5.937c0-4.988 4.058-9.047 9.047-9.047h.08c4.99 0 9.048 4.059 9.048 9.047a9.03 9.03 0 01-2.218 5.936c-.599.693-.84 1.292-.735 1.83.108.556.595 1.068 1.449 1.522 1.322-1.1 2.489-2.57 3.209-4.046A11.898 11.898 0 0024 12.217a11.929 11.929 0 00-3.503-8.457A11.923 11.923 0 0012.04.257h-.041zm-.005 4.837a7.072 7.072 0 00-3.76 1.075A7.202 7.202 0 006.15 8.093a7.164 7.164 0 00-1.161 2.65 7.188 7.188 0 00.04 3.125 7.14 7.14 0 001.22 2.607c.154.207.326.396.509.597l.185.202.005.006c.007.007.017.016.026.027.635.738.957 1.533.957 2.36a3.4 3.4 0 01-1.788 2.989 11.924 11.924 0 002.685 1.087c.14-.088.614-.441 1.077-1.083a4.899 4.899 0 00.94-2.99 6.595 6.595 0 00-.49-2.37 6.717 6.717 0 00-1.302-2.033l-.002-.004-.124-.142c-.21-.245-.428-.497-.602-.792a4.104 4.104 0 01-.462-1.135 4.258 4.258 0 01-.024-1.85 4.25 4.25 0 01.686-1.564 4.216 4.216 0 013.432-1.773H12.042a4.202 4.202 0 013.432 1.773c.33.466.568 1.007.686 1.565a4.27 4.27 0 01-.023 1.849c-.093.39-.249.772-.463 1.135-.173.295-.391.547-.602.792l-.123.142-.004.004a6.736 6.736 0 00-1.301 2.033 6.607 6.607 0 00-.49 2.37 4.897 4.897 0 00.94 2.99c.463.642.937.995 1.076 1.083a11.776 11.776 0 002.687-1.087 3.399 3.399 0 01-1.789-2.988c0-.817.313-1.59.956-2.359.009-.012.02-.022.027-.03l.006-.004.184-.204c.183-.2.355-.39.51-.596a7.14 7.14 0 001.22-2.608 7.21 7.21 0 00.04-3.124 7.185 7.185 0 00-1.16-2.65 7.203 7.203 0 00-2.044-1.924 7.074 7.074 0 00-3.762-1.075h-.09zM12 9.97a2.365 2.365 0 00-2.362 2.361A2.364 2.364 0 0012 14.691c1.301 0 2.36-1.059 2.36-2.36A2.364 2.364 0 0012 9.968z';

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
    .pgpc-target-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:.65rem; margin-top:.75rem; }
    .pgpc-target { min-width:0; padding:.7rem .8rem; border:1px solid #d6d9dc; background:#fff; }
    .pgpc-target-head { display:grid; grid-template-columns:1.75rem minmax(0,1fr) auto; align-items:start; gap:.6rem; padding-bottom:.55rem; border-bottom:1px solid #e0e0e0; }
    .pgpc-target-logo { display:grid; place-items:center; width:1.75rem; height:1.75rem; color:#6f6f6f; }.pgpc-target-logo svg { width:1.35rem; height:1.35rem; fill:currentColor; }.pgpc-target-logo.backblaze { color:#e21e29; }.pgpc-target-logo.ceph { color:#ef5c55; }
    .pgpc-target-title { display:grid; gap:.08rem; min-width:0; }.pgpc-target-title small { color:#6f6f6f; font-size:.58rem; font-weight:500; letter-spacing:.02em; text-transform:uppercase; }.pgpc-target-title b { overflow:hidden; font-size:.8rem; text-overflow:ellipsis; white-space:nowrap; }
    .pgpc-target-badges { display:flex; gap:.25rem; align-items:center; }.pgpc-target-badges .label { margin:0; }
    .pgpc-target dl { display:grid; gap:0; margin:.35rem 0 0; }.pgpc-target dl div { display:grid; grid-template-columns:4.4rem minmax(0,1fr); gap:.5rem; padding:.22rem 0; }.pgpc-target dt { color:#6f6f6f; font-size:.6rem; font-weight:400; }.pgpc-target dd { overflow:hidden; margin:0; font: .6rem/1.35 var(--clr-font-mono); text-overflow:ellipsis; white-space:nowrap; }
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
          <article class="pgpc-target" *ngFor="let target of fleet.backupTargets()">
            <div class="pgpc-target-head">
              <span class="pgpc-target-logo" [ngClass]="backupTargetBrand(target)">
                <svg *ngIf="backupTargetBrand(target)!=='generic'" role="img" viewBox="0 0 24 24"><title>{{ backupTargetVendorLabel(target) }}</title><path [attr.d]="backupTargetLogoPath(target)" /></svg>
                <os-cicon *ngIf="backupTargetBrand(target)==='generic'" [icon]="CloudIcon" [size]="18"></os-cicon>
              </span>
              <div class="pgpc-target-title"><small>S3 · {{ backupTargetVendorLabel(target) }}</small><b>{{ target.name }}</b></div>
              <div class="pgpc-target-badges"><span class="label" [class.label-success]="target.enabled" [class.label-warning]="!target.enabled">{{ target.enabled ? '활성' : '중지' }}</span><span class="label" [class.label-success]="backupTargetReady(target)" [class.label-danger]="!backupTargetReady(target)">{{ target.healthState }}</span></div>
            </div>
            <dl><div><dt>Endpoint</dt><dd>{{ target.endpoint }}</dd></div><div><dt>Bucket</dt><dd>{{ target.bucketName }} · {{ target.region || 'default' }}</dd></div></dl>
          </article>
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
  profileCount(kind: CatalogFilter): number | string {
    if (kind === 'objectStorage') {
      const targets = this.fleet.backupTargets();
      return `${targets.filter((target) => this.backupTargetReady(target)).length}/${targets.length}`;
    }
    return kind === 'all' ? this.profiles().length : this.profiles().filter((profile) => profile.kind === kind).length;
  }
  selectedCategoryLabel(): string { return this.categories.find((category) => category.id === this.selectedCategory())?.label || '전체'; }
  kindLabel(kind: EditorKind): string { return ({ instance: '인스턴스 자원', postgres: 'PostgreSQL 설정', pooling: '연결 풀링', objectStorage: '백업 저장소' })[kind]; }
  kindIcon(kind: EditorKind): any { return ({ instance: BareMetalServer16, postgres: DataBase16, pooling: Connection16, objectStorage: Cloud16 })[kind]; }
  backupTargetReady(target: ExternalBackupTarget): boolean { return target.enabled && target.healthState === 'Ready' && target.credential.configured; }
  backupTargetLabel(target: ExternalBackupTarget): string { return this.backupTargetReady(target) ? `Ready · Credential v${target.credential.version}` : `${target.healthState} · ${target.credential.configured ? 'Credential configured' : 'Credential missing'}`; }
  backupTargetBrand(target: ExternalBackupTarget): 'backblaze' | 'ceph' | 'generic' {
    const identity = `${target.vendor} ${target.provider} ${target.endpoint}`.toLowerCase();
    if (identity.includes('backblaze') || identity.includes('backblazeb2')) return 'backblaze';
    if (identity.includes('ceph') || identity.includes('rgw')) return 'ceph';
    return 'generic';
  }
  backupTargetVendorLabel(target: ExternalBackupTarget): string {
    const brand = this.backupTargetBrand(target);
    return brand === 'backblaze' ? 'BACKBLAZE B2' : brand === 'ceph' ? 'CEPH OBJECT GATEWAY (RGW)' : (target.vendor || target.provider || 'OBJECT STORAGE').toUpperCase();
  }
  backupTargetLogoPath(target: ExternalBackupTarget): string {
    return this.backupTargetBrand(target) === 'backblaze' ? BACKBLAZE_LOGO_PATH : CEPH_LOGO_PATH;
  }
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
