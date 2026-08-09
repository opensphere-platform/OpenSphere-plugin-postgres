import { CommonModule } from '@angular/common';
import { Component, computed, EventEmitter, inject, Input, OnInit, Output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ClarityModule } from '@clr/angular';
import { apiBase, hostFetch } from '../api-base';
import { PROV_GROUP, PROV_VER } from './claims.types';
import { PostgresFleetService } from './postgres/postgres-fleet.service';

export type PostgresRequestMode = 'Dedicated' | 'SharedDatabase' | 'DatabaseAccess';

@Component({
  selector: 'app-new-claim-form',
  standalone: true,
  imports: [CommonModule, FormsModule, ClarityModule],
  template: `
    <ng-container *ngIf="kind === 'pg'; else searchClaim">
      <div class="pg-request-types" *ngIf="showModeSelector" role="radiogroup" aria-label="PostgreSQL 리소스 요청 유형">
        <button type="button" class="pg-request-type" *ngFor="let option of visibleModeOptions()"
          [class.is-active]="mode() === option.id" (click)="mode.set(option.id)">
          <span class="pg-request-title">{{ option.label }}</span>
          <span>{{ option.description }}</span>
        </button>
      </div>

      <form clrForm clrLayout="horizontal" class="pg-request-form" (submit)="$event.preventDefault(); submit()">
        <clr-input-container>
          <label>요청 Namespace</label>
          <input clrInput [ngModel]="ns()" (ngModelChange)="ns.set($event)" name="namespace" required placeholder="소비 서비스 Namespace" />
        </clr-input-container>
        <clr-input-container>
          <label>요청 이름</label>
          <input clrInput [ngModel]="name()" (ngModelChange)="name.set($event)" name="claimName" required placeholder="예: orders-data" />
        </clr-input-container>

        <clr-select-container *ngIf="mode() === 'Dedicated'">
          <label>운영 Plan</label>
          <select clrSelect [ngModel]="plan()" (ngModelChange)="plan.set($event)" name="plan" required>
            <option value="">Plan 선택</option>
            <option *ngFor="let item of fleet.plans()" [value]="item.metadata?.name">{{ item.metadata?.name }} · PostgreSQL {{ item.spec?.postgresVersion }}</option>
          </select>
        </clr-select-container>

        <clr-select-container *ngIf="mode() !== 'Dedicated'">
          <label>PostgreSQL 인스턴스</label>
          <select clrSelect [ngModel]="target()" (ngModelChange)="target.set($event)" name="target" required>
            <option value="">관리 인스턴스 선택</option>
            <option *ngFor="let item of targets()" [value]="targetValue(item)">{{ targetLabel(item) }}</option>
          </select>
          <clr-control-helper>Ready 상태의 전용 인스턴스만 요청 대상으로 사용합니다.</clr-control-helper>
        </clr-select-container>

        <clr-input-container>
          <label>Database</label>
          <input clrInput [ngModel]="database()" (ngModelChange)="database.set($event)" name="database" required
            [placeholder]="mode() === 'DatabaseAccess' ? '접근할 기존 Database' : '생성할 Database'" />
        </clr-input-container>
        <clr-input-container>
          <label>{{ mode() === 'DatabaseAccess' ? '접근 계정' : 'Owner 계정' }}</label>
          <input clrInput [ngModel]="owner()" (ngModelChange)="owner.set($event)" name="owner" required placeholder="예: svc_orders" />
        </clr-input-container>

        <clr-select-container *ngIf="mode() === 'DatabaseAccess'">
          <label>접근 범위</label>
          <select clrSelect [ngModel]="access()" (ngModelChange)="access.set($event)" name="access">
            <option value="ReadOnly">읽기 전용</option>
            <option value="ReadWrite">읽기·쓰기</option>
          </select>
        </clr-select-container>
        <clr-input-container *ngIf="mode() !== 'Dedicated'">
          <label>최대 연결 수</label>
          <input clrInput type="number" min="1" max="1000" [ngModel]="connectionLimit()" (ngModelChange)="connectionLimit.set(+$event)" name="connectionLimit" />
        </clr-input-container>

        <div class="pg-request-actions">
          <button class="btn btn-primary" type="submit" [disabled]="!valid() || busy()">{{ busy() ? '요청 중…' : '리소스 요청' }}</button>
          <button class="btn" type="button" (click)="yaml.set(toYaml(build()))">YAML 보기</button>
          <span class="pg-request-message" [class.is-error]="error()">{{ msg() }}</span>
        </div>
      </form>
      <pre class="os-yaml" *ngIf="yaml()">{{ yaml() }}</pre>
    </ng-container>

    <ng-template #searchClaim>
      <dl class="os-kv">
        <dt>네임스페이스</dt><dd><input class="clr-input" [ngModel]="ns()" (ngModelChange)="ns.set($event)"></dd>
        <dt>claim 이름</dt><dd><input class="clr-input" [ngModel]="name()" (ngModelChange)="name.set($event)"></dd>
        <dt>Index 이름</dt><dd><input class="clr-input" [ngModel]="database()" (ngModelChange)="database.set($event)"></dd>
        <dt>Owner</dt><dd><input class="clr-input" [ngModel]="owner()" (ngModelChange)="owner.set($event)"></dd>
      </dl>
      <button class="btn btn-sm btn-primary" (click)="submit()">선언 생성</button>
    </ng-template>
  `,
  styles: [`
    .pg-request-types{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:.5rem;margin:.5rem 0 1rem}
    .pg-request-type{min-height:3.8rem;padding:.55rem .75rem;text-align:left;border:1px solid var(--cds-alias-object-border-color,#d7d7d7);background:var(--cds-alias-object-container-background,#fff);color:inherit}
    .pg-request-type:hover{border-color:var(--cds-alias-object-border-color-tint,#888)}
    .pg-request-type.is-active{border-color:var(--cds-alias-status-info,#0072a3);box-shadow:inset 3px 0 var(--cds-alias-status-info,#0072a3);background:var(--cds-alias-status-info-tint,#eef7fb)}
    .pg-request-title{display:block;font-weight:600;margin-bottom:.15rem}
    .pg-request-type span:last-child{display:block;color:var(--cds-alias-typography-color-300,#666);font-size:.65rem;line-height:1.3}
    .pg-request-form{max-width:58rem;display:grid;grid-template-columns:repeat(2,minmax(18rem,1fr));column-gap:1rem;align-items:start}
    .pg-request-actions{grid-column:1/-1;display:flex;align-items:center;gap:.4rem;margin-top:.75rem}
    .pg-request-message{color:var(--cds-alias-status-success,#278400)}.pg-request-message.is-error{color:var(--cds-alias-status-danger,#c21d00)}
    @media(max-width:900px){.pg-request-types,.pg-request-form{grid-template-columns:1fr}}
  `],
})
export class NewClaimFormComponent implements OnInit {
  @Input() kind: 'pg' | 'os' = 'pg';
  @Input() initialMode: PostgresRequestMode = 'Dedicated';
  @Input() allowedModes: PostgresRequestMode[] = ['Dedicated', 'SharedDatabase', 'DatabaseAccess'];
  @Input() showModeSelector = true;
  @Output() created = new EventEmitter<void>();
  readonly fleet = inject(PostgresFleetService);
  readonly mode = signal<PostgresRequestMode>('Dedicated');
  readonly ns = signal('opensphere-foundation');
  readonly name = signal('');
  readonly database = signal('');
  readonly owner = signal('');
  readonly plan = signal('');
  readonly target = signal('');
  readonly access = signal<'ReadOnly' | 'ReadWrite'>('ReadOnly');
  readonly connectionLimit = signal(20);
  readonly msg = signal('');
  readonly error = signal(false);
  readonly busy = signal(false);
  readonly yaml = signal('');
  readonly modeOptions: { id: PostgresRequestMode; label: string; description: string }[] = [
    { id: 'Dedicated', label: '전용 인스턴스', description: '독립 PostgreSQL 인스턴스와 Database·Owner를 함께 생성' },
    { id: 'SharedDatabase', label: '기존 인스턴스에 DB', description: '관리 중인 인스턴스에 새 Database·Owner·연결정보 생성' },
    { id: 'DatabaseAccess', label: '기존 DB 접근', description: '기존 Database에 읽기 또는 읽기·쓰기 계정 발급' },
  ];
  readonly targets = computed(() => this.fleet.claims().filter((item: any) =>
    (item.spec?.isolation || 'Dedicated') === 'Dedicated' && item.status?.phase === 'Ready'));
  readonly valid = computed(() => Boolean(this.ns() && this.name() && this.database() && this.owner()
    && (this.mode() === 'Dedicated' ? this.plan() : this.target())));

