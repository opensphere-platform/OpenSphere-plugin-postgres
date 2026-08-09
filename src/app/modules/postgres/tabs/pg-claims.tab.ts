import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { ClaimsListComponent } from '../../claims-list.component';
import { NewClaimFormComponent } from '../../new-claim-form.component';

// Claims 탭 — 기존 new-claim-form + claims-list 래핑(우리 고유 provisioning 모델).
@Component({
  selector: 'pg-claims',
  standalone: true,
  imports: [CommonModule, ClaimsListComponent, NewClaimFormComponent],
  template: `
    <p class="os-sub">PostgresClaim은 전용 인스턴스, 기존 인스턴스의 새 Database, 기존 Database의 접근 계정을 하나의 계약으로 요청합니다.</p>
    <div class="os-sech">PostgreSQL 리소스 요청</div>
    <app-new-claim-form kind="pg" (created)="pgList.load()"></app-new-claim-form>
    <div class="os-sech">PostgresClaims</div>
    <app-claims-list #pgList kind="pg" version="v1beta1" plural="postgresclaims" primaryLabel="DB / 계정"></app-claims-list>
  `,
})
export class PgClaimsTab {}
