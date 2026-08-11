import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ClarityModule } from '@clr/angular';
import ListBoxes16 from '@carbon/icons/es/list--boxes/16';
import Catalog16 from '@carbon/icons/es/catalog/16';
import DataAdd16 from '@carbon/icons/es/data--add/16';
import Settings16 from '@carbon/icons/es/settings/16';
import Renew16 from '@carbon/icons/es/renew/16';
import { CarbonIcon } from '../carbon-icon';

export interface PluginPageHeaderModel {
  name: string;
  logo: string;
  logos?: Array<{ src: string; alt: string }>;
  monogram?: string;
  stack?: string;
  capability: string;
  description: string;
  lifecycle: string;
  lifecycleClass?: string;
  versionLabel?: string;
  version: string;
  profile: string;
  namespace?: string;
  managedFleet?: boolean;
  stackSeparator?: '/' | '·';
  managementActions?: boolean;
  fleetActionLabel?: string;
  catalogActionLabel?: string;
  provisioningActionLabel?: string;
  operatorActionLabel?: string;
}

export interface PluginPageTab {
  id: string;
  label: string;
  disabled?: boolean;
  badge?: string | number;
}

export interface PluginHeaderOption { value: string; label: string; disabled?: boolean; }
export type PluginManagementActionId = 'cluster' | 'config' | 'claims' | 'operator';
export interface PluginHeaderContextModel {
  namespace: string;
  namespaces?: PluginHeaderOption[];
  resourceLabel?: string;
  resource?: string;
  resources?: PluginHeaderOption[];
  activeManagement?: PfsPluginTabId | '';
  allowNamespaceAdd?: boolean;
  refreshDisabled?: boolean;
}

/** Platform Delivery 엔진의 관리자 과업 중심 상세 화면 계약. */
export type DeliveryAdminTabId =
  | 'overview' | 'prerequisites' | 'install' | 'resources'
  | 'configuration' | 'security' | 'upgrade' | 'events';

export function deliveryAdminTabs(resourceLabel: string): PluginPageTab[] {
  return [
    { id: 'overview', label: 'Overview' },
    { id: 'prerequisites', label: 'Prerequisites' },
    { id: 'install', label: 'Install & Repair' },
    { id: 'resources', label: resourceLabel },
    { id: 'configuration', label: 'Configuration' },
    { id: 'security', label: 'Security & Policy' },
    { id: 'upgrade', label: 'Upgrade & Rollback' },
    { id: 'events', label: 'Events & Audit' },
  ];
}

/** PostgreSQL plugin이 확립한 PFS 상세 화면의 정본 11탭 계약. */
export type PfsPluginTabId =
  | 'overview' | 'operator' | 'cluster' | 'topology' | 'config'
  | 'domain' | 'backups' | 'events' | 'claims' | 'upgrade' | 'documentation';

export function pfsPluginTabs(domainLabel: string): PluginPageTab[] {
  return [
    { id: 'overview', label: 'Overview' },
    { id: 'operator', label: 'Operator' },
    { id: 'cluster', label: 'Cluster plan' },
    { id: 'topology', label: 'Topology' },
    { id: 'config', label: 'Configuration' },
    { id: 'domain', label: domainLabel },
    { id: 'backups', label: 'Backups' },
    { id: 'events', label: 'Events' },
    { id: 'claims', label: 'Claims' },
    { id: 'upgrade', label: 'Upgrade' },
    { id: 'documentation', label: 'Documentation' },
  ];
}

/**
 * PostgreSQL이 확립한 PFS plugin 페이지 머리/메타 계약의 단일 구현.
 * 엔진별 차이는 model 값으로만 표현하고 레이아웃은 분기하지 않는다.
 */
