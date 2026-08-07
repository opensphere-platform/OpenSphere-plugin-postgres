import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ClarityModule } from '@clr/angular';
import { apiBase, hostFetch, writeHeaders } from '../../../api-base';
import { CnpgService } from '../cnpg.service';
import { PILL, phaseClass } from '../cnpg.types';
import { PgState } from '../ui/pg-state';

@Component({
  selector: 'pg-backups',
  standalone: true,
  imports: [CommonModule, FormsModule, ClarityModule, PgState],
  template: `
    <clr-alert *ngIf="!svc.backupConfigured()" clrAlertType="info" [clrAlertClosable]="false">
      <clr-alert-item><span class="alert-text"><b>백업 미구성</b> — 이 클러스터에 <code>.spec.backup</code>(object store / 볼륨 스냅샷)이 설정되지 않았습니다.
        백업·스케줄·복원은 object store 구성 후 활성화됩니다. <b>현재는 정상</b>이며 실패가 아닙니다.</span></clr-alert-item>
    </clr-alert>

    <ng-container *ngIf="svc.backupConfigured()">
      <div class="os-title-row">
        <div class="os-sech">백업</div>
        <button class="btn btn-sm btn-primary os-ml-auto" (click)="openBackup()" [disabled]="busy()">지금 백업</button>
      </div>
      <pg-state [state]="svc.backupState()" hint="백업 없음" sub="'지금 백업'으로 on-demand 백업을 만드세요." (retry)="svc.refresh()">
        <table class="table">
          <thead><tr><th>이름</th><th>상태</th><th>method</th><th>시작</th><th>완료</th></tr></thead>
          <tbody>
            <tr *ngFor="let b of svc.backups()">
              <td class="os-mono">{{ b.metadata?.name }}</td>
              <td><span class="label" [ngClass]="bcls(b)">{{ backupPhase(b) }}</span></td>
              <td>{{ b.spec?.method || b.status?.method || (svc.provider() === 'stackgres' ? 'SGBackup' : '—') }}</td>
              <td>{{ b.status?.startedAt || b.status?.process?.timing?.start || '—' }}</td>
              <td>{{ b.status?.stoppedAt || b.status?.process?.timing?.end || '—' }}</td>
            </tr>
          </tbody>
        </table>
      </pg-state>
    </ng-container>

    <div class="os-sech">스케줄 ({{ svc.provider() === 'stackgres' ? 'SGCluster backup configuration' : 'ScheduledBackup' }})</div>
    <clr-alert *ngIf="!svc.scheduled().length" clrAlertType="info" [clrAlertClosable]="false" [clrAlertLightweight]="true">
      <clr-alert-item><span class="alert-text">스케줄된 백업 없음.</span></clr-alert-item>
    </clr-alert>
    <table class="table" *ngIf="svc.scheduled().length">
      <thead><tr><th>이름</th><th>일정(cron)</th><th>중단</th><th>마지막</th></tr></thead>
      <tbody>
        <tr *ngFor="let s of svc.scheduled()">
          <td class="os-mono">{{ s.metadata?.name }}</td>
          <td class="os-mono">{{ s.spec?.schedule }}</td>
          <td>{{ s.spec?.suspend ? '⏸' : '▶' }}</td>
          <td>{{ s.status?.lastScheduleTime || '—' }}</td>
        </tr>
      </tbody>
    </table>
    <p class="os-sub" *ngIf="msg()">{{ msg() }}</p>

    <clr-modal [(clrModalOpen)]="backupOpen" [clrModalClosable]="!busy()">
      <h3 class="modal-title">즉시 백업</h3>
      <div class="modal-body"><p>선택한 클러스터의 StackGres 백업을 생성합니다. 백업 대상과 정책은 Cluster plan의 Object Storage 설정을 사용합니다.</p><label>변경 사유<input [(ngModel)]="reason" placeholder="업그레이드 전 복구 지점 생성" /></label><label>클러스터 이름 확인<input [(ngModel)]="confirm" [placeholder]="svc.name" /></label></div>
      <div class="modal-footer"><button class="btn btn-outline" type="button" (click)="backupOpen=false" [disabled]="busy()">취소</button><button class="btn btn-primary" type="button" (click)="trigger()" [disabled]="busy() || confirm!==svc.name">백업 생성</button></div>
    </clr-modal>
  `,
})
export class PgBackupsTab {
  readonly svc = inject(CnpgService);
  readonly busy = signal(false);
  readonly msg = signal('');
  backupOpen = false;
  reason = '';
  confirm = '';

  backupPhase(b: any): string { return b.status?.phase || b.status?.process?.status || '—'; }
  bcls(b: any): string { return PILL[phaseClass(this.backupPhase(b), false)]; }

  openBackup(): void { this.reason = ''; this.confirm = ''; this.msg.set(''); this.backupOpen = true; }

  // 즉시 백업도 Foundation 승인·감사 경계를 통과한다. 브라우저는 SGBackup을 직접 생성하지 않는다.
  async trigger(): Promise<void> {
    this.busy.set(true);
    this.msg.set('');
    try {
      const r = await hostFetch(`${apiBase()}/api/foundation/postgres/backups`, {
        method: 'POST', headers: writeHeaders(), body: JSON.stringify({
          cluster: `stackgres:${this.svc.ns}:${this.svc.name}`, reason: this.reason, confirm: this.confirm,
        }),
      });
      const body = await r.json().catch(() => ({}));
      if (r.ok) { this.msg.set(`✓ 백업 요청됨 · ${body.name || ''}`); this.backupOpen = false; await this.svc.refresh(); }
      else if (r.status === 403) { this.msg.set('권한 없음 — 백업 생성 권한이 필요합니다.'); }
      else { this.msg.set(body.error || ('실패 ' + r.status + ' — 백업 구성(object store)을 확인하세요.')); }
    } catch { this.msg.set('네트워크 오류'); }
    this.busy.set(false);
  }
}
