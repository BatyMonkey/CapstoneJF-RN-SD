import { Injectable } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivate, Router } from '@angular/router';
import { SupabaseService } from 'src/app/services/supabase.service';

@Injectable({ providedIn: 'root' })
export class AuthGuard implements CanActivate {
  constructor(private router: Router, private supabaseService: SupabaseService) {}

  async canActivate(route: ActivatedRouteSnapshot): Promise<boolean> {
    const required: string[] = route.data?.['roles'] ?? [];

    // 1️⃣ Obtener sesión actual
    const { data: { session }, error: sessionError } = await this.supabaseService.client.auth.getSession();
    if (sessionError) console.warn('Error obteniendo sesión:', sessionError);

    // 2️⃣ Si NO hay sesión → intentar perfil local
    if (!session) {
      const perfilLocalRaw = localStorage.getItem('rb_usuario_activo');
      if (perfilLocalRaw) {
        try {
          const perfil = JSON.parse(perfilLocalRaw) as { rol?: string };

          if (!required.length) return true;
          if (!perfil?.rol) {
            this.router.navigate(['/auth/login']);
            return false;
          }
          if (!required.includes(perfil.rol)) {
            this.router.navigate(['/home']);
            return false;
          }

          console.log(`✅ Acceso permitido desde cache local (${perfil.rol})`);
          return true;
        } catch {
          this.router.navigate(['/auth/login']);
          return false;
        }
      }

      console.warn('⚠️ Sin sesión ni perfil local, redirigiendo a login');
      this.router.navigate(['/auth/login']);
      return false;
    }

    // 3️⃣ Si hay sesión y no se exigen roles, permitir
    if (!required.length) {
      console.log('✅ Acceso permitido (sin roles requeridos)');
      return true;
    }

    // 4️⃣ Consultar el rol actual desde Supabase
    const { data: perfil, error } = await this.supabaseService
      .from('usuario')
      .select('rol')
      .eq('id_auth', session.user.id)
      .maybeSingle();

    // 5️⃣ Fallback si la consulta falla
    if (error || !perfil?.rol) {
      console.warn('⚠️ No se pudo obtener rol desde Supabase, intentando perfil local');
      const perfilLocalRaw = localStorage.getItem('rb_usuario_activo');
      if (perfilLocalRaw) {
        try {
          const perfilLocal = JSON.parse(perfilLocalRaw) as { rol?: string };
          if (perfilLocal?.rol && required.includes(perfilLocal.rol)) {
            console.log(`✅ Acceso permitido por perfil local (${perfilLocal.rol})`);
            return true;
          }
          this.router.navigate(['/home']);
          return false;
        } catch {
          this.router.navigate(['/auth/login']);
          return false;
        }
      }

      console.error('❌ Error al obtener rol o rol indefinido:', error);
      this.router.navigate(['/auth/login']);
      return false;
    }

    // 6️⃣ Validar rol obtenido desde BD
    if (!required.includes(perfil.rol)) {
      console.warn(`⛔ Acceso denegado. Rol: ${perfil.rol}, Requeridos: ${required.join(', ')}`);
      this.router.navigate(['/home']);
      return false;
    }

    console.log(`✅ Acceso permitido | Rol: ${perfil.rol}`);
    return true;
  }
}
