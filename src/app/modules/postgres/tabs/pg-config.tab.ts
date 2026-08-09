import { CommonModule } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { CnpgService } from '../cnpg.service';
import { PgKv } from '../ui/pg-kv';
import { PgState } from '../ui/pg-state';
import { PgExtensionsPanel } from './pg-extensions.panel';

@Component({
  selector: 'pg-config',
  standalone: true,
  imports: [CommonModule, PgKv, PgState, PgExtensionsPanel],
  styles: [`
    .pgc-workspace{margin-top:1rem}
    .pgc-tab-toggle{position:absolute;width:1px;height:1px;opacity:0;pointer-events:none}
    .pgc-tab-label{display:inline-block;margin:0 1rem 0 0;padding:.45rem .35rem .35rem;border-bottom:2px solid transparent;color:#565656;cursor:pointer}
    .pgc-tab-label:hover{color:#0072a3}
    .pgc-tab-toggle:focus-visible + .pgc-tab-label{outline:2px solid #0072a3;outline-offset:2px}
    #pgc-extensions-tab:checked + .pgc-tab-label,#pgc-parameters-tab:checked + .pgc-tab-label{border-bottom-color:#0072a3;color:#1b2a32}
    .pgc-tab-panels{border-top:1px solid #d7dce1}
    .pgc-pane{display:none;padding:.75rem .15rem 1rem 0}
    #pgc-extensions-tab:checked ~ .pgc-tab-panels .pgc-extensions-pane{display:block}
    #pgc-parameters-tab:checked ~ .pgc-tab-panels .pgc-parameters-pane{display:block}
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

    <div class="pgc-workspace" role="group" aria-label="PostgreSQL 설정 영역">
      <input class="pgc-tab-toggle" type="radio" name="pgc-workspace" id="pgc-extensions-tab" checked>
      <label class="pgc-tab-label" for="pgc-extensions-tab">Extensions</label>
      <input class="pgc-tab-toggle" type="radio" name="pgc-workspace" id="pgc-parameters-tab">
      <label class="pgc-tab-label" for="pgc-parameters-tab">Parameters <span class="badge">{{ paramCount() }}</span></label>

      <div class="pgc-tab-panels">
        <section class="pgc-pane pgc-extensions-pane" id="pgc-extensions-panel" aria-label="Extensions">
          <pg-extensions-panel></pg-extensions-panel>
        </section>
        <section class="pgc-pane pgc-parameters pgc-parameters-pane" id="pgc-parameters-panel" aria-label="Parameters">
          <pg-state [state]="state()" hint="명시 파라미터 없음" [sub]="providerLabel() + ' 기본 튜닝을 사용합니다.'" (retry)="svc.refresh()">
            <pg-kv [params]="svc.params()"></pg-kv>
          </pg-state>
        </section>
      </div>
    </div>
  `,
})
export class PgConfigTab {
  readonly svc = inject(CnpgService);
  providerLabel(): string { return 'StackGres'; }
  readonly res = computed(() => this.svc.resources());
  readonly paramCount = computed(() => Object.keys(this.svc.params()).length);
  readonly state = computed(() => (this.paramCount() ? 'ok' : (this.svc.clusterState() === 'ok' ? 'empty' : this.svc.clusterState())));
}
