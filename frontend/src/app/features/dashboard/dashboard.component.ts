import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { ApiService } from '../../core/services/api.service';
import { AuthService } from '../../core/services/auth.service';
import { FreightOrder } from '../../core/models/order.model';

type StatFilter = 'open' | 'assigned' | 'in_transit' | 'delivered' | 'completed' | null;
interface StatCard { label: string; value: string | number; icon: string; color: string; filter: StatFilter; }

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink, TranslateModule],
  template: `
    <div class="dashboard">

      <!-- ════════════════ DRIVER ════════════════ -->

      <!-- Driver: header statut + gains du jour -->
      <div class="driver-header" *ngIf="isDriver()">
        <div class="driver-header-left">
          <div class="greeting-text">{{ 'DASHBOARD.GREETING' | translate: { name: firstName() } }}</div>
          <div class="availability-pill" [class.available]="driverAvailable()">
            {{ driverAvailable() ? ('TOPBAR.AVAILABLE' | translate) : ('TOPBAR.UNAVAILABLE' | translate) }}
          </div>
        </div>
        <div class="driver-header-right">
          <div class="today-stat">
            <span class="today-stat-value">{{ todayTrips() }}</span>
            <span class="today-stat-label">{{ 'DASHBOARD.DRIVER.TODAY_TRIPS' | translate }}</span>
          </div>
          <span class="today-sep">·</span>
          <div class="today-stat">
            <span class="today-stat-value">{{ todayEarnings() | number:'1.0-0' }} XOF</span>
            <span class="today-stat-label">{{ 'DASHBOARD.DRIVER.TODAY_EARNINGS' | translate }}</span>
          </div>
        </div>
      </div>

      <!-- Driver: CTA contextuel -->
      <div class="cta-banner" *ngIf="isDriver()">
        <ng-container *ngIf="activeTrip(); else noTrip">
          <div class="cta-info">
            <span class="cta-icon">🚛</span>
            <div>
              <div class="cta-title">{{ activeTrip()!.pickup_city }} → {{ activeTrip()!.delivery_city }}</div>
              <div class="cta-sub">
                <span class="badge badge--{{ activeTrip()!.status.toLowerCase() }}">{{ 'ORDERS.STATUS.' + activeTrip()!.status | translate }}</span>
              </div>
            </div>
          </div>
          <a class="cta-btn cta-btn--active" [routerLink]="['/orders', activeTrip()!.id]">
            {{ 'DASHBOARD.DRIVER.CONTINUE_DELIVERY' | translate }} →
          </a>
        </ng-container>
        <ng-template #noTrip>
          <div class="cta-info">
            <span class="cta-icon">🔍</span>
            <div>
              <div class="cta-title">{{ 'DASHBOARD.DRIVER.FIND_LOADS_TITLE' | translate }}</div>
              <div class="cta-sub">{{ availableLoads() }} {{ 'DASHBOARD.DRIVER.LOADS_AVAILABLE' | translate }}</div>
            </div>
          </div>
          <a class="cta-btn cta-btn--available" routerLink="/load-board">
            {{ 'DASHBOARD.DRIVER.FIND_LOADS_BTN' | translate }} →
          </a>
        </ng-template>
      </div>

      <!-- Driver: résumé du jour -->
      <div class="summary-row" *ngIf="isDriver()">
        <div class="summary-card">
          <div class="summary-value">{{ todayTrips() }}</div>
          <div class="summary-label">{{ 'DASHBOARD.DRIVER.VOYAGES' | translate }}</div>
        </div>
        <div class="summary-card summary-card--gold">
          <div class="summary-value">{{ todayEarnings() | number:'1.0-0' }}</div>
          <div class="summary-label">{{ 'DASHBOARD.DRIVER.GAINS' | translate }} (XOF)</div>
        </div>
        <div class="summary-card">
          <div class="summary-value">{{ todayDistance() }}</div>
          <div class="summary-label">{{ 'DASHBOARD.DRIVER.DISTANCE' | translate }} (km)</div>
        </div>
        <div class="summary-card">
          <div class="summary-value">{{ driverRating() }}</div>
          <div class="summary-label">{{ 'DASHBOARD.DRIVER.RATING' | translate }}</div>
        </div>
      </div>

      <!-- ════════════════ SHIPPER ════════════════ -->

      <!-- Shipper: centre de commande -->
      <div class="shipper-header" *ngIf="isShipper()">
        <div class="shipper-header-left">
          <div class="sh-greeting">{{ 'DASHBOARD.GREETING' | translate: { name: firstName() } }}</div>
          <div class="sh-stats-row">
            <div class="sh-kpi" [class.sh-kpi--alert]="delayedCount() > 0">
              <span class="sh-kpi-value">{{ activeShipments() }}</span>
              <span class="sh-kpi-label">{{ 'DASHBOARD.SHIPPER.ACTIVE_LOADS' | translate }}</span>
            </div>
            <div class="sh-kpi-sep">·</div>
            <div class="sh-kpi" [class.sh-kpi--warn]="delayedCount() > 0">
              <span class="sh-kpi-value">{{ delayedCount() }}</span>
              <span class="sh-kpi-label">{{ 'DASHBOARD.SHIPPER.DELAYED' | translate }}</span>
            </div>
            <div class="sh-kpi-sep">·</div>
            <div class="sh-kpi">
              <span class="sh-kpi-value">{{ pendingAssignment() }}</span>
              <span class="sh-kpi-label">{{ 'DASHBOARD.SHIPPER.PENDING_ASSIGN' | translate }}</span>
            </div>
          </div>
        </div>
        <div class="shipper-header-right">
          <div class="sh-spend">
            <div class="sh-spend-value">{{ todaySpend() | number:'1.0-0' }} XOF</div>
            <div class="sh-spend-label">{{ 'DASHBOARD.SHIPPER.TODAY_SPEND' | translate }}</div>
          </div>
          <a class="btn-create-load" routerLink="/orders/new">
            ＋ {{ 'DASHBOARD.SHIPPER.CREATE_LOAD' | translate }}
          </a>
        </div>
      </div>

      <!-- ════════════════ CARRIER ════════════════ -->

      <!-- Carrier: hero -->
      <div class="carrier-header" *ngIf="isCarrier()">
        <div class="carrier-header-left">
          <div class="carrier-greeting">{{ 'DASHBOARD.CARRIER.GREETING' | translate: { name: companyName() } }}</div>
          <div class="carrier-status">
            <span class="fleet-dot"></span>
            {{ 'DASHBOARD.CARRIER.FLEET_ONLINE' | translate }}
            &nbsp;·&nbsp; {{ activeCarrierLoads() }} {{ 'DASHBOARD.CARRIER.ACTIVE_LOADS' | translate }}
            &nbsp;·&nbsp; {{ availableTrucks() }} {{ 'DASHBOARD.CARRIER.TRUCKS_AVAILABLE' | translate }}
          </div>
        </div>
        <div class="carrier-header-right">
          <div class="carrier-revenue">
            <div class="carrier-revenue-val">{{ carrierRevenue() | number:'1.0-0' }} XOF</div>
            <div class="carrier-revenue-lbl">{{ 'DASHBOARD.CARRIER.TODAY_REVENUE' | translate }}</div>
          </div>
          <a class="btn-find-loads" routerLink="/load-board">
            ＋ {{ 'DASHBOARD.CARRIER.FIND_LOADS' | translate }}
          </a>
        </div>
      </div>

      <!-- Carrier: KPI cards -->
      <div class="carrier-kpis" *ngIf="isCarrier()">
        <div class="ckpi ckpi--green">
          <div class="ckpi-icon">🚛</div>
          <div class="ckpi-val">{{ availableTrucks() }}</div>
          <div class="ckpi-lbl">{{ 'DASHBOARD.CARRIER.KPI_TRUCKS' | translate }}</div>
        </div>
        <div class="ckpi ckpi--blue">
          <div class="ckpi-icon">📦</div>
          <div class="ckpi-val">{{ activeCarrierLoads() }}</div>
          <div class="ckpi-lbl">{{ 'DASHBOARD.CARRIER.KPI_LOADS' | translate }}</div>
        </div>
        <div class="ckpi ckpi--purple">
          <div class="ckpi-icon">👷</div>
          <div class="ckpi-val">{{ driversOnline() }}</div>
          <div class="ckpi-lbl">{{ 'DASHBOARD.CARRIER.KPI_DRIVERS' | translate }}</div>
        </div>
        <div class="ckpi ckpi--gold">
          <div class="ckpi-icon">💰</div>
          <div class="ckpi-val">{{ carrierRevenue() | number:'1.0-0' }}</div>
          <div class="ckpi-lbl">{{ 'DASHBOARD.CARRIER.KPI_REVENUE' | translate }} (XOF)</div>
        </div>
      </div>

      <!-- Carrier: Attention center -->
      <div class="carrier-attention" *ngIf="isCarrier()">
        <div class="attention-title">⚠ {{ 'DASHBOARD.CARRIER.ATTENTION' | translate }}</div>
        <div class="attention-empty" *ngIf="loadsNeedingDriver() === 0 && delayedCarrierLoads().length === 0">
          ✓ {{ 'DASHBOARD.CARRIER.NO_ALERTS' | translate }}
        </div>
        <div class="attention-item attention-item--warn" *ngIf="loadsNeedingDriver() > 0">
          <span class="att-icon">📌</span>
          <span>{{ loadsNeedingDriver() }} {{ 'DASHBOARD.CARRIER.ALERT_NO_DRIVER' | translate }}</span>
          <a routerLink="/load-board" class="att-cta">Voir →</a>
        </div>
        <div class="attention-item attention-item--danger" *ngFor="let o of delayedCarrierLoads()">
          <span class="att-icon">⏰</span>
          <span>{{ o.reference }} — {{ o.pickup_city }} → {{ o.delivery_city }}</span>
          <span class="badge badge--{{ o.status.toLowerCase() }}">{{ 'ORDERS.STATUS.' + o.status | translate }}</span>
        </div>
      </div>

      <!-- Carrier: Quick actions -->
      <div class="quick-actions" *ngIf="isCarrier()">
        <div class="quick-title">{{ 'DASHBOARD.QUICK_ACTIONS' | translate }}</div>
        <div class="quick-grid quick-grid--6">
          <a class="quick-card quick-card--primary" routerLink="/load-board">
            <span class="quick-icon">🚛</span>
            <span>{{ 'DASHBOARD.CARRIER.QA_LOADS' | translate }}</span>
          </a>
          <a class="quick-card" routerLink="/fleet">
            <span class="quick-icon">📍</span>
            <span>{{ 'DASHBOARD.CARRIER.QA_FLEET' | translate }}</span>
          </a>
          <a class="quick-card" routerLink="/profile" [queryParams]="{tab:'drivers'}">
            <span class="quick-icon">👷</span>
            <span>{{ 'DASHBOARD.CARRIER.QA_DRIVERS' | translate }}</span>
          </a>
          <a class="quick-card" routerLink="/profile" [queryParams]="{tab:'drivers'}">
            <span class="quick-icon">📦</span>
            <span>{{ 'DASHBOARD.CARRIER.QA_ASSIGN' | translate }}</span>
          </a>
          <a class="quick-card" routerLink="/messaging">
            <span class="quick-icon">💬</span>
            <span>{{ 'DASHBOARD.CARRIER.QA_MESSAGES' | translate }}</span>
          </a>
          <a class="quick-card" routerLink="/orders">
            <span class="quick-icon">💰</span>
            <span>{{ 'DASHBOARD.CARRIER.QA_PAYMENTS' | translate }}</span>
          </a>
        </div>

        <!-- Loads Management -->
        <div class="lm-divider"></div>
        <div class="quick-title">{{ 'DASHBOARD.CARRIER.LOADS_MGMT' | translate }}</div>
      </div>

      <!-- ════════════════ STATS (partagé) ════════════════ -->
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

      <!-- ════════════════ QUICK ACTIONS ════════════════ -->

      <!-- Driver -->
      <div class="quick-actions" *ngIf="isDriver()">
        <div class="quick-title">{{ 'DASHBOARD.QUICK_ACTIONS' | translate }}</div>
        <div class="quick-grid">
          <a class="quick-card" routerLink="/load-board">
            <span class="quick-icon">🔍</span>
            <span>{{ 'DASHBOARD.DRIVER.QA_LOADS' | translate }}</span>
          </a>
          <a class="quick-card" routerLink="/orders">
            <span class="quick-icon">📦</span>
            <span>{{ 'DASHBOARD.DRIVER.QA_TRIPS' | translate }}</span>
          </a>
          <a class="quick-card" routerLink="/messaging">
            <span class="quick-icon">💬</span>
            <span>{{ 'DASHBOARD.DRIVER.QA_DISPATCHER' | translate }}</span>
          </a>
          <a class="quick-card" routerLink="/messaging">
            <span class="quick-icon">⚠️</span>
            <span>{{ 'DASHBOARD.DRIVER.QA_REPORT' | translate }}</span>
          </a>
        </div>
      </div>

      <!-- Shipper -->
      <div class="quick-actions" *ngIf="isShipper()">
        <div class="quick-title">{{ 'DASHBOARD.QUICK_ACTIONS' | translate }}</div>
        <div class="quick-grid">
          <a class="quick-card quick-card--primary" routerLink="/orders/new">
            <span class="quick-icon">➕</span>
            <span>{{ 'DASHBOARD.SHIPPER.QA_CREATE' | translate }}</span>
          </a>
          <a class="quick-card" routerLink="/tracking">
            <span class="quick-icon">📍</span>
            <span>{{ 'DASHBOARD.SHIPPER.QA_TRACK' | translate }}</span>
          </a>
          <a class="quick-card" routerLink="/orders">
            <span class="quick-icon">📦</span>
            <span>{{ 'DASHBOARD.SHIPPER.QA_LOADS' | translate }}</span>
          </a>
          <a class="quick-card" routerLink="/messaging">
            <span class="quick-icon">💬</span>
            <span>{{ 'DASHBOARD.SHIPPER.QA_MESSAGES' | translate }}</span>
          </a>
        </div>
      </div>

      <!-- ════════════════ SECTION LIVRAISONS ════════════════ -->
      <div class="section">
        <div class="section-header">
          <h2>{{ (isDriver() ? 'DASHBOARD.RECENT_DRIVER' : 'DASHBOARD.RECENT_SHIPPER') | translate }}</h2>
          <div class="section-header-right">
            <span class="filter-badge" *ngIf="activeFilter()" (click)="setFilter(null)">
              ✕ {{ activeFilter() }}
            </span>
            <a routerLink="/orders" class="see-all">{{ 'COMMON.SEE_ALL' | translate }}</a>
          </div>
        </div>

        <div class="loading-overlay" *ngIf="loading()">⏳ {{ 'COMMON.LOADING' | translate }}</div>

        <!-- Driver rows (compact) -->
        <div class="orders-list" *ngIf="!loading() && filteredOrders().length && isDriver()">
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
            <div class="order-price" *ngIf="o.final_price || o.proposed_price">
              {{ (o.final_price || o.proposed_price) | number:'1.0-0' }} XOF
            </div>
            <div class="order-meta text-muted text-sm" *ngIf="!(o.final_price || o.proposed_price)">
              {{ o.weight_kg }} kg · {{ formatDate(o.pickup_scheduled_at) }}
            </div>
          </div>
        </div>

        <!-- Shipper: cartes opérationnelles -->
        <div class="op-cards" *ngIf="!loading() && filteredOrders().length && isShipper()">
          <div class="op-card" *ngFor="let o of filteredOrders()" [routerLink]="['/orders', o.id]"
               [class.op-card--delayed]="isDelayed(o)">
            <div class="op-card-top">
              <span class="op-ref">{{ o.reference }}</span>
              <span class="badge badge--{{ o.status.toLowerCase() }}">{{ 'ORDERS.STATUS.' + o.status | translate }}</span>
              <span class="op-delay-badge" *ngIf="isDelayed(o)">⚠️ {{ 'DASHBOARD.SHIPPER.LATE' | translate }}</span>
            </div>
            <div class="op-route">
              <span class="op-city">📍 {{ o.pickup_city }}</span>
              <span class="op-arrow">———›</span>
              <span class="op-city">🏁 {{ o.delivery_city }}</span>
              <span class="op-weight text-muted">· {{ o.weight_kg }} kg</span>
            </div>
            <div class="op-card-bottom">
              <span class="op-driver" *ngIf="o.assignment?.driver_detail">
                🚛 {{ o.assignment!.driver_detail.full_name }}
              </span>
              <span class="op-driver text-muted" *ngIf="!o.assignment">
                {{ 'DASHBOARD.SHIPPER.NO_DRIVER' | translate }}
              </span>
              <span class="op-price" *ngIf="o.final_price || o.proposed_price">
                {{ (o.final_price || o.proposed_price) | number:'1.0-0' }} XOF
              </span>
            </div>
          </div>
        </div>

        <div class="empty-state" *ngIf="!loading() && !filteredOrders().length">
          <div class="empty-icon">{{ isDriver() ? '🚚' : '📤' }}</div>
          <h3>{{ (isDriver() ? 'DASHBOARD.EMPTY_DRIVER_TITLE' : 'DASHBOARD.EMPTY_TITLE') | translate }}</h3>
          <p>{{ (isDriver() ? 'DASHBOARD.EMPTY_DRIVER_SUBTITLE' : 'DASHBOARD.EMPTY_SUBTITLE') | translate }}</p>
          <a class="btn-create-load mt-2" [routerLink]="isDriver() ? '/load-board' : '/orders/new'">
            {{ (isDriver() ? 'DASHBOARD.EMPTY_DRIVER_CTA' : 'DASHBOARD.EMPTY_SHIPPER_CTA') | translate }}
          </a>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .dashboard { max-width: 1100px; }

    /* ── Driver header ── */
    .driver-header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 22px 28px; border-radius: 16px; margin-bottom: 14px; gap: 16px; flex-wrap: wrap;
      background: linear-gradient(135deg, #0D1B0F, #1A2A1A);
      border-left: 5px solid #66BB6A; box-shadow: 0 4px 20px rgba(0,0,0,0.2);
    }
    .driver-header-left { display: flex; flex-direction: column; gap: 10px; }
    .greeting-text { font-size: 22px; font-weight: 800; color: #F0EDE6; }
    .availability-pill {
      display: inline-block; padding: 5px 14px; border-radius: 20px; font-size: 11px; font-weight: 700;
      background: rgba(239,83,80,0.2); color: #EF5350; border: 1px solid rgba(239,83,80,0.4);
    }
    .availability-pill::before { content: '🔴 '; }
    .availability-pill.available { background: rgba(102,187,106,0.2); color: #66BB6A; border-color: rgba(102,187,106,0.4); }
    .availability-pill.available::before { content: '🟢 '; }
    .driver-header-right { display: flex; align-items: center; gap: 16px; }
    .today-stat { display: flex; flex-direction: column; align-items: flex-end; }
    .today-stat-value { font-size: 18px; font-weight: 800; color: #F0EDE6; }
    .today-stat-label { font-size: 11px; color: rgba(240,237,230,0.5); margin-top: 2px; }
    .today-sep { color: rgba(240,237,230,0.25); font-size: 22px; line-height: 1; }

    /* ── Driver CTA ── */
    .cta-banner {
      display: flex; align-items: center; justify-content: space-between;
      padding: 20px 24px; border-radius: 14px; margin-bottom: 14px; gap: 16px; flex-wrap: wrap;
      background: var(--surface); border: 1.5px solid var(--border); box-shadow: var(--shadow);
    }
    .cta-info { display: flex; align-items: center; gap: 18px; }
    .cta-icon { font-size: 40px; line-height: 1; }
    .cta-title { font-size: 16px; font-weight: 700; color: var(--text-primary); margin-bottom: 6px; }
    .cta-sub { font-size: 13px; color: var(--text-secondary); }
    .cta-btn {
      padding: 14px 28px; border-radius: 12px; font-size: 15px; font-weight: 800;
      text-decoration: none; transition: all .2s; white-space: nowrap; flex-shrink: 0;
    }
    .cta-btn--available { background: linear-gradient(135deg, #43A047, #2E7D32); color: white; box-shadow: 0 4px 14px rgba(67,160,71,0.3); }
    .cta-btn--available:hover { box-shadow: 0 6px 20px rgba(67,160,71,0.4); transform: translateY(-2px); color: white; text-decoration: none; }
    .cta-btn--active { background: linear-gradient(135deg, #FF6B35, #E53935); color: white; box-shadow: 0 4px 14px rgba(255,107,53,0.3); }
    .cta-btn--active:hover { box-shadow: 0 6px 20px rgba(255,107,53,0.4); transform: translateY(-2px); color: white; text-decoration: none; }

    /* ── Driver summary ── */
    .summary-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 20px; }
    .summary-card {
      background: var(--surface); border-radius: 12px; padding: 16px 12px;
      text-align: center; border: 1px solid var(--border); box-shadow: var(--shadow);
    }
    .summary-card--gold { border-color: rgba(201,162,39,0.4); background: rgba(201,162,39,0.06); }
    .summary-value { font-size: 20px; font-weight: 900; color: var(--text-primary); margin-bottom: 4px; line-height: 1.1; }
    .summary-card--gold .summary-value { color: #C9A227; }
    .summary-label { font-size: 10px; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.6px; }

    /* ── Shipper header ── */
    .shipper-header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 24px 28px; border-radius: 16px; margin-bottom: 16px; gap: 20px; flex-wrap: wrap;
      background: linear-gradient(135deg, #1A1208, #2A2010);
      border-left: 5px solid #C9A227; box-shadow: 0 4px 20px rgba(0,0,0,0.2);
    }
    .shipper-header-left { display: flex; flex-direction: column; gap: 14px; }
    .sh-greeting { font-size: 22px; font-weight: 800; color: #F0EDE6; }
    .sh-stats-row { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
    .sh-kpi { display: flex; flex-direction: column; }
    .sh-kpi-value { font-size: 20px; font-weight: 900; color: #F0EDE6; line-height: 1; }
    .sh-kpi-label { font-size: 10px; color: rgba(240,237,230,0.5); text-transform: uppercase; letter-spacing: 0.4px; margin-top: 3px; }
    .sh-kpi--warn .sh-kpi-value { color: #FFB300; }
    .sh-kpi--alert .sh-kpi-value { color: #EF5350; }
    .sh-kpi-sep { color: rgba(240,237,230,0.2); font-size: 22px; line-height: 1; }
    .shipper-header-right { display: flex; flex-direction: column; align-items: flex-end; gap: 14px; }
    .sh-spend { text-align: right; }
    .sh-spend-value { font-size: 22px; font-weight: 900; color: #C9A227; }
    .sh-spend-label { font-size: 10px; color: rgba(240,237,230,0.5); text-transform: uppercase; letter-spacing: 0.4px; margin-top: 2px; }

    /* ── Shared CTA button ── */
    .btn-create-load {
      display: inline-block; padding: 12px 24px;
      background: linear-gradient(135deg, #C9A227, #A8861F);
      color: #111; border: none; border-radius: 10px; font-size: 14px; font-weight: 800;
      cursor: pointer; text-decoration: none; transition: all .2s; white-space: nowrap;
      box-shadow: 0 3px 12px rgba(201,162,39,0.4);
    }
    .btn-create-load:hover { transform: translateY(-1px); box-shadow: 0 5px 18px rgba(201,162,39,0.5); text-decoration: none; color: #111; }

    /* ── Stats grid ── */
    .stats-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); gap: 14px; margin-bottom: 20px; }
    .stat-card {
      background: var(--surface); border-radius: 14px; padding: 20px;
      display: flex; align-items: center; gap: 14px;
      box-shadow: var(--shadow); transition: box-shadow .15s, transform .15s;
      cursor: pointer; border: 1.5px solid var(--border);
    }
    .stat-card:hover { box-shadow: var(--shadow-lg); transform: translateY(-2px); }
    .stat-card--active { border-color: #C9A227; box-shadow: 0 0 0 2px rgba(201,162,39,0.3); }
    .stat-icon { width: 50px; height: 50px; border-radius: 14px; display: flex; align-items: center; justify-content: center; font-size: 22px; flex-shrink: 0; }
    .stat-value { font-size: 26px; font-weight: 900; line-height: 1; margin-bottom: 3px; }
    .stat-label { font-size: 12px; color: var(--text-secondary); }

    /* ── Quick actions ── */
    .quick-actions { margin-bottom: 20px; }
    .quick-title { font-size: 13px; font-weight: 700; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.8px; margin-bottom: 10px; }
    .quick-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; }
    .quick-card {
      display: flex; flex-direction: column; align-items: center; gap: 8px;
      padding: 16px 12px; background: var(--surface); border-radius: 12px;
      border: 1.5px solid var(--border); text-decoration: none; color: var(--text-primary);
      font-size: 12px; font-weight: 600; text-align: center; transition: all .15s;
    }
    .quick-card:hover { border-color: var(--gold); background: rgba(201,162,39,0.06); color: var(--gold); text-decoration: none; transform: translateY(-2px); box-shadow: var(--shadow); }
    .quick-card--primary { border-color: rgba(201,162,39,0.4); background: rgba(201,162,39,0.06); color: var(--gold); }
    .quick-icon { font-size: 26px; }

    /* ── Section ── */
    .section { background: var(--surface); border-radius: 14px; padding: 24px; box-shadow: var(--shadow); border: 1px solid var(--border); }
    .section-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; gap: 8px; flex-wrap: wrap; }
    .section-header-right { display: flex; align-items: center; gap: 12px; }
    .filter-badge { background: rgba(201,162,39,0.12); color: var(--gold); border: 1px solid rgba(201,162,39,0.4); border-radius: 20px; padding: 3px 10px; font-size: 11px; font-weight: 600; cursor: pointer; }
    h2 { font-size: 17px; font-weight: 700; color: var(--text-primary); }
    .see-all { color: var(--gold); font-size: 13px; font-weight: 700; text-decoration: none; white-space: nowrap; }

    /* ── Driver order rows ── */
    .order-row { display: flex; align-items: center; gap: 12px; padding: 12px 8px; border-bottom: 1px solid var(--border); cursor: pointer; border-radius: 6px; flex-wrap: wrap; transition: background .1s; }
    .order-row:last-child { border-bottom: none; }
    .order-row:hover { background: var(--surface-raised); }
    .order-ref { display: flex; align-items: center; gap: 10px; min-width: 160px; flex: 1; font-weight: 600; color: var(--text-primary); }
    .order-route { display: flex; align-items: center; gap: 8px; flex: 1; font-size: 13px; min-width: 140px; color: var(--text-primary); }
    .route-arrow { color: var(--gold); font-weight: 700; }
    .order-meta { margin-left: auto; white-space: nowrap; }
    .order-price { margin-left: auto; font-weight: 700; color: #66BB6A; font-size: 14px; white-space: nowrap; }

    /* ── Shipper operational cards ── */
    .op-cards { display: flex; flex-direction: column; gap: 10px; }
    .op-card {
      display: flex; flex-direction: column; gap: 8px;
      padding: 14px 16px; border-radius: 10px; cursor: pointer;
      border: 1.5px solid var(--border); background: var(--surface-raised);
      transition: border-color .15s, box-shadow .15s;
    }
    .op-card:hover { border-color: var(--gold); box-shadow: var(--shadow); }
    .op-card--delayed { border-color: rgba(255,179,0,0.5); background: rgba(255,179,0,0.04); }
    .op-card-top { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
    .op-ref { font-size: 13px; font-weight: 800; color: var(--text-primary); }
    .op-delay-badge { font-size: 11px; font-weight: 700; color: #FFB300; margin-left: auto; }
    .op-route { display: flex; align-items: center; gap: 8px; font-size: 14px; color: var(--text-primary); flex-wrap: wrap; }
    .op-city { font-weight: 600; }
    .op-arrow { color: var(--gold); font-weight: 700; letter-spacing: 1px; }
    .op-weight { font-size: 12px; }
    .op-card-bottom { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
    .op-driver { font-size: 12px; font-weight: 600; color: var(--text-secondary); }
    .op-price { font-size: 14px; font-weight: 800; color: var(--gold); white-space: nowrap; }

    /* ── Badges ── */
    .badge { display: inline-block; padding: 2px 10px; border-radius: 12px; font-size: 10px; font-weight: 700; text-transform: uppercase; }
    .badge--draft{background:rgba(97,97,97,0.15);color:#9E9E9E}.badge--posted{background:rgba(201,162,39,0.15);color:#C9A227}.badge--assigned{background:rgba(33,150,243,0.15);color:#42A5F5}.badge--in_transit{background:rgba(67,160,71,0.15);color:#66BB6A}.badge--pickup_pending{background:rgba(230,81,0,0.15);color:#FF6B35}.badge--picked_up{background:rgba(69,39,160,0.15);color:#9C27B0}.badge--delivered{background:rgba(0,137,123,0.15);color:#26A69A}.badge--completed{background:rgba(168,134,31,0.15);color:#A8861F}.badge--cancelled{background:rgba(183,28,28,0.15);color:#EF5350}.badge--disputed{background:rgba(136,14,79,0.15);color:#E91E63}

    /* ── Utils ── */
    .text-sm { font-size: 12px; }
    .text-muted { color: var(--text-secondary); }
    .loading-overlay { text-align: center; padding: 40px; color: var(--text-secondary); }
    .empty-state { padding: 40px 24px; text-align: center; color: var(--text-secondary); }
    .empty-icon { font-size: 44px; margin-bottom: 12px; }
    h3 { font-size: 16px; font-weight: 600; margin-bottom: 8px; color: var(--text-primary); }
    .mt-2 { margin-top: 16px; display: inline-block; }

    /* ── Carrier header ── */
    .carrier-header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 24px 28px; border-radius: 16px; margin-bottom: 16px; gap: 20px; flex-wrap: wrap;
      background: linear-gradient(135deg, #0A0F1A, #121E2E);
      border-left: 5px solid #42A5F5; box-shadow: 0 4px 20px rgba(0,0,0,0.25);
    }
    .carrier-header-left { display: flex; flex-direction: column; gap: 10px; }
    .carrier-greeting { font-size: 22px; font-weight: 800; color: #F0EDE6; }
    .carrier-status { font-size: 13px; color: rgba(240,237,230,0.6); display: flex; align-items: center; gap: 4px; flex-wrap: wrap; }
    .fleet-dot { width: 8px; height: 8px; border-radius: 50%; background: #66BB6A; box-shadow: 0 0 6px #66BB6A; display: inline-block; }
    .carrier-header-right { display: flex; flex-direction: column; align-items: flex-end; gap: 14px; }
    .carrier-revenue { text-align: right; }
    .carrier-revenue-val { font-size: 24px; font-weight: 900; color: #C9A227; }
    .carrier-revenue-lbl { font-size: 10px; color: rgba(240,237,230,0.5); text-transform: uppercase; letter-spacing: 0.5px; margin-top: 2px; }
    .btn-find-loads {
      padding: 12px 24px; background: linear-gradient(135deg, #42A5F5, #1565C0);
      color: #fff; border-radius: 10px; font-size: 14px; font-weight: 800;
      text-decoration: none; transition: all .2s; white-space: nowrap;
      box-shadow: 0 3px 12px rgba(66,165,245,0.35);
    }
    .btn-find-loads:hover { transform: translateY(-1px); box-shadow: 0 5px 18px rgba(66,165,245,0.5); text-decoration: none; color: #fff; }

    /* ── Carrier KPIs ── */
    .carrier-kpis { display: grid; grid-template-columns: repeat(4,1fr); gap: 14px; margin-bottom: 16px; }
    .ckpi {
      border-radius: 14px; padding: 20px 16px; display: flex; flex-direction: column; gap: 6px;
      border: 1.5px solid var(--border); background: var(--surface); box-shadow: var(--shadow);
    }
    .ckpi-icon { font-size: 24px; }
    .ckpi-val { font-size: 28px; font-weight: 900; line-height: 1; }
    .ckpi-lbl { font-size: 11px; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.5px; }
    .ckpi--green { border-color: rgba(102,187,106,0.35); } .ckpi--green .ckpi-val { color: #66BB6A; }
    .ckpi--blue  { border-color: rgba(66,165,245,0.35); }  .ckpi--blue  .ckpi-val { color: #42A5F5; }
    .ckpi--purple{ border-color: rgba(156,39,176,0.25); }  .ckpi--purple .ckpi-val{ color: #CE93D8; }
    .ckpi--gold  { border-color: rgba(201,162,39,0.35); }  .ckpi--gold  .ckpi-val { color: #C9A227; }

    /* ── Attention center ── */
    .lm-divider { border: none; border-top: 1px solid var(--border); margin: 16px 0 14px; }

    .carrier-attention {
      background: var(--surface); border-radius: 14px; padding: 18px 20px;
      border: 1.5px solid rgba(255,179,0,0.25); margin-bottom: 16px; box-shadow: var(--shadow);
    }
    .attention-title { font-size: 13px; font-weight: 700; color: #E53935; text-transform: uppercase; letter-spacing: 0.6px; margin-bottom: 12px; }
    .attention-empty { font-size: 13px; color: #66BB6A; }
    .attention-item {
      display: flex; align-items: center; gap: 10px; padding: 10px 14px;
      border-radius: 8px; margin-bottom: 8px; font-size: 13px; font-weight: 600;
    }
    .attention-item:last-child { margin-bottom: 0; }
    .attention-item--warn   { background: rgba(255,179,0,0.1);  color: #FFB300; border: 1px solid rgba(255,179,0,0.25); }
    .attention-item--danger { background: rgba(239,83,80,0.08); color: #EF5350; border: 1px solid rgba(239,83,80,0.2); }
    .att-icon { font-size: 16px; }
    .att-cta { margin-left: auto; font-size: 12px; color: inherit; text-decoration: underline; white-space: nowrap; }

    /* ── Quick grid 6-col ── */
    .quick-grid--6 { grid-template-columns: repeat(6,1fr); }

    @media (max-width: 768px) {
      .carrier-header { padding: 16px; }
      .carrier-greeting { font-size: 18px; }
      .carrier-kpis { grid-template-columns: repeat(2,1fr); }
      .quick-grid--6 { grid-template-columns: repeat(3,1fr); }
    }

    @media (max-width: 768px) {
      .driver-header, .shipper-header { padding: 16px; }
      .greeting-text, .sh-greeting { font-size: 18px; }
      .cta-banner { padding: 16px; }
      .cta-btn { padding: 12px 18px; font-size: 13px; }
      .summary-row { grid-template-columns: repeat(2, 1fr); }
      .stats-grid { grid-template-columns: repeat(2, 1fr); gap: 10px; }
      .stat-card { padding: 14px; gap: 10px; }
      .stat-value { font-size: 22px; }
      .quick-grid { grid-template-columns: repeat(2, 1fr); }
      .section { padding: 16px; }
      .order-meta, .op-weight { display: none; }
      .shipper-header-right { align-items: flex-start; }
    }
  `]
})
export class DashboardComponent implements OnInit {
  auth = inject(AuthService);
  private api = inject(ApiService);
  private router = inject(Router);