  async ngOnInit(): Promise<void> {
    this.mode.set(this.allowedModes.includes(this.initialMode) ? this.initialMode : (this.allowedModes[0] || 'Dedicated'));
    if (this.kind === 'pg' && this.fleet.state() === 'loading') await this.fleet.refresh();
    if (!this.plan() && this.fleet.plans()[0]) this.plan.set(this.fleet.plans()[0].metadata?.name || '');
  }

  visibleModeOptions(): typeof this.modeOptions { return this.modeOptions.filter((option) => this.allowedModes.includes(option.id)); }

  targetValue(item: any): string { return `${item.metadata?.namespace}/${item.metadata?.name}`; }
  targetLabel(item: any): string { return `${item.metadata?.name} · ${item.metadata?.namespace}`; }

  build(): any {
    if (this.kind === 'os') {
      return { apiVersion: `${PROV_GROUP}/${PROV_VER}`, kind: 'OpenSearchIndexClaim', metadata: { name: this.name(), namespace: this.ns() }, spec: { indexName: this.database(), owner: this.owner(), access: 'write' } };
    }
    const spec: any = { isolation: this.mode(), database: this.database(), owner: this.owner(), deletionPolicy: 'Retain' };
    if (this.mode() === 'Dedicated') spec.planRef = { name: this.plan() };
    else {
      const [namespace, name] = this.target().split('/');
      spec.clusterRef = { namespace, name };
      spec.access = this.mode() === 'SharedDatabase' ? 'Owner' : this.access();
      spec.connectionLimit = this.connectionLimit();
    }
    return { apiVersion: `${PROV_GROUP}/v1beta1`, kind: 'PostgresClaim', metadata: { name: this.name(), namespace: this.ns() }, spec };
  }

