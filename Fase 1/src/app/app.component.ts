import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule, MenuController } from '@ionic/angular';
import { Router, RouterOutlet, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { AuthService } from './auth/auth.service';
import { supabase } from './core/supabase.client';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, IonicModule, RouterOutlet],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
})
export class AppComponent {
  currentUrl = '';
  isAdmin = false;

  constructor(
    private router: Router,
    private menu: MenuController,
    private auth: AuthService
  ) {
    // URL actual
    this.currentUrl = this.router.url || '';
    this.refrescarRol(); // intenta cargar rol al inicio

    // Actualiza URL y rol en cada navegación
    this.router.events
      .pipe(filter((e) => e instanceof NavigationEnd))
      .subscribe(async (e: any) => {
        this.currentUrl = e.urlAfterRedirects || e.url || '';
        // Si entras/sales de auth, refresca el rol (puede haberse creado/desecho sesión)
        await this.refrescarRol();
      });
  }

  get isAuth(): boolean {
    return this.currentUrl.startsWith('/auth');
  }

  isActive(prefix: string): boolean {
    if (!this.currentUrl) return false;
    return this.currentUrl === prefix || this.currentUrl.startsWith(prefix + '/');
  }

  async go(url: string) {
    // Cierra el menú solo si está abierto (evita errores si no existe en /auth)
    if (await this.menu.isOpen('mainMenu')) {
      await this.menu.close('mainMenu');
    }
    await this.router.navigateByUrl(url);
  }

  async salir() {
    try {
      await this.auth.signOut();
      this.isAdmin = false;
    } finally {
      if (await this.menu.isOpen('mainMenu')) {
        await this.menu.close('mainMenu');
      }
      await this.router.navigateByUrl('/auth/login', { replaceUrl: true });
    }
  }

  private async refrescarRol() {
    try {
      // Si estás en /auth, ni consultes
      if (this.isAuth) { this.isAdmin = false; return; }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { this.isAdmin = false; return; }

      const { data: perfil, error } = await supabase
        .from('usuario')
        .select('rol')
        .eq('user_id', user.id) // ajusta si tu columna es id_auth en vez de user_id
        .maybeSingle();

      if (error) { this.isAdmin = false; return; }
      this.isAdmin = perfil?.rol === 'administrador';
    } catch {
      this.isAdmin = false;
    }
  }
}

