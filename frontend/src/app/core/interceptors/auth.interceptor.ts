import { HttpInterceptorFn, HttpRequest, HttpHandlerFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, switchMap, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';

export const authInterceptor: HttpInterceptorFn = (
  req: HttpRequest<unknown>,
  next: HttpHandlerFn
) => {
  const auth = inject(AuthService);
  const token = auth.getAccessToken();

  const addToken = (r: HttpRequest<unknown>, t: string) =>
    r.clone({ setHeaders: { Authorization: `Bearer ${t}` } });

  const request = token ? addToken(req, token) : req;

  return next(request).pipe(
    catchError((err: HttpErrorResponse) => {
      const isAuthEndpoint = req.url.includes('/auth/login') || req.url.includes('/auth/token/refresh');
      if (err.status === 401 && !isAuthEndpoint) {
        return auth.refreshToken().pipe(
          switchMap((res) => next(addToken(req, res.access))),
          catchError((refreshErr) => {
            auth.logout();
            return throwError(() => refreshErr);
          })
        );
      }
      return throwError(() => err);
    })
  );
};
