import { Component, computed, inject, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { AuthService } from '../../../core/services/auth.service';

interface NavItem {
  labelKey: string;
  icon: string;
  route: string;
  color: string;
  roles?: string[];
}

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive, TranslateModule],
  template: `
    <aside class="sidebar" [class.collapsed]="collapsed()" [class.mobile-open]="mobileOpen()">

      <!-- Brand -->
      <div class="sidebar-brand">
        <div class="brand-mark" *ngIf="!collapsed()">
          <img src="yoolo-logo.png" class="brand-logo" alt="Yoolo" />
        </div>
        <div class="brand-icon" *ngIf="collapsed()">
          <img src="yoolo-logo.png" class="brand-logo-mini" alt="Yoolo" />
        </div>
        <button class="sidebar-close" (click)="onClose()" aria-label="Close sidebar">✕</button>
      </div>

      <!-- Role badge -->
      <div class="role-badge" *ngIf="!collapsed()">
        <span class="role-pill" [class.role-pill--driver]="auth.role() === 'DRIVER'" [class.role-pill--shipper]="auth.role() === 'SHIPPER'">
          {{ auth.role() === 'DRIVER' ? '🚚 Chauffeur' : auth.role() === 'SHIPPER' ? '📦 Expéditeur' : '⚙️ Admin' }}
        </span>
      </div>

      <nav class="sidebar-nav">
        <ng-container *ngFor="let item of visibleItems()">
          <a
            [routerLink]="item.route"
            routerLinkActive="active"
            class="nav-item"
            [style.--item-color]="item.color"
            [title]="collapsed() ? (item.labelKey | translate) : ''"
            (click)="onNavClick()"
          >
            <span class="nav-icon">{{ item.icon }}</span>
            <span class="nav-label" *ngIf="!collapsed()">{{ item.labelKey | translate }}</span>
          </a>
        </ng-container>
      </nav>

      <div class="sidebar-footer">
        <div class="user-info" *ngIf="!collapsed()">
          <div class="user-avatar">{{ initials() }}</div>
          <div class="user-details">
            <div class="user-name">{{ auth.user()?.full_name }}</div>
            <div class="user-role">{{ roleKey() | translate }}</div>
          </div>
        </div>
        <button class="logout-btn" (click)="auth.logout()" [title]="collapsed() ? ('NAV.LOGOUT' | translate) : ''">
          <span>🚪</span>
          <span *ngIf="!collapsed()">{{ 'NAV.LOGOUT' | translate }}</span>
        </button>
      </div>
    </aside>
  `,
  styles: [`
    .sidebar {
      width: var(--sidebar-width); height: 100vh; background: #111111;
      display: flex; flex-direction: column; position: fixed; left: 0; top: 0;
      z-index: 100; transition: width .25s ease, transform .25s ease; overflow: hidden;
      border-right: 1px solid #2A2A2A;
    }
    .sidebar.collapsed { width: 64px; }

    /* Brand */
    .sidebar-brand {
      display: flex; align-items: center; justify-content: space-between;
      padding: 10px 14px; border-bottom: 1px solid rgba(201,162,39,0.2);
      min-height: 80px;
    }
    .brand-mark { display: flex; align-items: center; flex: 1; min-width: 0; }
    .brand-logo {
      width: 140px; height: 56px; object-fit: contain;
      border-radius: 8px; flex-shrink: 0;
    }
    .brand-icon { display: flex; align-items: center; justify-content: center; flex: 1; }
    .brand-logo-mini {
      width: 42px; height: 42px; object-fit: cover; object-position: center;
      border-radius: 10px; border: 1.5px solid rgba(201,162,39,0.35);
    }

    /* Role badge */
    .role-badge { padding: 10px 12px 6px; }
    .role-pill {
      display: inline-flex; align-items: center; gap: 5px;
      padding: 5px 13px; border-radius: 20px; font-size: 12px;
      font-weight: 700; letter-spacing: 0.3px;
      background: rgba(201,162,39,0.15); color: #E8C84A;
      border: 1px solid rgba(201,162,39,0.4);
    }
    .role-pill--driver { background: rgba(67,160,71,0.15); color: #81C784; border-color: rgba(102,187,106,0.4); }
    .role-pill--shipper { background: rgba(201,162,39,0.15); color: #E8C84A; border-color: rgba(201,162,39,0.4); }

    /* Nav */
    .sidebar-nav { flex: 1; padding: 10px 10px; overflow-y: auto; overflow-x: hidden; }
    .nav-item {
      display: flex; align-items: center; gap: 12px; padding: 12px 16px;
      border-radius: 10px; color: white; text-decoration: none;
      font-size: 13px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase;
      margin-bottom: 8px; white-space: nowrap; position: relative;
      background: var(--item-color);
      box-shadow: 0 4px 0 color-mix(in srgb, var(--item-color) 60%, black);
      transition: transform .1s ease, box-shadow .1s ease; user-select: none;
    }
    .nav-item:hover { text-decoration: none; filter: brightness(1.08); }
    .nav-item:active { transform: translateY(3px); box-shadow: 0 1px 0 color-mix(in srgb, var(--item-color) 60%, black); }
    .nav-item.active { filter: brightness(1.1); }
    .nav-icon { font-size: 18px; flex-shrink: 0; width: 20px; text-align: center; }
    .nav-label { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

    /* Footer */
    .sidebar-footer { padding: 10px 10px; border-top: 1px solid rgba(201,162,39,0.15); }
    .user-info { display: flex; align-items: center; gap: 10px; padding: 8px 10px; margin-bottom: 4px; }
    .user-avatar {
      width: 38px; height: 38px; border-radius: 50%;
      background: linear-gradient(135deg, #C9A227, #A8861F);
      color: #111; display: flex; align-items: center; justify-content: center;
      font-size: 14px; font-weight: 800; flex-shrink: 0;
      border: 2px solid rgba(201,162,39,0.6);
    }
    .user-details { overflow: hidden; }
    .user-name {
      font-size: 14px; font-weight: 700; color: #FFFFFF;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .user-role { font-size: 11px; color: #C9A227; text-transform: uppercase; letter-spacing: 0.8px; margin-top: 2px; }
    .logout-btn {
      display: flex; align-items: center; gap: 10px; width: 100%; padding: 10px 14px;
      background: none; border: none; color: #9E9A93; cursor: pointer;
      border-radius: 8px; font-size: 14px; font-weight: 500; transition: all .15s; white-space: nowrap;
    }
    .logout-btn:hover { background: rgba(229,57,53,0.12); color: #EF5350; }

    /* Mobile */
    @media (max-width: 768px) {
      .sidebar { transform: translateX(-100%); width: 100% !important; z-index: 150; }
      .sidebar.mobile-open { transform: translateX(0); }
      .sidebar-close { display: flex; }
      .sidebar-brand { justify-content: center; position: relative; padding: 14px; }
      .brand-mark { flex: unset; justify-content: center; }
      .sidebar-close { position: absolute; right: 14px; top: 50%; transform: translateY(-50%); }
      .sidebar-nav { display: flex; flex-direction: column; padding: 12px; gap: 10px; overflow: visible; }
      .nav-item { flex: 1; padding: 0 16px; margin-bottom: 0; font-size: 1.5rem; font-weight: 800; border-radius: 12px; box-shadow: 0 6px 0 color-mix(in srgb, var(--item-color) 60%, black); justify-content: flex-start; overflow: hidden; }
      .nav-item:active { transform: translateY(5px); box-shadow: 0 1px 0 color-mix(in srgb, var(--item-color) 60%, black); }
      .nav-icon { font-size: 22px; width: 24px; }
    }
    .sidebar-close {
      display: none; align-items: center; justify-content: center;
      width: 30px; height: 30px; background: none; border: none;
      color: rgba(255,255,255,0.5); font-size: 16px; cursor: pointer; border-radius: 6px;
      transition: all .15s; flex-shrink: 0;
    }
    .sidebar-close:hover { background: rgba(255,255,255,0.1); color: white; }
  `]
})
export class SidebarComponent {
  collapsed = input(false);
  mobileOpen = input(false);
  navClick = output<void>();
  close = output<void>();