  loading = signal(true);
  recentOrders = signal<FreightOrder[]>([]);
  activeFilter = signal<StatFilter>(null);

  firstName = computed(() => (this.auth.user()?.full_name || '').split(' ')[0]);
  isDriver  = computed(() => this.auth.role() === 'DRIVER');
  isShipper = computed(() => this.auth.role() === 'SHIPPER' || this.auth.role() === 'ADMIN');
  isCarrier = computed(() => this.auth.role() === 'CARRIER');

  // Carrier-specific signals
  carrierVehicles = signal<any[]>([]);
  carrierDrivers  = signal<any[]>([]);
  nearbyLoads     = signal<any[]>([]);

  private transitStatuses = ['PICKUP_PENDING', 'PICKED_UP', 'IN_TRANSIT'];
  private allActiveStatuses = ['ASSIGNED', 'PICKUP_PENDING', 'PICKED_UP', 'IN_TRANSIT'];

  // ── Driver computed ──────────────────────────────────────────────
  activeTrip = computed<FreightOrder | null>(() => {
    if (!this.isDriver()) return null;
    return this.recentOrders().find(o => this.allActiveStatuses.includes(o.status)) ?? null;
  });

  availableLoads = computed(() =>
    this.recentOrders().filter(o => o.status === 'POSTED').length
  );

