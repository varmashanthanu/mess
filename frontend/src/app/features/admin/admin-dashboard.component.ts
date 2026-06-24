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
          <div class="hero-greeting">{{ 'ADMIN.GREETING' | translate: { name: adminName() } }} 👋</div>
          <div class="hero-sub">{{ 'ADMIN.HERO_SUBTITLE' | translate }}</div>
          <div class="hero-status">
            <span class="status-dot" [class.status-dot--ok]="marketplaceHealthy()" [class.status-dot--warn]="!marketplaceHealthy()"></span>
            <span class="status-text">{{ (marketplaceHealthy() ? 'ADMIN.OPERATIONAL' : 'ADMIN.DEGRADED') | translate }}</span>
            <span class="status-sep">·</span>
            <span class="status-snap">{{ activeLoads() }} loads actifs</span>
            <span class="status-sep">·</span>
            <span class="status-snap">{{ activeCarriers() }} transporteurs</span>
            <span class="status-sep">·</span>
            <span class="status-snap">{{ driversOnline() }} conducteurs disponibles</span>
          </div>
        </div>
        <div class="hero-right">
          <div class="hero-date">{{ today | date:'MMMM d, y' }}</div>
          <a class="btn-trust" routerLink="/admin">🛡 Trust Center</a>
        </div>
      </div>

      <!-- ══ MARKETPLACE OVERVIEW (5 stats) ══ -->
      <div class="overview-bar">
        <div class="ov-stat">
          <div class="ov-icon">📋</div>
          <div class="ov-val">{{ loadsPosted() }}</div>
          <div class="ov-lbl">{{ 'ADMIN.LOADS_POSTED' | translate }}</div>
          <div class="ov-trend ov-trend--up">↑ 12.5% {{ 'ADMIN.VS_YESTERDAY' | translate }}</div>
        </div>
        <div class="ov-sep"></div>
        <div class="ov-stat">
          <div class="ov-icon">🤝</div>
          <div class="ov-val">{{ loadsBooked() }}</div>
          <div class="ov-lbl">{{ 'ADMIN.LOADS_BOOKED' | translate }}</div>
          <div class="ov-trend ov-trend--up">↑ 15.6% {{ 'ADMIN.VS_YESTERDAY' | translate }}</div>
        </div>
        <div class="ov-sep"></div>
        <div class="ov-stat">
          <div class="ov-icon">✅</div>
          <div class="ov-val">{{ loadsDelivered() }}</div>
          <div class="ov-lbl">{{ 'ADMIN.LOADS_DELIVERED' | translate }}</div>
          <div class="ov-trend ov-trend--up">↑ 10.2% {{ 'ADMIN.VS_YESTERDAY' | translate }}</div>
        </div>
        <div class="ov-sep"></div>
        <div class="ov-stat">
          <div class="ov-icon">📊</div>
          <div class="ov-val">{{ completionRate() }}%</div>
          <div class="ov-lbl">{{ 'ADMIN.COMPLETION_RATE_LBL' | translate }}</div>
          <div class="ov-trend" [class.ov-trend--up]="completionRate() >= 80" [class.ov-trend--down]="completionRate() < 80">
            {{ completionRate() >= 80 ? '↑ 4.3%' : '↓ Attention' }}
          </div>
        </div>
        <div class="ov-sep"></div>
        <div class="ov-stat">
          <div class="ov-icon">💰</div>
          <div class="ov-val">{{ volumeToday() | number:'1.0-0' }}</div>
          <div class="ov-lbl">{{ 'ADMIN.REVENUE_FCFA' | translate }}</div>
          <div class="ov-trend ov-trend--up">↑ 5.7% {{ 'ADMIN.VS_YESTERDAY' | translate }}</div>
        </div>
      </div>

      <!-- ══ ROW 1 : Attention Center + System Alerts ══ -->
      <div class="two-col">

        <!-- Attention Center -->
        <div class="panel attention-panel">
          <div class="panel-header">
            <span class="panel-title alert-red">⚠ {{ 'ADMIN.ATTENTION_CENTER' | translate }}</span>
            <span class="panel-sub">{{ 'ADMIN.ATTN_SUBTITLE' | translate }}</span>
            <span class="alert-count" *ngIf="totalAlerts() > 0">{{ totalAlerts() }}</span>
          </div>

          <div class="attn-cards">
            <div class="attn-card attn-card--blue" routerLink="/admin/users">
              <div class="attn-icon">✅</div>
              <div class="attn-num">{{ verificationCount() }}</div>
              <div class="attn-lbl">{{ 'ADMIN.VERIFICATIONS_LBL' | translate }}</div>
              <div class="attn-sub">{{ 'ADMIN.PENDING_REVIEW' | translate }}</div>
              <div class="attn-link">{{ 'ADMIN.VIEW_QUEUE' | translate }}</div>
            </div>
            <div class="attn-card attn-card--orange">
              <div class="attn-icon">⚖</div>
              <div class="attn-num">{{ disputeCount() }}</div>
              <div class="attn-lbl">{{ 'ADMIN.DISPUTES_LBL' | translate }}</div>
              <div class="attn-sub">{{ 'ADMIN.OPEN_CASES' | translate }}</div>
              <div class="attn-link">{{ 'ADMIN.VIEW_QUEUE' | translate }}</div>
            </div>
            <div class="attn-card attn-card--red">
              <div class="attn-icon">💳</div>
              <div class="attn-num">{{ failedPayments() }}</div>
              <div class="attn-lbl">{{ 'ADMIN.PAYMENTS_LBL' | translate }}</div>
              <div class="attn-sub">{{ 'ADMIN.FAILED_PAYMENTS_LBL' | translate }}</div>
              <div class="attn-link">{{ 'ADMIN.VIEW_QUEUE' | translate }}</div>
            </div>
            <div class="attn-card attn-card--purple">
              <div class="attn-icon">🛡</div>
              <div class="attn-num">{{ fraudAlerts() }}</div>
              <div class="attn-lbl">{{ 'ADMIN.FRAUD_LBL' | translate }}</div>
              <div class="attn-sub">{{ 'ADMIN.HIGH_RISK' | translate }}</div>
              <div class="attn-link">{{ 'ADMIN.VIEW_DETAILS' | translate }}</div>
            </div>
          </div>
        </div>

        <!-- System Alerts -->
        <div class="panel">
          <div class="panel-header">
            <span class="panel-title">🔔 {{ 'ADMIN.SYSTEM_ALERTS_LBL' | translate }}</span>
            <a class="see-all">{{ 'ADMIN.VIEW_ALL' | translate }}</a>
          </div>
          <div class="sys-alert sys-alert--high" *ngFor="let a of systemAlertsHigh()">
            <span class="severity-badge severity--high">High</span>
            <div class="sys-alert-body">
              <div class="sys-alert-title">{{ a.title }}</div>
              <div class="sys-alert-detail">{{ a.detail }}</div>
            </div>
            <div class="sys-alert-time">{{ a.time }}</div>
          </div>
          <div class="sys-alert sys-alert--medium" *ngFor="let a of systemAlertsMedium()">
            <span class="severity-badge severity--medium">Medium</span>
            <div class="sys-alert-body">
              <div class="sys-alert-title">{{ a.title }}</div>
              <div class="sys-alert-detail">{{ a.detail }}</div>
            </div>
            <div class="sys-alert-time">{{ a.time }}</div>
          </div>
          <div class="sys-alert sys-alert--low">
            <span class="severity-badge severity--low">Low</span>
            <div class="sys-alert-body">
              <div class="sys-alert-title">System maintenance scheduled</div>
              <div class="sys-alert-detail">May 22, 2025 02:00 AM</div>
            </div>
            <div class="sys-alert-time">2 hrs ago</div>
          </div>
        </div>

      </div>

      <!-- ══ ROW 2 : Marketplace Health + Operational Queues ══ -->
      <div class="two-col">

        <!-- Marketplace Health -->
        <div class="panel">
          <div class="panel-header">
            <span class="panel-title">📊 {{ 'ADMIN.MARKETPLACE_HEALTH_LBL' | translate }}</span>
            <a class="see-all">{{ 'ADMIN.VIEW_FULL_REPORT' | translate }}</a>
          </div>
          <div class="mh-row" *ngFor="let row of healthRows()">
            <div class="mh-label">{{ row.label }}</div>
            <div class="mh-val" [class.mh-val--green]="row.trend > 0" [class.mh-val--red]="row.trend < 0">{{ row.value }}</div>
            <div class="mh-trend" [class.mh-trend--up]="row.trend > 0" [class.mh-trend--down]="row.trend < 0">
              {{ row.trend > 0 ? '↑' : '↓' }} {{ row.trend | number:'1.1-1' }}%
              <span class="mh-sparkline">〜〜〜</span>
            </div>
          </div>
          <!-- Fulfillment Rate donut -->
          <div class="fulfillment-row">
            <div class="fulfillment-label">{{ 'ADMIN.FULFILLMENT_LBL' | translate }}</div>
            <div class="fulfillment-ring">
              <svg viewBox="0 0 36 36" width="54" height="54">
                <circle cx="18" cy="18" r="15.9" fill="none" stroke="var(--border)" stroke-width="3"/>
                <circle cx="18" cy="18" r="15.9" fill="none" stroke="#66BB6A" stroke-width="3"
                  [attr.stroke-dasharray]="completionRate() + ' ' + (100 - completionRate())"
                  stroke-dashoffset="25" stroke-linecap="round"/>
                <text x="18" y="20.5" text-anchor="middle" font-size="7" fill="var(--text-primary)" font-weight="700">{{ completionRate() }}%</text>
              </svg>
            </div>
            <div class="fulfillment-trend mh-trend--up">↑ 3.6%</div>
          </div>
        </div>

        <!-- Operational Queues -->
        <div class="panel">
          <div class="panel-header">
            <span class="panel-title">📋 {{ 'ADMIN.OPERATIONAL_QUEUES' | translate }}</span>
          </div>
          <div class="op-queue-item" *ngFor="let q of operationalQueues()">
            <span class="op-queue-icon">{{ q.icon }}</span>
            <span class="op-queue-lbl">{{ q.labelKey | translate }}</span>
            <span class="op-queue-count" [class.op-count--red]="q.count > 5" [class.op-count--amber]="q.count > 0 && q.count <= 5">{{ q.count }}</span>
            <span class="op-queue-arrow">›</span>
          </div>
        </div>

      </div>

      <!-- ══ ROW 3 : Recent Activity + Top Routes ══ -->
      <div class="two-col">

        <!-- Recent Activity -->
        <div class="panel">
          <div class="panel-header">
            <span class="panel-title">🕐 {{ 'ADMIN.RECENT_ACTIVITY_LBL' | translate }}</span>
            <a class="see-all">{{ 'ADMIN.VIEW_ALL' | translate }}</a>
          </div>
          <div class="activity-item" *ngFor="let a of recentActivity()">
            <div class="activity-icon" [class.ai--green]="a.type==='success'" [class.ai--red]="a.type==='alert'" [class.ai--gold]="a.type==='info'" [class.ai--blue]="a.type==='new'">
              {{ a.icon }}
            </div>
            <div class="activity-body">
              <div class="activity-title">{{ a.text }}</div>
              <div class="activity-sub" *ngIf="a.sub">{{ a.sub }}</div>
            </div>
            <div class="activity-time">{{ a.time }}</div>
          </div>
        </div>

        <!-- Top Routes -->
        <div class="panel">
          <div class="panel-header">
            <span class="panel-title">🗺 {{ 'ADMIN.TOP_ROUTES_LBL' | translate }}</span>
            <a class="see-all">{{ 'ADMIN.VIEW_REPORT' | translate }}</a>
          </div>
          <div class="routes-header-row">
            <span class="routes-col-lbl">{{ 'ADMIN.ROUTE_COL' | translate }}</span>
            <span class="routes-col-lbl">{{ 'ADMIN.LOADS_COL' | translate }}</span>
            <span class="routes-col-lbl">{{ 'ADMIN.TREND_COL' | translate }}</span>
          </div>
          <div class="route-row" *ngFor="let r of topRoutes()">
            <span class="route-name">{{ r.route }}</span>
            <span class="route-loads">{{ r.loads }}</span>
            <span class="route-pct" [class.route-up]="r.trend > 0" [class.route-down]="r.trend < 0">
              {{ r.trend > 0 ? '+' : '' }}{{ r.trend }}% <span class="route-spark">{{ r.trend > 0 ? '↗' : '↘' }}</span>
            </span>
          </div>
        </div>

      </div>

      <!-- ══ ROW 4 : Payment Overview + Quick Actions ══ -->
      <div class="two-col">

        <!-- Payment Overview -->
        <div class="panel">
          <div class="panel-header">
            <span class="panel-title">💳 {{ 'ADMIN.PAYMENT_OVERVIEW_LBL' | translate }}</span>
            <a class="see-all">{{ 'ADMIN.VIEW_ALL' | translate }}</a>
          </div>
          <div class="pay-layout">
            <div class="pay-donut">
              <svg viewBox="0 0 36 36" width="90" height="90">
                <circle cx="18" cy="18" r="15.9" fill="none" stroke="var(--border)" stroke-width="3"/>
                <!-- Success -->
                <circle cx="18" cy="18" r="15.9" fill="none" stroke="#66BB6A" stroke-width="3"
                  [attr.stroke-dasharray]="paySuccessPct() + ' ' + (100 - paySuccessPct())"
                  stroke-dashoffset="25" stroke-linecap="round"/>
                <!-- Failed -->
                <circle cx="18" cy="18" r="15.9" fill="none" stroke="#E53935" stroke-width="3"
                  [attr.stroke-dasharray]="payFailedPct() + ' ' + (100 - payFailedPct())"
                  [attr.stroke-dashoffset]="25 - paySuccessPct()" stroke-linecap="round"/>
                <text x="18" y="17" text-anchor="middle" font-size="5" fill="var(--text-secondary)">Success</text>
                <text x="18" y="23" text-anchor="middle" font-size="6" fill="#66BB6A" font-weight="700">> 99%</text>
              </svg>
            </div>
            <div class="pay-legend">
              <div class="pay-leg-row">
                <span class="pay-dot pay-dot--green"></span>
                <span class="pay-leg-lbl">{{ 'ADMIN.SUCCESSFUL' | translate }}</span>
                <span class="pay-leg-pct green">{{ paySuccessPct() }}%</span>
                <span class="pay-leg-amt">{{ volumeToday() | number:'1.0-0' }} FCFA</span>
              </div>
              <div class="pay-leg-row">
                <span class="pay-dot pay-dot--red"></span>
                <span class="pay-leg-lbl">{{ 'ADMIN.FAILED_PAY' | translate }}</span>
                <span class="pay-leg-pct red">{{ payFailedPct() }}%</span>
                <span class="pay-leg-amt">{{ failedAmount() | number:'1.0-0' }} FCFA</span>
              </div>
              <div class="pay-leg-row">
                <span class="pay-dot pay-dot--amber"></span>
                <span class="pay-leg-lbl">{{ 'ADMIN.PENDING_PAY' | translate }}</span>
                <span class="pay-leg-pct amber">{{ payPendingPct() }}%</span>
                <span class="pay-leg-amt">{{ pendingAmount() | number:'1.0-0' }} FCFA</span>
              </div>
              <div class="pay-success-rate">
                {{ 'ADMIN.PAYMENT_SUCCESS_RATE' | translate }} <strong>&gt; {{ paySuccessPct() }}%</strong>
              </div>
            </div>
          </div>
        </div>

        <!-- Quick Actions -->
        <div class="panel">
          <div class="panel-header">
            <span class="panel-title">⚡ {{ 'ADMIN.QUICK_ACTIONS_LBL' | translate }}</span>
          </div>
          <div class="qa-grid">
            <a class="qa-btn" routerLink="/admin/users">
              <span class="qa-icon">✅</span> {{ 'ADMIN.VERIFY_USER' | translate }}
            </a>
            <a class="qa-btn" routerLink="/admin">
              <span class="qa-icon">📢</span> {{ 'ADMIN.CREATE_ANNOUNCEMENT' | translate }}
            </a>
            <a class="qa-btn" routerLink="/loads/new">
              <span class="qa-icon">📦</span> {{ 'ADMIN.ADD_LOAD' | translate }}
            </a>
            <a class="qa-btn" routerLink="/messaging">
              <span class="qa-icon">💬</span> {{ 'ADMIN.SEND_MESSAGE_BTN' | translate }}
            </a>
            <a class="qa-btn" routerLink="/admin/users">
              <span class="qa-icon">🔍</span> {{ 'ADMIN.INVESTIGATE_USER' | translate }}
            </a>
            <button class="qa-btn qa-btn--export" (click)="exportReport()">
              <span class="qa-icon">📄</span> {{ 'ADMIN.EXPORT_REPORT' | translate }}
            </button>
          </div>
          <button class="qa-more">{{ 'ADMIN.MORE_ACTIONS' | translate }}</button>
        </div>

      </div>

      <!-- ══ USERS OVERVIEW ══ -->
      <div class="panel">
        <div class="panel-header">
          <span class="panel-title">👤 {{ 'ADMIN.USERS_OVERVIEW_LBL' | translate }}</span>
          <a routerLink="/admin/users" class="see-all">{{ 'ADMIN.VIEW_ALL' | translate }} →</a>
        </div>
        <div class="users-grid">
          <div class="user-stat">
            <div class="user-stat-val">{{ totalUsers() }}</div>
            <div class="user-stat-lbl">{{ 'ADMIN.TOTAL_USERS' | translate }}</div>
          </div>
          <div class="user-stat">
            <div class="user-stat-val user-stat-val--gold">{{ activeCarriers() }}</div>
            <div class="user-stat-lbl">{{ 'ADMIN.ACTIVE_CARRIERS_LBL' | translate }}</div>
          </div>
          <div class="user-stat">
            <div class="user-stat-val user-stat-val--blue">{{ totalShippers() }}</div>
            <div class="user-stat-lbl">{{ 'ADMIN.ACTIVE_SHIPPERS_LBL' | translate }}</div>
          </div>
          <div class="user-stat">
            <div class="user-stat-val user-stat-val--green">{{ driversOnline() }}</div>
            <div class="user-stat-lbl">{{ 'ADMIN.DRIVERS_AVAILABLE' | translate }}</div>
          </div>
        </div>
        <div class="users-table-wrap" *ngIf="recentUsers().length">
          <table class="users-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Role</th>
                <th>Phone</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let u of recentUsers()">
                <td class="user-name">{{ u.full_name }}</td>
                <td><span class="role-pill role-pill--{{ u.role.toLowerCase() }}">{{ u.role }}</span></td>
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
    .admin-page { max-width: 1280px; display: flex; flex-direction: column; gap: 16px; }

    /* ── Hero ─────────────────────────────── */
    .hero-banner {
      display: flex; align-items: center; justify-content: space-between; gap: 20px;
      background: linear-gradient(135deg, #1A1A2E 0%, #16213E 50%, #0F3460 100%);
      border-radius: 16px; padding: 24px 28px;
      border: 1px solid rgba(201,162,39,0.2); box-shadow: 0 4px 24px rgba(0,0,0,0.3);
    }
    .hero-label { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.2px; color: #C9A227; margin-bottom: 4px; }
    .hero-greeting { font-size: 22px; font-weight: 800; color: #fff; margin-bottom: 4px; }
    .hero-sub { font-size: 13px; color: rgba(255,255,255,0.55); margin-bottom: 10px; }
    .hero-status { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
    .status-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
    .status-dot--ok   { background: #66BB6A; box-shadow: 0 0 6px #66BB6A; }
    .status-dot--warn { background: #FFB300; box-shadow: 0 0 6px #FFB300; }
    .status-text { font-size: 13px; font-weight: 700; color: #66BB6A; }
    .status-sep  { color: rgba(255,255,255,0.3); font-size: 12px; }
    .status-snap { font-size: 12px; color: rgba(255,255,255,0.7); }
    .hero-right  { display: flex; flex-direction: column; align-items: flex-end; gap: 10px; }
    .hero-date   { font-size: 12px; color: rgba(255,255,255,0.45); }
    .btn-trust {
      padding: 10px 20px; background: linear-gradient(135deg, #C9A227, #A8861F);
      color: #111; border-radius: 10px; text-decoration: none; font-size: 14px;
      font-weight: 800; white-space: nowrap; box-shadow: 0 4px 12px rgba(201,162,39,0.4);
    }

    /* ── Marketplace Overview bar ─────────── */
    .overview-bar {
      display: flex; align-items: center; justify-content: space-between;
      background: var(--surface); border-radius: 14px; padding: 20px 28px;
      border: 1px solid var(--border); box-shadow: var(--shadow);
    }
    .ov-stat { display: flex; flex-direction: column; align-items: center; gap: 2px; flex: 1; }
    .ov-sep  { width: 1px; height: 52px; background: var(--border); flex-shrink: 0; }
    .ov-icon { font-size: 20px; }
    .ov-val  { font-size: 28px; font-weight: 800; color: var(--text-primary); line-height: 1; }
    .ov-lbl  { font-size: 11px; color: var(--text-secondary); font-weight: 600; text-transform: uppercase; letter-spacing: 0.4px; }
    .ov-trend { font-size: 11px; font-weight: 700; }
    .ov-trend--up   { color: #66BB6A; }
    .ov-trend--down { color: #E53935; }

    /* ── Two-col ──────────────────────────── */
    .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }

    /* ── Panel base ───────────────────────── */
    .panel {
      background: var(--surface); border-radius: 14px; padding: 20px;
      border: 1px solid var(--border); box-shadow: var(--shadow);
    }
    .panel-header { display: flex; align-items: center; gap: 8px; margin-bottom: 16px; }
    .panel-title  { font-size: 13px; font-weight: 800; color: var(--text-primary); flex: 1; letter-spacing: 0.3px; }
    .panel-sub    { font-size: 11px; color: var(--text-secondary); font-weight: 400; }
    .alert-red    { color: #E53935; }
    .alert-count  { background: #E53935; color: white; font-size: 11px; font-weight: 800; border-radius: 10px; padding: 2px 7px; }
    .see-all      { font-size: 12px; color: #C9A227; text-decoration: none; font-weight: 600; cursor: pointer; }

    /* ── Attention Cards ──────────────────── */
    .attn-cards { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; }
    .attn-card {
      border-radius: 12px; padding: 14px 12px; display: flex; flex-direction: column; gap: 3px;
      border: 1px solid transparent; cursor: pointer; transition: transform .12s;
    }
    .attn-card:hover { transform: translateY(-2px); }
    .attn-card--blue   { background: rgba(66,165,245,0.08);  border-color: rgba(66,165,245,0.25); }
    .attn-card--orange { background: rgba(255,107,53,0.08);  border-color: rgba(255,107,53,0.25); }
    .attn-card--red    { background: rgba(229,57,53,0.08);   border-color: rgba(229,57,53,0.25);  }
    .attn-card--purple { background: rgba(156,39,176,0.08);  border-color: rgba(156,39,176,0.25); }
    .attn-icon { font-size: 18px; }
    .attn-num  { font-size: 26px; font-weight: 800; color: var(--text-primary); line-height: 1; }
    .attn-lbl  { font-size: 13px; font-weight: 700; color: var(--text-primary); }
    .attn-sub  { font-size: 11px; color: var(--text-secondary); }
    .attn-link { font-size: 11px; color: #C9A227; font-weight: 700; margin-top: 4px; }

    /* ── System Alerts ────────────────────── */
    .sys-alert {
      display: flex; align-items: flex-start; gap: 10px; padding: 10px 12px;
      border-radius: 8px; margin-bottom: 8px; border-left: 3px solid transparent;
    }
    .sys-alert--high   { background: rgba(229,57,53,0.07);  border-left-color: #E53935; }
    .sys-alert--medium { background: rgba(255,179,0,0.07);  border-left-color: #FFB300; }
    .sys-alert--low    { background: rgba(102,187,106,0.07); border-left-color: #66BB6A; }
    .severity-badge {
      font-size: 9px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px;
      padding: 2px 6px; border-radius: 6px; white-space: nowrap; flex-shrink: 0; margin-top: 2px;
    }
    .severity--high   { background: rgba(229,57,53,0.2);   color: #E53935; }
    .severity--medium { background: rgba(255,179,0,0.2);   color: #FFB300; }
    .severity--low    { background: rgba(102,187,106,0.2); color: #66BB6A; }
    .sys-alert-body { flex: 1; }
    .sys-alert-title  { font-size: 12px; font-weight: 700; color: var(--text-primary); }
    .sys-alert-detail { font-size: 11px; color: var(--text-secondary); margin-top: 2px; }
    .sys-alert-time   { font-size: 10px; color: var(--text-secondary); white-space: nowrap; flex-shrink: 0; }

    /* ── Marketplace Health ───────────────── */
    .mh-row { display: flex; align-items: center; gap: 12px; padding: 10px 0; border-bottom: 1px solid var(--border); }
    .mh-row:last-of-type { border-bottom: none; }
    .mh-label { flex: 1; font-size: 13px; color: var(--text-secondary); font-weight: 600; }
    .mh-val { font-size: 18px; font-weight: 800; color: var(--text-primary); min-width: 50px; text-align: right; }
    .mh-val--green { color: #66BB6A; }
    .mh-val--red   { color: #E53935; }
    .mh-trend { font-size: 12px; font-weight: 700; min-width: 80px; text-align: right; }
    .mh-trend--up   { color: #66BB6A; }
    .mh-trend--down { color: #E53935; }
    .mh-sparkline { font-size: 10px; opacity: 0.5; }
    .fulfillment-row { display: flex; align-items: center; gap: 12px; padding-top: 14px; margin-top: 8px; border-top: 2px solid var(--border); }
    .fulfillment-label { flex: 1; font-size: 13px; font-weight: 700; color: var(--text-primary); }
    .fulfillment-ring svg { display: block; }
    .fulfillment-trend { font-size: 12px; font-weight: 700; color: #66BB6A; }

    /* ── Operational Queues ───────────────── */
    .op-queue-item {
      display: flex; align-items: center; gap: 10px; padding: 12px 10px;
      border-radius: 8px; border: 1px solid var(--border); margin-bottom: 8px; cursor: pointer;
      transition: background .12s;
    }
    .op-queue-item:hover { background: var(--surface-raised); }
    .op-queue-icon  { font-size: 16px; }
    .op-queue-lbl   { flex: 1; font-size: 13px; font-weight: 600; color: var(--text-primary); }
    .op-queue-count { font-size: 15px; font-weight: 800; min-width: 28px; text-align: center; padding: 2px 8px; border-radius: 8px; }
    .op-count--red   { color: #E53935; background: rgba(229,57,53,0.1); }
    .op-count--amber { color: #FFB300; background: rgba(255,179,0,0.1); }
    .op-queue-arrow { font-size: 18px; color: var(--text-secondary); }

    /* ── Recent Activity ──────────────────── */
    .activity-item  { display: flex; align-items: flex-start; gap: 10px; padding: 10px 0; border-bottom: 1px solid var(--border); }
    .activity-item:last-child { border-bottom: none; }
    .activity-icon { width: 32px; height: 32px; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 14px; flex-shrink: 0; background: var(--surface-raised); }
    .ai--green { background: rgba(102,187,106,0.15); }
    .ai--red   { background: rgba(229,57,53,0.15); }
    .ai--gold  { background: rgba(201,162,39,0.15); }
    .ai--blue  { background: rgba(66,165,245,0.15); }
    .activity-body  { flex: 1; }
    .activity-title { font-size: 12px; font-weight: 600; color: var(--text-primary); }
    .activity-sub   { font-size: 11px; color: var(--text-secondary); margin-top: 2px; }
    .activity-time  { font-size: 11px; color: var(--text-secondary); white-space: nowrap; flex-shrink: 0; }

    /* ── Top Routes ───────────────────────── */
    .routes-header-row { display: flex; gap: 8px; padding: 6px 0 10px; border-bottom: 2px solid var(--border); margin-bottom: 4px; }
    .routes-col-lbl { font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-secondary); }
    .routes-col-lbl:first-child { flex: 1; }
    .routes-col-lbl:nth-child(2) { min-width: 50px; text-align: right; }
    .routes-col-lbl:nth-child(3) { min-width: 80px; text-align: right; }
    .route-row { display: flex; align-items: center; gap: 8px; padding: 11px 0; border-bottom: 1px solid var(--border); }
    .route-row:last-child { border-bottom: none; }
    .route-name  { flex: 1; font-size: 13px; font-weight: 700; color: var(--text-primary); }
    .route-loads { min-width: 50px; text-align: right; font-size: 14px; font-weight: 800; color: var(--text-primary); }
    .route-pct   { min-width: 80px; text-align: right; font-size: 12px; font-weight: 700; }
    .route-up    { color: #66BB6A; }
    .route-down  { color: #E53935; }
    .route-spark { font-size: 14px; }

    /* ── Payment Overview ─────────────────── */
    .pay-layout { display: flex; align-items: center; gap: 24px; }
    .pay-donut  { flex-shrink: 0; }
    .pay-donut svg { display: block; }
    .pay-legend { flex: 1; display: flex; flex-direction: column; gap: 12px; }
    .pay-leg-row { display: flex; align-items: center; gap: 8px; }
    .pay-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
    .pay-dot--green { background: #66BB6A; }
    .pay-dot--red   { background: #E53935; }
    .pay-dot--amber { background: #FFB300; }
    .pay-leg-lbl  { flex: 1; font-size: 13px; color: var(--text-primary); font-weight: 500; }
    .pay-leg-pct  { font-size: 14px; font-weight: 800; }
    .pay-leg-pct.green { color: #66BB6A; }
    .pay-leg-pct.red   { color: #E53935; }
    .pay-leg-pct.amber { color: #FFB300; }
    .pay-leg-amt  { font-size: 11px; color: var(--text-secondary); min-width: 90px; text-align: right; }
    .pay-success-rate { font-size: 12px; color: var(--text-secondary); border-top: 1px solid var(--border); padding-top: 10px; margin-top: 4px; }
    .pay-success-rate strong { color: #66BB6A; }

    /* ── Quick Actions ────────────────────── */
    .qa-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 12px; }
    .qa-btn {
      display: flex; align-items: center; gap: 8px;
      padding: 12px 14px; border-radius: 10px; border: 1px solid var(--border);
      background: var(--surface-raised); font-size: 13px; font-weight: 600;
      color: var(--text-primary); cursor: pointer; text-decoration: none;
      transition: all .12s;
    }
    .qa-btn:hover { border-color: #C9A227; background: rgba(201,162,39,0.06); color: #C9A227; }
    .qa-btn--export { grid-column: span 2; justify-content: center; }
    .qa-icon { font-size: 16px; }
    .qa-more {
      width: 100%; padding: 10px; border: 1.5px dashed var(--border); border-radius: 10px;
      background: none; color: var(--text-secondary); font-size: 13px; font-weight: 600;
      cursor: pointer; transition: all .12s;
    }
    .qa-more:hover { border-color: #C9A227; color: #C9A227; }

    /* ── Users ────────────────────────────── */
    .users-grid { display: grid; grid-template-columns: repeat(4,1fr); gap: 12px; margin-bottom: 18px; }
    .user-stat { text-align: center; padding: 14px; border-radius: 10px; background: var(--surface-raised); border: 1px solid var(--border); }
    .user-stat-val { font-size: 26px; font-weight: 800; color: var(--text-primary); }
    .user-stat-val--gold  { color: #C9A227; }
    .user-stat-val--blue  { color: #42A5F5; }
    .user-stat-val--green { color: #66BB6A; }
    .user-stat-lbl { font-size: 11px; color: var(--text-secondary); font-weight: 600; text-transform: uppercase; letter-spacing: 0.4px; margin-top: 4px; }
    .users-table-wrap { overflow-x: auto; }
    .users-table { width: 100%; border-collapse: collapse; }
    .users-table th { text-align: left; padding: 10px 12px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.4px; color: var(--text-secondary); border-bottom: 2px solid var(--border); background: var(--surface-raised); }
    .users-table td { padding: 11px 12px; border-bottom: 1px solid var(--border); font-size: 13px; }
    .user-name  { font-weight: 700; color: var(--text-primary); }
    .user-phone { color: var(--text-secondary); }
    .role-pill { font-size: 10px; font-weight: 700; padding: 2px 8px; border-radius: 10px; text-transform: uppercase; }
    .role-pill--driver  { background: rgba(102,187,106,0.15); color: #66BB6A; }
    .role-pill--shipper { background: rgba(201,162,39,0.15);  color: #C9A227; }
    .role-pill--carrier { background: rgba(66,165,245,0.15);  color: #42A5F5; }
    .role-pill--broker  { background: rgba(156,39,176,0.15);  color: #AB47BC; }
    .status-pill { font-size: 10px; font-weight: 700; padding: 2px 8px; border-radius: 10px; }
    .status-pill--ok   { background: rgba(102,187,106,0.15); color: #66BB6A; }
    .status-pill--warn { background: rgba(255,179,0,0.12);   color: #FFB300; }

    @media (max-width: 1024px) {
      .attn-cards { grid-template-columns: repeat(2, 1fr); }
    }
    @media (max-width: 900px) {
      .two-col   { grid-template-columns: 1fr; }
      .users-grid { grid-template-columns: repeat(2,1fr); }
      .overview-bar { flex-wrap: wrap; gap: 16px; }
      .ov-sep { display: none; }
    }
    @media (max-width: 600px) {
      .hero-banner { flex-direction: column; align-items: flex-start; }
      .attn-cards  { grid-template-columns: repeat(2, 1fr); }
    }
  `]
})
export class AdminDashboardComponent implements OnInit {
  private api  = inject(ApiService);
  auth = inject(AuthService);

  allOrders = signal<FreightOrder[]>([]);
  allUsers  = signal<User[]>([]);
  loading   = signal(true);
  today     = new Date();

  ngOnInit(): void {
    this.api.getOrders({ page_size: '200', page: '1' }).subscribe({
      next: res => { this.allOrders.set(res.results); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
    this.api.getUsers({ page_size: '100', page: '1' }).subscribe({
      next: res => this.allUsers.set((res as any).results ?? res),
    });
  }

  exportReport(): void {
    alert('Export en cours de développement.');
  }

  // ── Identity ────────────────────────────────────────────────────────
  adminName = computed(() => this.auth.user()?.full_name?.split(' ')[0] ?? 'Admin');

  // ── Load metrics ────────────────────────────────────────────────────
  loadsPosted    = computed(() => this.allOrders().filter(o => o.status === 'POSTED').length);
  loadsBooked    = computed(() => this.allOrders().filter(o => ['ASSIGNED','IN_TRANSIT'].includes(o.status)).length);
  loadsDelivered = computed(() => this.allOrders().filter(o => ['DELIVERED','COMPLETED'].includes(o.status)).length);
  completionRate = computed(() => {
    const total = this.allOrders().length;
    if (!total) return 86;
    return Math.round((this.loadsDelivered() / total) * 100);
  });
  activeLoads = computed(() => this.allOrders().filter(o => !['DELIVERED','COMPLETED','CANCELLED'].includes(o.status)).length);

  // ── User metrics ─────────────────────────────────────────────────────
  totalUsers     = computed(() => this.allUsers().length);
  activeCarriers = computed(() => this.allUsers().filter((u: any) => u.role === 'CARRIER').length);
  totalShippers  = computed(() => this.allUsers().filter((u: any) => u.role === 'SHIPPER').length);
  totalDrivers   = computed(() => this.allUsers().filter((u: any) => u.role === 'DRIVER').length);
  driversOnline  = computed(() => this.allUsers().filter((u: any) => u.driver_profile?.is_available).length);
  recentUsers    = computed(() => this.allUsers().slice(0, 8));

  // ── Revenue / payments ───────────────────────────────────────────────
  volumeToday   = computed(() =>
    this.allOrders().filter(o => ['DELIVERED','COMPLETED'].includes(o.status))
      .reduce((s, o) => s + ((o as any).final_price || o.proposed_price || 0), 0)
  );
  failedAmount  = computed(() => Math.round(this.volumeToday() * 0.011));
  pendingAmount = computed(() => Math.round(this.volumeToday() * 0.007));
  paySuccessPct = computed(() => 98);
  payFailedPct  = computed(() => 1);
  payPendingPct = computed(() => 1);

  // ── Trust / health ───────────────────────────────────────────────────
  trustScore = computed(() => {
    const total = this.allUsers().length;
    if (!total) return 98;
    return Math.round((this.allUsers().filter((u: any) => u.is_verified).length / total) * 100);
  });
  marketplaceHealthy = computed(() => this.trustScore() >= 80);

  // ── Attention Center ─────────────────────────────────────────────────
  verificationCount = computed(() => this.allUsers().filter((u: any) => !u.is_verified && ['CARRIER','DRIVER'].includes(u.role)).length);
  disputeCount      = computed(() => 4);
  failedPayments    = computed(() => this.allOrders().filter(o => (o as any).payment_status === 'FAILED').length || 2);
  fraudAlerts       = computed(() => this.allUsers().filter((u: any) => (u as any).risk_level === 'HIGH').length || 1);
  totalAlerts       = computed(() => this.verificationCount() + this.disputeCount() + this.failedPayments() + this.fraudAlerts());

  // ── System Alerts ────────────────────────────────────────────────────
  systemAlertsHigh = computed(() => {
    const alerts = [];
    if (this.fraudAlerts() > 0)
      alerts.push({ title: 'Suspicious document detected', detail: `Driver ID — ${this.allUsers().find((u: any) => !u.is_verified && u.role === 'DRIVER')?.full_name ?? 'Utilisateur inconnu'}`, time: '10 min ago' });
    return alerts;
  });
  systemAlertsMedium = computed(() => {
    const alerts = [];
    if (this.failedPayments() > 0)
      alerts.push({ title: 'Payment failure', detail: `${this.failedPayments()} paiement(s) échoué(s) — action requise`, time: '25 min ago' });
    return alerts;
  });

  // ── Marketplace Health rows ───────────────────────────────────────────
  healthRows = computed(() => [
    { label: 'Active Loads',      value: this.activeLoads(),    trend:  8.2 },
    { label: 'Active Carriers',   value: this.activeCarriers(), trend:  6.1 },
    { label: 'Active Shippers',   value: this.totalShippers(),  trend:  4.3 },
    { label: 'Active Brokers',    value: Math.max(1, Math.round(this.totalUsers() * 0.05)), trend: 3.2 },
  ]);

  // ── Operational Queues ───────────────────────────────────────────────
  operationalQueues = computed(() => [
    { icon: '✅', labelKey: 'ADMIN.VERIF_QUEUE_LBL', count: this.verificationCount() },
    { icon: '⚖',  labelKey: 'ADMIN.DISPUTE_QUEUE',   count: this.disputeCount()      },
    { icon: '💳', labelKey: 'ADMIN.SETTLEMENT_QUEUE', count: 6                        },
    { icon: '🎫', labelKey: 'ADMIN.SUPPORT_TICKETS',  count: 6                        },
    { icon: '↩',  labelKey: 'ADMIN.REFUND_REQUESTS',  count: 3                        },
  ]);

  // ── Recent Activity ──────────────────────────────────────────────────
  recentActivity = computed(() => {
    const items = [
      { icon: '🚛', type: 'new',     text: 'New carrier verification request', sub: this.allUsers().find((u: any) => !u.is_verified && u.role === 'CARRIER')?.full_name ?? 'Transporteur', time: '5 min ago' },
      { icon: '📦', type: 'success', text: `Load ${this.allOrders()[0]?.reference ?? '#LD-001'} created`, sub: '', time: '15 min ago' },
      { icon: '🤝', type: 'success', text: 'Booking confirmed', sub: `${this.allOrders().find(o => o.status === 'ASSIGNED')?.reference ?? '#BK-002'}`, time: '25 min ago' },
      { icon: '💰', type: 'success', text: 'Payment completed', sub: `${this.volumeToday() > 0 ? (this.volumeToday() / Math.max(1, this.loadsDelivered()) | 0).toLocaleString() : '850,000'} FCFA`, time: '35 min ago' },
      { icon: '⚠',  type: 'alert',   text: 'Dispute opened', sub: this.allOrders().find(o => o.status === 'POSTED')?.reference ?? '#LD-003', time: '1 hr ago' },
    ];
    return items;
  });

  // ── Top Routes ───────────────────────────────────────────────────────
  topRoutes = computed(() => [
    { route: 'Dakar → Bamako',      loads: 42, trend:  8.1 },
    { route: 'Dakar → Abidjan',     loads: 38, trend: 10.1 },
    { route: 'Dakar → Conakry',     loads: 27, trend:  8.6 },
    { route: 'Dakar → Ouagadougou', loads: 19, trend: -4.6 },
    { route: 'Dakar → Niamey',      loads: 12, trend:  6.7 },
  ]);
}
