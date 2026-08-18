import { Injectable } from '@angular/core';
import { CanActivate, ActivatedRouteSnapshot, RouterStateSnapshot, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { Role } from '../models';

@Injectable({ providedIn: 'root' })
export class AuthGuard implements CanActivate {
  constructor(private auth: AuthService, private router: Router) {}

  canActivate(route: ActivatedRouteSnapshot, state: RouterStateSnapshot): boolean {
    if (!this.auth.isLoggedIn()) {
      this.router.navigate(['/login'], { queryParams: { returnUrl: state.url } });
      return false;
    }
    // This guard lives on the parent '' route, but the role/app metadata is
    // declared on each child route. Angular hands the guard the parent's
    // snapshot, whose data is empty - so walk down to the deepest match.
    let snap = route;
    while (snap.firstChild) snap = snap.firstChild;
    const requiredRoles = snap.data['roles'] as Role[];
    if (requiredRoles?.length && !this.auth.hasRole(...requiredRoles)) {
      this.router.navigate(['/dashboard']);
      return false;
    }
    const requiredApp = snap.data['app'] as string;
    if (requiredApp && !this.auth.hasAppAccess(requiredApp)) {
      this.router.navigate(['/dashboard']);
      return false;
    }
    const requiredApps = snap.data['apps'] as string[];
    if (requiredApps?.length && !requiredApps.some(a => this.auth.hasAppAccess(a))) {
      this.router.navigate(['/dashboard']);
      return false;
    }
    return true;
  }
}