  driverAvailable = computed(() =>
    (this.auth.user() as any)?.driver_profile?.is_available ?? false
  );

  driverRating = computed(() => {
    const r = (this.auth.user() as any)?.rating_avg;
    return r ? Number(r).toFixed(1) + ' ⭐' : '— ⭐';
  });

  todayTrips = computed(() => {
    const today = new Date().toDateString();
    return this.recentOrders().filter(o =>
      ['COMPLETED', 'DELIVERED'].includes(o.status) &&
      new Date(o.pickup_scheduled_at).toDateString() === today
    ).length;
  });

  todayEarnings = computed(() =>
    this.recentOrders()
      .filter(o => o.status === 'COMPLETED')
      .reduce((sum, o) => sum + (o.final_price || o.proposed_price || 0), 0)
  );

  todayDistance = computed(() => {
    const dist = this.recentOrders()
      .filter(o => ['COMPLETED', 'DELIVERED'].includes(o.status))
      .reduce((sum, o) => sum + ((o as any).estimated_distance_km || 0), 0);
    return Math.round(dist);
  });

  // ── Shipper computed ─────────────────────────────────────────────
  activeShipments = computed(() =>
    this.recentOrders().filter(o => this.allActiveStatuses.includes(o.status)).length
  );

  pendingAssignment = computed(() =>
    this.recentOrders().filter(o => o.status === 'POSTED').length
  );

