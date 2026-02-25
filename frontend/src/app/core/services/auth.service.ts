import { Injectable, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, tap, catchError, throwError, of } from 'rxjs';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { User, AuthTokens, JwtPayload, UserRole } from '../models/user.model';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly ACCESS_KEY = 'mess_access';
  private readonly REFRESH_KEY = 'mess_refresh';
  private readonly apiUrl = environment.apiUrl;

  private _user = signal<User | null>(null);
  readonly user = this._user.asReadonly();
  readonly isLoggedIn = computed(() => !!this._user());
  readonly role = computed(() => this._user()?.role ?? null);

  constructor(private http: HttpClient, private router: Router) {}

  /**
   * Called by APP_INITIALIZER — restores the logged-in user before Angular
   * renders any component, eliminating the race condition where authGuard
   * sees _user=null and redirects to /auth/login on a hard page reload.
   *
   * If the access token is expired the authInterceptor will silently refresh
   * it and retry /accounts/me/ automatically, so we don't need to handle
   * that case explicitly here.
   */
  initAuth(): Promise<void> {
    const access = this.getAccessToken();
    const refresh = this.getRefreshToken();

    // No tokens at all — unauthenticated, nothing to restore
    if (!access && !refresh) return Promise.resolve();

    return firstValueFrom(
      this.http.get<User>(`${this.apiUrl}/accounts/me/`).pipe(
        tap((user) => this._user.set(user)),
        catchError(() => {
          // /accounts/me/ failed even after a refresh attempt — clear state
          this.clearTokens();
          return of(null);
        })
      )
    ).then(() => {});
  }

  register(data: {
    phone_number: string;
    full_name: string;
    password: string;
    role: UserRole;
  }): Observable<{ message: string; user_id: string }> {
    return this.http.post<{ message: string; user_id: string }>(
      `${this.apiUrl}/auth/register/`, data
    );
  }

  login(phone_number: string, password: string): Observable<AuthTokens & { user: User }> {
    return this.http.post<AuthTokens & { user: User }>(
      `${this.apiUrl}/auth/login/`, { phone_number, password }
    ).pipe(
      tap((res) => {
        this.storeTokens(res.access, res.refresh);
        this._user.set(res.user);
      })
    );
  }

  requestOtp(phone_number: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(
      `${this.apiUrl}/auth/otp/request/`, { phone_number }
    );
  }

  verifyOtp(phone_number: string, otp: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(
      `${this.apiUrl}/auth/otp/verify/`, { phone_number, otp }
    );
  }

  refreshToken(): Observable<{ access: string }> {
    const refresh = this.getRefreshToken();
    if (!refresh) return throwError(() => new Error('No refresh token'));
    return this.http.post<{ access: string }>(
      `${this.apiUrl}/auth/token/refresh/`, { refresh }
    ).pipe(
      tap((res) => localStorage.setItem(this.ACCESS_KEY, res.access))
    );
  }

  logout(): void {
    const refresh = this.getRefreshToken();
    if (refresh) {
      this.http.post(`${this.apiUrl}/auth/logout/`, { refresh }).subscribe();
    }
    this.clearTokens();
    this._user.set(null);
    this.router.navigate(['/auth/login']);
  }

  getAccessToken(): string | null {
    return localStorage.getItem(this.ACCESS_KEY);
  }

  getRefreshToken(): string | null {
    return localStorage.getItem(this.REFRESH_KEY);
  }

  private storeTokens(access: string, refresh: string): void {
    localStorage.setItem(this.ACCESS_KEY, access);
    localStorage.setItem(this.REFRESH_KEY, refresh);
  }

  private clearTokens(): void {
    localStorage.removeItem(this.ACCESS_KEY);
    localStorage.removeItem(this.REFRESH_KEY);
  }

  decodeToken(token: string): JwtPayload | null {
    try {
      const payload = token.split('.')[1];
      return JSON.parse(atob(payload));
    } catch {
      return null;
    }
  }

  isTokenExpired(payload: JwtPayload): boolean {
    return Date.now() / 1000 > payload.exp;
  }

  hasRole(...roles: UserRole[]): boolean {
    const role = this._user()?.role;
    return role ? roles.includes(role) : false;
  }

  updateProfile(user: User): void {
    this._user.set(user);
  }
}
