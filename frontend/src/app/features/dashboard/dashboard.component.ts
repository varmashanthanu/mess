import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { ApiService } from '../../core/services/api.service';
import { AuthService } from '../../core/services/auth.service';
import { FreightOrder } from '../../core/models/order.model';

type StatFilter = 'available' | 'in_transit' | 'delivered' | 'completed' | null;
interface StatCard { label: string; value: string | number; icon: string; color: string; filter: StatFilter; }

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink, TranslateModule],
  template: `
    <div class="dashboard">

      <!-- ── Welcome banner ── -->
      <div class="welcome-banner" [class.welcome-banner--driver]="isDriver()" [class.welcome-banner--shipper]="isShipper()">
        <div class="welcome-text">
          <div class="role-chip" *ngIf="isDriver()">{{ 'DASHBOARD.ROLE_DRIVER' | translate }}</div>
          <div class="role-chip role-chip--shipper" *ngIf="isShipper()">{{ 'DASHBOARD.ROLE_SHIPPER' | translate }}</div>
          <h1>{{ 'DASHBOARD.GREETING' | translate: { name: firstName() } }}</h1>
          <p class="today-date">{{ today() }}</p>
        </div>
        <div class="banner-actions">
          <a class="btn-primary" routerLink="/orders/new" *ngIf="isShipper()">
            {{ 'DASHBOARD.NEW_ORDER' | translate }}
          </a>
          <a class="btn-primary btn-driver" routerLink="/load-board" *ngIf="isDriver()">
            🗺️ {{ 'DASHBOARD.MY_DELIVERIES' | translate }}
          </a>
        </div>
      </div>

      <!-- ── Stats grid ── -->
      <div class="stats-grid">
        <div class="stat-card" *ngFor="let s of stats()"
             [class.stat-card--active]="activeFilter() === s.filter"
             (click)="setFilter(s.filter)">
          <div class="stat-icon" [style.background]="s.color + '18'" [style.color]="s.color">{{ s.icon }}</div>
          <div class="stat-body">
            <div class="stat-value" [style.color]="s.color">{{ s.value }}</div>
            <div class="stat-label">{{ s.label | translate }}</div>
          </div>
        </div>
      </div>

      <!-- ── Driver quick actions ── -->
      <div class="quick-actions" *ngIf="isDriver()">
        <div class="quick-title">{{ 'DASHBOARD.QUICK_ACTIONS' | translate }}</div>
        <div class="quick-grid">
          <a class="quick-card" routerLink="/load-board">
            <span class="quick-icon">📋</span>
            <span>{{ 'DASHBOARD.DRIVER.LOAD_BOARD' | translate }}</span>
          </a>
          <a class="quick-card" routerLink="/tracking">
            <span class="quick-icon">🗺️</span>
            <span>{{ 'DASHBOARD.DRIVER.TRACKING' | translate }}</span>
          </a>
          <a class="quick-card" routerLink="/messaging">
            <span class="quick-icon">💬</span>
            <span>{{ 'DASHBOARD.DRIVER.MESSAGING' | translate }}</span>
          </a>
          <a class="quick-card" routerLink="/profile">
            <span class="quick-icon">👤</span>
            <span>{{ 'DASHBOARD.DRIVER.PROFILE' | translate }}</span>
          </a>
        </div>
      </div>

      <!-- ── Shipper quick actions ── -->
      <div class="quick-actions quick-actions--shipper" *ngIf="isShipper()">
        <div class="quick-title">{{ 'DASHBOARD.QUICK_ACTIONS' | translate }}</div>
        <div class="quick-grid">
          <a class="quick-card" routerLink="/orders/new">
            <span class="quick-icon">➕</span>
            <span>{{ 'DASHBOARD.SHIPPER.NEW_ORDER' | translate }}</span>
          </a>
          <a class="quick-card" routerLink="/orders">
            <span class="quick-icon">📦</span>
            <span>{{ 'DASHBOARD.SHIPPER.MY_ORDERS' | translate }}</span>
          </a>
          <a class="quick-card" routerLink="/tracking">
            <span class="quick-icon">📍</span>
            <span>{{ 'DASHBOARD.SHIPPER.TRACKING' | translate }}</span>
          </a>
          <a class="quick-card" routerLink="/messaging">
            <span class="quick-icon">💬</span>
            <span>{{ 'DASHBOARD.SHIPPER.MESSAGING' | translate }}</span>
          </a>
        </div>
      </div>

      <!-- ── Recent orders section ── -->
      <div class="section">
        <div class="section-header">
          <h2>
            {{ (isDriver() ? 'DASHBOARD.RECENT_DRIVER' : 'DASHBOARD.RECENT_SHIPPER') | translate }}
          </h2>
          <div class="section-header-right">
            <span class="filter-badge" *ngIf="activeFilter()" (click)="setFilter(null)">
              {{ 'DASHBOARD.STATS.' + activeFilter()!.toUpperCase() | translate }} ✕
            </span>
            <a routerLink="/orders" class="see-all">{{ 'COMMON.SEE_ALL' | translate }}</a>
          </div>
        </div>

        <div class="loading-overlay" *ngIf="loading()">⏳ {{ 'COMMON.LOADING' | translate }}</div>

        <div class="orders-list" *ngIf="!loading() && filteredOrders().length">
          <div class="order-row" *ngFor="let o of filteredOrders()" [routerLink]="['/orders', o.id]">
            <div class="order-ref">
              <strong>{{ o.reference }}</strong>
              <span class="badge badge--{{ o.status.toLowerCase() }}">{{ 'ORDERS.STATUS.' + o.status | translate }}</span>
            </div>
            <div class="order-route">
              <span>📍 {{ o.pickup_city }}</span>
              <span class="route-arrow">→</span>
              <span>🏁 {{ o.delivery_city }}</span>
            </div>
            <div class="order-meta text-muted text-sm">
              {{ o.weight_kg }} kg · {{ formatDate(o.pickup_scheduled_at) }}
            </div>
          </div>
        </div>

        <div class="empty-state" *ngIf="!loading() && !filteredOrders().length">
          <div class="empty-icon">{{ isDriver() ? '🚚' : '📦' }}</div>
          <h3>{{ (isDriver() ? 'DASHBOARD.EMPTY_DRIVER_TITLE' : 'DASHBOARD.EMPTY_TITLE') | translate }}</h3>
          <p>{{ (isDriver() ? 'DASHBOARD.EMPTY_DRIVER_SUBTITLE' : 'DASHBOARD.EMPTY_SUBTITLE') | translate }}</p>
          <a class="btn-primary mt-2" [routerLink]="isDriver() ? '/load-board' : '/orders/new'">
            {{ (isDriver() ? 'DASHBOARD.EMPTY_DRIVER_CTA' : 'DASHBOARD.EMPTY_SHIPPER_CTA') | translate }}
          </a>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .dashboard { max-width: 1100px; }

    /* Welcome banner */
    .welcome-banner {
      display: flex; align-items: center; justify-content: space-between;
      margin-bottom: 24px; gap: 16px; flex-wrap: wrap;
      padding: 24px 28px; border-radius: 16px;
      background: linear-gradient(135deg, #1A1A1A 0%, #2A2A2A 100%);
      border-left: 5px solid #C9A227;
      box-shadow: 0 4px 20px rgba(0,0,0,0.15);
    }
    .welcome-banner--driver { border-left-color: #66BB6A; background: linear-gradient(135deg, #0D1B0F 0%, #1A2A1A 100%); }
    .welcome-banner--shipper { border-left-color: #C9A227; }
    .role-chip {
      display: inline-block; padding: 3px 12px; border-radius: 20px; font-size: 11px;
      font-weight: 700; letter-spacing: 0.5px; margin-bottom: 8px;
      background: rgba(201,162,39,0.2); color: #C9A227; border: 1px solid rgba(201,162,39,0.4);
    }
    .role-chip--shipper { background: rgba(201,162,39,0.2); color: #C9A227; border-color: rgba(201,162,39,0.4); }
    .welcome-banner--driver .role-chip { background: rgba(102,187,106,0.2); color: #66BB6A; border-color: rgba(102,187,106,0.4); }
    h1 { font-size: 26px; font-weight: 800; margin-bottom: 4px; color: #F0EDE6; }
    .today-date { color: rgba(240,237,230,0.55); font-size: 13px; }
    .banner-actions { display: flex; gap: 10px; flex-wrap: wrap; }
    .btn-primary {
      padding: 10px 22px; background: linear-gradient(135deg, #C9A227, #A8861F);
      color: #111; border: none; border-radius: 10px; font-size: 14px; font-weight: 700;
      cursor: pointer; text-decoration: none; transition: all .2s; white-space: nowrap;
      box-shadow: 0 3px 10px rgba(201,162,39,0.35);
    }
    .btn-primary:hover { transform: translateY(-1px); box-shadow: 0 5px 16px rgba(201,162,39,0.45); text-decoration: none; color: #111; }
    .btn-driver { background: linear-gradient(135deg, #43A047, #2E7D32); color: white; box-shadow: 0 3px 10px rgba(67,160,71,0.35); }
    .btn-driver:hover { box-shadow: 0 5px 16px rgba(67,160,71,0.45); color: white; }

    /* Stats grid */
    .stats-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); gap: 14px; margin-bottom: 24px; }
    .stat-card {
      background: var(--surface); border-radius: 14px; padding: 20px;
      display: flex; align-items: center; gap: 14px;
      box-shadow: var(--shadow); transition: box-shadow .15s, transform .15s;
      cursor: pointer; border: 1.5px solid var(--border);
    }
    .stat-card:hover { box-shadow: var(--shadow-lg); transform: translateY(-2px); }
    .stat-card--active { border-color: #C9A227; box-shadow: 0 0 0 2px rgba(201,162,39,0.3), var(--shadow); }
    .stat-icon { width: 50px; height: 50px; border-radius: 14px; display: flex; align-items: center; justify-content: center; font-size: 22px; flex-shrink: 0; }
    .stat-value { font-size: 26px; font-weight: 900; line-height: 1; margin-bottom: 3px; }
    .stat-label { font-size: 12px; color: var(--text-secondary); }

    /* Quick actions */
    .quick-actions { margin-bottom: 24px; }
    .quick-title { font-size: 13px; font-weight: 700; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.8px; margin-bottom: 10px; }
    .quick-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 10px; }
    .quick-card {
      display: flex; flex-direction: column; align-items: center; gap: 8px;
      padding: 16px 12px; background: var(--surface); border-radius: 12px;
      border: 1.5px solid var(--border); text-decoration: none; color: var(--text-primary);
      font-size: 12px; font-weight: 600; text-align: center; transition: all .15s;
    }
    .quick-card:hover { border-color: #C9A227; background: rgba(201,162,39,0.06); color: #C9A227; text-decoration: none; transform: translateY(-2px); box-shadow: var(--shadow); }
    .quick-actions--shipper .quick-card:hover { border-color: #C9A227; color: #C9A227; }
    .quick-icon { font-size: 24px; }

    /* Section */
    .section { background: var(--surface); border-radius: 14px; padding: 24px; box-shadow: var(--shadow); border: 1px solid var(--border); }
    .section-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; gap: 8px; flex-wrap: wrap; }
    .section-header-right { display: flex; align-items: center; gap: 12px; }
    .filter-badge { background: rgba(201,162,39,0.12); color: #C9A227; border: 1px solid rgba(201,162,39,0.4); border-radius: 20px; padding: 3px 10px; font-size: 11px; font-weight: 600; cursor: pointer; }
    h2 { font-size: 17px; font-weight: 700; color: var(--text-primary); }
    .see-all { color: #C9A227; font-size: 13px; font-weight: 700; text-decoration: none; white-space: nowrap; }
    .see-all:hover { text-decoration: none; opacity: 0.8; }

    /* Order rows */
    .order-row { display: flex; align-items: center; gap: 12px; padding: 12px 8px; border-bottom: 1px solid var(--border); cursor: pointer; border-radius: 6px; flex-wrap: wrap; transition: background .1s; }
    .order-row:last-child { border-bottom: none; }
    .order-row:hover { background: var(--surface-raised); }
    .order-ref { display: flex; align-items: center; gap: 10px; min-width: 160px; flex: 1; font-weight: 600; color: var(--text-primary); }
    .order-route { display: flex; align-items: center; gap: 8px; flex: 1; font-size: 13px; min-width: 140px; color: var(--text-primary); }
    .route-arrow { color: #C9A227; font-weight: 700; }
    .order-meta { margin-left: auto; white-space: nowrap; color: var(--text-secondary); }

    /* Badges */
    .badge { display: inline-block; padding: 2px 10px; border-radius: 12px; font-size: 10px; font-weight: 700; text-transform: uppercase; }
    .badge--draft{background:#E0E0E0;color:#616161}.badge--posted{background:#FFF8E1;color:#F57F17}.badge--assigned{background:#E8EAF6;color:#3949AB}.badge--in_transit{background:#E8F5E9;color:#2E7D32}.badge--delivered{background:#E0F2F1;color:#00695C}.badge--completed{background:rgba(201,162,39,0.15);color:#A8861F}.badge--cancelled{background:#FFEBEE;color:#B71C1C}.badge--disputed{background:#FCE4EC;color:#880E4F}.badge--pickup_pending{background:#FFF3E0;color:#E65100}.badge--picked_up{background:#EDE7F6;color:#4527A0}

    /* States */
    .text-sm { font-size: 12px; }
    .text-muted { color: var(--text-secondary); }
    .loading-overlay { text-align: center; padding: 40px; color: var(--text-secondary); }
    .empty-state { padding: 40px 24px; text-align: center; color: var(--text-secondary); }
    .empty-icon { font-size: 44px; margin-bottom: 12px; }
    h3 { font-size: 16px; font-weight: 600; margin-bottom: 8px; color: var(--text-primary); }
    .mt-2 { margin-top: 16px; display: inline-block; }

    @media (max-width: 600px) {
      h1 { font-size: 20px; }
      .welcome-banner { padding: 18px 16px; }
      .stats-grid { grid-template-columns: repeat(2, 1fr); gap: 10px; }
      .stat-card { padding: 14px; gap: 10px; }
      .stat-value { font-size: 22px; }
      .section { padding: 16px; }
      .order-meta { display: none; }
      .quick-grid { grid-template-columns: repeat(2, 1fr); }
    }
  `]
})
export class DashboardComponent implements OnInit {
  auth = inject(AuthService);
  private api = inject(ApiService);

