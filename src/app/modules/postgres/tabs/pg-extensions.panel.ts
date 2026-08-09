import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ClarityModule } from '@clr/angular';
import { PgAdminService } from '../admin/pg-admin.service';
import { PostgresExtensionCatalogItem, PostgresExtensionSelection, PostgresFleetService } from '../postgres-fleet.service';

@Component({
  selector: 'pg-extensions-panel',
  standalone: true,
  imports: [CommonModule, FormsModule, ClarityModule],
  styles: [`
    :host{display:block;margin-top:1rem}.pge-head{display:flex;justify-content:space-between;align-items:end;gap:1rem;border-bottom:1px solid #d7dce1;padding-bottom:.55rem}.pge-head h2{margin:0 0 .15rem;font-size:1rem}.pge-head p{margin:0;color:#5b6573;font-size:.75rem}.pge-summary{display:flex;gap:.4rem;align-items:center;white-space:nowrap}.pge-tools{display:grid;grid-template-columns:minmax(14rem,2fr) minmax(10rem,1fr);gap:1rem;align-items:end;margin:.75rem 0}.pge-table-wrap{border:1px solid #d7dce1;max-height:25rem;overflow:auto}.pge-table{width:100%;border-collapse:collapse;font-size:.75rem}.pge-table th{position:sticky;top:0;z-index:1;background:#eef1f4;color:#313944;text-align:left;padding:.5rem .65rem}.pge-table td{padding:.45rem .65rem;border-top:1px solid #e6e9ec;vertical-align:middle}.pge-table tr.selected{background:#eef6ff}.pge-name{font-weight:600}.pge-desc{color:#5b6573;max-width:38rem}.pge-version{width:8rem}.pge-actions{display:flex;gap:.5rem;align-items:end;flex-wrap:wrap;margin-top:.75rem}.pge-reason{min-width:23rem}.pge-preview{margin-top:.6rem;background:#f4f6f8;border-left:3px solid #0f62fe;padding:.65rem;font-size:.72rem;white-space:pre-wrap}.pge-db{display:grid;grid-template-columns:minmax(12rem,1fr) minmax(12rem,1fr) minmax(12rem,1fr) auto;gap:1rem;align-items:end;margin-top:.75rem}.pge-empty{padding:1.5rem;text-align:center;color:#5b6573}@media(max-width:900px){.pge-tools,.pge-db{grid-template-columns:1fr}.pge-reason{min-width:0}}
  `],
  template: `
    <section aria-labelledby="postgres-extensions-title">
      <div class="pge-head">
        <div><h2 id="postgres-extensions-title">Extensions</h2><p>선택한 PostgreSQL major와 호환되는 StackGres 확장 바이너리를 클러스터에 할당합니다. 데이터베이스 활성화는 아래에서 별도로 수행합니다.</p></div>
        <div class="pge-summary"><span class="label label-info">PostgreSQL {{ view()?.postgresVersion || '—' }}</span><span class="label">{{ draft().length }} allocated</span><span *ngIf="view()?.pendingRestart" class="label label-warning">Restart pending</span></div>
      </div>

      <clr-alert *ngIf="fleet.extensionsState()==='error'" clrAlertType="danger" [clrAlertClosable]="false"><clr-alert-item><span class="alert-text">{{ fleet.extensionsError() }}</span></clr-alert-item></clr-alert>
      <div class="pge-tools">
        <clr-input-container><label>확장 검색</label><input clrInput name="extensionSearch" [(ngModel)]="search" placeholder="이름, 설명 또는 태그" /></clr-input-container>
        <clr-select-container><label>라이선스</label><select clrSelect name="extensionLicense" [(ngModel)]="license"><option value="">전체</option><option *ngFor="let item of licenses()" [value]="item">{{ item }}</option></select></clr-select-container>
      </div>

      <div class="pge-table-wrap" *ngIf="fleet.extensionsState()!=='loading'; else loading">
        <table class="pge-table" aria-label="호환 PostgreSQL Extensions">
          <thead><tr><th>할당</th><th>이름</th><th>버전</th><th>라이선스</th><th>설명</th></tr></thead>
          <tbody>
            <tr *ngFor="let item of filteredCatalog()" [class.selected]="isSelected(item)">
              <td><clr-checkbox-wrapper><input clrCheckbox type="checkbox" [ngModel]="isSelected(item)" (ngModelChange)="toggle(item, $event)" [ngModelOptions]="{standalone:true}" aria-label="{{item.name}} 할당" /></clr-checkbox-wrapper></td>
              <td><span class="pge-name">{{ item.name }}</span><div class="os-dim">{{ item.publisher }}</div></td>
              <td><select class="pge-version" [ngModel]="selectedVersion(item)" (ngModelChange)="setVersion(item, $event)" [ngModelOptions]="{standalone:true}" [disabled]="!isSelected(item)"><option *ngFor="let version of item.versions" [value]="version">{{ version }}</option></select></td>
              <td>{{ item.license || '—' }}</td><td class="pge-desc">{{ item.abstract || item.description || '설명 없음' }}</td>
            </tr>
          </tbody>
        </table>
        <div class="pge-empty" *ngIf="!filteredCatalog().length">조건에 맞는 확장이 없습니다.</div>
      </div>
      <ng-template #loading><div class="pge-empty"><span class="spinner spinner-sm"></span> 호환 확장 카탈로그를 확인하고 있습니다.</div></ng-template>

      <div class="pge-actions">
        <clr-input-container class="pge-reason"><label>변경 사유</label><input clrInput name="extensionReason" [(ngModel)]="reason" placeholder="운영 변경 사유 (8자 이상)" /></clr-input-container>
        <button class="btn btn-sm" type="button" (click)="preview()" [disabled]="busy || reason.trim().length<8">변경 미리보기</button>
        <button class="btn btn-sm btn-primary" type="button" (click)="apply()" [disabled]="busy || reason.trim().length<8">클러스터에 적용</button>
        <button class="btn btn-sm btn-link" type="button" (click)="reload()" [disabled]="busy">새로고침</button>
      </div>
      <div class="pge-preview" *ngIf="result">{{ result }}</div>

      <div class="pge-head" style="margin-top:1.25rem">
        <div><h2>Database activation</h2><p>클러스터에 할당된 확장을 선택한 데이터베이스에 CREATE / UPDATE / DROP EXTENSION으로 반영합니다.</p></div>
      </div>
      <div class="pge-db">
        <clr-select-container><label>Database</label><select clrSelect name="extensionDatabase" [(ngModel)]="database"><option *ngFor="let item of admin.catalog()?.databases || []" [value]="item.name">{{ item.name }}</option></select></clr-select-container>
        <clr-select-container><label>Extension</label><select clrSelect name="databaseExtension" [(ngModel)]="databaseExtension"><option *ngFor="let item of databaseExtensionOptions()" [value]="item.name">{{ item.name }}{{ item.installed ? ' · active' : '' }}</option></select></clr-select-container>
        <clr-select-container><label>작업</label><select clrSelect name="databaseExtensionAction" [(ngModel)]="databaseAction"><option value="create-extension">CREATE</option><option value="update-extension">UPDATE</option><option value="drop-extension">DROP</option></select></clr-select-container>
        <button class="btn btn-sm btn-primary" type="button" (click)="applyDatabase()" [disabled]="busy || !database || !databaseExtension || reason.trim().length<8">데이터베이스에 적용</button>
      </div>
    </section>
  `,
})
export class PgExtensionsPanel implements OnInit {
  readonly fleet = inject(PostgresFleetService);
  readonly admin = inject(PgAdminService);
  readonly view = computed(() => this.fleet.extensions());
  readonly draft = signal<PostgresExtensionSelection[]>([]);
  search = ''; license = ''; reason = ''; result = ''; busy = false;
  database = ''; databaseExtension = ''; databaseAction: 'create-extension' | 'update-extension' | 'drop-extension' = 'create-extension';
  readonly licenses = computed(() => [...new Set((this.view()?.catalog || []).map((item) => item.license).filter(Boolean))].sort());
  readonly filteredCatalog = computed(() => {
    const query = this.search.trim().toLowerCase();
    return (this.view()?.catalog || []).filter((item) => (!this.license || item.license === this.license)
      && (!query || [item.name, item.abstract, item.description, ...(item.tags || [])].join(' ').toLowerCase().includes(query)));
  });
  readonly databaseExtensionOptions = computed(() => {
    const rows = new Map<string, { name: string; version?: string; installed: boolean }>();
    for (const item of this.draft()) rows.set(item.name, { name: item.name, version: item.version, installed: false });
    for (const item of this.admin.catalog()?.extensions || []) rows.set(item.name, { name: item.name, version: item.version, installed: true });
    return [...rows.values()].sort((a, b) => a.name.localeCompare(b.name));
  });