  toYaml(obj: any): string {
    const lines: string[] = [];
    const write = (value: any, indent: number) => Object.entries(value).forEach(([key, item]) => {
      if (item && typeof item === 'object' && !Array.isArray(item)) { lines.push(`${' '.repeat(indent)}${key}:`); write(item, indent + 2); }
      else lines.push(`${' '.repeat(indent)}${key}: ${item}`);
    });
    write(obj, 0);
    return lines.join('\n');
  }

  async submit(): Promise<void> {
    if (!this.valid()) { this.error.set(true); this.msg.set('필수 값을 모두 입력하세요.'); return; }
    this.busy.set(true); this.error.set(false); this.msg.set('');
    const obj = this.build();
    const version = this.kind === 'pg' ? 'v1beta1' : PROV_VER;
    const plural = this.kind === 'pg' ? 'postgresclaims' : 'opensearchindexclaims';
    try {
      const response = await hostFetch(`${apiBase()}/api/k8s/apis/${PROV_GROUP}/${version}/namespaces/${encodeURIComponent(this.ns())}/${plural}`, {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(obj),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.message || body.error || `HTTP ${response.status}`);
      this.msg.set('요청이 접수되었습니다. PFSS가 자원과 연결정보를 준비합니다.'); this.yaml.set('');
      await this.fleet.refresh(); this.created.emit();
    } catch (cause: any) {
      this.error.set(true); this.msg.set(cause?.message || '요청에 실패했습니다.'); this.yaml.set(this.toYaml(obj));
    } finally { this.busy.set(false); }
  }
}
