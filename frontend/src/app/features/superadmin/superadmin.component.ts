import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { AuthService } from '../../core/services/auth.service';
import { environment } from '../../../environments/environment';

interface AdminUser {
  id: string;
  full_name: string;
  first_name: string;
  last_name: string;
  phone_number: string;
  email: string;
  is_superuser: boolean;
  is_verified: boolean;
  is_active: boolean;
  date_joined: string;
  last_login: string | null;
  permissions: AdminPermissions | null;
}

interface AdminPermissions {
  can_manage_users: boolean;
  can_manage_fleet: boolean;
  can_manage_orders: boolean;
  can_manage_finance: boolean;
  can_manage_analytics: boolean;
  can_manage_messaging: boolean;
  can_manage_tracking: boolean;
  can_view_governance: boolean;
}

interface SystemStats {
  disk: { total_gb: number; used_gb: number; free_gb: number; pct: number };
  memory: { total_mb: number; used_mb: number; free_mb: number; pct: number };
  cpu: { load_1: number; load_5: number; load_15: number };
  uptime_hours: number;
  database: { table_count: number; active_connections: number; total_connections: number; users: number; orders: number; messages: number };
}

interface PlatformUser {
  id: string;
  full_name: string;
  phone_number: string;
  email: string;
  role: string;
  is_active: boolean;
  is_verified: boolean;
  is_superuser: boolean;
  date_joined: string;
  last_login: string | null;
}

type Tab = 'admins' | 'users' | 'system';

