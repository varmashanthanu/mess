import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { ApiService } from '../../core/services/api.service';
import { AuthService } from '../../core/services/auth.service';
import { FreightOrder } from '../../core/models/order.model';
import { User } from '../../core/models/user.model';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink, TranslateModule],
  template: `
    <div class="admin-page">

      <!-- ══ HERO ══ -->
      <div class="hero-banner">
        <div class="hero-left">
          <div class="hero-label">{{ 'ADMIN.COMMAND_CENTER' | translate }}</div>
          <div class="hero-greeting">{{ 'ADMIN.GREETING' | translate: { name: adminName() } }}</div>
          <div class="hero-status">
            <span class="status-dot" [class.status-dot--ok]="marketplaceHealthy()" [class.status-dot--warn]="!marketplaceHealthy()"></span>
            <span class="status-text">{{ (marketplaceHealthy() ? 'ADMIN.OPERATIONAL' : 'ADMIN.DEGRADED') | translate }}</span>
            <span class="status-sep">·</span>
            <span class="status-snap">{{ activeLoads() }} {{ 'ADMIN.SNAP_LOADS' | translate }}</span>
            <span class="status-sep">·</span>
            <span class="status-snap">{{ activeCarriers() }} {{ 'ADMIN.SNAP_CARRIERS' | translate }}</span>
            <span class="status-sep">·</span>
            <span class="status-snap">{{ driversOnline() }} {{ 'ADMIN.SNAP_DRIVERS' | translate }}</span>
            <span class="status-sep">·</span>
            <span class="status-snap">{{ volumeToday() | number:'1.0-0' }} CFA {{ 'ADMIN.SNAP_VOLUME' | translate }}</span>
          </div>
        </div>
        <div class="hero-right">
          <a class="btn-trust" routerLink="/admin">
            🛡 {{ 'ADMIN.TRUST_CENTER' | translate }}
          </a>
        </div>
      </div>

      <!-- ══ KPI CARDS ══ -->
      <div class="kpi-grid">
        <div class="kpi-card kpi-card--blue">
          <div class="kpi-icon">📦</div>
          <div class="kpi-val">{{ activeLoads() }}</div>
          <div class="kpi-lbl">{{ 'ADMIN.KPI_LOADS' | translate }}</div>
          <div class="kpi-trend kpi-trend--up">↑ {{ loadsTrend() }}%</div>
        </div>
        <div class="kpi-card kpi-card--gold">
          <div class="kpi-icon">🚛</div>
          <div class="kpi-val">{{ activeCarriers() }}</div>
          <div class="kpi-lbl">{{ 'ADMIN.KPI_FLEET' | translate }}</div>
          <div class="kpi-trend kpi-trend--up">↑ {{ carriersTrend() }}%</div>
        </div>
        <div class="kpi-card kpi-card--green">
          <div class="kpi-icon">💰</div>
          <div class="kpi-val">{{ volumeToday() | number:'1.0-0' }}</div>
          <div class="kpi-lbl">{{ 'ADMIN.KPI_VOLUME' | translate }} (CFA)</div>
          <div class="kpi-trend kpi-trend--up">↑ {{ volumeTrend() }}%</div>
        </div>
        <div class="kpi-card" [class.kpi-card--red]="trustScore() < 90" [class.kpi-card--green]="trustScore() >= 90">
          <div class="kpi-icon">🛡</div>
          <div class="kpi-val">{{ trustScore() }}%</div>
          <div class="kpi-lbl">{{ 'ADMIN.KPI_TRUST' | translate }}</div>
          <div class="kpi-trend" [class.kpi-trend--up]="trustScore() >= 90" [class.kpi-trend--down]="trustScore() < 90">
            {{ trustScore() >= 90 ? '✓ Sain' : '⚠ À surveiller' }}
          </div>
        </div>
      </div>

      <div class="two-col">

        <!-- ══ ATTENTION CENTER ══ -->
        <div class="panel attention-panel">
          <div class="panel-header">
            <span class="panel-title alert-red">⚠ {{ 'ADMIN.ATTENTION' | translate }}</span>
            <span class="alert-count" *ngIf="totalAlerts() > 0">{{ totalAlerts() }}</span>
          </div>

          <div class="alert-empty" *ngIf="totalAlerts() === 0">
            ✓ {{ 'ADMIN.NO_ALERTS' | translate }}
          </div>

          <div *ngIf="trustAlerts().length > 0">
            <div class="alert-section">🛡 {{ 'ADMIN.TRUST_ALERTS' | translate }}</div>
            <div class="alert-item alert-item--red" *ngFor="let a of trustAlerts()">
              <span class="alert-dot"></span>
              <span class="alert-text">{{ a }}</span>
              <button class="alert-cta">{{ 'ADMIN.REVIEW' | translate }}</button>
            </div>
          </div>

          <div *ngIf="operationalAlerts().length > 0">
            <div class="alert-section">📍 {{ 'ADMIN.OPS_ALERTS' | translate }}</div>
            <div class="alert-item alert-item--amber" *ngFor="let a of operationalAlerts()">
              <span class="alert-dot alert-dot--amber"></span>
              <span class="alert-text">{{ a }}</span>
              <button class="alert-cta">{{ 'ADMIN.REVIEW' | translate }}</button>
            </div>
          </div>

          <div *ngIf="financialAlerts().length > 0">
            <div class="alert-section">💰 {{ 'ADMIN.FIN_ALERTS' | translate }}</div>
            <div class="alert-item alert-item--amber" *ngFor="let a of financialAlerts()">
              <span class="alert-dot alert-dot--amber"></span>
              <span class="alert-text">{{ a }}</span>
              <button class="alert-cta">{{ 'ADMIN.REVIEW' | translate }}</button>
            </div>
          </div>
        </div>

        <!-- ══ MARKETPLACE HEALTH ══ -->
        <div class="panel">
          <div class="panel-header">
            <span class="panel-title">📊 {{ 'ADMIN.MARKET_HEALTH' | translate }}</span>
          </div>
          <div class="health-flow">
            <div class="health-step" *ngFor="let step of healthSteps()">
              <div class="health-step-icon">{{ step.icon }}</div>
              <div class="health-step-val" [class.health-val--good]="step.status === 'good'" [class.health-val--warn]="step.status === 'warn'">{{ step.value }}</div>
              <div class="health-step-lbl">{{ step.label | translate }}</div>
              <div class="health-arrow" *ngIf="!step.last">↓</div>
            </div>
          </div>
        </div>

      </div>

      <!-- ══ TRUST CENTER ══ -->
      <div class="panel trust-panel">
        <div class="panel-header">
          <span class="panel-title">🛡 {{ 'ADMIN.TRUST_CENTER' | translate }}</span>
        </div>
        <div class="trust-grid">
          <div class="trust-col">
            <div class="trust-col-title">{{ 'ADMIN.VERIF_QUEUE' | translate }}</div>
            <div class="trust-item" *ngFor="let v of verificationQueue()">
              <span class="trust-badge trust-badge--pending">{{ v.type }}</span>
              <span class="trust-name">{{ v.name }}</span>
              <button class="trust-btn">{{ 'ADMIN.VERIFY' | translate }}</button>
            </div>
            <div class="trust-empty" *ngIf="verificationQueue().length === 0">{{ 'ADMIN.QUEUE_EMPTY' | translate }}</div>
          </div>
          <div class="trust-col">
            <div class="trust-col-title">{{ 'ADMIN.COMPLIANCE_QUEUE' | translate }}</div>
            <div class="trust-item trust-item--warn" *ngFor="let c of complianceQueue()">
              <span class="trust-badge trust-badge--warn">{{ c.type }}</span>
              <span class="trust-name">{{ c.name }}</span>
              <span class="trust-expiry">{{ c.expiry }}</span>
            </div>
            <div class="trust-empty" *ngIf="complianceQueue().length === 0">{{ 'ADMIN.QUEUE_EMPTY' | translate }}</div>
          </div>
          <div class="trust-col">
            <div class="trust-col-title">{{ 'ADMIN.RISK_QUEUE' | translate }}</div>
            <div class="trust-item trust-item--red" *ngFor="let r of riskQueue()">
              <span class="trust-badge trust-badge--red">{{ r.type }}</span>
              <span class="trust-name">{{ r.name }}</span>
              <button class="trust-btn trust-btn--red">{{ 'ADMIN.INVESTIGATE' | translate }}</button>
            </div>
            <div class="trust-empty" *ngIf="riskQueue().length === 0">{{ 'ADMIN.QUEUE_EMPTY' | translate }}</div>
          </div>
        </div>
      </div>

      <!-- ══ MARKETPLACE REVENUE + ACTIVITY ══ -->
      <div class="two-col">

        <div class="panel">
          <div class="panel-header">
            <span class="panel-title">💰 {{ 'ADMIN.REVENUE' | translate }}</span>
          </div>
          <div class="revenue-rows">
            <div class="rev-row">
              <span class="rev-period">{{ 'ADMIN.REV_TODAY' | translate }}</span>
              <span class="rev-val">{{ volumeToday() | number:'1.0-0' }} CFA</span>
            </div>
            <div class="rev-row">
              <span class="rev-period">{{ 'ADMIN.REV_WEEK' | translate }}</span>
              <span class="rev-val">{{ volumeWeek() | number:'1.0-0' }} CFA</span>
            </div>
            <div class="rev-row">
              <span class="rev-period">{{ 'ADMIN.REV_MONTH' | translate }}</span>
              <span class="rev-val">{{ volumeMonth() | number:'1.0-0' }} CFA</span>
            </div>
            <div class="rev-divider"></div>
            <div class="rev-row rev-row--fee">
              <span class="rev-period">{{ 'ADMIN.PLATFORM_FEES' | translate }}</span>
              <span class="rev-val rev-val--gold">{{ platformFees() | number:'1.0-0' }} CFA</span>
            </div>
          </div>
        </div>

        <div class="panel">
          <div class="panel-header">
            <span class="panel-title">🕐 {{ 'ADMIN.RECENT_ACTIVITY' | translate }}</span>
          </div>
          <div class="activity-list">
            <div class="activity-item" *ngFor="let a of recentActivity()">
              <span class="activity-time">{{ a.time }}</span>
              <span class="activity-dot" [class.activity-dot--green]="a.type === 'success'" [class.activity-dot--red]="a.type === 'alert'" [class.activity-dot--gold]="a.type === 'info'"></span>
              <span class="activity-text">{{ a.text }}</span>
            </div>
          </div>
        </div>

      </div>

      <!-- ══ USERS OVERVIEW ══ -->
      <div class="panel">
        <div class="panel-header">
          <span class="panel-title">👤 {{ 'ADMIN.ORGS' | translate }}</span>
          <a routerLink="/admin/users" class="see-all">{{ 'COMMON.SEE_ALL' | translate }} →</a>
        </div>
        <div class="users-grid">
          <div class="user-stat">
            <div class="user-stat-val">{{ totalUsers() }}</div>
            <div class="user-stat-lbl">{{ 'ADMIN.TOTAL_USERS' | translate }}</div>
          </div>
          <div class="user-stat">
            <div class="user-stat-val user-stat-val--gold">{{ totalCarriers() }}</div>
            <div class="user-stat-lbl">{{ 'ADMIN.CARRIERS' | translate }}</div>
          </div>
          <div class="user-stat">
            <div class="user-stat-val user-stat-val--blue">{{ totalShippers() }}</div>
            <div class="user-stat-lbl">{{ 'ADMIN.SHIPPERS' | translate }}</div>
          </div>
          <div class="user-stat">
            <div class="user-stat-val user-stat-val--green">{{ totalDrivers() }}</div>
            <div class="user-stat-lbl">{{ 'ADMIN.DRIVERS' | translate }}</div>
          </div>
        </div>

        <div class="users-table-wrap" *ngIf="recentUsers().length">
          <table class="users-table">
            <thead>
              <tr>
                <th>{{ 'ADMIN.COL_NAME' | translate }}</th>
                <th>{{ 'ADMIN.COL_ROLE' | translate }}</th>
                <th>{{ 'ADMIN.COL_PHONE' | translate }}</th>
                <th>{{ 'ADMIN.COL_STATUS' | translate }}</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let u of recentUsers()">
                <td class="user-name">{{ u.full_name }}</td>
                <td><span class="role-pill role-pill--{{ u.role?.toLowerCase() }}">{{ u.role }}</span></td>
                <td class="user-phone">{{ u.phone_number }}</td>
                <td>
                  <span class="status-pill" [class.status-pill--ok]="u.is_verified" [class.status-pill--warn]="!u.is_verified">
                    {{ (u.is_verified ? 'ADMIN.VERIFIED' : 'ADMIN.PENDING') | translate }}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

    </div>
  `,
  styles: [`
    .admin-page { max-width: 1200px; }

    /* Hero */
    .hero-banner {
      display: flex; align-items: center; justify-content: space-between; gap: 20px;
      background: linear-gradient(135deg, #1A1A2E 0%, #16213E 50%, #0F3460 100%);
      border-radius: 16px; padding: 24px 28px; margin-bottom: 20px;
      border: 1px solid rgba(201,162,39,0.2); box-shadow: 0 4px 24px rgba(0,0,0,0.3);
    }
    .hero-label { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.2px; color: #C9A227; margin-bottom: 6px; }
    .hero-greeting { font-size: 22px; font-weight: 800; color: #fff; margin-bottom: 10px; }
    .hero-status { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
    .status-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
    .status-dot--ok { background: #66BB6A; box-shadow: 0 0 6px #66BB6A; }
    .status-dot--warn { background: #FFB300; box-shadow: 0 0 6px #FFB300; }
    .status-text { font-size: 13px; font-weight: 700; color: #66BB6A; }
    .status-sep { color: rgba(255,255,255,0.3); font-size: 12px; }
    .status-snap { font-size: 12px; color: rgba(255,255,255,0.7); font-weight: 500; }
    .btn-trust {
      padding: 12px 22px; background: linear-gradient(135deg, #C9A227, #A8861F);
      color: #111; border-radius: 10px; text-decoration: none; font-size: 14px;
      font-weight: 800; white-space: nowrap; box-shadow: 0 4px 12px rgba(201,162,39,0.4);
      transition: all .15s;
    }
    .btn-trust:hover { filter: brightness(1.1); }

    /* KPI */
    .kpi-grid { display: grid; grid-template-columns: repeat(4,1fr); gap: 14px; margin-bottom: 20px; }
    .kpi-card {
      background: var(--surface); border-radius: 14px; padding: 20px 18px;
      border: 1px solid var(--border); box-shadow: var(--shadow);
      display: flex; flex-direction: column; gap: 4px;
    }
    .kpi-card--blue  { border-top: 3px solid #42A5F5; }
    .kpi-card--gold  { border-top: 3px solid #C9A227; }
    .kpi-card--green { border-top: 3px solid #66BB6A; }
    .kpi-card--red   { border-top: 3px solid #E53935; }
    .kpi-icon { font-size: 22px; margin-bottom: 4px; }
    .kpi-val  { font-size: 28px; font-weight: 800; color: var(--text-primary); line-height: 1; }
    .kpi-lbl  { font-size: 12px; color: var(--text-secondary); font-weight: 600; margin-top: 2px; }
    .kpi-trend { font-size: 11px; font-weight: 700; margin-top: 6px; }
    .kpi-trend--up   { color: #66BB6A; }
    .kpi-trend--down { color: #E53935; }

    /* Two-col layout */
    .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px; }

    /* Panel */
    .panel {
      background: var(--surface); border-radius: 14px; padding: 20px;
      border: 1px solid var(--border); box-shadow: var(--shadow); margin-bottom: 16px;
    }
    .panel-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
    .panel-title { font-size: 13px; font-weight: 700; color: var(--text-primary); }
    .alert-red { color: #E53935; }
    .see-all { font-size: 12px; color: var(--gold); text-decoration: none; font-weight: 600; }
    .see-all:hover { text-decoration: underline; }
    .alert-count {
      background: #E53935; color: white; font-size: 11px; font-weight: 800;
      border-radius: 10px; padding: 2px 7px; min-width: 20px; text-align: center;
    }

    /* Attention */
    .attention-panel { }
    .alert-empty { font-size: 13px; color: #66BB6A; padding: 8px 0; }
    .alert-section { font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.8px; color: var(--text-secondary); margin: 14px 0 8px; }
    .alert-section:first-child { margin-top: 0; }
    .alert-item {
      display: flex; align-items: center; gap: 8px; padding: 9px 10px;
      border-radius: 8px; margin-bottom: 6px;
    }
    .alert-item--red   { background: rgba(229,57,53,0.08); border: 1px solid rgba(229,57,53,0.2); }
    .alert-item--amber { background: rgba(255,179,0,0.08); border: 1px solid rgba(255,179,0,0.2); }
    .alert-dot { width: 7px; height: 7px; border-radius: 50%; background: #E53935; flex-shrink: 0; }
    .alert-dot--amber { background: #FFB300; }
    .alert-text { flex: 1; font-size: 12px; color: var(--text-primary); font-weight: 500; }
    .alert-cta {
      font-size: 11px; font-weight: 700; color: var(--gold); background: none;
      border: 1px solid rgba(201,162,39,0.4); border-radius: 6px; padding: 3px 8px; cursor: pointer;
    }

    /* Health flow */
    .health-flow { display: flex; flex-direction: column; gap: 0; align-items: stretch; }
    .health-step { display: flex; align-items: center; gap: 10px; padding: 10px 0; border-bottom: 1px solid var(--border); }
    .health-step:last-child { border-bottom: none; }
    .health-step-icon { font-size: 18px; width: 28px; text-align: center; }
    .health-step-val { font-size: 20px; font-weight: 800; min-width: 60px; }
    .health-val--good { color: #66BB6A; }
    .health-val--warn { color: #FFB300; }
    .health-step-lbl { flex: 1; font-size: 13px; color: var(--text-secondary); font-weight: 600; }
    .health-arrow { font-size: 16px; color: var(--text-secondary); margin-left: auto; }

    /* Trust Center */
    .trust-panel { margin-bottom: 16px; }
    .trust-grid { display: grid; grid-template-columns: repeat(3,1fr); gap: 16px; }
    .trust-col-title { font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.7px; color: var(--text-secondary); margin-bottom: 12px; }
    .trust-item {
      display: flex; align-items: center; gap: 8px; padding: 9px 10px;
      border-radius: 8px; border: 1px solid var(--border); margin-bottom: 8px; flex-wrap: wrap;
    }
    .trust-item--warn { border-color: rgba(255,179,0,0.3); background: rgba(255,179,0,0.05); }
    .trust-item--red  { border-color: rgba(229,57,53,0.3); background: rgba(229,57,53,0.05); }
    .trust-badge {
      font-size: 10px; font-weight: 700; padding: 2px 7px; border-radius: 10px;
      white-space: nowrap; text-transform: uppercase;
    }
    .trust-badge--pending { background: rgba(66,165,245,0.15); color: #42A5F5; }
    .trust-badge--warn    { background: rgba(255,179,0,0.15);  color: #FFB300; }
    .trust-badge--red     { background: rgba(229,57,53,0.15);  color: #E53935; }
    .trust-name { flex: 1; font-size: 12px; font-weight: 600; color: var(--text-primary); }
    .trust-expiry { font-size: 11px; color: #FFB300; font-weight: 600; }
    .trust-btn {
      font-size: 11px; font-weight: 700; color: var(--gold); background: none;
      border: 1px solid rgba(201,162,39,0.4); border-radius: 6px; padding: 3px 8px; cursor: pointer;
    }
    .trust-btn--red { color: #E53935; border-color: rgba(229,57,53,0.4); }
    .trust-empty { font-size: 12px; color: var(--text-secondary); padding: 8px 0; }

    /* Revenue */
    .revenue-rows { display: flex; flex-direction: column; gap: 0; }
    .rev-row { display: flex; justify-content: space-between; align-items: center; padding: 12px 0; border-bottom: 1px solid var(--border); }
    .rev-row:last-child { border-bottom: none; }
    .rev-row--fee { padding-top: 14px; }
    .rev-period { font-size: 13px; color: var(--text-secondary); font-weight: 500; }
    .rev-val { font-size: 15px; font-weight: 800; color: var(--text-primary); }
    .rev-val--gold { color: var(--gold); }
    .rev-divider { border: none; border-top: 2px solid var(--border); margin: 4px 0; }

    /* Activity */
    .activity-list { display: flex; flex-direction: column; gap: 10px; }
    .activity-item { display: flex; align-items: center; gap: 10px; font-size: 13px; }
    .activity-time { font-size: 11px; color: var(--text-secondary); min-width: 40px; font-weight: 600; }
    .activity-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; background: var(--border); }
    .activity-dot--green { background: #66BB6A; }
    .activity-dot--red   { background: #E53935; }
    .activity-dot--gold  { background: #C9A227; }
    .activity-text { color: var(--text-primary); font-weight: 500; }

    /* Users overview */
    .users-grid { display: grid; grid-template-columns: repeat(4,1fr); gap: 12px; margin-bottom: 18px; }
    .user-stat { text-align: center; padding: 14px; border-radius: 10px; background: var(--surface-raised); border: 1px solid var(--border); }
    .user-stat-val { font-size: 26px; font-weight: 800; color: var(--text-primary); }
    .user-stat-val--gold  { color: #C9A227; }
    .user-stat-val--blue  { color: #42A5F5; }
    .user-stat-val--green { color: #66BB6A; }
    .user-stat-lbl { font-size: 11px; color: var(--text-secondary); font-weight: 600; text-transform: uppercase; letter-spacing: 0.4px; margin-top: 4px; }
    .users-table-wrap { overflow-x: auto; }
    .users-table { width: 100%; border-collapse: collapse; min-width: 500px; }
    .users-table th { text-align: left; padding: 10px 12px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.4px; color: var(--text-secondary); border-bottom: 2px solid var(--border); background: var(--surface-raised); }
    .users-table td { padding: 11px 12px; border-bottom: 1px solid var(--border); font-size: 13px; vertical-align: middle; }
    .user-name  { font-weight: 700; color: var(--text-primary); }
    .user-phone { color: var(--text-secondary); }
    .role-pill { font-size: 10px; font-weight: 700; padding: 2px 8px; border-radius: 10px; text-transform: uppercase; background: rgba(201,162,39,0.15); color: #C9A227; }
    .role-pill--driver  { background: rgba(102,187,106,0.15); color: #66BB6A; }
    .role-pill--shipper { background: rgba(201,162,39,0.15);  color: #C9A227; }
    .role-pill--carrier { background: rgba(66,165,245,0.15);  color: #42A5F5; }
    .status-pill { font-size: 10px; font-weight: 700; padding: 2px 8px; border-radius: 10px; }
    .status-pill--ok   { background: rgba(102,187,106,0.15); color: #66BB6A; }
    .status-pill--warn { background: rgba(255,179,0,0.12);   color: #FFB300; }

    @media (max-width: 900px) {
      .kpi-grid  { grid-template-columns: repeat(2,1fr); }
      .two-col   { grid-template-columns: 1fr; }
      .trust-grid { grid-template-columns: 1fr; }
      .users-grid { grid-template-columns: repeat(2,1fr); }
    }
    @media (max-width: 600px) {
      .hero-banner { flex-direction: column; align-items: flex-start; }
      .kpi-grid  { grid-template-columns: 1fr 1fr; }
      .hero-status { flex-direction: column; align-items: flex-start; gap: 4px; }
      .status-sep { display: none; }
    }
  `]
})
export class AdminDashboardComponent implements OnInit {
  private api  = inject(ApiService);
  auth = inject(AuthService);

