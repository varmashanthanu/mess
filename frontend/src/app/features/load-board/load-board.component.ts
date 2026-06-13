import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { ApiService } from '../../core/services/api.service';
import { FreightOrder } from '../../core/models/order.model';

const CARGO_TYPES = ['GENERAL','REFRIGERATED','HAZARDOUS','LIVESTOCK','BULK','CONSTRUCTION','ELECTRONICS'] as const;

@Component({
  selector: 'app-load-board',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule, TranslateModule],
  template: `
    <div class="load-board-page">
      <div class="page-header">
        <div>
          <h1>{{ 'NAV.LOAD_BOARD' | translate }}</h1>
          <p class="subtitle">{{ 'LOAD_BOARD.SUBTITLE' | translate }}</p>
        </div>
        <div class="result-count" *ngIf="!loading()">
          {{ 'LOAD_BOARD.RESULTS' | translate: { count: totalCount() } }}
        </div>
      </div>

      <!-- Filter panel -->
      <div class="filter-panel card mb-2">
        <div class="filter-header" (click)="filtersOpen = !filtersOpen">
          <span class="filter-title">🔽 {{ 'LOAD_BOARD.FILTERS' | translate }}</span>
          <span class="active-badge" *ngIf="activeFiltersCount > 0">{{ activeFiltersCount }}</span>
          <span class="filter-chevron">{{ filtersOpen ? '▲' : '▼' }}</span>
        </div>

        <div class="filter-body" *ngIf="filtersOpen">
          <!-- Row 1: search + cities -->
          <div class="filter-row">
            <div class="filter-group filter-group--wide">
              <label>🔍 {{ 'COMMON.SEARCH' | translate }}</label>
              <input type="text" [(ngModel)]="search" [placeholder]="'COMMON.SEARCH' | translate" (input)="onFilterChange()" />
            </div>
            <div class="filter-group">
              <label>📍 {{ 'LOAD_BOARD.PICKUP_CITY' | translate }}</label>
              <input type="text" [(ngModel)]="pickupCity" [placeholder]="'LOAD_BOARD.PICKUP_CITY_PH' | translate" (input)="onFilterChange()" />
            </div>
            <div class="filter-group">
              <label>🏁 {{ 'LOAD_BOARD.DELIVERY_CITY' | translate }}</label>
              <input type="text" [(ngModel)]="deliveryCity" [placeholder]="'LOAD_BOARD.DELIVERY_CITY_PH' | translate" (input)="onFilterChange()" />
            </div>
          </div>

          <!-- Row 2: cargo type + price + sort + reset -->
          <div class="filter-row">
            <div class="filter-group">
              <label>📦 {{ 'LOAD_BOARD.CARGO_TYPE' | translate }}</label>
              <select [(ngModel)]="cargoType" (change)="onFilterChange()">
                <option value="">{{ 'COMMON.ALL' | translate }}</option>
                <option *ngFor="let t of cargoTypes" [value]="t">
                  {{ 'ORDERS.CREATE.CARGO_TYPES.' + t | translate }}
                </option>
              </select>
            </div>
            <div class="filter-group">
              <label>💰 {{ 'LOAD_BOARD.MAX_PRICE' | translate }}</label>
              <input type="number" [(ngModel)]="maxPrice" [placeholder]="'LOAD_BOARD.MAX_PRICE_PH' | translate" (input)="onFilterChange()" min="0" />
            </div>
            <div class="filter-group">
              <label>↕ {{ 'LOAD_BOARD.SORT' | translate }}</label>
              <select [(ngModel)]="ordering" (change)="onFilterChange()">
                <option value="-pickup_scheduled_at">{{ 'LOAD_BOARD.SORT_DATE' | translate }}</option>
                <option value="proposed_price">{{ 'LOAD_BOARD.SORT_PRICE_ASC' | translate }}</option>
                <option value="-proposed_price">{{ 'LOAD_BOARD.SORT_PRICE_DESC' | translate }}</option>
                <option value="weight_kg">{{ 'LOAD_BOARD.SORT_WEIGHT' | translate }}</option>
              </select>
            </div>
            <div class="filter-group filter-group--reset">
              <button class="btn-reset" (click)="resetFilters()" *ngIf="activeFiltersCount > 0">
                ✕ {{ 'LOAD_BOARD.RESET' | translate }}
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Loading -->
      <div class="loading-overlay" *ngIf="loading()">⏳ {{ 'COMMON.LOADING' | translate }}</div>

      <!-- Results -->
      <div class="card" *ngIf="!loading()">
        <div class="empty-state" *ngIf="!orders().length">
          <div class="empty-icon">📋</div>
          <h3>{{ 'LOAD_BOARD.EMPTY_TITLE' | translate }}</h3>
          <p>{{ 'LOAD_BOARD.EMPTY_SUBTITLE' | translate }}</p>
        </div>

        <div class="table-wrap" *ngIf="orders().length">
          <table class="mess-table">
            <thead>
              <tr>
                <th>{{ 'ORDERS.COL_REF' | translate }}</th>
                <th>{{ 'LOAD_BOARD.COL_DISTANCE' | translate }}</th>
                <th>{{ 'LOAD_BOARD.COL_TYPE' | translate }}</th>
                <th>{{ 'ORDERS.COL_WEIGHT' | translate }}</th>
                <th>{{ 'ORDERS.COL_DATE' | translate }}</th>
                <th>{{ 'ORDERS.COL_BUDGET' | translate }}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let o of orders()" [routerLink]="['/orders', o.id]" class="order-row">
                <td>
                  <strong class="ref">{{ o.reference }}</strong>
                </td>
                <td>
                  <div class="route-main">{{ o.pickup_city }} → {{ o.delivery_city }}</div>
                  <div class="route-sub">{{ o.pickup_address | slice:0:36 }}…</div>
                </td>
                <td>
                  <span class="cargo-badge cargo-badge--{{ o.cargo_type.toLowerCase() }}">
                    {{ 'ORDERS.CREATE.CARGO_TYPES.' + o.cargo_type | translate }}
                  </span>
                </td>
                <td class="num">{{ o.weight_kg | number }} kg</td>
                <td class="date">{{ o.pickup_scheduled_at | date:'dd/MM/yy' }}</td>
                <td class="price">{{ o.proposed_price ? (o.proposed_price | number) + ' XOF' : '—' }}</td>
                <td><a [routerLink]="['/orders', o.id]" class="btn-view">{{ 'COMMON.VIEW' | translate }}</a></td>
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
    .load-board-page { max-width: 1100px; }
    .page-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 16px; flex-wrap: wrap; gap: 12px; }
    h1 { font-size: 24px; font-weight: 700; margin-bottom: 2px; color: var(--text-primary); }
    .subtitle { font-size: 13px; color: var(--text-secondary); }
    .result-count { font-size: 13px; color: var(--text-secondary); align-self: flex-end; padding-bottom: 4px; }
    .mb-2 { margin-bottom: 16px; }
    .card { background: var(--surface); border-radius: 12px; padding: 20px; box-shadow: var(--shadow); border: 1px solid var(--border); }

    /* Filter panel */
    .filter-panel { padding: 0; overflow: hidden; }
    .filter-header {
      display: flex; align-items: center; gap: 8px; padding: 14px 20px;
      cursor: pointer; user-select: none;
    }
    .filter-header:hover { background: var(--surface-raised); }
    .filter-title { font-size: 13px; font-weight: 700; color: var(--text-primary); flex: 1; }
    .filter-chevron { font-size: 11px; color: var(--text-secondary); }
    .active-badge {
      background: var(--gold); color: #111; font-size: 11px; font-weight: 800;
      border-radius: 50%; width: 18px; height: 18px; display: flex; align-items: center; justify-content: center;
    }
    .filter-body { padding: 0 20px 16px; border-top: 1px solid var(--border); }
    .filter-row { display: flex; gap: 12px; margin-top: 14px; flex-wrap: wrap; }
    .filter-group { display: flex; flex-direction: column; gap: 5px; flex: 1; min-width: 140px; }
    .filter-group--wide { flex: 2; }
    .filter-group--reset { justify-content: flex-end; min-width: 100px; flex: 0; }
    .filter-group label { font-size: 11px; font-weight: 700; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.4px; }
    .filter-group input, .filter-group select {
      padding: 8px 10px; border: 1.5px solid var(--border); border-radius: 8px;
      font-size: 13px; background: var(--surface-raised); color: var(--text-primary);
      font-family: inherit; outline: none;
    }
    .filter-group input:focus, .filter-group select:focus { border-color: var(--gold); }
    .btn-reset {
      padding: 8px 14px; background: rgba(244,67,54,0.1); color: #EF5350;
      border: 1px solid rgba(244,67,54,0.3); border-radius: 8px;
      font-size: 12px; font-weight: 700; cursor: pointer; white-space: nowrap;
      transition: background .15s;
    }
    .btn-reset:hover { background: rgba(244,67,54,0.18); }

    /* Table */
    .table-wrap { overflow-x: auto; -webkit-overflow-scrolling: touch; }
    .mess-table { width: 100%; border-collapse: collapse; min-width: 620px; }
    .mess-table th { text-align: left; padding: 11px 14px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-secondary); border-bottom: 2px solid var(--border); background: var(--surface-raised); }
    .mess-table td { padding: 13px 14px; border-bottom: 1px solid var(--border); color: var(--text-primary); vertical-align: middle; }
    .order-row { cursor: pointer; }
    .order-row:hover td { background: var(--surface-raised); }
    .ref { font-size: 13px; font-weight: 700; letter-spacing: 0.3px; }
    .route-main { font-size: 13px; font-weight: 600; }
    .route-sub { font-size: 11px; color: var(--text-secondary); margin-top: 2px; }
    .num, .date, .price { font-size: 13px; white-space: nowrap; }
    .price { font-weight: 600; color: var(--gold); }

    /* Cargo badge */
    .cargo-badge { display: inline-block; padding: 3px 8px; border-radius: 6px; font-size: 11px; font-weight: 700; white-space: nowrap; }
    .cargo-badge--general    { background: rgba(33,150,243,0.12); color: #64B5F6; }
    .cargo-badge--refrigerated{ background: rgba(0,188,212,0.12); color: #4DD0E1; }
    .cargo-badge--hazardous  { background: rgba(244,67,54,0.12); color: #EF9A9A; }
    .cargo-badge--livestock  { background: rgba(139,195,74,0.12); color: #AED581; }
    .cargo-badge--bulk       { background: rgba(255,193,7,0.12); color: #FFD54F; }
    .cargo-badge--construction{ background: rgba(121,85,72,0.12); color: #BCAAA4; }
    .cargo-badge--electronics{ background: rgba(156,39,176,0.12); color: #CE93D8; }

    .btn-view { padding: 5px 12px; background: #FF6B35; color: white; border-radius: 6px; text-decoration: none; font-size: 12px; font-weight: 600; white-space: nowrap; }

    /* Misc */
    .pagination { display: flex; align-items: center; justify-content: space-between; padding: 16px 0 0; border-top: 1px solid var(--border); font-size: 13px; color: var(--text-secondary); gap: 8px; flex-wrap: wrap; margin-top: 8px; }
    .pagination button { padding: 8px 14px; border: 1px solid var(--border); background: var(--surface-raised); color: var(--text-primary); border-radius: 6px; cursor: pointer; font-size: 13px; }
    .pagination button:disabled { opacity: 0.4; cursor: not-allowed; }
    .empty-state { padding: 48px; text-align: center; color: var(--text-secondary); }
    .empty-icon { font-size: 40px; margin-bottom: 12px; }
    h3 { font-size: 16px; font-weight: 600; margin-bottom: 8px; color: var(--text-primary); }
    .loading-overlay { text-align: center; padding: 40px; color: var(--text-secondary); }

    @media (max-width: 700px) {
      h1 { font-size: 20px; }
      .filter-row { flex-direction: column; }
      .filter-group--wide { flex: 1; }
      .card { padding: 12px; }
    }
  `]
})
export class LoadBoardComponent implements OnInit {
  private api = inject(ApiService);