  loading = signal(true);
  recentOrders = signal<FreightOrder[]>([]);
  activeFilter = signal<StatFilter>(null);

  firstName = computed(() => (this.auth.user()?.full_name || '').split(' ')[0]);
  isDriver = computed(() => this.auth.role() === 'DRIVER');
  isShipper = computed(() => this.auth.role() === 'SHIPPER' || this.auth.role() === 'ADMIN');

  private inTransitStatuses = ['ASSIGNED', 'PICKUP_PENDING', 'PICKED_UP', 'IN_TRANSIT'];

  stats = computed<StatCard[]>(() => {
    const orders = this.recentOrders();
    if (this.isDriver()) {
      return [
        { label: 'DASHBOARD.STATS.AVAILABLE',  value: orders.filter(o => o.status === 'POSTED').length,                         icon: '📋', color: '#C9A227', filter: 'available' },
        { label: 'DASHBOARD.STATS.IN_TRANSIT', value: orders.filter(o => this.inTransitStatuses.includes(o.status)).length,     icon: '🚛', color: '#66BB6A', filter: 'in_transit' },
        { label: 'DASHBOARD.STATS.DELIVERED',  value: orders.filter(o => o.status === 'DELIVERED').length,                      icon: '📬', color: '#42A5F5', filter: 'delivered' },
        { label: 'DASHBOARD.STATS.COMPLETED',  value: orders.filter(o => o.status === 'COMPLETED').length,                      icon: '✅', color: '#A8861F', filter: 'completed' },
      ];
    }
    return [
      { label: 'DASHBOARD.STATS.AVAILABLE',  value: orders.filter(o => o.status === 'POSTED').length,                           icon: '📦', color: '#C9A227', filter: 'available' },
      { label: 'DASHBOARD.STATS.IN_TRANSIT', value: orders.filter(o => this.inTransitStatuses.includes(o.status)).length,       icon: '🚚', color: '#42A5F5', filter: 'in_transit' },
      { label: 'DASHBOARD.STATS.DELIVERED',  value: orders.filter(o => o.status === 'DELIVERED').length,                        icon: '📬', color: '#66BB6A', filter: 'delivered' },
      { label: 'DASHBOARD.STATS.COMPLETED',  value: orders.filter(o => o.status === 'COMPLETED').length,                        icon: '🏆', color: '#A8861F', filter: 'completed' },
    ];
  });

  filteredOrders = computed<FreightOrder[]>(() => {
    const orders = this.recentOrders();
    const filter = this.activeFilter();
    if (!filter) return orders;
    switch (filter) {
      case 'available':   return orders.filter(o => o.status === 'POSTED');
      case 'in_transit':  return orders.filter(o => this.inTransitStatuses.includes(o.status));
      case 'delivered':   return orders.filter(o => o.status === 'DELIVERED');
      case 'completed':   return orders.filter(o => o.status === 'COMPLETED');
      default:            return orders;
    }
  });

  setFilter(filter: StatFilter): void {
    this.activeFilter.set(this.activeFilter() === filter ? null : filter);
  }

  ngOnInit(): void {
    this.api.getOrders({ page_size: '100' }).subscribe({
      next: (res) => { this.recentOrders.set(res.results); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  today(): string {
    return new Date().toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  }

  formatDate(d: string): string {
    return new Date(d).toLocaleDateString(undefined, { day: '2-digit', month: 'short' });
  }
}