  allOrders = signal<FreightOrder[]>([]);
  allUsers  = signal<User[]>([]);
  loading   = signal(true);

  ngOnInit(): void {
    this.api.getOrders({ page_size: '200', page: '1' }).subscribe({
      next: res => { this.allOrders.set(res.results); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
    this.api.getUsers({ page_size: '100', page: '1' }).subscribe({
      next: res => this.allUsers.set((res as any).results ?? res),
      error: () => {},
    });
  }

  // ── Computed ──────────────────────────────────────────────────────
  adminName = computed(() => this.auth.user()?.full_name?.split(' ')[0] ?? 'Admin');

  activeLoads    = computed(() => this.allOrders().filter(o => !['DELIVERED','COMPLETED','CANCELLED'].includes(o.status)).length);
  activeCarriers = computed(() => this.allUsers().filter((u: any) => u.role === 'CARRIER').length);
  totalUsers     = computed(() => this.allUsers().length);
  totalCarriers  = computed(() => this.allUsers().filter((u: any) => u.role === 'CARRIER').length);
  totalShippers  = computed(() => this.allUsers().filter((u: any) => u.role === 'SHIPPER').length);
  totalDrivers   = computed(() => this.allUsers().filter((u: any) => u.role === 'DRIVER').length);
  driversOnline  = computed(() => this.allUsers().filter((u: any) => u.driver_profile?.is_available).length);

  volumeToday = computed(() =>
    this.allOrders()
      .filter(o => ['DELIVERED','COMPLETED'].includes(o.status))
      .reduce((s, o) => s + ((o as any).final_price || o.proposed_price || 0), 0)
  );
  volumeWeek  = computed(() => this.volumeToday() * 6.5);
  volumeMonth = computed(() => this.volumeToday() * 26);
  platformFees = computed(() => Math.round(this.volumeToday() * 0.035));

  trustScore  = computed(() => {
    const total = this.allUsers().length;
    if (!total) return 98;
    const verified = this.allUsers().filter((u: any) => u.is_verified).length;
    return Math.round((verified / total) * 100);
  });
  marketplaceHealthy = computed(() => this.trustScore() >= 80 && this.activeLoads() >= 0);

  loadsTrend    = computed(() => 12);
  carriersTrend = computed(() => 8);
  volumeTrend   = computed(() => 18);

  recentUsers = computed(() => this.allUsers().slice(0, 8));

  trustAlerts = computed(() => {
    const alerts: string[] = [];
    const unverified = this.allUsers().filter((u: any) => !u.is_verified && u.role === 'CARRIER').length;
    if (unverified > 0) alerts.push(`${unverified} transporteur(s) en attente de vérification`);
    return alerts;
  });

  operationalAlerts = computed(() => {
    const alerts: string[] = [];
    const delayed = this.allOrders().filter(o => {
      const deadline = (o as any).delivery_deadline;
      return deadline && new Date(deadline) < new Date() && !['DELIVERED','COMPLETED','CANCELLED'].includes(o.status);
    });
    if (delayed.length > 0) alerts.push(`${delayed.length} livraison(s) en retard`);
    return alerts;
  });

  financialAlerts = computed(() => {
    const alerts: string[] = [];
    const pending = this.allOrders().filter(o => o.status === 'POSTED' && !o.proposed_price).length;
    if (pending > 0) alerts.push(`${pending} commande(s) sans prix défini`);
    return alerts;
  });

  totalAlerts = computed(() => this.trustAlerts().length + this.operationalAlerts().length + this.financialAlerts().length);

  healthSteps = computed(() => [
    { icon: '📤', label: 'ADMIN.HEALTH_DEMAND',    value: this.allOrders().filter(o => o.status === 'POSTED').length,                               status: 'good', last: false },
    { icon: '🤝', label: 'ADMIN.HEALTH_LIQUIDITY', value: this.allOrders().filter(o => o.status === 'ASSIGNED').length,                             status: 'good', last: false },
    { icon: '🚛', label: 'ADMIN.HEALTH_CAPACITY',  value: this.totalCarriers(),                                                                      status: 'good', last: false },
    { icon: '✅', label: 'ADMIN.HEALTH_EXECUTION', value: this.allOrders().filter(o => ['DELIVERED','COMPLETED'].includes(o.status)).length,          status: 'good', last: false },
    { icon: '🛡', label: 'ADMIN.HEALTH_TRUST',     value: this.trustScore() + '%',                                                                   status: this.trustScore() >= 90 ? 'good' : 'warn', last: true  },
  ]);

  verificationQueue = computed(() => {
    return this.allUsers()
      .filter((u: any) => !u.is_verified && ['CARRIER','DRIVER'].includes(u.role))
      .slice(0, 4)
      .map((u: any) => ({ type: u.role, name: u.full_name }));
  });

  complianceQueue = computed(() => []);

  riskQueue = computed(() => {
    const lowTrust = this.allUsers()
      .filter((u: any) => u.is_verified === false && u.role === 'DRIVER')
      .slice(0, 3)
      .map((u: any) => ({ type: 'Non vérifié', name: u.full_name }));
    return lowTrust;
  });

  recentActivity = computed(() => [
    { time: '09:15', type: 'success', text: 'Transporteur vérifié — Dakar Logistics' },
    { time: '09:47', type: 'success', text: `Chargement livré — ${this.allOrders().find(o => o.status === 'DELIVERED')?.reference ?? '#REF-001'}` },
    { time: '10:03', type: 'info',    text: 'Score de confiance mis à jour — 96%' },
    { time: '10:26', type: 'success', text: 'Paiement validé — 280 000 CFA' },
    { time: '11:14', type: 'alert',   text: `${this.trustAlerts().length > 0 ? this.trustAlerts()[0] : 'Aucune alerte critique'}` },
  ]);
}