  auth = inject(AuthService);

  initials = computed(() => {
    const name = this.auth.user()?.full_name ?? '';
    return name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);
  });

  roleKey = computed(() => {
    const roleMap: Record<string, string> = {
      SHIPPER: 'PROFILE.ROLES.SHIPPER',
      DRIVER: 'PROFILE.ROLES.DRIVER',
      ADMIN: 'PROFILE.ROLES.ADMIN',
    };
    return roleMap[this.auth.user()?.role ?? ''] ?? '';
  });

  private allItems: NavItem[] = [
    { labelKey: 'NAV.LOAD_BOARD',   icon: '📋', route: '/load-board', color: '#F5A623', roles: ['DRIVER'] },
    { labelKey: 'NAV.MY_DASHBOARD', icon: '📊', route: '/dashboard',  color: '#2196F3' },
    { labelKey: 'NAV.ORDERS',       icon: '📦', route: '/orders',     color: '#9C27B0', roles: ['SHIPPER', 'ADMIN'] },
    { labelKey: 'NAV.TRACKING',     icon: '🗺️', route: '/tracking',  color: '#E53935' },
    { labelKey: 'NAV.MESSAGES',     icon: '💬', route: '/messaging',  color: '#43A047' },
    { labelKey: 'NAV.PROFILE',      icon: '👤', route: '/profile',    color: '#757575' },
    { labelKey: 'NAV.ADMIN',        icon: '⚙️', route: '/admin',     color: '#455A64', roles: ['ADMIN'] },
  ];

  visibleItems = computed(() => {
    const role = this.auth.role();
    return this.allItems.filter(item => !item.roles || (role && item.roles.includes(role)));
  });

  onNavClick(): void {
    this.navClick.emit();
  }

  onClose(): void {
    this.close.emit();
  }
}
