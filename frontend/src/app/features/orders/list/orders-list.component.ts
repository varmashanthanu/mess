import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { ApiService } from '../../../core/services/api.service';
import { AuthService } from '../../../core/services/auth.service';
import { FreightOrder } from '../../../core/models/order.model';

@Component({
  selector: 'app-orders-list',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule, TranslateModule],
  template: `
    <div class="orders-page">
      <div class="page-header">
        <h1>{{ 'ORDERS.TITLE' | translate }}</h1>
        <a class="btn-primary" routerLink="/orders/new"
           *ngIf="auth.hasRole('SHIPPER', 'ADMIN')">{{ 'ORDERS.NEW' | translate }}</a>
      </div>

      <div class="filters card mb-2">
        <select [(ngModel)]="statusFilter" (change)="load()">
          <option value="">{{ 'ORDERS.FILTER_STATUS' | translate }}</option>
          <option *ngFor="let s of statuses" [value]="s.value">{{ 'ORDERS.STATUS.' + s.value | translate }}</option>
        </select>
        <input type="text" [(ngModel)]="search" [placeholder]="'COMMON.SEARCH' | translate" (input)="load()" />
      </div>

      <div class="loading-overlay" *ngIf="loading()">⏳ {{ 'COMMON.LOADING' | translate }}</div>

      <div class="card" *ngIf="!loading()">
        <div class="empty-state" *ngIf="!orders().length">
          <div class="empty-icon">📦</div>
          <h3>{{ 'ORDERS.EMPTY_TITLE' | translate }}</h3>
        </div>

        <div class="table-wrap" *ngIf="orders().length">
        <table class="mess-table">
          <thead>
            <tr>
              <th>{{ 'ORDERS.COL_REF' | translate }}</th>
              <th>{{ 'ORDERS.COL_ROUTE' | translate }}</th>
              <th>{{ 'ORDERS.COL_STATUS' | translate }}</th>
              <th>{{ 'ORDERS.COL_WEIGHT' | translate }}</th>
              <th>{{ 'ORDERS.COL_DATE' | translate }}</th>
              <th>{{ 'ORDERS.COL_BUDGET' | translate }}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let o of orders()" [routerLink]="['/orders', o.id]" style="cursor:pointer">
              <td><strong>{{ o.reference }}</strong></td>
              <td>
                <div style="font-size:13px">{{ o.pickup_city }} → {{ o.delivery_city }}</div>
                <div class="route-sub">{{ o.pickup_address | slice:0:40 }}...</div>
              </td>
              <td><span class="badge badge--{{ o.status.toLowerCase() }}">{{ 'ORDERS.STATUS.' + o.status | translate }}</span></td>
              <td>{{ o.weight_kg }} kg</td>
              <td>{{ o.pickup_scheduled_at | date:'dd/MM/yy' }}</td>
              <td>{{ o.proposed_price ? (o.proposed_price | number) + ' XOF' : '—' }}</td>
              <td><a [routerLink]="['/orders', o.id]" class="btn-sm">{{ 'COMMON.VIEW' | translate }}</a></td>
            </tr>
          </tbody>
        </table>
        </div>

        <div class="pagination" *ngIf="totalCount() > pageSize">
          <button [disabled]="page === 1" (click)="changePage(-1)">{{ 'ORDERS.PREV' | translate }}</button>
          <span>{{ 'ORDERS.PAGE_OF' | translate: { page: page, total: totalCount() } }}</span>
          <button [disabled]="!hasNext()" (click)="changePage(1)">{{ 'ORDERS.NEXT' | translate }}</button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .orders-page { max-width: 1100px; }
    .page-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; gap: 12px; flex-wrap: wrap; }
    h1 { font-size: 24px; font-weight: 700; color: var(--text-primary); }
    .btn-primary { padding: 10px 18px; background: var(--gold); color: #111; border-radius: 8px; text-decoration: none; font-size: 14px; font-weight: 600; white-space: nowrap; }
    .filters { display: flex; gap: 12px; align-items: center; margin-bottom: 16px; padding: 16px; flex-wrap: wrap; }
    select, input {
      padding: 9px 12px; border: 1.5px solid var(--border); border-radius: 8px;
      font-size: 14px; outline: none; background: var(--surface); color: var(--text-primary);
    }
    select:focus, input:focus { border-color: var(--gold); }
    input { flex: 1; min-width: 120px; }
    .table-wrap { overflow-x: auto; -webkit-overflow-scrolling: touch; }
    .mess-table { width: 100%; border-collapse: collapse; min-width: 600px; }
    .mess-table th { text-align: left; padding: 12px 16px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-secondary); border-bottom: 2px solid var(--border); background: var(--surface-raised); }
    .mess-table td { padding: 14px 16px; border-bottom: 1px solid var(--border); color: var(--text-primary); }
    .mess-table tr:hover td { background: var(--surface-raised); }
    .route-sub { font-size: 11px; color: var(--text-secondary); }
    .badge { display: inline-block; padding: 3px 10px; border-radius: 12px; font-size: 10px; font-weight: 700; text-transform: uppercase; }
    .badge--draft{background:rgba(158,158,158,0.15);color:#9E9E9E}.badge--posted{background:rgba(21,101,192,0.15);color:#64B5F6}.badge--assigned{background:rgba(106,27,154,0.15);color:#CE93D8}.badge--in_transit{background:rgba(46,125,50,0.15);color:#81C784}.badge--delivered{background:rgba(0,105,92,0.15);color:#4DB6AC}.badge--completed{background:rgba(27,94,32,0.15);color:#A5D6A7}.badge--cancelled{background:rgba(183,28,28,0.15);color:#EF9A9A}.badge--disputed{background:rgba(136,14,79,0.15);color:#F48FB1}.badge--pickup_pending{background:rgba(245,127,23,0.15);color:#FFD54F}.badge--picked_up{background:rgba(40,53,147,0.15);color:#9FA8DA}
    .btn-sm { padding: 5px 12px; background: var(--surface-raised); color: var(--text-primary); border: 1px solid var(--border); border-radius: 6px; text-decoration: none; font-size: 12px; font-weight: 600; }
    .pagination { display: flex; align-items: center; justify-content: space-between; padding: 16px; border-top: 1px solid var(--border); font-size: 13px; color: var(--text-secondary); gap: 8px; }
    .pagination button { padding: 8px 14px; border: 1px solid var(--border); background: var(--surface); color: var(--text-primary); border-radius: 6px; cursor: pointer; font-size: 13px; }
    .pagination button:disabled { opacity: 0.4; cursor: not-allowed; }
    .mb-2 { margin-bottom: 16px; }
    .empty-state { padding: 48px; text-align: center; color: var(--text-secondary); }
    .empty-icon { font-size: 40px; margin-bottom: 12px; }
    h3 { font-size: 16px; font-weight: 600; color: var(--text-primary); }
    @media (max-width: 600px) {
      h1 { font-size: 20px; }
      .filters { padding: 12px; }
      select { width: 100%; }
      .mess-table th, .mess-table td { padding: 10px 12px; }
      .pagination { flex-wrap: wrap; justify-content: center; }
    }
  `]
})
export class OrdersListComponent implements OnInit {
  auth = inject(AuthService);
  private api = inject(ApiService);

  loading = signal(true);
  orders = signal<FreightOrder[]>([]);
  totalCount = signal(0);
  page = 1;
  pageSize = 20;
  statusFilter = '';
  search = '';

  statuses = [
    { value: 'DRAFT' }, { value: 'POSTED' }, { value: 'ASSIGNED' },
    { value: 'IN_TRANSIT' }, { value: 'DELIVERED' }, { value: 'COMPLETED' }, { value: 'CANCELLED' },
  ];

  ngOnInit(): void { this.load(); }

  load(): void {
    this.loading.set(true);
    const params: Record<string, string> = { page: String(this.page), page_size: String(this.pageSize) };
    if (this.statusFilter) params['status'] = this.statusFilter;
    if (this.search) params['search'] = this.search;
    this.api.getOrders(params).subscribe({
      next: (res) => { this.orders.set(res.results); this.totalCount.set(res.count); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  changePage(dir: number): void { this.page += dir; this.load(); }
  hasNext(): boolean { return this.page * this.pageSize < this.totalCount(); }
}
