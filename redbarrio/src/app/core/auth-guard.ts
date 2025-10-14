import { Injectable } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivate, Router } from '@angular/router';
import { supabase } from './supabase.client';

@Injectable({ providedIn: 'root' })
export class AuthGuard implements CanActivate {
  constructor(private router: Router) {}

  async canActivate(route: ActivatedRouteSnapshot): Promise<boolean> {
    // 1) Obtener roles requeridos para la ruta (si los hay)
    const required: string[] = route.data?.['roles'] ?? [];

    // 2) Intentar obtener la sesión Supabase
    const { data: { session } } = await supabase.auth.getSession();

    // 3) Si NO hay sesión, permitimos el acceso sólo si existe un perfil forzado
    //    guardado localmente (modo desarrollo / persistencia local).
    if (!session) {
      const perfilLocalRaw = localStorage.getItem('rb_usuario_activo');
      if (perfilLocalRaw) {
        try {
          const perfil = JSON.parse(perfilLocalRaw) as { rol?: string };
          // Si no se requieren roles, el usuario local es suficiente
          if (!required.length) return true;

          if (!perfil?.rol) {
            this.router.navigate(['/auth/login']);
            return false;
          }

          if (!required.includes(perfil.rol)) {
            this.router.navigate(['/home']);
            return false;
          }

          return true;
        } catch (err) {
          // Falló el parseo: tratar como no autenticado
          this.router.navigate(['/auth/login']);
          return false;
        }
      }

      // Ninguna sesión ni perfil local: forzar login
      this.router.navigate(['/auth/login']);
      return false;
    }

    // 4) Si hay sesión y no se piden roles, basta con estar logueado
    if (!required.length) return true;

    // 5) Obtener rol desde la tabla 'usuario'
    const { data: perfil, error } = await supabase
      .from('usuario')
      .select('rol')
      .eq('id_auth', session.user.id)
      .maybeSingle(); // <- más seguro que single()

    // 6) Si falla la consulta, intentamos fallback a perfil local antes de
    //    redirigir al login (esto ayuda durante el desarrollo y con sesiones
    //    que el cliente perdió pero cuyo perfil se guardó localmente).
    if (error || !perfil?.rol) {
      console.warn('No se pudo obtener rol desde Supabase, intentando perfil local:', error);
      const perfilLocalRaw = localStorage.getItem('rb_usuario_activo');
      if (perfilLocalRaw) {
        try {
          const perfilLocal = JSON.parse(perfilLocalRaw) as { rol?: string };
          if (!perfilLocal?.rol) {
            this.router.navigate(['/auth/login']);
            return false;
          }
          if (!required.includes(perfilLocal.rol)) {
            this.router.navigate(['/home']);
            return false;
          }
          return true;
        } catch (err) {
          this.router.navigate(['/auth/login']);
          return false;
        }
      }

      console.error('Error al obtener perfil o rol no definido:', error);
      this.router.navigate(['/auth/login']);
      return false;
    }

    // 7) Validar rol obtenido desde Supabase
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