  async ngOnInit(): Promise<void> { await this.reload(); }
  private clusterId(): string { return this.fleet.selected()?.id || ''; }
  async reload(): Promise<void> {
    const cluster = this.clusterId(); if (!cluster) return;
    this.busy = true; this.result = '';
    await Promise.all([this.fleet.refreshExtensions({ cluster }), this.admin.refresh()]);
    this.draft.set((this.view()?.desired || []).map((item) => ({ ...item })));
    this.database = this.admin.selectedDatabase(); this.databaseExtension = this.draft()[0]?.name || '';
    this.busy = false;
  }
  private key(item: PostgresExtensionSelection): string { return `${item.publisher || 'com.ongres'}/${item.name}`; }
  isSelected(item: PostgresExtensionSelection): boolean { return this.draft().some((row) => this.key(row) === this.key(item)); }
  selectedVersion(item: PostgresExtensionCatalogItem): string { return this.draft().find((row) => this.key(row) === this.key(item))?.version || item.channels?.stable || item.versions[0] || ''; }
  toggle(item: PostgresExtensionCatalogItem, selected: boolean): void {
    if (selected) this.draft.update((rows) => [...rows, { name: item.name, version: item.channels?.stable || item.versions[0], publisher: item.publisher, ...(item.repository ? { repository: item.repository } : {}) }]);
    else this.draft.update((rows) => rows.filter((row) => this.key(row) !== this.key(item)));
    this.databaseExtension = this.draft()[0]?.name || '';
  }
  setVersion(item: PostgresExtensionCatalogItem, version: string): void { this.draft.update((rows) => rows.map((row) => this.key(row) === this.key(item) ? { ...row, version } : row)); }
  async preview(): Promise<void> {
    this.busy = true;
    try { const value = await this.fleet.previewExtensions(this.clusterId(), this.draft(), this.reason); this.result = JSON.stringify({ diff: value.diff, impact: value.impact }, null, 2); }
    catch (error: any) { this.result = error?.message || String(error); }
    finally { this.busy = false; }
  }
  async apply(): Promise<void> {
    this.busy = true;
    try { const value = await this.fleet.applyExtensions(this.clusterId(), this.draft(), this.reason); this.result = `클러스터 확장 할당 완료 · 추가 ${value.diff?.add?.length || 0}, 변경 ${value.diff?.update?.length || 0}, 제거 ${value.diff?.remove?.length || 0}`; }
    catch (error: any) { this.result = error?.message || String(error); }
    finally { this.busy = false; }
  }
  async applyDatabase(): Promise<void> {
    const selected = this.databaseExtensionOptions().find((item) => item.name === this.databaseExtension);
    if (!selected) return;
    this.busy = true;
    try {
      const ok = await this.admin.execute({ action: this.databaseAction, database: this.database, name: selected.name,
        version: this.databaseAction === 'drop-extension' ? undefined : selected.version, reason: this.reason });
      this.result = this.admin.actionResult();
      if (ok) await this.reload();
    } finally { this.busy = false; }
  }
}
