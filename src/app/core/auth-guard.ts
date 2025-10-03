import { Injectable } from '@angular/core';
import { CanActivate, Router } from '@angular/router';
import { supabase } from './supabase.client';

@Injectable({ providedIn: 'root' })
export class AuthGuard implements CanActivate {
  constructor(private router: Router) {}

  async canActivate(): Promise<boolean> {
    const { data } = await supabase.auth.getSession();
    const isLogged = !!data.session;
    if (!isLogged) {
      this.router.navigate(['/auth/login']);
      return false;
    }
    return true;
  }
}
