import { Injectable } from '@angular/core';
import { HttpRequest, HttpHandler, HttpEvent, HttpInterceptor, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { AuthService } from '../services/auth.service';

@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  constructor(private auth: AuthService) {}
  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    const token = this.auth.getToken();
    const authReq = token
      ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
      : req;
    return next.handle(authReq).pipe(
      catchError((err: HttpErrorResponse) => {
        // Only logout on 401 if we had an active token (user was authenticated).
        // Ignore 401 on pre-login calls (no token) to prevent redirect loops.
        if (err.status === 401 && token) {
          this.auth.logout();
        }
        return throwError(() => err);
      })
    );
  }
}
