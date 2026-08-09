import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ClarityModule } from '@clr/angular';
import { CarbonIcon } from '../../carbon-icon';
import { apiBase, hostFetch } from '../../api-base';
import { FoundationRegistryService, PostgresInstallParameters } from '../../registry/foundation-registry.service';
import { ViewRouter } from '../../view-router';
import { CnpgService } from './cnpg.service';
import { PILL } from './cnpg.types';
import { PgOverviewTab } from './tabs/pg-overview.tab';
import { PgMonitoringTab } from './tabs/pg-monitoring.tab';
import { PgTopologyTab } from './tabs/pg-topology.tab';
import { PgConfigTab } from './tabs/pg-config.tab';
import { PgDatabasesTab } from './tabs/pg-databases.tab';
import { PgBackupsTab } from './tabs/pg-backups.tab';
import { PgEventsTab } from './tabs/pg-events.tab';
import { PgProfileCatalogTab } from './tabs/pg-profile-catalog.tab';
import { PgOperationsTab } from './tabs/pg-operations.tab';
import { PgAdminTab } from './admin/pg-admin.tab';
import { PgAdminService } from './admin/pg-admin.service';
import { PostgresFleetCluster, PostgresFleetService } from './postgres-fleet.service';
import ArrowLeft16 from '@carbon/icons/es/arrow--left/16';
import Renew16 from '@carbon/icons/es/renew/16';
import Add16 from '@carbon/icons/es/add/16';
import Catalog16 from '@carbon/icons/es/catalog/16';
import ListBoxes16 from '@carbon/icons/es/list--boxes/16';
import Settings16 from '@carbon/icons/es/settings/16';
import { PluginPageHeaderComponent, PluginPageHeaderModel, PluginPageTab, PluginTabsComponent } from '../../shared/plugin-page-shell.component';

type PackageTab = 'overview' | 'provisioning' | 'monitoring' | 'admin' | 'fleet' | 'operator' | 'cluster' | 'topology' | 'profiles' | 'config' | 'databases' | 'backups' | 'events' | 'claims' | 'operations' | 'upgrade' | 'documentation';
type Profile = 'development' | 'compact' | 'production' | 'custom';

interface StorageClassRow {
  name: string;
  provisioner: string;
  isDefault: boolean;
  allowExpansion: boolean;
  reclaimPolicy: string;
}

interface PgForm extends PostgresInstallParameters { profile: Profile }

const LOGO = 'https://logos.opl.io.kr/i/postgresql';
const MANUAL_SOURCE_ID = 'plugin:postgres/postgresql-operations-ko';
const DEFAULT_FORM: PgForm = {
  profile: 'development',
  instances: 1,
  imageTag: '18',
  namespace: 'opensphere-foundation',
  storageClass: 'standard',
  storageSize: '10Gi',
  walStorageSize: '',
  resourceProfile: 'small',
  cpuRequest: '250m',
  memoryRequest: '512Mi',
  cpuLimit: '1',
  memoryLimit: '1Gi',
  poolerEnabled: false,
  poolerMode: 'transaction',
  poolerInstances: 1,
  enableSuperuserAccess: false,
  monitoring: true,
  extensions: ['vector'],
  backup: { enabled: false, s3Endpoint: '', destinationPath: '', secretName: '', retentionPolicy: '30d' },
};