@Component({
  selector: 'osp-plugin-page-header',
  standalone: true,
  imports: [CommonModule, FormsModule, ClarityModule, CarbonIcon],
  template: `
    <section class="pfs-plugin-head" [attr.aria-labelledby]="headingId">
      <div class="pfs-plugin-brand">
        <div class="pfs-plugin-logo" [class.pfs-plugin-logo-pair]="model.logos?.length">
          <ng-container *ngIf="model.logos?.length; else singleLogo">
            <img *ngFor="let logo of model.logos" [src]="logo.src" [alt]="logo.alt" />
          </ng-container>
          <ng-template #singleLogo>
            <img *ngIf="model.logo" [src]="model.logo" [alt]="model.name" />
            <span *ngIf="!model.logo" class="pfs-plugin-monogram">{{ model.monogram || model.name.slice(0, 2) }}</span>
          </ng-template>
        </div>
        <div>
          <span class="vl-eyebrow">{{ model.stack || 'PFSS' }} {{ model.stackSeparator || '/' }} {{ model.capability }}</span>
          <h1 [id]="headingId">{{ model.name }}</h1>
          <p>{{ model.description }}</p>
        </div>
      </div>
      <dl class="pfs-plugin-release">
        <div><dt>Lifecycle</dt><dd><span class="label" [ngClass]="model.lifecycleClass || 'label-warning'">{{ model.lifecycle }}</span></dd></div>
        <div><dt>{{ model.versionLabel || 'Version' }}</dt><dd>{{ model.version }}</dd></div>
        <div><dt>Profile</dt><dd>{{ model.profile }}</dd></div>
        <div class="pgp-header-tools">
          <nav *ngIf="model.managementActions !== false" class="pgp-management-actions pgp-management-actions--header" aria-label="플랫폼 관리 작업">
            <button *ngIf="model.managedFleet !== false" type="button" class="pgp-management-action" [title]="model.fleetActionLabel || '전체 서비스'" [attr.aria-label]="model.fleetActionLabel || '전체 서비스'" [attr.aria-current]="context?.activeManagement === 'cluster' ? 'page' : null" [class.active]="context?.activeManagement === 'cluster'" (click)="managementSelected.emit('cluster')"><os-cicon [icon]="iFleet" [size]="16" /><span>{{ model.fleetActionLabel || '전체 서비스' }}</span></button>
            <button type="button" class="pgp-management-action" [title]="model.catalogActionLabel || '설정 카탈로그'" [attr.aria-label]="model.catalogActionLabel || '설정 카탈로그'" [attr.aria-current]="context?.activeManagement === 'config' ? 'page' : null" [class.active]="context?.activeManagement === 'config'" (click)="managementSelected.emit('config')"><os-cicon [icon]="iCatalog" [size]="16" /><span>{{ model.catalogActionLabel || '설정 카탈로그' }}</span></button>
            <button type="button" class="pgp-management-action pgp-management-action--primary" [title]="model.provisioningActionLabel || '서비스 생성'" [attr.aria-label]="model.provisioningActionLabel || '서비스 생성'" [attr.aria-current]="context?.activeManagement === 'claims' ? 'page' : null" [class.active]="context?.activeManagement === 'claims'" (click)="managementSelected.emit('claims')"><os-cicon [icon]="iProvisioning" [size]="16" /><span>{{ model.provisioningActionLabel || '서비스 생성' }}</span></button>
            <button type="button" class="pgp-management-action" [title]="model.operatorActionLabel || '엔진 관리'" [attr.aria-label]="model.operatorActionLabel || '엔진 관리'" [attr.aria-current]="context?.activeManagement === 'operator' ? 'page' : null" [class.active]="context?.activeManagement === 'operator'" (click)="managementSelected.emit('operator')"><os-cicon [icon]="iOperator" [size]="16" /><span>{{ model.operatorActionLabel || '엔진 관리' }}</span></button>
          </nav>
          <div class="pgp-header-context" aria-label="PFSS 운영 컨텍스트">
            <div class="pgp-header-context-unit">
              <clr-select-container class="pgp-header-context-field"><label>Namespace</label><select clrSelect name="pfssHeaderNamespace" aria-label="Namespace 선택" [ngModel]="context?.namespace" (ngModelChange)="namespaceSelected.emit($event)"><option *ngFor="let option of context?.namespaces || []" [ngValue]="option.value" [disabled]="option.disabled">{{option.label}}</option></select></clr-select-container>
              <button *ngIf="context?.allowNamespaceAdd !== false" class="btn btn-sm btn-link pgp-header-context-action" type="button" aria-label="Namespace 추가" title="Namespace 추가" (click)="namespaceAdd.emit()">추가</button>
            </div>
            <div class="pgp-header-context-unit">
              <clr-select-container class="pgp-header-context-field" *ngIf="context?.resources?.length"><label>{{context?.resourceLabel || '서비스'}}</label><select clrSelect name="pfssHeaderResource" [attr.aria-label]="(context?.resourceLabel || '서비스') + ' 선택'" [ngModel]="context?.resource || ''" (ngModelChange)="resourceSelected.emit($event)"><option *ngFor="let option of context?.resources || []" [ngValue]="option.value" [disabled]="option.disabled">{{option.label}}</option></select></clr-select-container>
              <button class="btn btn-sm btn-link pgp-header-context-refresh" type="button" aria-label="운영 컨텍스트 새로고침" title="새로고침" [disabled]="context?.refreshDisabled" (click)="refreshRequested.emit()"><os-cicon [icon]="iRenew" [size]="16" /></button>
            </div>
          </div>
        </div>
      </dl>
    </section>
  `,
  styles: [`
    .pfs-plugin-logo-pair {
      width: auto;
      min-width: 3.4rem;
      padding: 0.28rem 0.38rem;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.28rem;
    }
    .pfs-plugin-logo-pair img {
      width: 1.35rem;
      height: 1.35rem;
      object-fit: contain;
      flex: 0 0 auto;
    }
  `],
})
export class PluginPageHeaderComponent {
  readonly iFleet = ListBoxes16;
  readonly iCatalog = Catalog16;
  readonly iProvisioning = DataAdd16;
  readonly iOperator = Settings16;
  readonly iRenew = Renew16;
  @Input({ required: true }) model!: PluginPageHeaderModel;
  @Input({ required: true }) context!: PluginHeaderContextModel;
  @Input() headingId = 'pfs-plugin-page-title';
  @Output() readonly managementSelected = new EventEmitter<PluginManagementActionId>();
  @Output() readonly namespaceSelected = new EventEmitter<string>();
  @Output() readonly resourceSelected = new EventEmitter<string>();
  @Output() readonly namespaceAdd = new EventEmitter<void>();
  @Output() readonly refreshRequested = new EventEmitter<void>();
}

