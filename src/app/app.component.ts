import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule, MenuController, Platform } from '@ionic/angular';
import { Router, RouterOutlet, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { AuthService } from './auth/auth.service';
import { supabase } from './core/supabase.client';
import { StatusBar, Style } from '@capacitor/status-bar';

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
    private auth: AuthService,
    private platform: Platform
  ) {
    this.currentUrl = this.router.url || '';
    this.refrescarRol();

    this.platform.ready().then(() => this.configurarStatusBar());

    this.router.events
      .pipe(filter((e) => e instanceof NavigationEnd))
      .subscribe(async (e: any) => {
        this.currentUrl = e.urlAfterRedirects || e.url || '';
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
    try { if (await this.menu.isOpen('mainMenu')) await this.menu.close('mainMenu'); } catch {}
    await this.router.navigateByUrl(url);
  }

  async salir() {
    try {
      await this.auth.signOut();
      this.isAdmin = false;
    } finally {
      try { if (await this.menu.isOpen('mainMenu')) await this.menu.close('mainMenu'); } catch {}
      await this.router.navigateByUrl('/auth/login', { replaceUrl: true });
    }
  }

  private async refrescarRol() {
    try {
      if (this.isAuth) { this.isAdmin = false; return; }
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { this.isAdmin = false; return; }
      const { data: perfil, error } = await supabase
        .from('usuario')
        .select('rol')
        .eq('user_id', user.id)
        .maybeSingle();
      if (error) { this.isAdmin = false; return; }
      this.isAdmin = perfil?.rol === 'administrador';
    } catch { this.isAdmin = false; }
  }

  // === Status bar SIN superponer, con color igual al header (ilusión de transparencia) ===
  private async configurarStatusBar() {
    try {
      await StatusBar.setOverlaysWebView({ overlay: false });       // no se superpone
      await StatusBar.setBackgroundColor({ color: '#000000' });     // mismo color que el tope del gradiente
      await StatusBar.setStyle({ style: Style.Dark });              // íconos del sistema BLANCOS
    } catch {}
  }
}