  loading   = signal(true);
  orders    = signal<FreightOrder[]>([]);
  totalCount = signal(0);

  page     = 1;
  pageSize = 20;

  // Filters
  search       = '';
  pickupCity   = '';
  deliveryCity = '';
  cargoType    = '';
  maxPrice     = '';
  ordering     = '-pickup_scheduled_at';
  filtersOpen  = true;

  readonly cargoTypes = [...CARGO_TYPES];

  get activeFiltersCount(): number {
    return [this.search, this.pickupCity, this.deliveryCity, this.cargoType, this.maxPrice]
      .filter(v => v !== '').length;
  }

  ngOnInit(): void { this.load(); }

  onFilterChange(): void {
    this.page = 1;
    this.load();
  }

  load(): void {
    this.loading.set(true);
    const params: Record<string, string> = {
      page:      String(this.page),
      page_size: String(this.pageSize),
      status:    'POSTED',
      ordering:  this.ordering,
    };
    if (this.search)       params['search']        = this.search;
    if (this.pickupCity)   params['pickup_city']   = this.pickupCity;
    if (this.deliveryCity) params['delivery_city'] = this.deliveryCity;
    if (this.cargoType)    params['cargo_type']    = this.cargoType;
    if (this.maxPrice)     params['max_price']     = this.maxPrice;

    this.api.getOrders(params).subscribe({
      next:  (res) => { this.orders.set(res.results); this.totalCount.set(res.count); this.loading.set(false); },
      error: ()    => this.loading.set(false),
    });
  }

  resetFilters(): void {
    this.search = this.pickupCity = this.deliveryCity = this.cargoType = this.maxPrice = '';
    this.ordering = '-pickup_scheduled_at';
    this.page = 1;
    this.load();
  }

  changePage(dir: number): void { this.page += dir; this.load(); }
  hasNext(): boolean { return this.page * this.pageSize < this.totalCount(); }
}