@Component({
  selector: 'app-postgres-plugin',
  standalone: true,
  styles: [':host { display: block; min-width: 0; }'],
  imports: [
    CommonModule, FormsModule, ClarityModule, CarbonIcon, PluginPageHeaderComponent, PluginTabsComponent,
    PgOverviewTab, PgMonitoringTab, PgTopologyTab, PgConfigTab, PgDatabasesTab, PgAdminTab, PgBackupsTab, PgEventsTab, PgProfileCatalogTab, PgOperationsTab,
  ],
  template: `
    <a class="vl-back" (click)="back()" (keydown.enter)="back()" role="button" tabindex="0">
      <os-cicon [icon]="iBack" [size]="16" /> PFS 모듈
    </a>

    <section class="pgp-page-frame" aria-label="PostgreSQL plugin 개요와 메뉴">
      <osp-plugin-page-header [model]="headerModel()" headingId="postgres-plugin-title">
        <div pluginHeaderContext class="pgp-header-context" aria-label="PostgreSQL 운영 컨텍스트">
          <div class="pgp-header-context-unit">
            <clr-select-container class="pgp-header-context-field">
              <label>Namespace</label>
              <select clrSelect name="postgresNamespace" aria-label="Namespace 선택"
                [ngModel]="selectedNamespace()" (ngModelChange)="selectNamespace($event)">
                <option *ngFor="let namespace of fleet.namespaces()" [ngValue]="namespace">{{ namespace }}</option>
              </select>
            </clr-select-container>
            <button class="btn btn-sm btn-link pgp-header-context-action" type="button"
              aria-label="Namespace 추가" title="Namespace 추가" (click)="openNamespaceModal()">추가</button>
          </div>
          <div class="pgp-header-context-unit">
            <clr-select-container class="pgp-header-context-field" *ngIf="namespaceClusters().length > 1">
              <label>PostgreSQL 인스턴스</label>
              <select clrSelect name="postgresInstance" aria-label="PostgreSQL 인스턴스 선택"
                [ngModel]="fleet.selectedId()" (ngModelChange)="selectFleetCluster($event)">
                <option *ngFor="let cluster of namespaceClusters()" [ngValue]="cluster.id">{{ cluster.displayName }}</option>
              </select>
            </clr-select-container>
            <button class="btn btn-sm btn-link pgp-header-context-refresh" type="button"
              aria-label="PostgreSQL 컨텍스트 새로고침" title="새로고침"
              (click)="refreshFleet()" [disabled]="fleet.busy()"><os-cicon [icon]="iRenew" [size]="16" /></button>
          </div>
        </div>
      </osp-plugin-page-header>
      <div class="pgp-navigation-row">
        <osp-plugin-tabs [tabs]="primaryTabsForUi()" [active]="primaryTab()" routeBase="/pfss/postgres" ariaLabel="PostgreSQL 운영 영역" (selected)="openPrimaryTab($event)" />
        <nav class="pgp-management-actions" aria-label="PostgreSQL 관리 작업">
          <a class="pgp-management-action" href="/pfss/postgres/fleet" aria-label="전체 클러스터" title="전체 클러스터" [class.active]="tab()==='fleet'"><os-cicon [icon]="iFleet" [size]="16" /><span>전체 클러스터</span></a>
          <a class="pgp-management-action" href="/pfss/postgres/profiles" aria-label="설정 카탈로그" title="설정 카탈로그" [class.active]="tab()==='profiles'"><os-cicon [icon]="iCatalog" [size]="16" /><span>설정 카탈로그</span></a>
          <a class="pgp-management-action pgp-management-action--primary" href="/pfss/postgres/provisioning" aria-label="PostgreSQL 생성" title="PostgreSQL 생성" [class.active]="tab()==='provisioning'"><os-cicon [icon]="iAdd" [size]="16" /><span>PostgreSQL 생성</span></a>
          <a class="pgp-management-action" href="/pfss/postgres/operator" aria-label="엔진 관리" title="엔진 관리" [class.active]="tab()==='operator'"><os-cicon [icon]="iSettings" [size]="16" /><span>엔진 관리</span></a>
        </nav>
      </div>
      <div class="pgp-subnav" *ngIf="secondaryTabsForUi().length">
        <span class="pgp-subnav-label">{{ primaryTabLabel() }}</span>
        <osp-plugin-tabs [tabs]="secondaryTabsForUi()" [active]="tab()" routeBase="/pfss/postgres" ariaLabel="선택한 운영 영역의 세부 메뉴" (selected)="openTab($event)" />
      </div>
      <div class="pgp-management-scope" *ngIf="isManagementView()">
        <span><b>관리 워크스페이스</b> · 운영 상태 탭과 분리된 Namespace/플랫폼 설정 영역입니다.</span>
        <button class="btn btn-sm btn-link" type="button" (click)="openTab('overview')">선택한 인스턴스로 돌아가기</button>
      </div>
    </section>

    <ng-container *ngIf="tab() === 'overview'">
      <section class="pgp-workspace pgp-workspace--full" aria-label="선택한 Namespace의 PostgreSQL">
        <clr-alert *ngIf="fleet.state()==='error'" clrAlertType="danger" [clrAlertClosable]="false"><clr-alert-item><span class="alert-text">{{fleet.error()}}</span></clr-alert-item></clr-alert>
        <div class="pgp-loading" *ngIf="fleet.busy() && fleet.state()==='loading'">Namespace와 PostgreSQL 클러스터를 확인하고 있습니다.</div>
        <article class="pgp-empty-state" *ngIf="!fleet.busy() && !selectedContextCluster()">
          <div class="pgp-empty-copy"><span class="vl-eyebrow">{{ selectedNamespace() }}</span><h2>이 Namespace에는 PostgreSQL이 없습니다</h2><p>전용 StackGres PostgreSQL을 설치하면 이 화면이 관리·모니터링 워크스페이스로 전환됩니다. 클러스터, 볼륨, 접속 자격증명과 수명주기는 다른 Claim과 공유하지 않습니다.</p></div>
          <div class="os-actions"><button class="btn btn-primary" type="button" (click)="openTab('provisioning')">PostgreSQL 인스턴스 생성</button><span class="os-dim">Provisioning에서 Plan과 StackGres Profile을 선택합니다.</span></div>
        </article>

      <ng-container *ngIf="selectedContextCluster() as selected">
        <section class="pgp-runtime-context" aria-label="선택한 PostgreSQL 운영 대상">
          <div><span>운영 대상</span><b>{{ selected.displayName }}</b><small>{{ selected.namespace }}</small></div>
          <div><span>수명주기</span><b [class.ok]="selected.ready">{{ selected.phase }}</b><small>{{ selected.readyInstances }} / {{ selected.instances }} instances ready</small></div>
          <div><span>운영 계약</span><b>{{ selected.plan || selected.mode }}</b><small>설정·생성 작업은 상단 관리 메뉴에서 수행합니다.</small></div>
        </section>

        <pg-overview part="monitoring" (jump)="openTab($event)"></pg-overview>

        <section class="pgp-dashboard">
          <article class="pgp-panel">
            <h2>Package readiness</h2><p>설치 수명주기의 실제 상태만 표시합니다.</p>
            <div class="pgp-status-list"><div><span>PFS Control Plane</span><b class="ok">Ready</b></div><div><span>{{ providerName(selected) }} Operator</span><b class="ok">Running</b></div><div><span>PostgreSQL Cluster</span><b [class.ok]="selected.ready">{{ selected.phase }}</b></div><div><span>Managed instances</span><b [class.ok]="selected.ready">{{ selected.readyInstances }} / {{ selected.instances }}</b></div></div>
            <button class="btn btn-sm" type="button" (click)="refreshAll()">상태 새로고침</button>
          </article>
          <article class="pgp-panel">
            <h2>Cluster health</h2><p>{{ providerName(selected) }}가 보고한 인스턴스 가용성과 현재 Primary입니다.</p>
            <div class="pgp-health"><strong>{{ clusterAvailability(selected) }}%</strong><span>instances ready</span><progress [value]="selected.readyInstances" [max]="selected.instances || 1" aria-label="PostgreSQL 인스턴스 가용성"></progress></div>
            <dl class="os-kv"><dt>Primary</dt><dd class="os-mono">{{ pg.primary() || '—' }}</dd><dt>Storage</dt><dd>{{ pg.storage() }} · {{ pg.storageClass() }}</dd><dt>Image</dt><dd class="os-mono">{{ pg.image() || '—' }}</dd></dl>
          </article>
          <article class="pgp-panel">
            <h2>Operations policy</h2><p>생성 선언에 포함된 보호·접속·관측 정책입니다.</p>
            <div class="pgp-policy-grid"><div><span>TLS</span><b class="ok">{{ providerName(selected) }} managed</b></div><div><span>Monitoring</span><b [class.ok]="pg.monitoringEnabled()">{{ pg.monitoringEnabled() ? 'Enabled' : 'Disabled' }}</b></div><div><span>Backup</span><b [class.ok]="pg.backupConfigured()">{{ pg.backupConfigured() ? 'Configured' : 'Not configured' }}</b></div><div><span>Access</span><b class="ok">Secret governed</b></div><div><span>Plan</span><b>{{ selected.plan || selected.mode }}</b></div><div><span>Database</span><button class="btn btn-sm btn-link" type="button" (click)="openSelectedAdmin()">pgAdmin</button></div></div>
          </article>
        </section>

        <pg-overview part="details" (jump)="openTab($event)"></pg-overview>

        <section class="pgp-description"><div><h2>Description</h2><p>PostgreSQL plugin은 선택한 Namespace의 StackGres SGCluster를 기준으로 토폴로지, 설정, 데이터베이스·역할, 백업, 이벤트와 Claim을 관리합니다. 모든 PostgreSQL 인스턴스는 동일한 StackGres 수명주기로 운영됩니다.</p></div><div><h2>Documentation</h2><a [href]="manualUrl">OpenSphere PostgreSQL 멀티 인스턴스 운영 안내서 (한글)</a><a [href]="providerDocsUrl()" target="_blank" rel="noreferrer">{{ providerDocsLabel() }}</a><a [href]="postgresDocsUrl()" target="_blank" rel="noreferrer">PostgreSQL {{documentationVersion()}} documentation</a><button class="btn btn-sm btn-link" type="button" (click)="openTab('cluster')">OpenSphere 설치 계약 보기</button></div></section>
      </ng-container>
      <clr-alert *ngIf="claimResult" [clrAlertType]="claimFailed?'danger':'success'" [clrAlertClosable]="false"><clr-alert-item><span class="alert-text">{{claimResult}}</span></clr-alert-item></clr-alert>
      </section>
    </ng-container>

    <section *ngIf="tab() === 'provisioning'" class="pgp-workspace pgp-workspace--full" aria-label="PostgreSQL 인스턴스 생성">
      <div class="pgp-section-head">
        <div><span class="vl-eyebrow">Namespace-scoped provisioning</span><h2>PostgreSQL 인스턴스 생성</h2><p><b>{{ selectedNamespace() }}</b> Namespace에 독립된 PostgreSQL 인스턴스를 생성합니다. Plan은 운영 기준을, Profile은 StackGres 런타임 설정을 결정합니다.</p></div>
        <span class="label label-info">PostgresClaim v1beta1</span>
      </div>
      <div class="pgp-provider-flow" aria-label="PostgreSQL 프로비저닝 흐름">
        <div><span>1</span><b>기본 정보</b><small>Namespace · Database · Owner</small></div><i>→</i><div><span>2</span><b>운영 계약</b><small>Plan · Version · Storage</small></div><i>→</i><div><span>3</span><b>엔진 설정</b><small>Profile · Backup · Pooling</small></div><i>→</i><div><span>4</span><b>검토·생성</b><small>PostgresClaim 선언</small></div>
      </div>
      <form class="pgp-form pgp-provisioning-form" (ngSubmit)="createDedicatedCluster()">
        <fieldset [disabled]="creatingClaim">
          <legend>인스턴스 식별</legend>
          <div class="pgp-form-grid">
            <label><span>Namespace</span><input name="claimNamespace" [value]="selectedNamespace()" disabled /><small>상단 Namespace 선택과 동일합니다.</small></label>
            <label><span>인스턴스 이름</span><input name="claimName" [(ngModel)]="claimName" placeholder="orders-postgres" required /></label>
            <label><span>초기 Database</span><input name="claimDatabase" [(ngModel)]="claimDatabase" placeholder="orders" required /></label>
            <label><span>Owner role</span><input name="claimOwner" [(ngModel)]="claimOwner" placeholder="orders_app" required /></label>
          </div>
        </fieldset>
        <fieldset [disabled]="creatingClaim">
          <legend>운영 Plan</legend>
          <div class="pgp-form-grid">
            <label><span>Plan</span><select name="claimPlan" [(ngModel)]="claimPlan"><option *ngFor="let plan of fleet.plans()" [value]="plan.metadata?.name">{{ plan.metadata?.name }} · {{ plan.spec?.displayName || plan.spec?.description || 'PostgreSQL' }}</option><option *ngIf="!fleet.plans().length" value="postgresql-dev-single">postgresql-dev-single</option></select><small>인스턴스 수, 스토리지와 기본 보호 정책의 승인된 조합입니다.</small></label>
            <label><span>실행 엔진</span><input name="claimEngine" value="StackGres" disabled /><small>PFSS PostgreSQL의 단일 운영 엔진입니다.</small></label>
            <label><span>PostgreSQL major</span><input name="claimVersion" [(ngModel)]="claimVersion" placeholder="18" /><small>비워 두면 Plan 기본 버전을 사용합니다.</small></label>
            <label><span>삭제 정책</span><select name="claimDeletionPolicy" [(ngModel)]="claimDeletionPolicy"><option value="Retain">Retain · 데이터 보존</option><option value="Delete">Delete · 인스턴스와 함께 제거</option></select><small>Claim 삭제 시 데이터 수명주기입니다.</small></label>
          </div>
        </fieldset>
        <fieldset [disabled]="creatingClaim">
          <legend>스토리지 override <small>비워 두면 Plan 기본값을 사용합니다.</small></legend>
          <div class="pgp-form-grid">
            <label><span>Data volume</span><input name="claimStorageSize" [(ngModel)]="claimStorageSize" placeholder="예: 50Gi" /><small>Gi 또는 Ti 단위의 PVC 용량</small></label>
            <label><span>StorageClass</span><select name="claimStorageClass" [(ngModel)]="claimStorageClass"><option value="">Plan 기본값</option><option *ngFor="let storageClass of storageClasses()" [value]="storageClass.name">{{ storageClass.name }}{{ storageClass.isDefault ? ' · default' : '' }}</option></select><small>클러스터에서 확인된 StorageClass</small></label>
          </div>
        </fieldset>
        <fieldset [disabled]="creatingClaim">
          <legend>StackGres Profile 연결 <small>선택하지 않으면 Plan 기본값을 사용합니다.</small></legend>
          <div class="pgp-form-grid">
            <label><span>Instance Profile</span><select name="claimInstanceProfile" [(ngModel)]="claimInstanceProfile"><option value="">Plan 기본값</option><option *ngFor="let profile of profilesFor('instance')" [value]="profile.name">{{ profile.name }} · {{ profileSummary(profile) }}</option></select><small>CPU와 Memory request/limit</small></label>
            <label><span>PostgreSQL Profile</span><select name="claimPostgresProfile" [(ngModel)]="claimPostgresProfile"><option value="">Plan 기본값</option><option *ngFor="let profile of profilesFor('postgres')" [value]="profile.name">{{ profile.name }} · {{ profileSummary(profile) }}</option></select><small>PostgreSQL 버전과 postgresql.conf</small></label>
            <label><span>Pooling Profile</span><select name="claimPoolingProfile" [(ngModel)]="claimPoolingProfile"><option value="">사용 안 함 / Plan 기본값</option><option *ngFor="let profile of profilesFor('pooling')" [value]="profile.name">{{ profile.name }} · {{ profileSummary(profile) }}</option></select><small>PgBouncer 연결 풀 정책</small></label>
            <label><span>백업 Object Storage</span><select name="claimObjectStorageProfile" [(ngModel)]="claimObjectStorageProfile"><option value="">백업 사용 안 함 / Plan 기본값</option><option *ngFor="let profile of profilesFor('objectStorage')" [value]="profile.name">{{ profile.name }} · {{ profileSummary(profile) }}</option></select><small>External Channels에서 등록한 백업 대상을 설정 카탈로그에 연결합니다.</small></label>
          </div>
        </fieldset>
        <clr-alert *ngIf="claimResult" [clrAlertType]="claimFailed?'danger':'success'" [clrAlertClosable]="false"><clr-alert-item><span class="alert-text">{{claimResult}}</span></clr-alert-item></clr-alert>
        <div class="os-actions"><button class="btn btn-primary" type="submit" [disabled]="creatingClaim || !claimName.trim() || !claimDatabase.trim() || !claimOwner.trim()">PostgreSQL 인스턴스 생성</button><button class="btn" type="button" (click)="previewClaim()" [disabled]="!claimName.trim()">YAML 미리보기</button><button class="btn btn-link" type="button" (click)="openTab('profiles')">Profile 관리</button></div>
      </form>
      <pre class="pgp-yaml-preview" *ngIf="claimYamlPreview()" aria-label="PostgresClaim YAML 미리보기">{{ claimYamlPreview() }}</pre>
      <section class="pgp-provisioned" *ngIf="namespaceClusters().length"><h3>이 Namespace의 인스턴스</h3><div class="pgp-operator-grid"><button class="card" type="button" *ngFor="let cluster of namespaceClusters()" (click)="selectFleetClusterAndOpen(cluster.id)"><div class="card-header">{{cluster.displayName}} <span class="label" [ngClass]="cluster.ready?'label-success':'label-warning'">{{cluster.phase}}</span></div><div class="card-block"><dl class="os-kv"><dt>Plan</dt><dd>{{cluster.plan || '—'}}</dd><dt>Instances</dt><dd>{{cluster.readyInstances}} / {{cluster.instances}}</dd><dt>Storage</dt><dd>{{cluster.storage || '—'}}</dd></dl></div></button></div></section>
    </section>

    <section *ngIf="tab() === 'fleet'" class="pgp-workspace" aria-label="PostgreSQL Fleet overview">
      <div class="pgp-section-head"><div><span class="vl-eyebrow">Secondary view</span><h2>PFSS PostgreSQL Fleet</h2><p>모든 Namespace의 PostgreSQL을 확인합니다. 운영 대상 선택은 상단 Namespace 컨텍스트를 기준으로 합니다.</p></div><button class="btn btn-sm" type="button" (click)="refreshFleet()" [disabled]="fleet.busy()">새로고침</button></div>
      <clr-alert clrAlertType="info" [clrAlertClosable]="false"><clr-alert-item><span class="alert-text">모든 PostgresClaim은 독립 StackGres SGCluster, 볼륨, 앱 자격증명과 수명주기를 가집니다.</span></clr-alert-item></clr-alert>
      <div class="pgp-operator-grid" *ngIf="fleet.clusters().length; else noFleetClusters">
        <button type="button" class="card" *ngFor="let cluster of fleet.clusters()" (click)="selectFleetClusterAndOpen(cluster.id)" [class.pgp-selected-card]="fleet.selectedId()===cluster.id"><div class="card-header">{{cluster.displayName}} <span class="label" [ngClass]="cluster.ready?'label-success':'label-warning'">{{cluster.phase}}</span></div><div class="card-block"><dl class="os-kv"><dt>Provider</dt><dd>{{cluster.provider}}</dd><dt>Mode</dt><dd>{{cluster.mode}}</dd><dt>Namespace</dt><dd class="os-mono">{{cluster.namespace}}</dd><dt>Instances</dt><dd>{{cluster.readyInstances}} / {{cluster.instances}}</dd><dt>Storage</dt><dd>{{cluster.storage || '—'}}</dd></dl></div></button>
      </div>
      <ng-template #noFleetClusters><div class="pgp-loading">등록된 PostgreSQL 클러스터가 없습니다. 상단에서 Namespace를 선택해 설치할 수 있습니다.</div></ng-template>
    </section>

    <pg-monitoring *ngIf="tab() === 'monitoring' && hasSelectedCluster()"></pg-monitoring>

    <clr-modal [(clrModalOpen)]="namespaceModalOpen" [clrModalClosable]="!creatingNamespace">
      <h3 class="modal-title">Namespace 추가</h3>
      <div class="modal-body"><p>PostgreSQL fleet에서 사용할 Kubernetes Namespace를 생성합니다.</p><form class="pgp-form" (ngSubmit)="createNamespace()"><div class="pgp-form-grid pgp-namespace-form"><label><span>Namespace</span><input name="newNamespaceName" [(ngModel)]="newNamespaceName" placeholder="team-orders" /></label><label><span>생성 사유</span><input name="newNamespaceReason" [(ngModel)]="newNamespaceReason" placeholder="운영 변경 사유(8자 이상)" /></label></div></form><clr-alert *ngIf="namespaceError" clrAlertType="danger" [clrAlertClosable]="false"><clr-alert-item><span class="alert-text">{{ namespaceError }}</span></clr-alert-item></clr-alert></div>
      <div class="modal-footer"><button class="btn btn-outline" type="button" (click)="namespaceModalOpen=false" [disabled]="creatingNamespace">취소</button><button class="btn btn-primary" type="button" (click)="createNamespace()" [disabled]="creatingNamespace||!newNamespaceName.trim()||newNamespaceReason.trim().length<8">Namespace 생성</button></div>
    </clr-modal>

    <section *ngIf="tab() === 'operator'" class="pgp-workspace pgp-workspace--full">
      <div class="pgp-provider-banner"><div><span class="vl-eyebrow">PostgreSQL operating provider</span><h2>StackGres Operator</h2><p>클러스터 생성·복구·백업·확장과 PostgreSQL 설정 적용을 담당하는 플랫폼 제어 계층입니다.</p></div><div class="pgp-provider-version"><small>Operator</small><b>{{ operatorVersion() }}</b><span>Platform scope</span></div></div>
      <div class="pgp-section-head"><div><h3>Operator control areas</h3><p>StackGres 제어판의 구성을 OpenSphere 운영 규칙에 맞춰 확인합니다.</p></div><button class="btn btn-sm" type="button" (click)="refreshOperator()">새로고침</button></div>
      <clr-alert *ngIf="fleet.operatorError()" clrAlertType="danger" [clrAlertClosable]="false"><clr-alert-item><span class="alert-text">{{ fleet.operatorError() }}</span></clr-alert-item></clr-alert>
      <div class="pgp-loading" *ngIf="fleet.operatorState()==='loading'">StackGres Operator 구성을 확인하고 있습니다.</div>
      <div class="pgp-control-area-grid" *ngIf="fleet.operator() as operator"><article><span>Admin UI & API</span><b>{{operator.config?.spec?.deploy?.restapi ? 'REST API enabled' : 'Console integrated'}}</b><small>OpenSphere Console에서 제어</small></article><article><span>Authentication</span><b>{{operator.config?.spec?.authentication?.type || 'Platform identity'}}</b><small>Console 권한 정책 적용</small></article><article><span>Certificates</span><b>{{operator.config?.spec?.cert?.autoApprove ? 'Auto managed' : 'Operator managed'}}</b><small>TLS 수명주기</small></article><article><span>Container Registry</span><b>{{operator.config?.spec?.containerRegistry || 'Operator default'}}</b><small>PostgreSQL 이미지 공급원</small></article><article><span>Extensions</span><b>{{operator.config?.spec?.extensions?.refreshEnabled ? 'Refresh enabled' : 'Catalog managed'}}</b><small>확장 카탈로그 정책</small></article><article><span>Grafana</span><b>{{operator.config?.spec?.grafana?.autoEmbed ? 'Embedded' : 'External integration'}}</b><small>관측 화면 연결</small></article><article><span>Image pull policy</span><b>{{operator.config?.spec?.imagePullPolicy || 'IfNotPresent'}}</b><small>워크로드 이미지 정책</small></article><article><span>Jobs</span><b>{{operator.config?.spec?.jobs?.annotations ? 'Customized' : 'Operator default'}}</b><small>백업·복구·유지보수 작업</small></article><article><span>Service account</span><b>{{operator.config?.spec?.serviceAccount?.create ? 'Operator managed' : 'Platform managed'}}</b><small>{{operator.config?.metadata?.namespace || 'stackgres'}}</small></article></div>
      <article class="pgp-selected-target" *ngIf="selectedContextCluster() as selected"><div><span class="vl-eyebrow">Selected runtime target</span><h3>{{selected.displayName}}</h3></div><dl class="os-kv"><dt>Namespace</dt><dd class="os-mono">{{selected.namespace}}</dd><dt>Cluster resource</dt><dd class="os-mono">SGCluster/{{selected.name}}</dd><dt>Instance profile</dt><dd class="os-mono">{{pg.cluster()?.spec?.sgInstanceProfile || 'Plan default'}}</dd><dt>Lifecycle</dt><dd>{{selected.phase}}</dd></dl></article>
      <clr-alert clrAlertType="info" [clrAlertClosable]="false"><clr-alert-item><span class="alert-text">Operator 설정은 플랫폼 범위이며 Namespace별 Cluster Profile과 다릅니다. 편집 기능은 승인·영향 분석과 함께 별도 단계로 제공합니다.</span></clr-alert-item></clr-alert>
    </section>

    <section *ngIf="false" class="pgp-workspace">
      <div class="pgp-section-head"><div><span class="vl-eyebrow">Desired state</span><h2>PostgreSQL Cluster 구성</h2></div><span class="label" [ngClass]="clusterExists() ? 'label-success' : 'label-warning'">{{ clusterExists() ? 'Managed' : 'Not created' }}</span></div>
      <clr-alert *ngIf="false" clrAlertType="warning" [clrAlertClosable]="false"><clr-alert-item><span class="alert-text">Cluster plan을 먼저 선택해야 합니다.</span></clr-alert-item></clr-alert>

      <form class="pgp-form" (ngSubmit)="applyCluster()">
        <fieldset [disabled]="applying()">
          <legend>Topology & version</legend>
          <div class="pgp-form-grid">
            <label><span>운영 프로파일</span><select name="profile" [ngModel]="form().profile" (ngModelChange)="setProfile($event)"><option value="development">Development · 1 instance</option><option value="compact">Compact HA · 2 instances</option><option value="production">Production HA · 3 instances</option><option value="custom">Custom</option></select></label>
            <label><span>PostgreSQL major</span><input name="imageTag" value="18" disabled /></label>
            <label><span>Instances</span><input name="instances" type="number" min="1" max="9" [ngModel]="form().instances" (ngModelChange)="patchForm({ instances: +$event, profile: 'custom' })" /></label>
            <label><span>Resource profile</span><select name="resourceProfile" [ngModel]="form().resourceProfile" (ngModelChange)="setResourceProfile($event)"><option value="small">Small · 250m / 512Mi</option><option value="medium">Medium · 500m / 1Gi</option><option value="large">Large · 1 / 2Gi</option></select></label>
          </div>
          <clr-alert *ngIf="form().profile==='compact'" clrAlertType="info" [clrAlertClosable]="false"><clr-alert-item><span class="alert-text">Compact HA는 Primary 1개와 Standby 1개를 사용합니다. 한 인스턴스에 장애가 발생하면 복구될 때까지 단일 인스턴스로 운영됩니다.</span></clr-alert-item></clr-alert>
        </fieldset>

        <fieldset [disabled]="applying()">
          <legend>Persistent storage</legend>
          <div class="pgp-form-grid">
            <label><span>StorageClass</span><select name="storageClass" [ngModel]="form().storageClass" (ngModelChange)="patchForm({ storageClass: $event })" [disabled]="clusterExists()"><option *ngFor="let sc of storageClasses()" [value]="sc.name">{{ sc.name }}{{ sc.isDefault ? ' (default)' : '' }}</option></select><small>{{ selectedStorageHint() }}</small></label>
            <label><span>Data volume</span><input name="storageSize" [ngModel]="form().storageSize" (ngModelChange)="patchForm({ storageSize: $event })" placeholder="10Gi" /><small>기존 PVC는 증가만 허용될 수 있습니다.</small></label>
            <label><span>WAL volume</span><input name="walStorageSize" [ngModel]="form().walStorageSize" (ngModelChange)="patchForm({ walStorageSize: $event })" placeholder="비우면 data volume 공유" /></label>
            <label><span>Namespace</span><input name="namespace" [ngModel]="form().namespace" disabled /></label>
          </div>
        </fieldset>

        <fieldset [disabled]="applying()">
          <legend>Operations policy</legend>
          <div class="pgp-check-grid">
            <label><input type="checkbox" name="monitoring" [ngModel]="form().monitoring" (ngModelChange)="patchForm({ monitoring: $event })" /> PodMonitor 활성화</label>
            <label><input type="checkbox" name="pooler" [ngModel]="form().poolerEnabled" (ngModelChange)="patchForm({ poolerEnabled: $event })" /> PgBouncer Pooler</label>
            <label><input type="checkbox" name="superuser" [ngModel]="form().enableSuperuserAccess" (ngModelChange)="patchForm({ enableSuperuserAccess: $event })" /> superuser 외부 접근</label>
            <label><input type="checkbox" name="backup" [ngModel]="form().backup.enabled" (ngModelChange)="patchBackup({ enabled: $event })" /> S3 연속 백업</label>
          </div>
          <div class="pgp-form-grid" *ngIf="form().backup.enabled">
            <label><span>S3 endpoint</span><input name="s3Endpoint" [ngModel]="form().backup.s3Endpoint" (ngModelChange)="patchBackup({ s3Endpoint: $event })" placeholder="https://s3.example.com" /></label>
            <label><span>Destination</span><input name="destinationPath" [ngModel]="form().backup.destinationPath" (ngModelChange)="patchBackup({ destinationPath: $event })" placeholder="s3://bucket/foundation-pg" /></label>
            <label><span>Credentials Secret</span><input name="secretName" [ngModel]="form().backup.secretName" (ngModelChange)="patchBackup({ secretName: $event })" placeholder="stackgres-backup-credentials" /></label>
            <label><span>Retention</span><input name="retentionPolicy" [ngModel]="form().backup.retentionPolicy" (ngModelChange)="patchBackup({ retentionPolicy: $event })" placeholder="30d" /></label>
          </div>
        </fieldset>

        <clr-alert *ngIf="validationError()" clrAlertType="danger" [clrAlertClosable]="false"><clr-alert-item><span class="alert-text">{{ validationError() }}</span></clr-alert-item></clr-alert>
        <div class="os-actions">
          <button class="btn btn-primary" type="submit" [disabled]="!canApply()">{{ clusterExists() ? '운영 구성 적용' : 'PostgreSQL Cluster 생성' }}</button>
          <span class="os-dim">FoundationModel/data → control-plane SSA → Cluster/{{ pg.name }}</span>
        </div>
      </form>

      <div class="vl-progress-wrap" *ngIf="applyState() !== 'idle'">
        <div class="vl-progress-head"><span>{{ applyState() === 'error' ? '설치 실패' : applyState() === 'done' ? 'Cluster 준비 완료' : 'Cluster 적용 진행' }}</span><span class="vl-progress-pct">{{ applyProgress() }}%</span></div>
        <div class="vl-progress-track"><div class="vl-progress-bar" [class.pgp-progress-error]="applyState() === 'error'" [style.width.%]="applyProgress()"></div></div>
        <div class="vl-log"><div class="vl-log-line" *ngFor="let line of applyLogs()">{{ line }}</div></div>
      </div>
    </section>

    <section *ngIf="tab() === 'cluster' && selectedContextCluster() as selected" class="pgp-workspace">
      <div class="pgp-section-head"><div><span class="vl-eyebrow">Desired state</span><h2>PostgreSQL Cluster plan</h2><p>PostgresClaim과 AddonPlan으로 선언된 전용 StackGres 클러스터 구성입니다.</p></div><span class="label" [ngClass]="selected.ready ? 'label-success' : 'label-warning'">{{selected.phase}}</span></div>
      <div class="pgp-dashboard"><article class="pgp-panel"><h2>Plan</h2><dl class="os-kv"><dt>Name</dt><dd>{{selected.plan || '—'}}</dd><dt>Instances</dt><dd>{{selected.instances}}</dd><dt>PostgreSQL</dt><dd>{{selected.postgresVersion || '—'}}</dd></dl></article><article class="pgp-panel"><h2>Storage</h2><dl class="os-kv"><dt>Capacity</dt><dd>{{selected.storage || '—'}}</dd><dt>Isolation</dt><dd>{{selected.mode}}</dd><dt>Lifecycle</dt><dd>Dedicated SGCluster</dd></dl></article><article class="pgp-panel"><h2>Binding</h2><dl class="os-kv"><dt>Secret</dt><dd class="os-mono">{{selected.bindingSecret || '—'}}</dd><dt>Namespace</dt><dd class="os-mono">{{selected.namespace}}</dd><dt>Resource</dt><dd class="os-mono">{{selected.name}}</dd></dl></article></div>
      <clr-alert clrAlertType="info" [clrAlertClosable]="false"><clr-alert-item><span class="alert-text">Plan은 승인된 운영 조합이고, Profile은 실제 StackGres 설정의 정본입니다. Profile 변경은 적용 전에 영향과 재시작 필요성을 검토합니다.</span></clr-alert-item></clr-alert>
      <button class="btn btn-sm" type="button" (click)="openTab('profiles')">Profiles & Configuration 열기</button>
    </section>

    <section *ngIf="tab() === 'profiles'" class="pgp-workspace pgp-workspace--full">
      <pg-profile-catalog [namespace]="selectedNamespace()"></pg-profile-catalog>
    </section>

    <pg-topology *ngIf="tab() === 'topology' && hasSelectedCluster()"></pg-topology>
    <pg-config *ngIf="tab() === 'config' && hasSelectedCluster()"></pg-config>
    <pg-databases *ngIf="tab() === 'databases' && hasSelectedCluster()"></pg-databases>
    <pg-admin *ngIf="tab() === 'admin' && hasSelectedCluster()"></pg-admin>
    <pg-backups *ngIf="tab() === 'backups' && hasSelectedCluster()"></pg-backups>
    <pg-events *ngIf="tab() === 'events' && hasSelectedCluster()"></pg-events>

    <section *ngIf="tab() === 'operations' && hasSelectedCluster()" class="pgp-workspace pgp-workspace--full">
      <div class="pgp-section-head"><div><span class="vl-eyebrow">Controlled maintenance</span><h2>PostgreSQL operations</h2><p>선택한 인스턴스의 재시작, Vacuum, Repack 등 승인된 유지보수 작업을 미리보기 후 실행합니다.</p></div></div>
      <pg-operations></pg-operations>
    </section>

    <section *ngIf="tab() === 'upgrade' && selectedContextCluster() as selected" class="pgp-workspace">
      <div class="pgp-section-head"><div><span class="vl-eyebrow">Controlled lifecycle · {{selected.provider}}</span><h2>PostgreSQL upgrade & rollback</h2></div><span class="label label-info">PostgreSQL {{selected.postgresVersion || '—'}}</span></div>
      <clr-alert clrAlertType="warning" [clrAlertClosable]="false"><clr-alert-item><span class="alert-text">Major 버전 변경은 별도 복구·전환 계획이 필요합니다. 이 화면에서는 StackGres가 지원하는 typed maintenance 작업만 요청합니다.</span></clr-alert-item></clr-alert>
      <table class="table"><thead><tr><th>Provider</th><th>현재 버전</th><th>Plan</th><th>승격 조건</th></tr></thead><tbody><tr><td>{{selected.provider}}</td><td>{{selected.postgresVersion || '—'}}</td><td>{{selected.plan || selected.mode}}</td><td>provider compatibility · backup/restore · rollback 증거</td></tr></tbody></table>
      <pg-operations></pg-operations>
    </section>

    <section *ngIf="tab() === 'documentation'" class="pgp-workspace">
      <div class="pgp-section-head"><div><span class="vl-eyebrow">Console Manual Registry</span><h2>Documentation</h2></div><span class="label label-success">자동 등록</span></div>
      <p>선택한 StackGres · PostgreSQL {{documentationVersion()}} 운영 안내서는 Foundation package 활성화 시 Console Manual Registry와 통합 검색에 자동 등록됩니다.</p>
      <dl class="os-kv"><dt>문서 ID</dt><dd class="os-mono">{{manualSourceId}}</dd><dt>화면 경로</dt><dd class="os-mono">/pfss/postgres</dd><dt>정본 수준</dt><dd>Tier 2 · 제품/운영 안내서</dd></dl>
      <a class="btn btn-sm btn-primary" [href]="manualUrl">한글 안내서 열기</a><a class="btn btn-sm" [href]="postgresDocsUrl()" target="_blank" rel="noreferrer">PostgreSQL {{documentationVersion()}} 공식 문서</a><a class="btn btn-sm" [href]="providerDocsUrl()" target="_blank" rel="noreferrer">{{providerDocsLabel()}}</a>
    </section>
  `,
})
export class PostgresPluginComponent implements OnInit, OnDestroy {
  readonly pg = inject(CnpgService);
  readonly reg = inject(FoundationRegistryService);
  readonly vr = inject(ViewRouter);
  readonly fleet = inject(PostgresFleetService);
  readonly pgAdmin = inject(PgAdminService);
  readonly LOGO = LOGO;
  readonly manualSourceId = MANUAL_SOURCE_ID;
  readonly manualUrl = `/manual?doc=${encodeURIComponent(MANUAL_SOURCE_ID)}`;
  readonly iBack = ArrowLeft16;
  readonly iRenew = Renew16;
  readonly iAdd = Add16;
  readonly iCatalog = Catalog16;
  readonly iFleet = ListBoxes16;
  readonly iSettings = Settings16;

