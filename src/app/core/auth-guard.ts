import { Injectable } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivate, Router } from '@angular/router';
import { supabase } from './supabase.client';

@Injectable({ providedIn: 'root' })
export class AuthGuard implements CanActivate {
  constructor(private router: Router) {}

  async canActivate(route: ActivatedRouteSnapshot): Promise<boolean> {
    // 1) Debe haber sesión
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      this.router.navigate(['/auth/login']);
      return false;
    }

    // 2) ¿La ruta pide roles?
    const required: string[] = route.data?.['roles'] ?? [];

    // Si NO hay roles requeridos, basta con estar logueado
    if (!required.length) return true;

    // 3) Obtener el rol del perfil
    const { data: perfil, error } = await supabase
      .from('usuario')
      .select('rol')
      .eq('id_auth', session.user.id)
      .maybeSingle(); // <- más seguro que single()

    if (error || !perfil?.rol) {
      console.error('Error al obtener perfil o rol no definido:', error);
      this.router.navigate(['/auth/login']);
      return false;
    }

    // 4) Validar rol
    if (!required.includes(perfil.rol)) {
      console.warn(
        `⛔ Acceso denegado. Rol actual: ${perfil.rol}, Roles permitidos: ${required.join(', ')}`
      );
      this.router.navigate(['/home']);
      return false;
    }

    return true;
  }
}
