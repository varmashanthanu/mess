import { Component, computed, inject, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { AuthService } from '../../../core/services/auth.service';
import { ApiService } from '../../../core/services/api.service';

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
  imports: [CommonModule, FormsModule, RouterLink, RouterLinkActive, TranslateModule],
  template: `
    <aside class="sidebar" [class.collapsed]="collapsed()" [class.mobile-open]="mobileOpen()">

      <!-- Brand + Contact -->
      <div class="sidebar-brand">
        <div class="brand-mark" *ngIf="!collapsed()">
          <img src="yoolo-logo.png" class="brand-logo" alt="Yoolo" />
          <button class="contact-inline-btn" (click)="showContact.set(true)" [title]="'CONTACT.TITLE' | translate">
            {{ 'CONTACT.TITLE' | translate }}
          </button>
        </div>
        <div class="brand-icon" *ngIf="collapsed()">
          <img src="yoolo-logo.png" class="brand-logo-mini" alt="Yoolo" />
        </div>
        <button class="contact-btn-icon" *ngIf="collapsed()" (click)="showContact.set(true)" [title]="'CONTACT.TITLE' | translate">☎</button>
        <button class="sidebar-close" *ngIf="!collapsed()" (click)="onClose()" aria-label="Close sidebar">✕</button>
      </div>

      <!-- Role badge -->
      <div class="role-badge" *ngIf="!collapsed()">
        <span class="role-pill"
          [class.role-pill--driver]="auth.role() === 'DRIVER'"
          [class.role-pill--shipper]="auth.role() === 'SHIPPER'"
          [class.role-pill--carrier]="auth.role() === 'CARRIER'">
          {{ rolePillKey() | translate }}
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
        <button class="logout-btn" (click)="auth.logout()" [title]="collapsed() ? ('NAV.LOGOUT' | translate) : ''">
          <span>🚪</span>
          <span *ngIf="!collapsed()">{{ 'NAV.LOGOUT' | translate }}</span>
        </button>
      </div>
    </aside>

    <!-- Contact modal -->
    <div class="modal-overlay" *ngIf="showContact()" (click)="showContact.set(false)">
      <div class="modal-box" (click)="$event.stopPropagation()">
        <div class="modal-header">
          <h2>{{ 'CONTACT.TITLE' | translate }}</h2>
          <button class="modal-close" (click)="showContact.set(false)">✕</button>
        </div>
        <p class="modal-subtitle">{{ 'CONTACT.SUBTITLE' | translate }}</p>

        <div class="modal-success" *ngIf="contactSuccess()">{{ 'CONTACT.SUCCESS' | translate }}</div>
        <div class="modal-error" *ngIf="contactError()">{{ 'CONTACT.ERROR' | translate }}</div>

        <form *ngIf="!contactSuccess()" (ngSubmit)="submitContact()" #contactForm="ngForm">
          <div class="modal-row">
            <div class="modal-group">
              <label>{{ 'CONTACT.FIRST_NAME' | translate }}</label>
              <input type="text" [(ngModel)]="contact.first_name" name="first_name" required [placeholder]="'CONTACT.FIRST_NAME_PH' | translate" />
            </div>
            <div class="modal-group">
              <label>{{ 'CONTACT.LAST_NAME' | translate }}</label>
              <input type="text" [(ngModel)]="contact.last_name" name="last_name" [placeholder]="'CONTACT.LAST_NAME_PH' | translate" />
            </div>
          </div>
          <div class="modal-group">
            <label>{{ 'CONTACT.ADDRESS' | translate }}</label>
            <input type="text" [(ngModel)]="contact.address" name="address" [placeholder]="'CONTACT.ADDRESS_PH' | translate" />
          </div>
          <div class="modal-group">
            <label>{{ 'CONTACT.SUBJECT' | translate }}</label>
            <input type="text" [(ngModel)]="contact.subject" name="subject" required [placeholder]="'CONTACT.SUBJECT_PH' | translate" />
          </div>
          <div class="modal-group">
            <label>{{ 'CONTACT.MESSAGE' | translate }}</label>
            <textarea rows="4" [(ngModel)]="contact.message" name="message" required [placeholder]="'CONTACT.MESSAGE_PH' | translate"></textarea>
          </div>
          <button type="submit" class="modal-submit" [disabled]="contactSubmitting() || !contactForm.valid">
            {{ (contactSubmitting() ? 'CONTACT.SUBMITTING' : 'CONTACT.SUBMIT') | translate }}
          </button>
        </form>
      </div>
    </div>
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
      min-height: 80px; gap: 8px;
    }
    .brand-mark { display: flex; align-items: center; gap: 8px; flex: 1; min-width: 0; }
    .brand-logo {
      width: 90px; height: 50px; object-fit: contain;
      border-radius: 8px; flex-shrink: 0;
    }
    .contact-inline-btn {
      flex: 1; padding: 6px 10px; background: rgba(201,162,39,0.12);
      color: #E8C84A; border: 1px solid rgba(201,162,39,0.3); border-radius: 8px;
      font-size: 11px; font-weight: 700; cursor: pointer; white-space: nowrap;
      overflow: hidden; text-overflow: ellipsis; transition: background .15s;
      text-align: center;
    }
    .contact-inline-btn:hover { background: rgba(201,162,39,0.22); }
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
    .role-pill--carrier { background: rgba(33,150,243,0.15); color: #64B5F6; border-color: rgba(33,150,243,0.4); }

    /* Nav */
    .sidebar-nav { flex: 1; padding: 10px 10px; overflow-y: auto; overflow-x: hidden; }
    .nav-item {
      display: flex; align-items: center; gap: 12px; padding: 12px 16px;
      border-radius: 10px; color: white; text-decoration: none;
      font-size: 13px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase;
      margin-bottom: 8px; position: relative;
      background: var(--item-color);
      box-shadow: 0 4px 0 color-mix(in srgb, var(--item-color) 60%, black);
      transition: transform .1s ease, box-shadow .1s ease; user-select: none;
    }
    .nav-item:hover { text-decoration: none; filter: brightness(1.08); }
    .nav-item:active { transform: translateY(3px); box-shadow: 0 1px 0 color-mix(in srgb, var(--item-color) 60%, black); }
    .nav-item.active { filter: brightness(1.1); }
    .nav-icon { font-size: 18px; flex-shrink: 0; width: 20px; text-align: center; }
    .nav-label { flex: 1; white-space: normal; line-height: 1.25; word-break: break-word; }

    /* Profile card in nav */
    .profile-nav-card {
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      gap: 6px; padding: 12px 10px; margin-top: 8px;
      border-radius: 12px; text-decoration: none; cursor: pointer;
      border: 1.5px solid rgba(201,162,39,0.25);
      background: rgba(201,162,39,0.07);
      transition: background .15s, border-color .15s;
    }
    .profile-nav-card:hover, .profile-nav-card.active { background: rgba(201,162,39,0.14); border-color: rgba(201,162,39,0.5); }
    .profile-nav-avatar {
      width: 42px; height: 42px; border-radius: 50%;
      background: linear-gradient(135deg, #C9A227, #A8861F);
      color: #111; display: flex; align-items: center; justify-content: center;
      font-size: 16px; font-weight: 800; flex-shrink: 0;
      border: 2px solid rgba(201,162,39,0.7);
    }
    .profile-nav-info { text-align: center; width: 100%; overflow: hidden; }
    .profile-nav-name {
      font-size: 13px; font-weight: 700; color: #FFFFFF;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .profile-nav-role { font-size: 10px; color: #C9A227; text-transform: uppercase; letter-spacing: 0.8px; margin-top: 2px; }

    /* Footer */
    .sidebar-footer { padding: 6px 10px 10px; border-top: 1px solid rgba(201,162,39,0.15); }
    .logout-btn {
      display: flex; align-items: center; justify-content: center; gap: 10px; width: 100%; padding: 9px 14px;
      background: none; border: none; color: #9E9A93; cursor: pointer;
      border-radius: 8px; font-size: 13px; font-weight: 500; transition: all .15s; white-space: nowrap;
    }
    .logout-btn:hover { background: rgba(229,57,53,0.12); color: #EF5350; }

    /* Contact icon (collapsed mode) */
    .contact-btn-icon {
      width: 34px; height: 34px; background: rgba(201,162,39,0.12);
      color: #E8C84A; border: 1px solid rgba(201,162,39,0.3); border-radius: 8px;
      font-size: 15px; cursor: pointer; display: flex; align-items: center; justify-content: center;
      transition: background .15s; flex-shrink: 0;
    }
    .contact-btn-icon:hover { background: rgba(201,162,39,0.22); }

    /* Contact modal */
    .modal-overlay {
      position: fixed; inset: 0; background: rgba(0,0,0,0.6);
      display: flex; align-items: center; justify-content: center; z-index: 500;
    }
    .modal-box {
      background: var(--surface); border: 1px solid var(--border); border-radius: 16px;
      padding: 28px; width: 480px; max-width: calc(100vw - 32px); max-height: 90vh;
      overflow-y: auto; box-shadow: 0 20px 60px rgba(0,0,0,0.4);
    }
    .modal-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px; }
    .modal-header h2 { font-size: 18px; font-weight: 800; color: var(--text-primary); margin: 0; }
    .modal-close { background: none; border: none; font-size: 18px; cursor: pointer; color: var(--text-secondary); padding: 4px 8px; border-radius: 6px; }
    .modal-close:hover { background: var(--surface-raised); }
    .modal-subtitle { font-size: 13px; color: var(--text-secondary); margin-bottom: 20px; }
    .modal-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .modal-group { margin-bottom: 14px; }
    .modal-group label { display: block; font-size: 12px; font-weight: 600; color: var(--text-primary); margin-bottom: 5px; }
    .modal-group input, .modal-group textarea {
      width: 100%; padding: 9px 12px; border: 1.5px solid var(--border); border-radius: 8px;
      font-size: 14px; background: var(--surface-raised); color: var(--text-primary);
      font-family: inherit; outline: none; box-sizing: border-box;
    }
    .modal-group input:focus, .modal-group textarea:focus { border-color: #C9A227; }
    .modal-group textarea { resize: vertical; }
    .modal-submit {
      width: 100%; padding: 12px; background: #C9A227; color: #111; border: none;
      border-radius: 10px; font-size: 14px; font-weight: 700; cursor: pointer;
      margin-top: 4px; transition: background .15s;
    }
    .modal-submit:hover:not(:disabled) { background: #A8861F; }
    .modal-submit:disabled { opacity: 0.5; cursor: not-allowed; }
    .modal-success { background: rgba(67,160,71,0.12); color: #81C784; border: 1px solid rgba(67,160,71,0.3); border-radius: 8px; padding: 12px; margin-bottom: 16px; font-size: 13px; }
    .modal-error { background: rgba(198,40,40,0.12); color: #EF9A9A; border: 1px solid rgba(244,67,54,0.3); border-radius: 8px; padding: 12px; margin-bottom: 16px; font-size: 13px; }

    @media (max-width: 768px) {
      .sidebar { transform: translateX(-100%); width: 100% !important; z-index: 150; }
      .sidebar.mobile-open { transform: translateX(0); }
      .sidebar-close { display: flex; }
      .sidebar-brand { flex-direction: row; align-items: center; position: relative; padding: 10px 44px 10px 10px; gap: 8px; }
      .brand-mark { flex: 1; min-width: 0; flex-direction: row; align-items: center; gap: 8px; }
      .brand-logo { flex: 1; width: 0; height: 60px; object-fit: contain; object-position: center center; margin-left: 8px; }
      .contact-inline-btn { flex: 1; min-width: 0; font-size: 11px; padding: 8px 6px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; text-align: center; }
      .sidebar-close { position: absolute; top: 50%; right: 10px; transform: translateY(-50%); }
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
  private api = inject(ApiService);

  // Contact form
  showContact    = signal(false);
  contactSubmitting = signal(false);
  contactSuccess = signal(false);
  contactError   = signal(false);
  contact = { first_name: '', last_name: '', address: '', subject: '', message: '' };

  initials = computed(() => {
    const name = this.auth.user()?.full_name ?? '';
    return name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);
  });

  roleKey = computed(() => {
    const roleMap: Record<string, string> = {
      SHIPPER: 'PROFILE.ROLES.SHIPPER',
      DRIVER: 'PROFILE.ROLES.DRIVER',
      CARRIER: 'PROFILE.ROLES.CARRIER',
      ADMIN: 'PROFILE.ROLES.ADMIN',
    };
    return roleMap[this.auth.user()?.role ?? ''] ?? '';
  });

  rolePillKey = computed(() => {
    const roleMap: Record<string, string> = {
      SHIPPER: 'PROFILE.ROLES.SHIPPER_LABEL',
      DRIVER: 'PROFILE.ROLES.DRIVER_LABEL',
      CARRIER: 'PROFILE.ROLES.CARRIER_LABEL',
      ADMIN: 'PROFILE.ROLES.ADMIN_LABEL',
    };
    return roleMap[this.auth.user()?.role ?? ''] ?? '';
  });

  private driverItems: NavItem[] = [
    { labelKey: 'NAV.DASHBOARD_DRIVER',  icon: '🏠', route: '/dashboard',  color: '#2196F3' },
    { labelKey: 'NAV.LOAD_BOARD_DRIVER', icon: '🚛', route: '/load-board', color: '#F5A623' },
    { labelKey: 'NAV.MY_TRIPS',          icon: '📦', route: '/orders',     color: '#9C27B0' },
    { labelKey: 'NAV.TRACKING_DRIVER',   icon: '🧭', route: '/tracking',   color: '#E53935' },
    { labelKey: 'NAV.MESSAGES',          icon: '💬', route: '/messaging',  color: '#43A047' },
    { labelKey: 'NAV.PROFILE',           icon: '👤', route: '/profile',    color: '#757575' },
  ];

  private shipperItems: NavItem[] = [
    { labelKey: 'NAV.MY_DASHBOARD',     icon: '📊', route: '/dashboard',  color: '#2196F3' },
    { labelKey: 'NAV.SHIPPER_LOADS',    icon: '📦', route: '/orders',     color: '#9C27B0' },
    { labelKey: 'NAV.SHIPPER_TRACKING', icon: '📍', route: '/tracking',   color: '#E53935' },
    { labelKey: 'NAV.MESSAGES',         icon: '💬', route: '/messaging',  color: '#43A047' },
    { labelKey: 'NAV.SHIPPER_ACCOUNT',  icon: '👤', route: '/profile',    color: '#757575' },
  ];

  private allItems: NavItem[] = [
    { labelKey: 'NAV.MY_DASHBOARD', icon: '📊', route: '/dashboard',  color: '#2196F3' },
    { labelKey: 'NAV.FLEET',        icon: '🚛', route: '/fleet',      color: '#0288D1', roles: ['CARRIER'] },
    { labelKey: 'NAV.TRACKING',     icon: '🗺️', route: '/tracking',  color: '#E53935' },
    { labelKey: 'NAV.MESSAGES',     icon: '💬', route: '/messaging',  color: '#43A047' },
    { labelKey: 'NAV.PROFILE',      icon: '👤', route: '/profile',    color: '#757575' },
    { labelKey: 'NAV.ADMIN',        icon: '⚙️', route: '/admin',     color: '#455A64', roles: ['ADMIN'] },
  ];

  visibleItems = computed(() => {
    const role = this.auth.role();
    if (role === 'DRIVER') return this.driverItems;
    if (role === 'SHIPPER') return this.shipperItems;
    return this.allItems.filter(item => !item.roles || (role && item.roles.includes(role)));
  });

  onNavClick(): void {
    this.navClick.emit();
  }

  onClose(): void {
    this.close.emit();
  }

  submitContact(): void {
    this.contactSubmitting.set(true);
    this.contactError.set(false);
    this.api.sendContactMessage(this.contact).subscribe({
      next: () => {
        this.contactSubmitting.set(false);
        this.contactSuccess.set(true);
        this.contact = { first_name: '', last_name: '', address: '', subject: '', message: '' };
      },
      error: () => {
        this.contactSubmitting.set(false);
        this.contactError.set(true);
      },
    });
  }
}