  readonly form = signal<PgForm>(structuredClone(DEFAULT_FORM));
  readonly storageClasses = signal<StorageClassRow[]>([]);
  readonly applying = signal(false);
  readonly applyState = signal<'idle' | 'applying' | 'done' | 'error'>('idle');
  readonly applyProgress = signal(0);
  readonly applyLogs = signal<string[]>([]);
  private installTimer: ReturnType<typeof setInterval> | undefined;
  claimName = ''; claimDatabase = ''; claimOwner = ''; claimPlan = 'postgresql-dev-single';
  claimVersion = '18'; claimStorageSize = ''; claimStorageClass = ''; claimDeletionPolicy: 'Retain' | 'Delete' = 'Retain';
  claimInstanceProfile = ''; claimPostgresProfile = ''; claimPoolingProfile = ''; claimObjectStorageProfile = '';
  creatingClaim = false; claimResult = ''; claimFailed = false;
  readonly claimYamlPreview = signal('');
  namespaceModalOpen = false; creatingNamespace = false; newNamespaceName = ''; newNamespaceReason = ''; namespaceError = '';
  readonly selectedNamespace = signal(DEFAULT_FORM.namespace);

  readonly tabs: { id: PackageTab; label: string; requiresCluster?: boolean; badge?: boolean }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'provisioning', label: 'Provisioning' },
    { id: 'cluster', label: 'Cluster plan', requiresCluster: true },
    { id: 'topology', label: 'Topology', requiresCluster: true },
    { id: 'profiles', label: 'Profile Catalog' },
    { id: 'config', label: 'Runtime configuration', requiresCluster: true },
    { id: 'monitoring', label: 'Monitoring', requiresCluster: true },
    { id: 'events', label: 'Events', requiresCluster: true, badge: true },
    { id: 'upgrade', label: 'Upgrade', requiresCluster: true },
    { id: 'databases', label: 'Databases & Roles', requiresCluster: true, badge: true },
    { id: 'admin', label: 'pgAdmin', requiresCluster: true },
    { id: 'backups', label: 'Backups', requiresCluster: true, badge: true },
    { id: 'operations', label: 'Maintenance', requiresCluster: true },
    { id: 'operator', label: 'Engine management' },
    { id: 'documentation', label: 'Documentation' },
    { id: 'fleet', label: 'Fleet overview' },
    { id: 'claims', label: 'Claims' },
  ];

  readonly primaryTabs: PluginPageTab[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'monitoring', label: 'Monitoring' },
    { id: 'topology', label: 'Topology' },
    { id: 'databases', label: 'Database' },
    { id: 'backups', label: 'Data Protection' },
    { id: 'operations', label: 'Operations' },
    { id: 'events', label: 'Events' },
    { id: 'documentation', label: 'Documentation' },
  ];

  readonly secondaryByPrimary: Partial<Record<PackageTab, PackageTab[]>> = {
    databases: ['databases', 'admin'],
    operations: ['operations', 'cluster', 'config', 'upgrade'],
  };

  readonly tab = computed<PackageTab>(() => {
    const requested = this.vr.tab() as PackageTab;
    const t: PackageTab = requested === 'claims' ? 'provisioning' : requested;
    const target = this.tabs.find((item) => item.id === t);
    if (!target) return 'overview';
    if (target.requiresCluster && !this.hasSelectedCluster()) return 'overview';
    return t;
  });
  readonly clusterExists = computed(() => this.pg.clusterState() === 'ok' && !!this.pg.cluster());
  readonly namespaceClusters = computed(() => this.fleet.clusters().filter((cluster) => cluster.namespace === this.selectedNamespace()));
  readonly selectedContextCluster = computed(() => this.namespaceClusters().find((cluster) => cluster.id === this.fleet.selectedId()) || this.namespaceClusters()[0] || null);
  readonly hasSelectedCluster = computed(() => !!this.selectedContextCluster());
  readonly documentationVersion = computed(() => this.compactPostgresVersion(this.selectedContextCluster()?.postgresVersion || '') || 'current');
  readonly validationError = computed(() => {
    const f = this.form();
    if (f.instances < 1 || f.instances > 9) return '인스턴스 수는 1~9여야 합니다.';
    if (!/^\d+(Gi|Ti)$/.test(f.storageSize)) return 'Data volume은 10Gi 또는 1Ti 형식이어야 합니다.';
    if (f.walStorageSize && !/^\d+(Gi|Ti)$/.test(f.walStorageSize)) return 'WAL volume은 10Gi 또는 1Ti 형식이어야 합니다.';
    if (!f.storageClass) return 'StorageClass를 선택해야 합니다.';
    if (f.backup.enabled && (!f.backup.s3Endpoint || !f.backup.destinationPath || !f.backup.secretName)) return 'S3 백업을 사용하려면 endpoint, destination, Secret이 모두 필요합니다.';
    return '';
  });
  readonly canApply = computed(() => !this.applying() && !this.validationError());

  ngOnInit(): void {
    this.pg.start();
    void this.refreshFleet();
    void this.fleet.refreshOperator();
    void this.loadStorageClasses();
  }
  ngOnDestroy(): void {
    if (this.installTimer) clearInterval(this.installTimer);
    this.pg.stop();
  }

  back(): void { this.vr.setModule('modules'); }
  openControlPlane(): void { this.vr.setModule('control-plane'); }
  openTab(id: string): void { this.vr.setTab(id); }
  openPrimaryTab(id: string): void { this.openTab(id); }
  selectNamespace(namespace: string): void {
    if (!namespace || namespace === this.selectedNamespace()) return;
    this.selectedNamespace.set(namespace);
    this.claimResult = '';
    this.claimYamlPreview.set('');
    void this.fleet.refreshProfiles(namespace);
    this.syncNamespaceContext();
    const current = this.tabs.find((item) => item.id === this.tab());
    if (current?.requiresCluster && !this.hasSelectedCluster()) this.openTab('overview');
  }
  openNamespaceModal(): void {
    this.namespaceError = '';
    this.namespaceModalOpen = true;
  }
  selectFleetCluster(id: string): void {
    const selected = this.fleet.clusters().find((cluster) => cluster.id === id);
    if (!selected) return;
    this.selectedNamespace.set(selected.namespace);
    this.applyClusterContext(selected);
  }
  selectFleetClusterAndOpen(id: string): void { this.selectFleetCluster(id); this.openTab('overview'); }
  openSelectedAdmin(): void {
    const selected = this.selectedContextCluster();
    if (!selected) return;
    this.selectFleetCluster(selected.id);
    this.openTab('admin');
  }
  async refreshFleet(): Promise<void> {
    await this.fleet.refresh();
    const namespaces = this.fleet.namespaces();
    if (!namespaces.includes(this.selectedNamespace())) this.selectedNamespace.set(namespaces.includes(DEFAULT_FORM.namespace) ? DEFAULT_FORM.namespace : (namespaces[0] || DEFAULT_FORM.namespace));
    this.syncNamespaceContext();
    await this.fleet.refreshProfiles(this.selectedNamespace());
  }
  async createNamespace(): Promise<void> {
    this.creatingNamespace = true; this.namespaceError = '';
    try {
      const namespace = this.newNamespaceName.trim();
      await this.fleet.createNamespace(namespace, this.newNamespaceReason.trim());
      this.selectedNamespace.set(namespace);
      this.newNamespaceName = ''; this.newNamespaceReason = ''; this.namespaceModalOpen = false;
      this.syncNamespaceContext(); this.openTab('overview');
    } catch (error: any) { this.namespaceError = error?.message || String(error); }
    finally { this.creatingNamespace = false; }
  }
  async createDedicatedCluster(): Promise<void> {
    this.creatingClaim = true; this.claimResult = ''; this.claimFailed = false;
    try {
      const namespace = this.selectedNamespace();
      const claimName = this.claimName.trim();
      await this.fleet.createClaim({ name: this.claimName.trim(), namespace, database: this.claimDatabase.trim(), owner: this.claimOwner.trim(), plan: this.claimPlan,
        version: this.claimVersion.trim() || undefined, deletionPolicy: this.claimDeletionPolicy,
        storageSize: this.claimStorageSize.trim() || undefined, storageClass: this.claimStorageClass || undefined,
        profileRefs: { instanceProfile: this.claimInstanceProfile || undefined, postgresConfig: this.claimPostgresProfile || undefined, poolingConfig: this.claimPoolingProfile || undefined, objectStorage: this.claimObjectStorageProfile || undefined } });
      this.claimResult = `PostgresClaim ${namespace}/${claimName} 생성 요청이 승인되었습니다.`;
      this.claimName = ''; this.claimDatabase = ''; this.claimOwner = ''; this.claimStorageSize = ''; this.claimStorageClass = ''; this.claimDeletionPolicy = 'Retain'; this.claimInstanceProfile = ''; this.claimPostgresProfile = ''; this.claimPoolingProfile = ''; this.claimObjectStorageProfile = '';
      this.claimYamlPreview.set('');
      this.syncNamespaceContext();
      const created = this.namespaceClusters().find((cluster) => cluster.name === claimName);
      if (created) this.selectFleetCluster(created.id);
    } catch (error: any) { this.claimFailed = true; this.claimResult = error?.message || String(error); }
    finally { this.creatingClaim = false; }
  }
  patchForm(patch: Partial<PgForm>): void { this.form.update((f) => ({ ...f, ...patch })); }
  profilesFor(kind: 'instance' | 'postgres' | 'pooling' | 'objectStorage') { return this.fleet.profiles().filter((profile) => profile.kind === kind && !profile.claimOwned); }
  profileSummary(profile: { kind: string; spec: any }): string {
    if (profile.kind === 'instance') return `${profile.spec?.requests?.cpu || profile.spec?.cpu || '—'} / ${profile.spec?.requests?.memory || profile.spec?.memory || '—'}`;
    if (profile.kind === 'postgres') return `PostgreSQL ${profile.spec?.postgresVersion || '—'}`;
    if (profile.kind === 'objectStorage') return `${profile.spec?.type || '—'} · ${profile.spec?.[profile.spec?.type]?.bucket || '—'}`;
    return String(profile.spec?.pgBouncer?.['pgbouncer.ini']?.pgbouncer?.pool_mode || '—');
  }
  previewClaim(): void {
    const profileRefs = [
      this.claimInstanceProfile ? `    instanceProfile: ${this.claimInstanceProfile}` : '',
      this.claimPostgresProfile ? `    postgresConfig: ${this.claimPostgresProfile}` : '',
      this.claimPoolingProfile ? `    poolingConfig: ${this.claimPoolingProfile}` : '',
      this.claimObjectStorageProfile ? `    objectStorage: ${this.claimObjectStorageProfile}` : '',
    ].filter(Boolean);
    this.claimYamlPreview.set([
      'apiVersion: provisioning.opensphere.io/v1beta1',
      'kind: PostgresClaim',
      'metadata:',
      `  name: ${this.claimName.trim() || '<name>'}`,
      `  namespace: ${this.selectedNamespace()}`,
      'spec:',
      `  planRef:\n    name: ${this.claimPlan}`,
      '  isolation: Dedicated',
      `  database: ${this.claimDatabase.trim() || '<database>'}`,
      `  owner: ${this.claimOwner.trim() || '<owner>'}`,
      ...(this.claimVersion.trim() ? [`  version: ${this.claimVersion.trim()}`] : []),
      `  deletionPolicy: ${this.claimDeletionPolicy}`,
      ...(this.claimStorageSize.trim() || this.claimStorageClass ? ['  storage:', ...(this.claimStorageSize.trim() ? [`    size: ${this.claimStorageSize.trim()}`] : []), ...(this.claimStorageClass ? [`    storageClass: ${this.claimStorageClass}`] : [])] : []),
      ...(profileRefs.length ? ['  profileRefs:', ...profileRefs] : []),
    ].join('\n'));
  }
  patchBackup(patch: Partial<PgForm['backup']>): void { this.form.update((f) => ({ ...f, backup: { ...f.backup, ...patch } })); }

  setProfile(profile: Profile): void {
    if (profile === 'production') {
      this.form.update((f) => ({ ...f, profile, instances: 3, storageSize: '50Gi', resourceProfile: 'medium', cpuRequest: '500m', memoryRequest: '1Gi', cpuLimit: '2', memoryLimit: '2Gi', poolerEnabled: true, poolerInstances: 2, monitoring: true }));
      return;
    }
    if (profile === 'compact') {
      this.form.update((f) => ({ ...f, profile, instances: 2, storageSize: '10Gi', resourceProfile: 'small', cpuRequest: '250m', memoryRequest: '512Mi', cpuLimit: '1', memoryLimit: '1Gi', poolerEnabled: false, poolerInstances: 1, monitoring: true }));
      return;
    }
    if (profile === 'development') {
      this.form.update((f) => ({ ...f, profile, instances: 1, storageSize: '10Gi', resourceProfile: 'small', cpuRequest: '250m', memoryRequest: '512Mi', cpuLimit: '1', memoryLimit: '1Gi', poolerEnabled: false, poolerInstances: 1, monitoring: true }));
      return;
    }
    this.patchForm({ profile });
  }

  setResourceProfile(profile: string): void {
    const presets: Record<string, Partial<PgForm>> = {
      small: { resourceProfile: 'small', cpuRequest: '250m', memoryRequest: '512Mi', cpuLimit: '1', memoryLimit: '1Gi' },
      medium: { resourceProfile: 'medium', cpuRequest: '500m', memoryRequest: '1Gi', cpuLimit: '2', memoryLimit: '2Gi' },
      large: { resourceProfile: 'large', cpuRequest: '1', memoryRequest: '2Gi', cpuLimit: '4', memoryLimit: '4Gi' },
    };
    this.patchForm({ ...(presets[profile] ?? {}), profile: 'custom' });
  }

  lifecycleLabel(): string {
    if (this.fleet.busy() && this.fleet.state() === 'loading') return 'Discovering';
    const cluster = this.selectedContextCluster();
    if (!cluster) return 'Not installed';
    return this.compactLifecycle(cluster.phase, cluster.ready);
  }
  lifecyclePill(): string {
    return this.selectedContextCluster()?.ready ? 'label-success' : 'label-warning';
  }
  headerModel(): PluginPageHeaderModel {
    const cluster = this.selectedContextCluster();
    return {
      name: 'PostgreSQL', logo: LOGO, stack: 'PFS / StackGres', capability: 'data.sql.postgres',
      description: 'Namespace별 PostgreSQL을 StackGres 운영 모델로 프로비저닝하고 수명주기·데이터·보호 정책을 관리하는 Foundation service',
      lifecycle: this.lifecycleLabel(), lifecycleClass: this.lifecyclePill(), versionLabel: 'PostgreSQL',
      version: this.compactPostgresVersion(cluster?.postgresVersion || ''), profile: cluster?.plan || cluster?.mode || 'Not installed',
    };
  }
  compactLifecycle(phase: string, ready = false): string {
    if (ready) return 'Ready';
    const value = String(phase || '').trim();
    if (!value) return 'Progressing';
    if (/waiting for .*instances?.*active|starting|initializ/i.test(value)) return 'Starting';
    if (/degraded|failed|error|not ready/i.test(value)) return 'Degraded';
    if (/pending|creating|progress/i.test(value)) return 'Progressing';
    return value.length > 18 ? `${value.slice(0, 17)}…` : value;
  }
  compactPostgresVersion(version: string): string {
    const value = String(version || '').trim();
    if (!value) return '—';
    const tag = value.includes(':') ? value.slice(value.lastIndexOf(':') + 1) : value;
    const match = tag.match(/(?:postgres(?:ql)?[^0-9]*)?(\d+(?:\.\d+)?)(?:[-_.]?beta(\d+))?/i)
      || value.match(/(?:postgres(?:ql)?[^0-9]*)?(\d+(?:\.\d+)?)(?:[-_.]?beta(\d+))?/i);
    if (!match) return value.length > 14 ? `${value.slice(0, 13)}…` : value;
    return match[2] ? `${match[1]} beta${match[2]}` : match[1];
  }
  primaryTab(): PackageTab {
    const current = this.tab();
    if (current === 'cluster' || current === 'config' || current === 'upgrade') return 'operations';
    if (current === 'admin') return 'databases';
    return current;
  }
  isManagementView(): boolean { return ['fleet', 'profiles', 'provisioning', 'operator'].includes(this.tab()); }
  primaryTabsForUi(): PluginPageTab[] {
    return this.primaryTabs.map((item) => ({
      ...item,
      disabled: this.tabRequiresCluster(item.id as PackageTab) && !this.hasSelectedCluster(),
      badge: item.id === 'databases' ? this.badge('databases') : item.id === 'backups' ? this.badge('backups') : '',
    }));
  }
  secondaryTabsForUi(): PluginPageTab[] {
    const ids = this.secondaryByPrimary[this.primaryTab()] || [];
    return ids.map((id) => {
      const item = this.tabs.find((tab) => tab.id === id)!;
      return { id, label: item.label, disabled: !!item.requiresCluster && !this.hasSelectedCluster(), badge: item.badge ? this.badge(id) : '' };
    });
  }
  primaryTabLabel(): string { return this.primaryTabs.find((item) => item.id === this.primaryTab())?.label || ''; }
  private tabRequiresCluster(id: PackageTab): boolean { return !!this.tabs.find((item) => item.id === id)?.requiresCluster; }
  operatorVersion(): string {
    const operator = this.fleet.operator();
    return operator?.config?.status?.version || operator?.config?.metadata?.labels?.version || 'Detected';
  }
  clusterAvailability(cluster: PostgresFleetCluster): number {
    return cluster.instances ? Math.round((cluster.readyInstances / cluster.instances) * 100) : 0;
  }
  providerName(_cluster: PostgresFleetCluster): string { return 'StackGres'; }
  postgresDocsUrl(): string {
    const version = this.documentationVersion();
    return /^\d+$/.test(version) ? `https://www.postgresql.org/docs/${version}/` : 'https://www.postgresql.org/docs/current/';
  }
  providerDocsUrl(): string { return 'https://stackgres.io/doc/latest/'; }
  providerDocsLabel(): string { return 'StackGres 공식 문서'; }
  availability(): number {
    return this.pg.totalN() ? Math.round((this.pg.readyN() / this.pg.totalN()) * 100) : 0;
  }
  badge(id: PackageTab): string {
    if (id === 'databases') return String(this.pg.databases().length + this.pg.managedRoles().length || '');
    if (id === 'backups') return String(this.pg.backups().length || '');
    if (id === 'events') return String(this.pg.events().filter((e: any) => e.type === 'Warning').length || '');
    return '';
  }
  selectedStorageHint(): string {
    const sc = this.storageClasses().find((x) => x.name === this.form().storageClass);
    if (!sc) return 'StorageClass 상태를 확인 중입니다.';
    return `${sc.provisioner} · ${sc.allowExpansion ? '온라인 확장 지원' : '확장 미지원'} · reclaim ${sc.reclaimPolicy}`;
  }

  async refreshAll(): Promise<void> {
    await Promise.allSettled([this.pg.refresh(), this.fleet.refresh(), this.fleet.refreshOperator(), this.reg.refreshModels(), this.loadStorageClasses()]);
  }
  refreshOperator(): void { void this.fleet.refreshOperator(); }

  private syncNamespaceContext(): void {
    const current = this.namespaceClusters().find((cluster) => cluster.id === this.fleet.selectedId());
    const next = current || this.namespaceClusters()[0] || null;
    this.applyClusterContext(next);
  }

  private applyClusterContext(cluster: PostgresFleetCluster | null): void {
    const id = cluster?.id || '';
    this.fleet.select(id);
    if (cluster) this.pg.selectTarget(cluster.provider, cluster.namespace, cluster.name);
    if (this.pgAdmin.selectedCluster() === id) return;
    this.pgAdmin.selectedCluster.set(id);
    this.pgAdmin.catalog.set(null);
    this.pgAdmin.selectedDatabase.set('');
    this.pgAdmin.selectedSchema.set('public');
    this.pgAdmin.selectedObject.set(null);
    this.pgAdmin.queryResult.set(null);
    this.pgAdmin.dataResult.set(null);
    if (id && this.tab() === 'admin') void this.pgAdmin.refresh();
  }

  async applyCluster(): Promise<void> {
    if (!this.canApply()) return;
    this.applying.set(true);
    this.applyState.set('applying');
    this.applyProgress.set(10);
    this.applyLogs.set([]);
    this.log('FoundationModel/data PostgreSQL 설치 선언을 제출합니다.');
    const { profile: _profile, ...parameters } = this.form();
    const ok = await this.reg.configurePostgres(parameters);
    if (!ok) {
      this.applyState.set('error');
      this.applyProgress.set(100);
      this.applying.set(false);
      this.log(`실패: ${this.reg.lastError()}`);
      return;
    }
    this.applyProgress.set(25);
    this.log('설치 선언이 승인되었습니다. Foundation control-plane reconcile을 기다립니다.');
    this.pg.forceRefresh();
    this.watchCluster();
  }

  private watchCluster(): void {
    if (this.installTimer) clearInterval(this.installTimer);
    let ticks = 0;
    this.installTimer = setInterval(async () => {
      ticks++;
      await this.pg.refresh();
      if (this.clusterExists()) {
        this.applyProgress.set(Math.max(this.applyProgress(), 55));
        this.logOnce('cluster', `Cluster/${this.pg.name}가 생성되었습니다.`);
      }
      if (this.pg.instances().length) {
        this.applyProgress.set(Math.max(this.applyProgress(), 75));
        this.logOnce('pods', `PostgreSQL Pod ${this.pg.instances().length}개를 확인했습니다.`);
      }
      if (this.pg.allReady()) {
        this.applyProgress.set(100);
        this.applyState.set('done');
        this.applying.set(false);
        this.logOnce('ready', '모든 PostgreSQL 인스턴스가 Ready입니다.');
        if (this.installTimer) clearInterval(this.installTimer);
        this.installTimer = undefined;
      } else if (ticks >= 100) {
        this.applyState.set('error');
        this.applyProgress.set(100);
        this.applying.set(false);
        this.log('5분 안에 Ready가 되지 않았습니다. Events 탭과 control-plane 상태를 확인하세요.');
        if (this.installTimer) clearInterval(this.installTimer);
        this.installTimer = undefined;
      }
    }, 3000);
  }

  private async loadStorageClasses(): Promise<void> {
    try {
      const r = await hostFetch(`${apiBase()}/api/k8s/apis/storage.k8s.io/v1/storageclasses`, { cache: 'no-store' });
      if (!r.ok) return;
      const rows: StorageClassRow[] = ((await r.json()).items ?? []).map((x: any) => ({
        name: String(x.metadata?.name ?? ''),
        provisioner: String(x.provisioner ?? ''),
        isDefault: x.metadata?.annotations?.['storageclass.kubernetes.io/is-default-class'] === 'true',
        allowExpansion: x.allowVolumeExpansion === true,
        reclaimPolicy: String(x.reclaimPolicy ?? 'Delete'),
      })).filter((x: StorageClassRow) => !!x.name).sort((a: StorageClassRow, b: StorageClassRow) => Number(b.isDefault) - Number(a.isDefault) || a.name.localeCompare(b.name));
      this.storageClasses.set(rows);
      if (!rows.some((x) => x.name === this.form().storageClass)) {
        const selected = rows.find((x) => x.isDefault) ?? rows[0];
        if (selected) this.patchForm({ storageClass: selected.name });
      }
    } catch { /* 상태 표시는 selectedStorageHint에서 처리 */ }
  }

  private log(message: string): void {
    const time = new Date().toLocaleTimeString();
    this.applyLogs.update((lines) => [...lines, `[${time}] ${message}`]);
  }
  private logOnce(key: string, message: string): void {
    if (this.applyLogs().some((x) => x.includes(`[${key}]`))) return;
    this.log(`[${key}] ${message}`);
  }
}
