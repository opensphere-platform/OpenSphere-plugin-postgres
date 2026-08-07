import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ClarityModule } from '@clr/angular';
import { apiBase, hostFetch, writeHeaders } from '../../../api-base';
import { CnpgService } from '../cnpg.service';

type Operation = 'restart' | 'vacuum' | 'repack';

@Component({
  selector: 'pg-operations',
  standalone: true,
  imports: [CommonModule, FormsModule, ClarityModule],
  styles: [`:host{display:block}.pgo-head{display:flex;justify-content:space-between;align-items:end;gap:1rem}.pgo-head h2{margin:.1rem 0}.pgo-actions{display:flex;gap:.5rem;flex-wrap:wrap}.pgo-preview{max-height:15rem;overflow:auto;background:#f4f6f8;padding:.75rem;font-size:.75rem}`],
  template: `
    <section aria-label="PostgreSQL maintenance operations">
      <div class="pgo-head"><div><span class="vl-eyebrow">Controlled lifecycle</span><h2>유지보수 작업</h2><p>StackGres가 실행하는 작업만 생성하며, 직접 Pod 조작은 제공하지 않습니다.</p></div><div class="pgo-actions"><button class="btn btn-sm" type="button" (click)="refresh()" [disabled]="busy()">새로고침</button><button class="btn btn-sm" type="button" (click)="open('vacuum')">Vacuum</button><button class="btn btn-sm" type="button" (click)="open('repack')">Repack</button><button class="btn btn-sm btn-warning" type="button" (click)="open('restart')">Restart</button></div></div>
      <clr-alert *ngIf="error()" clrAlertType="danger" [clrAlertClosable]="false"><clr-alert-item><span class="alert-text">{{error()}}</span></clr-alert-item></clr-alert>
      <table class="table" *ngIf="operations().length"><thead><tr><th>작업</th><th>이름</th><th>상태</th><th>요청 시각</th></tr></thead><tbody><tr *ngFor="let item of operations()"><td>{{item.operation}}</td><td class="os-mono">{{item.name}}</td><td>{{item.phase}}</td><td>{{item.createdAt}}</td></tr></tbody></table>
      <p class="os-sub" *ngIf="!operations().length && !busy()">아직 요청된 유지보수 작업이 없습니다.</p>
    </section>
    <clr-modal [(clrModalOpen)]="modalOpen" [clrModalClosable]="!busy()"><h3 class="modal-title">{{operationLabel()}} 작업</h3><div class="modal-body"><p>{{operationDescription()}}</p><label>변경 사유<input [(ngModel)]="reason" placeholder="운영 유지보수 필요성 (8자 이상)" /></label><label>클러스터 이름 확인<input [(ngModel)]="confirm" [placeholder]="svc.name" /></label><label *ngIf="operation()==='restart'"><input type="checkbox" [(ngModel)]="onlyPendingRestart" /> 재시작 대기 Pod만 처리</label><ng-container *ngIf="operation()==='vacuum'"><label><input type="checkbox" [(ngModel)]="full" /> VACUUM FULL</label><label><input type="checkbox" [(ngModel)]="freeze" /> FREEZE</label></ng-container><clr-alert *ngIf="error()" clrAlertType="danger" [clrAlertClosable]="false"><clr-alert-item><span class="alert-text">{{error()}}</span></clr-alert-item></clr-alert><pre class="pgo-preview" *ngIf="preview()">{{preview() | json}}</pre></div><div class="modal-footer"><button class="btn btn-outline" type="button" (click)="modalOpen=false" [disabled]="busy()">취소</button><button class="btn" type="button" (click)="loadPreview()" [disabled]="busy()">미리보기</button><button class="btn btn-primary" type="button" (click)="apply()" [disabled]="busy() || !preview() || confirm!==svc.name">작업 요청</button></div></clr-modal>
  `,
})
export class PgOperationsTab implements OnInit {
  readonly svc = inject(CnpgService);
  readonly operations = signal<any[]>([]);
  readonly busy = signal(false);
  readonly error = signal('');
  readonly preview = signal<any>(null);
  readonly operation = signal<Operation>('restart');
  modalOpen = false; reason = ''; confirm = ''; onlyPendingRestart = true; full = false; freeze = false;
  ngOnInit(): void { void this.refresh(); }
  private url(): string { return `${apiBase()}/api/foundation/postgres/operations?cluster=${encodeURIComponent(`stackgres:${this.svc.ns}:${this.svc.name}`)}`; }
  async refresh(): Promise<void> { this.busy.set(true); this.error.set(''); try { const response = await hostFetch(this.url(), { cache: 'no-store' }); const body = await response.json().catch(() => ({})); if (!response.ok) throw new Error(body.error || `Operation HTTP ${response.status}`); this.operations.set(body.operations || []); } catch (error: any) { this.error.set(error?.message || String(error)); } finally { this.busy.set(false); } }
  open(operation: Operation): void { this.operation.set(operation); this.reason = ''; this.confirm = ''; this.onlyPendingRestart = true; this.full = false; this.freeze = false; this.preview.set(null); this.error.set(''); this.modalOpen = true; }
  operationLabel(): string { return ({ restart: 'Restart', vacuum: 'Vacuum', repack: 'Repack' })[this.operation()]; }
  operationDescription(): string { return ({ restart: 'StackGres가 안전한 순서로 PostgreSQL Pod를 재시작합니다.', vacuum: '선택한 클러스터 전체에 유지보수 Vacuum을 실행합니다.', repack: 'StackGres repack 작업을 요청합니다.' })[this.operation()]; }
  private body(dryRun: boolean): any { return { cluster: `stackgres:${this.svc.ns}:${this.svc.name}`, operation: this.operation(), onlyPendingRestart: this.onlyPendingRestart, full: this.full, freeze: this.freeze, reason: this.reason, confirm: this.confirm, dryRun }; }
  async loadPreview(): Promise<void> { this.busy.set(true); this.error.set(''); try { const response = await hostFetch(this.url(), { method: 'POST', headers: writeHeaders(), body: JSON.stringify(this.body(true)) }); const payload = await response.json().catch(() => ({})); if (!response.ok) throw new Error(payload.error || `Operation HTTP ${response.status}`); this.preview.set(payload); } catch (error: any) { this.preview.set(null); this.error.set(error?.message || String(error)); } finally { this.busy.set(false); } }
  async apply(): Promise<void> { this.busy.set(true); this.error.set(''); try { const response = await hostFetch(this.url(), { method: 'POST', headers: writeHeaders(), body: JSON.stringify(this.body(false)) }); const payload = await response.json().catch(() => ({})); if (!response.ok) throw new Error(payload.error || `Operation HTTP ${response.status}`); this.modalOpen = false; this.preview.set(null); await this.refresh(); } catch (error: any) { this.error.set(error?.message || String(error)); } finally { this.busy.set(false); } }
}