  delayedCount = computed(() => {
    const now = new Date();
    return this.recentOrders().filter(o =>
      o.delivery_deadline &&
      new Date(o.delivery_deadline) < now &&
      !['DELIVERED', 'COMPLETED', 'CANCELLED'].includes(o.status)
    ).length;
  });

  todaySpend = computed(() =>
    this.recentOrders()
      .filter(o => !['DRAFT', 'CANCELLED'].includes(o.status))
      .reduce((sum, o) => sum + (o.final_price || o.proposed_price || 0), 0)
  );

  isDelayed(o: FreightOrder): boolean {
    return !!(o.delivery_deadline &&
      new Date(o.delivery_deadline) < new Date() &&
      !['DELIVERED', 'COMPLETED', 'CANCELLED'].includes(o.status));
  }

  // ── Stats ─────────────────────────────────────────────────────────
  stats = computed<StatCard[]>(() => {
    const orders = this.recentOrders();
    if (this.isDriver()) {
      return [
        { label: 'DASHBOARD.STATS.DRIVER_AVAILABLE', value: orders.filter(o => o.status === 'POSTED').length,                      icon: '🔍', color: '#C9A227', filter: 'open' },
        { label: 'DASHBOARD.STATS.DRIVER_ACTIVE',    value: orders.filter(o => this.allActiveStatuses.includes(o.status)).length,  icon: '🚛', color: '#66BB6A', filter: 'in_transit' },
        { label: 'DASHBOARD.STATS.DRIVER_PENDING',   value: orders.filter(o => o.status === 'DELIVERED').length,                   icon: '📬', color: '#42A5F5', filter: 'delivered' },
        { label: 'DASHBOARD.STATS.COMPLETED',        value: orders.filter(o => o.status === 'COMPLETED').length,                   icon: '✅', color: '#A8861F', filter: 'completed' },
      ];
    }
    // Shipper — Option B: Ouvert | Attribué | En transit | Fermé
    return [
      { label: 'DASHBOARD.STATS.SHIPPER_OPEN',     value: orders.filter(o => o.status === 'POSTED').length,                         icon: '📤', color: '#C9A227', filter: 'open' },
      { label: 'DASHBOARD.STATS.SHIPPER_ASSIGNED', value: orders.filter(o => o.status === 'ASSIGNED').length,                       icon: '🤝', color: '#42A5F5', filter: 'assigned' },
      { label: 'DASHBOARD.STATS.SHIPPER_TRANSIT',  value: orders.filter(o => this.transitStatuses.includes(o.status)).length,       icon: '🚚', color: '#66BB6A', filter: 'in_transit' },
      { label: 'DASHBOARD.STATS.SHIPPER_CLOSED',   value: orders.filter(o => ['DELIVERED', 'COMPLETED'].includes(o.status)).length, icon: '🏁', color: '#A8861F', filter: 'completed' },
    ];
  });