@Component({
  selector: 'osp-plugin-tabs',
  standalone: true,
  imports: [CommonModule],
  template: `
    <nav class="pfs-plugin-tabs" [attr.aria-label]="ariaLabel" role="tablist" aria-orientation="horizontal">
      <a *ngFor="let tab of tabs" class="pfs-plugin-tab"
        role="tab" [attr.aria-selected]="active === tab.id" [attr.tabindex]="active === tab.id ? 0 : -1"
        [attr.href]="tabHref(tab.id)"
        [attr.aria-label]="tab.disabled ? tab.label + ' — 선행 설치 단계 완료 후 사용 가능' : tab.label"
        [attr.aria-disabled]="tab.disabled ? 'true' : null"
        [attr.title]="tab.disabled ? '선행 설치 단계 완료 후 사용 가능' : null"
        [class.active]="active === tab.id" [class.disabled]="tab.disabled"
        (click)="onTabClick($event, tab)" (keydown)="onKeydown($event, tab.id)">
        {{ tab.label }}<span *ngIf="tab.badge !== undefined && tab.badge !== '' && tab.badge !== 0" class="label">{{ tab.badge }}</span>
      </a>
    </nav>
  `,
})
export class PluginTabsComponent {
  @Input({ required: true }) tabs: PluginPageTab[] = [];
  @Input({ required: true }) active = 'overview';
  @Input() ariaLabel = 'Plugin 메뉴';
  @Input() routeBase = '';
  @Output() readonly selected = new EventEmitter<string>();

  tabHref(id: string): string | null {
    if (!this.routeBase) return null;
    return id === 'overview' ? this.routeBase : `${this.routeBase}/${id}`;
  }

  onTabClick(event: MouseEvent, tab: PluginPageTab): void {
    if (tab.disabled) {
      event.preventDefault();
      return;
    }
    const href = this.tabHref(tab.id);
    if (href) {
      event.preventDefault();
      this.navigateTo(tab.id, href);
      return;
    }
    this.selected.emit(tab.id);
  }

  onKeydown(event: KeyboardEvent, currentId: string): void {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    const enabled = this.tabs.filter((tab) => !tab.disabled);
    const current = enabled.findIndex((tab) => tab.id === currentId);
    if (current < 0 || !enabled.length) return;
    let next = current;
    if (event.key === 'ArrowRight') next = (current + 1) % enabled.length;
    if (event.key === 'ArrowLeft') next = (current - 1 + enabled.length) % enabled.length;
    if (event.key === 'Home') next = 0;
    if (event.key === 'End') next = enabled.length - 1;
    event.preventDefault();
    const targetId = enabled[next].id;
    const buttons = (event.currentTarget as HTMLElement).parentElement?.querySelectorAll<HTMLElement>('[role="tab"]:not(.disabled)');
    buttons?.[next]?.focus();
    const href = this.tabHref(targetId);
    if (href) this.navigateTo(targetId, href);
    else this.selected.emit(targetId);
  }

  private navigateTo(id: string, href: string): void {
    // Main Shell과 외부 plugin은 서로 다른 Angular injector를 사용한다.
    // URL만 push하고 한쪽 signal만 바꾸면 탭이 시각적으로 눌린 채 콘텐츠가 바뀌지
    // 않을 수 있으므로, 하나의 canonical URL을 기록한 뒤 모든 router에 popstate를 알린다.
    if (location.pathname !== href) history.pushState(history.state, '', href + location.search + location.hash);
    window.dispatchEvent(new PopStateEvent('popstate', { state: history.state }));
    this.selected.emit(id);
  }
}