@Component({
  selector: 'app-superadmin',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, TranslateModule],
  template: `
    <div class="sa-page">

      <!-- ══ HERO ══ -->
      <div class="sa-hero">
        <div>
          <div class="sa-badge">{{ 'SUPERADMIN.BADGE' | translate }}</div>
          <div class="sa-title">{{ 'SUPERADMIN.TITLE' | translate }}</div>
          <div class="sa-sub">{{ 'SUPERADMIN.SUBTITLE' | translate }}</div>
        </div>
        <a routerLink="/admin" class="sa-back-btn">{{ 'SUPERADMIN.BACK' | translate }}</a>
      </div>

      <!-- ══ TABS ══ -->
      <div class="sa-tabs">
        <button class="sa-tab" [class.active]="tab() === 'admins'" (click)="tab.set('admins')">
          {{ 'SUPERADMIN.TAB_ADMINS' | translate }}
        </button>
        <button class="sa-tab" [class.active]="tab() === 'users'" (click)="openUsers()">
          {{ 'SUPERADMIN.TAB_USERS' | translate }} ({{ totalUsers() }})
        </button>
        <button class="sa-tab" [class.active]="tab() === 'system'" (click)="loadSystem(); tab.set('system')">
          {{ 'SUPERADMIN.TAB_SYSTEM' | translate }}
        </button>
      </div>

      <!-- ══ ADMINS TAB ══ -->
      <ng-container *ngIf="tab() === 'admins'">

        <div class="two-col">
          <!-- Admin list -->
          <div class="panel">
            <div class="panel-header">
              <span class="panel-title">{{ 'SUPERADMIN.ADMIN_LIST_HEADER' | translate }} ({{ admins().length }})</span>
              <button class="btn-new" (click)="openCreate()">{{ 'SUPERADMIN.NEW_ADMIN' | translate }}</button>
            </div>

            <div class="loading" *ngIf="loadingAdmins()">{{ 'SUPERADMIN.LOADING' | translate }}</div>

            <div class="admin-row" *ngFor="let a of admins()" [class.selected]="selectedAdmin()?.id === a.id" (click)="selectAdmin(a)">
              <div class="admin-avatar">{{ initials(a.full_name) }}</div>
              <div class="admin-info">
                <div class="admin-name">{{ a.full_name }}
                  <span class="badge-super" *ngIf="a.is_superuser">SUPER</span>
                </div>
                <div class="admin-phone">{{ a.phone_number }}</div>
              </div>
              <div class="admin-status">
                <span class="dot-active" *ngIf="a.is_active"></span>
                <span class="dot-inactive" *ngIf="!a.is_active"></span>
              </div>
            </div>

            <div class="empty" *ngIf="!loadingAdmins() && !admins().length">{{ 'SUPERADMIN.NO_ADMINS' | translate }}</div>
          </div>

          <!-- Right: create form OR permissions -->
          <div class="panel" *ngIf="showCreateForm()">
            <div class="panel-header">
              <span class="panel-title">{{ 'SUPERADMIN.CREATE_TITLE' | translate }}</span>
              <button class="btn-close" (click)="showCreateForm.set(false)">✕</button>
            </div>
            <div class="form-grid">
              <div class="form-group">
                <label>{{ 'SUPERADMIN.FIRST_NAME' | translate }}</label>
                <input [(ngModel)]="newAdmin.first_name" placeholder="Amadou" />
              </div>
              <div class="form-group">
                <label>{{ 'SUPERADMIN.LAST_NAME' | translate }}</label>
                <input [(ngModel)]="newAdmin.last_name" placeholder="Diallo" />
              </div>
              <div class="form-group">
                <label>{{ 'SUPERADMIN.PHONE' | translate }}</label>
                <input [(ngModel)]="newAdmin.phone_number" placeholder="+221771234567" />
              </div>
              <div class="form-group">
                <label>{{ 'SUPERADMIN.EMAIL' | translate }}</label>
                <input [(ngModel)]="newAdmin.email" placeholder="admin@yoolo.sn" type="email" />
              </div>
              <div class="form-group form-group--full">
                <label>{{ 'SUPERADMIN.PASSWORD' | translate }}</label>
                <input [(ngModel)]="newAdmin.password" type="password" placeholder="••••••••" />
              </div>
            </div>
            <div class="form-error" *ngIf="createError()">{{ createError() }}</div>
            <div class="form-success" *ngIf="createSuccess()">{{ 'SUPERADMIN.CREATE_SUCCESS' | translate }}</div>
            <button class="btn-create" (click)="createAdmin()" [disabled]="creating()">
              {{ creating() ? ('SUPERADMIN.CREATING' | translate) : ('SUPERADMIN.CREATE_BTN' | translate) }}
            </button>
          </div>

          <div class="panel" *ngIf="selectedAdmin() && !showCreateForm()">
            <div class="panel-header">
              <span class="panel-title">{{ 'SUPERADMIN.PERMS_PANEL_TITLE' | translate }} — {{ selectedAdmin()!.full_name }}</span>
              <button class="btn-delete" *ngIf="!selectedAdmin()!.is_superuser" (click)="deleteAdmin(selectedAdmin()!)">{{ 'SUPERADMIN.DELETE' | translate }}</button>
            </div>

            <div class="perm-grid" *ngIf="editPerms">
              <div class="perm-row" *ngFor="let p of permKeys">
                <label class="perm-label">{{ p.i18nKey | translate }}</label>
                <label class="toggle">
                  <input type="checkbox" [(ngModel)]="editPerms[p.key]" />
                  <span class="toggle-track"></span>
                </label>
              </div>
            </div>

            <div class="perm-actions">
              <button class="btn-save" (click)="savePermissions()" [disabled]="savingPerms()">
                {{ savingPerms() ? ('SUPERADMIN.SAVING_PERMS' | translate) : ('SUPERADMIN.SAVE_PERMS' | translate) }}
              </button>
              <div class="perm-success" *ngIf="permSaved()">{{ 'SUPERADMIN.PERMS_SAVED' | translate }}</div>
            </div>
          </div>
        </div>

      </ng-container>

      <!-- ══ USERS TAB ══ -->
      <ng-container *ngIf="tab() === 'users'">
        <div class="panel">
          <!-- Filters -->
          <div class="users-filters">
            <input class="search-input" [(ngModel)]="searchQuery" (ngModelChange)="filterUsers()" [placeholder]="'SUPERADMIN.SEARCH_PLACEHOLDER' | translate" />
            <select class="role-select" [(ngModel)]="roleFilter" (ngModelChange)="filterUsers()">
              <option value="">{{ 'SUPERADMIN.ALL_ROLES' | translate }}</option>
              <option value="SHIPPER">{{ 'ROLES.SHIPPER' | translate }}</option>
              <option value="DRIVER">{{ 'ROLES.DRIVER' | translate }}</option>
              <option value="CARRIER">{{ 'ROLES.CARRIER' | translate }}</option>
              <option value="BROKER">{{ 'ROLES.BROKER' | translate }}</option>
              <option value="ADMIN">{{ 'ROLES.ADMIN' | translate }}</option>
            </select>
            <select class="role-select" [(ngModel)]="activeFilter" (ngModelChange)="filterUsers()">
              <option value="">{{ 'SUPERADMIN.ALL_STATUS' | translate }}</option>
              <option value="true">{{ 'SUPERADMIN.STATUS_ACTIVE_FILTER' | translate }}</option>
              <option value="false">{{ 'SUPERADMIN.STATUS_BLOCKED_FILTER' | translate }}</option>
            </select>
          </div>

          <div class="loading" *ngIf="loadingUsers()">{{ 'SUPERADMIN.USERS_LOADING' | translate }}</div>

          <div class="users-table-wrap" *ngIf="!loadingUsers()">
            <table class="users-table">
              <thead>
                <tr>
                  <th>{{ 'SUPERADMIN.COL_USER' | translate }}</th>
                  <th>{{ 'SUPERADMIN.COL_PHONE' | translate }}</th>
                  <th>{{ 'SUPERADMIN.COL_ROLE' | translate }}</th>
                  <th>{{ 'SUPERADMIN.COL_VERIFIED' | translate }}</th>
                  <th>{{ 'SUPERADMIN.COL_STATUS' | translate }}</th>
                  <th>{{ 'SUPERADMIN.COL_DATE' | translate }}</th>
                  <th>{{ 'SUPERADMIN.COL_ACTION' | translate }}</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let u of filteredUsers()" [class.row-blocked]="!u.is_active">
                  <td>
                    <div class="user-cell">
                      <div class="user-avatar-sm">{{ initials(u.full_name) }}</div>
                      <span class="user-name-cell">{{ u.full_name }}</span>
                    </div>
                  </td>
                  <td class="cell-phone">{{ u.phone_number }}</td>
                  <td><span class="role-badge role-badge--{{ u.role.toLowerCase() }}">{{ ('ROLES.' + u.role) | translate }}</span></td>
                  <td>
                    <span class="verif-badge" [class.verif-ok]="u.is_verified" [class.verif-no]="!u.is_verified">
                      {{ (u.is_verified ? 'SUPERADMIN.VERIFIED' : 'SUPERADMIN.NOT_VERIFIED') | translate }}
                    </span>
                  </td>
                  <td>
                    <span class="status-badge" [class.status-active]="u.is_active" [class.status-blocked]="!u.is_active">
                      {{ (u.is_active ? 'SUPERADMIN.USER_ACTIVE' : 'SUPERADMIN.USER_BLOCKED') | translate }}
                    </span>
                  </td>
                  <td class="cell-date">{{ u.date_joined | date:'dd/MM/yyyy' }}</td>
                  <td>
                    <button *ngIf="!u.is_superuser"
                      class="btn-toggle-block"
                      [class.btn-block]="u.is_active"
                      [class.btn-unblock]="!u.is_active"
                      [disabled]="togglingId() === u.id"
                      (click)="toggleBlock(u)">
                      {{ togglingId() === u.id ? ('SUPERADMIN.TOGGLING' | translate) : ((u.is_active ? 'SUPERADMIN.BLOCK' : 'SUPERADMIN.UNBLOCK') | translate) }}
                    </button>
                    <span *ngIf="u.is_superuser" class="superuser-lock">{{ 'SUPERADMIN.SUPERADMIN_LOCK' | translate }}</span>
                  </td>
                </tr>
              </tbody>
            </table>
            <div class="empty" *ngIf="!filteredUsers().length">{{ 'SUPERADMIN.NO_USERS' | translate }}</div>
            <div class="users-count">{{ filteredUsers().length }} {{ 'SUPERADMIN.USERS_COUNT' | translate }} {{ allPlatformUsers().length }}</div>
          </div>
        </div>
      </ng-container>

      <!-- ══ SYSTEM TAB ══ -->
      <ng-container *ngIf="tab() === 'system'">
        <div class="loading" *ngIf="loadingSystem()">{{ 'SUPERADMIN.SYSTEM_LOADING' | translate }}</div>

        <ng-container *ngIf="systemStats()">
          <div class="sys-grid">

            <!-- CPU -->
            <div class="sys-card">
              <div class="sys-card-icon">⚡</div>
              <div class="sys-card-title">{{ 'SUPERADMIN.CPU_TITLE' | translate }}</div>
              <div class="sys-vals">
                <div class="sys-val-row"><span class="sys-period">1 min</span> <span class="sys-num" [class.sys-warn]="systemStats()!.cpu.load_1 > 1">{{ systemStats()!.cpu.load_1 }}</span></div>
                <div class="sys-val-row"><span class="sys-period">5 min</span> <span class="sys-num">{{ systemStats()!.cpu.load_5 }}</span></div>
                <div class="sys-val-row"><span class="sys-period">15 min</span> <span class="sys-num">{{ systemStats()!.cpu.load_15 }}</span></div>
              </div>
              <div class="sys-uptime">{{ 'SUPERADMIN.UPTIME' | translate }} {{ systemStats()!.uptime_hours }}h</div>
            </div>

            <!-- Memory -->
            <div class="sys-card">
              <div class="sys-card-icon">🧠</div>
              <div class="sys-card-title">{{ 'SUPERADMIN.RAM' | translate }}</div>
              <div class="sys-bar-wrap">
                <div class="sys-bar">
                  <div class="sys-bar-fill" [class.sys-bar--warn]="systemStats()!.memory.pct > 80" [style.width.%]="systemStats()!.memory.pct"></div>
                </div>
                <span class="sys-bar-pct">{{ systemStats()!.memory.pct }}%</span>
              </div>
              <div class="sys-vals">
                <div class="sys-val-row"><span class="sys-period">{{ 'SUPERADMIN.MEM_USED' | translate }}</span> <span class="sys-num">{{ systemStats()!.memory.used_mb | number:'1.0-0' }} MB</span></div>
                <div class="sys-val-row"><span class="sys-period">{{ 'SUPERADMIN.FREE' | translate }}</span> <span class="sys-num sys-ok">{{ systemStats()!.memory.free_mb | number:'1.0-0' }} MB</span></div>
                <div class="sys-val-row"><span class="sys-period">{{ 'SUPERADMIN.TOTAL' | translate }}</span> <span class="sys-num">{{ systemStats()!.memory.total_mb | number:'1.0-0' }} MB</span></div>
              </div>
            </div>

            <!-- Disk -->
            <div class="sys-card">
              <div class="sys-card-icon">💾</div>
              <div class="sys-card-title">{{ 'SUPERADMIN.DISK' | translate }}</div>
              <div class="sys-bar-wrap">
                <div class="sys-bar">
                  <div class="sys-bar-fill" [class.sys-bar--warn]="systemStats()!.disk.pct > 80" [style.width.%]="systemStats()!.disk.pct"></div>
                </div>
                <span class="sys-bar-pct">{{ systemStats()!.disk.pct }}%</span>
              </div>
              <div class="sys-vals">
                <div class="sys-val-row"><span class="sys-period">{{ 'SUPERADMIN.DISK_USED' | translate }}</span> <span class="sys-num">{{ systemStats()!.disk.used_gb }} GB</span></div>
                <div class="sys-val-row"><span class="sys-period">{{ 'SUPERADMIN.FREE' | translate }}</span> <span class="sys-num sys-ok">{{ systemStats()!.disk.free_gb }} GB</span></div>
                <div class="sys-val-row"><span class="sys-period">{{ 'SUPERADMIN.TOTAL' | translate }}</span> <span class="sys-num">{{ systemStats()!.disk.total_gb }} GB</span></div>
              </div>
            </div>

            <!-- Database -->
            <div class="sys-card">
              <div class="sys-card-icon">🗄</div>
              <div class="sys-card-title">{{ 'SUPERADMIN.DB' | translate }}</div>
              <div class="sys-vals">
                <div class="sys-val-row"><span class="sys-period">{{ 'SUPERADMIN.TABLES' | translate }}</span> <span class="sys-num">{{ systemStats()!.database.table_count }}</span></div>
                <div class="sys-val-row"><span class="sys-period">{{ 'SUPERADMIN.ACTIVE_CONN' | translate }}</span> <span class="sys-num" [class.sys-warn]="systemStats()!.database.active_connections > 10">{{ systemStats()!.database.active_connections }}</span></div>
                <div class="sys-val-row"><span class="sys-period">{{ 'SUPERADMIN.TOTAL_CONN' | translate }}</span> <span class="sys-num">{{ systemStats()!.database.total_connections }}</span></div>
              </div>
            </div>

          </div>

          <!-- DB Row counts -->
          <div class="panel">
            <div class="panel-header">
              <span class="panel-title">{{ 'SUPERADMIN.DB_STATS_TITLE' | translate }}</span>
              <button class="btn-refresh" (click)="loadSystem()">{{ 'SUPERADMIN.REFRESH' | translate }}</button>
            </div>
            <div class="db-stats-grid">
              <div class="db-stat">
                <div class="db-stat-val">{{ systemStats()!.database.users | number }}</div>
                <div class="db-stat-lbl">{{ 'SUPERADMIN.DB_USERS' | translate }}</div>
              </div>
              <div class="db-stat">
                <div class="db-stat-val">{{ systemStats()!.database.orders | number }}</div>
                <div class="db-stat-lbl">{{ 'SUPERADMIN.DB_ORDERS' | translate }}</div>
              </div>
              <div class="db-stat">
                <div class="db-stat-val">{{ systemStats()!.database.messages | number }}</div>
                <div class="db-stat-lbl">{{ 'SUPERADMIN.DB_MESSAGES' | translate }}</div>
              </div>
              <div class="db-stat">
                <div class="db-stat-val">{{ systemStats()!.database.table_count }}</div>
                <div class="db-stat-lbl">{{ 'SUPERADMIN.DB_TABLES' | translate }}</div>
              </div>
            </div>
          </div>

        </ng-container>

      </ng-container>

    </div>
  `,
  styles: [`
    .sa-page { max-width: 1280px; display: flex; flex-direction: column; gap: 16px; }

    /* Hero */
    .sa-hero {
      display: flex; align-items: center; justify-content: space-between; gap: 16px;
      background: linear-gradient(135deg, #0D0D0D 0%, #1A1A2E 100%);
      border-radius: 16px; padding: 24px 28px;
      border: 1px solid rgba(201,162,39,0.3); box-shadow: 0 4px 24px rgba(0,0,0,0.4);
    }
    .sa-badge { font-size: 11px; font-weight: 800; letter-spacing: 1.5px; color: #C9A227; margin-bottom: 6px; }
    .sa-title { font-size: 22px; font-weight: 800; color: #fff; margin-bottom: 4px; }
    .sa-sub   { font-size: 13px; color: rgba(255,255,255,0.5); }
    .sa-back-btn {
      padding: 10px 18px; border: 1.5px solid rgba(255,255,255,0.2); border-radius: 10px;
      color: rgba(255,255,255,0.7); font-size: 13px; font-weight: 600; text-decoration: none;
      white-space: nowrap; transition: all .15s;
    }
    .sa-back-btn:hover { border-color: #C9A227; color: #C9A227; }

    /* Tabs */
    .sa-tabs { display: flex; gap: 8px; }
    .sa-tab {
      padding: 10px 20px; border-radius: 10px; border: 1.5px solid var(--border);
      background: var(--surface); color: var(--text-secondary); font-size: 13px;
      font-weight: 700; cursor: pointer; transition: all .12s;
    }
    .sa-tab.active { border-color: #C9A227; color: #C9A227; background: rgba(201,162,39,0.08); }

    /* Layout */
    .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    .panel {
      background: var(--surface); border-radius: 14px; padding: 20px;
      border: 1px solid var(--border); box-shadow: var(--shadow);
    }
    .panel-header { display: flex; align-items: center; gap: 8px; margin-bottom: 16px; }
    .panel-title  { flex: 1; font-size: 13px; font-weight: 800; color: var(--text-primary); }

    /* Admin list */
    .admin-row {
      display: flex; align-items: center; gap: 12px; padding: 10px 12px;
      border-radius: 10px; cursor: pointer; border: 1.5px solid transparent;
      transition: all .12s; margin-bottom: 6px;
    }
    .admin-row:hover { background: var(--surface-raised); border-color: var(--border); }
    .admin-row.selected { border-color: #C9A227; background: rgba(201,162,39,0.06); }
    .admin-avatar {
      width: 38px; height: 38px; border-radius: 50%;
      background: linear-gradient(135deg, #C9A227, #A8861F);
      color: #111; display: flex; align-items: center; justify-content: center;
      font-size: 13px; font-weight: 800; flex-shrink: 0;
    }
    .admin-info  { flex: 1; min-width: 0; }
    .admin-name  { font-size: 13px; font-weight: 700; color: var(--text-primary); display: flex; align-items: center; gap: 6px; }
    .admin-phone { font-size: 11px; color: var(--text-secondary); margin-top: 2px; }
    .badge-super { background: rgba(201,162,39,0.2); color: #C9A227; font-size: 9px; font-weight: 800; padding: 1px 6px; border-radius: 8px; letter-spacing: 0.5px; }
    .dot-active   { width: 8px; height: 8px; border-radius: 50%; background: #66BB6A; flex-shrink: 0; }
    .dot-inactive { width: 8px; height: 8px; border-radius: 50%; background: #9E9A93; flex-shrink: 0; }

    /* Buttons */
    .btn-new { padding: 7px 14px; background: #C9A227; color: #111; border: none; border-radius: 8px; font-size: 12px; font-weight: 700; cursor: pointer; }
    .btn-close { background: none; border: none; font-size: 16px; color: var(--text-secondary); cursor: pointer; padding: 4px; }
    .btn-delete { padding: 6px 12px; background: rgba(229,57,53,0.1); color: #E53935; border: 1px solid rgba(229,57,53,0.3); border-radius: 8px; font-size: 12px; font-weight: 700; cursor: pointer; }
    .btn-save { padding: 10px 20px; background: #C9A227; color: #111; border: none; border-radius: 8px; font-size: 13px; font-weight: 700; cursor: pointer; }
    .btn-save:disabled { opacity: 0.5; cursor: not-allowed; }
    .btn-refresh { padding: 6px 12px; background: var(--surface-raised); border: 1px solid var(--border); border-radius: 8px; font-size: 12px; font-weight: 600; color: var(--text-secondary); cursor: pointer; }
    .btn-create { width: 100%; padding: 12px; background: linear-gradient(135deg, #C9A227, #A8861F); color: #111; border: none; border-radius: 10px; font-size: 14px; font-weight: 800; cursor: pointer; margin-top: 8px; }
    .btn-create:disabled { opacity: 0.5; cursor: not-allowed; }

    /* Create form */
    .form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .form-group { display: flex; flex-direction: column; gap: 5px; }
    .form-group--full { grid-column: span 2; }
    .form-group label { font-size: 11px; font-weight: 600; color: var(--text-secondary); }
    .form-group input { padding: 9px 12px; border: 1.5px solid var(--border); border-radius: 8px; font-size: 13px; background: var(--surface-raised); color: var(--text-primary); font-family: inherit; outline: none; }
    .form-group input:focus { border-color: #C9A227; }
    .form-error   { color: #E53935; font-size: 12px; margin-top: 8px; }
    .form-success { color: #66BB6A; font-size: 12px; margin-top: 8px; font-weight: 600; }

    /* Permissions */
    .perm-grid { display: flex; flex-direction: column; gap: 0; }
    .perm-row  { display: flex; align-items: center; justify-content: space-between; padding: 11px 0; border-bottom: 1px solid var(--border); }
    .perm-row:last-child { border-bottom: none; }
    .perm-label { font-size: 13px; color: var(--text-primary); font-weight: 500; }
    .perm-actions { display: flex; align-items: center; gap: 12px; margin-top: 16px; }
    .perm-success { font-size: 12px; color: #66BB6A; font-weight: 600; }
    /* Toggle */
    .toggle { display: inline-flex; cursor: pointer; }
    .toggle input { display: none; }
    .toggle-track { width: 40px; height: 22px; border-radius: 11px; background: var(--border); position: relative; transition: background .2s; }
    .toggle input:checked + .toggle-track { background: #C9A227; }
    .toggle-track::after { content: ''; position: absolute; top: 3px; left: 3px; width: 16px; height: 16px; border-radius: 50%; background: white; transition: transform .2s; }
    .toggle input:checked + .toggle-track::after { transform: translateX(18px); }

    /* System monitoring */
    .sys-grid { display: grid; grid-template-columns: repeat(4,1fr); gap: 14px; margin-bottom: 16px; }
    .sys-card { background: var(--surface); border-radius: 14px; padding: 18px; border: 1px solid var(--border); }
    .sys-card-icon  { font-size: 22px; margin-bottom: 6px; }
    .sys-card-title { font-size: 12px; font-weight: 800; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.4px; margin-bottom: 12px; }
    .sys-vals { display: flex; flex-direction: column; gap: 6px; }
    .sys-val-row { display: flex; justify-content: space-between; align-items: center; }
    .sys-period { font-size: 11px; color: var(--text-secondary); }
    .sys-num { font-size: 14px; font-weight: 800; color: var(--text-primary); }
    .sys-num.sys-warn { color: #FFB300; }
    .sys-num.sys-ok   { color: #66BB6A; }
    .sys-uptime { font-size: 11px; color: var(--text-secondary); margin-top: 10px; border-top: 1px solid var(--border); padding-top: 8px; }
    /* Bar */
    .sys-bar-wrap { display: flex; align-items: center; gap: 10px; margin-bottom: 12px; }
    .sys-bar { flex: 1; height: 8px; border-radius: 4px; background: var(--border); overflow: hidden; }
    .sys-bar-fill { height: 100%; border-radius: 4px; background: #66BB6A; transition: width .3s; }
    .sys-bar-fill.sys-bar--warn { background: #FFB300; }
    .sys-bar-pct { font-size: 12px; font-weight: 700; color: var(--text-primary); min-width: 38px; text-align: right; }
    /* DB stats */
    .db-stats-grid { display: grid; grid-template-columns: repeat(4,1fr); gap: 12px; }
    .db-stat { text-align: center; padding: 16px 12px; border-radius: 10px; background: var(--surface-raised); border: 1px solid var(--border); }
    .db-stat-val { font-size: 24px; font-weight: 800; color: var(--text-primary); }
    .db-stat-lbl { font-size: 11px; color: var(--text-secondary); font-weight: 600; margin-top: 4px; }

    /* Users tab */
    .users-filters { display: flex; gap: 10px; margin-bottom: 16px; flex-wrap: wrap; }
    .search-input { flex: 1; min-width: 220px; padding: 9px 14px; border: 1.5px solid var(--border); border-radius: 8px; font-size: 13px; background: var(--surface-raised); color: var(--text-primary); outline: none; }
    .search-input:focus { border-color: #C9A227; }
    .role-select { padding: 9px 12px; border: 1.5px solid var(--border); border-radius: 8px; font-size: 13px; background: var(--surface-raised); color: var(--text-primary); outline: none; cursor: pointer; }
    .role-select:focus { border-color: #C9A227; }
    .users-table-wrap { overflow-x: auto; }
    .users-table { width: 100%; border-collapse: collapse; font-size: 13px; }
    .users-table th { text-align: left; padding: 10px 12px; font-size: 11px; font-weight: 700; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.4px; border-bottom: 2px solid var(--border); white-space: nowrap; }
    .users-table td { padding: 11px 12px; border-bottom: 1px solid var(--border); vertical-align: middle; }
    .users-table tr:last-child td { border-bottom: none; }
    .users-table tr.row-blocked td { opacity: 0.55; }
    .users-table tr:hover td { background: var(--surface-raised); }
    .user-cell { display: flex; align-items: center; gap: 8px; }
    .user-avatar-sm { width: 30px; height: 30px; border-radius: 50%; background: linear-gradient(135deg, #C9A227, #A8861F); color: #111; font-size: 11px; font-weight: 800; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
    .user-name-cell { font-weight: 600; color: var(--text-primary); }
    .cell-phone { color: var(--text-secondary); font-family: monospace; font-size: 12px; }
    .cell-date { color: var(--text-secondary); font-size: 12px; white-space: nowrap; }
    .role-badge { padding: 2px 8px; border-radius: 10px; font-size: 10px; font-weight: 700; letter-spacing: 0.3px; text-transform: uppercase; }
    .role-badge--shipper  { background: rgba(201,162,39,0.15); color: #C9A227; }
    .role-badge--driver   { background: rgba(67,160,71,0.15);  color: #43A047; }
    .role-badge--carrier  { background: rgba(33,150,243,0.15); color: #1565C0; }
    .role-badge--broker   { background: rgba(21,101,192,0.15); color: #1565C0; }
    .role-badge--admin    { background: rgba(156,39,176,0.15); color: #7B1FA2; }
    .verif-badge { font-size: 11px; font-weight: 600; }
    .verif-ok { color: #43A047; }
    .verif-no { color: #E53935; }
    .status-badge { padding: 3px 10px; border-radius: 10px; font-size: 11px; font-weight: 700; }
    .status-active  { background: #E8F5E9; color: #2E7D32; }
    .status-blocked { background: #FFEBEE; color: #B71C1C; }
    .btn-toggle-block { padding: 5px 12px; border-radius: 6px; font-size: 11px; font-weight: 700; cursor: pointer; border: none; white-space: nowrap; transition: opacity .15s; }
    .btn-block   { background: rgba(229,57,53,0.1); color: #E53935; border: 1px solid rgba(229,57,53,0.3) !important; }
    .btn-unblock { background: rgba(67,160,71,0.1);  color: #43A047; border: 1px solid rgba(67,160,71,0.3)  !important; }
    .btn-toggle-block:disabled { opacity: 0.5; cursor: not-allowed; }
    .superuser-lock { font-size: 11px; color: #C9A227; font-weight: 600; }
    .users-count { padding: 10px 0 0; font-size: 12px; color: var(--text-secondary); text-align: right; }

    /* Misc */
    .loading { padding: 20px; text-align: center; color: var(--text-secondary); font-size: 13px; }
    .empty   { padding: 16px; text-align: center; color: var(--text-secondary); font-size: 13px; }

    @media (max-width: 900px) {
      .two-col { grid-template-columns: 1fr; }
      .sys-grid { grid-template-columns: repeat(2,1fr); }
      .db-stats-grid { grid-template-columns: repeat(2,1fr); }
    }
  `]
})
export class SuperAdminComponent implements OnInit {
  private http      = inject(HttpClient);
  private translate = inject(TranslateService);
  auth = inject(AuthService);

