import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';

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
}

export interface PluginPageTab {
  id: string;
  label: string;
  disabled?: boolean;
  badge?: string | number;
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
  imports: [CommonModule],
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
          <span class="vl-eyebrow">{{ model.stack || 'PFS' }} · {{ model.capability }}</span>
          <h1 [id]="headingId">{{ model.name }}</h1>
          <p>{{ model.description }}</p>
        </div>
      </div>
      <dl class="pfs-plugin-release">
        <div><dt>Lifecycle</dt><dd><span class="label" [ngClass]="model.lifecycleClass || 'label-warning'">{{ model.lifecycle }}</span></dd></div>
        <div><dt>{{ model.versionLabel || 'Version' }}</dt><dd>{{ model.version }}</dd></div>
        <div><dt>Profile</dt><dd>{{ model.profile }}</dd></div>
        <div *ngIf="model.namespace"><dt>Namespace</dt><dd class="os-mono">{{ model.namespace }}</dd></div>
        <ng-content select="[pluginHeaderContext]" />
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
  @Input({ required: true }) model!: PluginPageHeaderModel;
  @Input() headingId = 'pfs-plugin-page-title';
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
