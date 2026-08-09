import { CommonModule } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { ClarityModule } from '@clr/angular';
import { CnpgService } from '../cnpg.service';
import { PgKv } from '../ui/pg-kv';
import { PgState } from '../ui/pg-state';
import { PgExtensionsPanel } from './pg-extensions.panel';

@Component({
  selector: 'pg-config',
  standalone: true,
  imports: [CommonModule, ClarityModule, PgKv, PgState, PgExtensionsPanel],
  styles: [`
    .pgc-workspace{margin-top:1rem}
    .pgc-pane{padding:.25rem .15rem 1rem 0}
    .pgc-parameters{padding-top:.75rem}
  `],
  template: `
    <div class="os-cardgrid">
      <div class="card">
        <div class="card-header">리소스</div>
        <div class="card-block">
          <dl class="os-kv">
            <dt>CPU</dt><dd>{{ res()?.requests?.cpu || '—' }} req / {{ res()?.limits?.cpu || '—' }} lim</dd>
            <dt>Memory</dt><dd>{{ res()?.requests?.memory || '—' }} req / {{ res()?.limits?.memory || '—' }} lim</dd>
            <dt>Storage</dt><dd>{{ svc.storage() }} · {{ svc.storageClass() }}</dd>
          </dl>
        </div>
      </div>
      <div class="card">
        <div class="card-header">PostgreSQL</div>
        <div class="card-block">
          <dl class="os-kv">
            <dt>버전</dt><dd>v{{ svc.pgMajor() }}</dd>
            <dt>이미지</dt><dd class="os-mono">{{ svc.image() || '—' }}</dd>
            <dt>파라미터</dt><dd>{{ paramCount() }} 개</dd>
          </dl>
        </div>
      </div>
    </div>

    <clr-tabs class="pgc-workspace" aria-label="PostgreSQL 설정 영역">
      <clr-tab>
        <button clrTabLink type="button">Extensions</button>
        <clr-tab-content *clrIfActive>
          <div class="pgc-pane"><pg-extensions-panel></pg-extensions-panel></div>
        </clr-tab-content>
      </clr-tab>
      <clr-tab>
        <button clrTabLink type="button">Parameters <span class="badge">{{ paramCount() }}</span></button>
        <clr-tab-content *clrIfActive>
          <div class="pgc-pane pgc-parameters">
            <pg-state [state]="state()" hint="명시 파라미터 없음" [sub]="providerLabel() + ' 기본 튜닝을 사용합니다.'" (retry)="svc.refresh()">
              <pg-kv [params]="svc.params()"></pg-kv>
            </pg-state>
          </div>
        </clr-tab-content>
      </clr-tab>
    </clr-tabs>
  `,
})
export class PgConfigTab {
  readonly svc = inject(CnpgService);
  providerLabel(): string { return 'StackGres'; }
  readonly res = computed(() => this.svc.resources());
  readonly paramCount = computed(() => Object.keys(this.svc.params()).length);
  readonly state = computed(() => (this.paramCount() ? 'ok' : (this.svc.clusterState() === 'ok' ? 'empty' : this.svc.clusterState())));
}