  private readonly apiBase = `${environment.apiUrl}/superadmin`;

  tab            = signal<Tab>('admins');
  admins         = signal<AdminUser[]>([]);
  selectedAdmin  = signal<AdminUser | null>(null);
  loadingAdmins  = signal(true);
  loadingSystem  = signal(false);
  systemStats    = signal<SystemStats | null>(null);
  showCreateForm = signal(false);
  creating       = signal(false);
  createError    = signal('');
  createSuccess  = signal(false);
  savingPerms    = signal(false);
  permSaved      = signal(false);

  // Users tab
  allPlatformUsers = signal<PlatformUser[]>([]);
  filteredUsers    = signal<PlatformUser[]>([]);
  loadingUsers     = signal(false);
  togglingId       = signal<string | null>(null);
  totalUsers       = signal(0);
  searchQuery      = '';
  roleFilter       = '';
  activeFilter     = '';

  newAdmin = { first_name: '', last_name: '', phone_number: '', email: '', password: '' };
  editPerms: Record<string, boolean> | null = null;

  permKeys = [
    { key: 'can_manage_users',     i18nKey: 'SUPERADMIN.PERM_USERS' },
    { key: 'can_manage_fleet',     i18nKey: 'SUPERADMIN.PERM_FLEET' },
    { key: 'can_manage_orders',    i18nKey: 'SUPERADMIN.PERM_ORDERS' },
    { key: 'can_manage_finance',   i18nKey: 'SUPERADMIN.PERM_FINANCE' },
    { key: 'can_manage_analytics', i18nKey: 'SUPERADMIN.PERM_ANALYTICS' },
    { key: 'can_manage_messaging', i18nKey: 'SUPERADMIN.PERM_MESSAGING' },
    { key: 'can_manage_tracking',  i18nKey: 'SUPERADMIN.PERM_TRACKING' },
    { key: 'can_view_governance',  i18nKey: 'SUPERADMIN.PERM_GOVERNANCE' },
  ];