  filteredOrders = computed<FreightOrder[]>(() => {
    const orders = this.recentOrders();
    const filter = this.activeFilter();
    if (!filter) return orders;
    switch (filter) {
      case 'open':       return orders.filter(o => o.status === 'POSTED');
      case 'assigned':   return orders.filter(o => o.status === 'ASSIGNED');
      case 'in_transit': return orders.filter(o => [...this.allActiveStatuses, ...this.transitStatuses].includes(o.status));
      case 'delivered':  return orders.filter(o => o.status === 'DELIVERED');
      case 'completed':  return orders.filter(o => ['DELIVERED', 'COMPLETED'].includes(o.status));
      default:           return orders;
    }
  });

  setFilter(filter: StatFilter): void {
    this.activeFilter.set(this.activeFilter() === filter ? null : filter);
  }

  // ── Carrier computed ─────────────────────────────────────────────
  availableTrucks = computed(() => this.carrierVehicles().filter(v => v.is_active).length);
  trucksOnTrip    = computed(() => this.carrierVehicles().filter(v => !v.is_active).length);
  driversOnline   = computed(() => this.carrierDrivers().filter((d: any) => d.driver_profile?.is_available).length);
  activeCarrierLoads = computed(() =>
    this.recentOrders().filter(o => ['ASSIGNED','PICKUP_PENDING','PICKED_UP','IN_TRANSIT'].includes(o.status)).length
  );
  loadsNeedingDriver = computed(() => this.recentOrders().filter(o => o.status === 'POSTED').length);
  delayedCarrierLoads = computed(() => {
    const now = new Date();
    return this.recentOrders().filter(o =>
      o.delivery_deadline && new Date(o.delivery_deadline) < now &&
      !['DELIVERED','COMPLETED','CANCELLED'].includes(o.status)
    );
  });
  carrierRevenue = computed(() =>
    this.recentOrders()
      .filter(o => ['DELIVERED','COMPLETED'].includes(o.status))
      .reduce((s, o) => s + (o.final_price || o.proposed_price || 0), 0)
  );
  fleetUtilization = computed(() => {
    const total = this.carrierVehicles().length;
    if (!total) return 0;
    return Math.round((this.trucksOnTrip() / total) * 100);
  });
  companyName = computed(() => {
    const cp = (this.auth.user() as any)?.carrier_profile;
    return cp?.legal_company_name || this.firstName();
  });

  ngOnInit(): void {
    if (this.auth.role() === 'BROKER') {
      this.router.navigate(['/broker-dashboard']);
      return;
    }
    this.api.getOrders({ page_size: '100' }).subscribe({
      next: (res) => { this.recentOrders.set(res.results); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
    if (this.auth.role() === 'CARRIER') {
      this.api.getVehicles().subscribe({ next: (res: any) => this.carrierVehicles.set(res.results ?? res) });
      this.api.getMyDrivers().subscribe({ next: (drivers) => this.carrierDrivers.set(drivers) });
      this.api.getOrders({ page_size: '5', status: 'POSTED' }).subscribe({ next: (res) => this.nearbyLoads.set(res.results) });
    }
  }

  today(): string {
    return new Date().toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  }

  formatDate(d: string): string {
    return new Date(d).toLocaleDateString(undefined, { day: '2-digit', month: 'short' });
  }
}
