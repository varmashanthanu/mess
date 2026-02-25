import { Routes } from '@angular/router';
import { ShellComponent } from './shared/components/shell/shell.component';
import { authGuard, publicGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  // Auth routes (no shell)
  {
    path: 'auth',
    canActivate: [publicGuard],
    children: [
      {
        path: 'login',
        loadComponent: () => import('./features/auth/login/login.component').then(m => m.LoginComponent),
      },
      {
        path: 'register',
        loadComponent: () => import('./features/auth/register/register.component').then(m => m.RegisterComponent),
      },
      {
        path: 'verify',
        loadComponent: () => import('./features/auth/verify-otp/verify-otp.component').then(m => m.VerifyOtpComponent),
      },
      { path: '', redirectTo: 'login', pathMatch: 'full' },
    ],
  },

  // App routes (with shell)
  {
    path: '',
    component: ShellComponent,
    canActivate: [authGuard],
    children: [
      {
        path: 'dashboard',
        loadComponent: () => import('./features/dashboard/dashboard.component').then(m => m.DashboardComponent),
      },
      {
        path: 'orders',
        children: [
          {
            path: '',
            loadComponent: () => import('./features/orders/list/orders-list.component').then(m => m.OrdersListComponent),
          },
          {
            path: 'new',
            loadComponent: () => import('./features/orders/create/order-create.component').then(m => m.OrderCreateComponent),
          },
          {
            path: ':id',
            loadComponent: () => import('./features/orders/detail/order-detail.component').then(m => m.OrderDetailComponent),
          },
        ],
      },
      {
        path: 'tracking',
        loadComponent: () => import('./features/tracking/tracking.component').then(m => m.TrackingComponent),
      },
      {
        path: 'fleet',
        loadComponent: () => import('./features/fleet/fleet.component').then(m => m.FleetComponent),
      },
      {
        path: 'messaging',
        loadComponent: () => import('./features/messaging/messaging.component').then(m => m.MessagingComponent),
      },
      {
        path: 'notifications',
        loadComponent: () => import('./features/notifications/notifications.component').then(m => m.NotificationsComponent),
      },
      {
        path: 'profile',
        loadComponent: () => import('./features/profile/profile.component').then(m => m.ProfileComponent),
      },
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
    ],
  },

  // Fallback
  { path: '**', redirectTo: '/dashboard' },
];