  ngOnInit(): void {
    this.loadAdmins();
  }

  private headers(): HttpHeaders {
    const token = this.auth.getAccessToken();
    return new HttpHeaders({ Authorization: `Bearer ${token}` });
  }

  loadAdmins(): void {
    this.loadingAdmins.set(true);
    this.http.get<{ results: AdminUser[] }>(`${this.apiBase}/admins/`, { headers: this.headers() }).subscribe({
      next: r => { this.admins.set(r.results ?? []); this.loadingAdmins.set(false); },
      error: () => this.loadingAdmins.set(false),
    });
  }

  loadSystem(): void {
    this.loadingSystem.set(true);
    this.http.get<SystemStats>(`${this.apiBase}/system/`, { headers: this.headers() }).subscribe({
      next: r => { this.systemStats.set(r); this.loadingSystem.set(false); },
      error: () => this.loadingSystem.set(false),
    });
  }

  selectAdmin(a: AdminUser): void {
    this.selectedAdmin.set(a);
    this.showCreateForm.set(false);
    this.permSaved.set(false);
    this.editPerms = a.permissions ? { ...a.permissions } : {
      can_manage_users: true, can_manage_fleet: true, can_manage_orders: true,
      can_manage_finance: true, can_manage_analytics: true, can_manage_messaging: true,
      can_manage_tracking: true, can_view_governance: false,
    };
    // Fetch fresh permissions
    this.http.get<AdminPermissions>(`${this.apiBase}/admins/${a.id}/permissions/`, { headers: this.headers() }).subscribe({
      next: p => { this.editPerms = { ...p }; },
    });
  }

  openCreate(): void {
    this.selectedAdmin.set(null);
    this.showCreateForm.set(true);
    this.createError.set('');
    this.createSuccess.set(false);
    this.newAdmin = { first_name: '', last_name: '', phone_number: '', email: '', password: '' };
  }

  createAdmin(): void {
    if (!this.newAdmin.first_name || !this.newAdmin.last_name || !this.newAdmin.phone_number || !this.newAdmin.password) {
      this.createError.set(this.translate.instant('SUPERADMIN.CREATE_VALIDATION'));
      return;
    }
    this.creating.set(true);
    this.createError.set('');
    this.http.post<AdminUser>(`${this.apiBase}/admins/`, this.newAdmin, { headers: this.headers() }).subscribe({
      next: a => {
        this.creating.set(false);
        this.createSuccess.set(true);
        this.admins.update(list => [...list, a]);
        setTimeout(() => this.showCreateForm.set(false), 1500);
      },
      error: err => {
        this.creating.set(false);
        const msg = err.error?.phone_number?.[0] ?? err.error?.detail ?? this.translate.instant('SUPERADMIN.CREATE_API_ERROR');
        this.createError.set(msg);
      },
    });
  }

  savePermissions(): void {
    const a = this.selectedAdmin();
    if (!a || !this.editPerms) return;
    this.savingPerms.set(true);
    this.http.patch(`${this.apiBase}/admins/${a.id}/permissions/`, this.editPerms, { headers: this.headers() }).subscribe({
      next: () => { this.savingPerms.set(false); this.permSaved.set(true); },
      error: () => this.savingPerms.set(false),
    });
  }

  deleteAdmin(a: AdminUser): void {
    if (!confirm(`${this.translate.instant('SUPERADMIN.CONFIRM_DELETE')} ${a.full_name} ?`)) return;
    this.http.delete(`${this.apiBase}/admins/${a.id}/`, { headers: this.headers() }).subscribe({
      next: () => {
        this.admins.update(list => list.filter(x => x.id !== a.id));
        this.selectedAdmin.set(null);
      },
    });
  }

  openUsers(): void {
    this.tab.set('users');
    if (!this.allPlatformUsers().length) this.loadUsers();
  }

  loadUsers(): void {
    this.loadingUsers.set(true);
    this.http.get<{ results: PlatformUser[]; count: number }>(`${this.apiBase}/users/?limit=500`, { headers: this.headers() }).subscribe({
      next: r => {
        const list = r.results ?? (r as any);
        this.allPlatformUsers.set(Array.isArray(list) ? list : []);
        this.totalUsers.set((r as any).count ?? (Array.isArray(list) ? list.length : 0));
        this.filteredUsers.set(this.allPlatformUsers());
        this.loadingUsers.set(false);
      },
      error: () => this.loadingUsers.set(false),
    });
  }

  filterUsers(): void {
    let list = this.allPlatformUsers();
    if (this.searchQuery.trim()) {
      const q = this.searchQuery.toLowerCase();
      list = list.filter(u => u.full_name.toLowerCase().includes(q) || u.phone_number.includes(q));
    }
    if (this.roleFilter) {
      list = list.filter(u => u.role === this.roleFilter);
    }
    if (this.activeFilter !== '') {
      list = list.filter(u => String(u.is_active) === this.activeFilter);
    }
    this.filteredUsers.set(list);
  }

  toggleBlock(user: PlatformUser): void {
    this.togglingId.set(user.id);
    this.http.patch<PlatformUser>(`${this.apiBase}/users/${user.id}/toggle-block/`, {}, { headers: this.headers() }).subscribe({
      next: updated => {
        this.allPlatformUsers.update(list => list.map(u => u.id === updated.id ? updated : u));
        this.filterUsers();
        this.togglingId.set(null);
      },
      error: () => this.togglingId.set(null),
    });
  }

  initials(name: string): string {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  }
}
