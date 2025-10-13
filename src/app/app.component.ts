import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule, MenuController, Platform } from '@ionic/angular';
import { Router, RouterOutlet, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { AuthService } from './auth/auth.service';
import { supabase } from './core/supabase.client';
import { StatusBar, Style } from '@capacitor/status-bar';
import { App } from '@capacitor/app';

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

  // Evita registrar deep links más de una vez (hot reload / doble bootstrap)
  private static _deepLinkInit = false;

  constructor(
    private router: Router,
    private menu: MenuController,
    private auth: AuthService,
    private platform: Platform
  ) {
    this.currentUrl = this.router.url || '';
    this.refrescarRol();

    this.platform.ready().then(async () => {
      await this.configurarStatusBar();

      if (!AppComponent._deepLinkInit) {
        this.setupDeepLinks();
        AppComponent._deepLinkInit = true;
      }
    });

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
      await StatusBar.setOverlaysWebView({ overlay: false });
      await StatusBar.setBackgroundColor({ color: '#000000' });
      await StatusBar.setStyle({ style: Style.Dark });
    } catch {}
  }

  /** Deep links:
   * myapp://auth/reset?type=recovery&access_token=...&refresh_token=... (query)
   * myapp://auth/reset#access_token=...&refresh_token=...&type=recovery (hash)
   * myapp://auth/reset?type=recovery&code=... (PKCE)
   */
  private setupDeepLinks() {
    // App abierta desde cero
    App.getLaunchUrl().then((launch) => {
      if (launch?.url) this.handleUrl(launch.url);
    });

    // App ya abierta
    App.addListener('appUrlOpen', (data) => {
      if (data?.url) this.handleUrl(data.url);
    });
  }

  private async handleUrl(rawUrl: string) {
    try {
      const u = new URL(rawUrl);
      if (u.protocol !== 'myapp:' || u.host !== 'auth') return;

      // 1) parámetros en query
      const q = u.searchParams;
      // 2) parámetros en hash (#a=b&c=d)
      const hashParams = new URLSearchParams(u.hash?.startsWith('#') ? u.hash.slice(1) : u.hash);

      const getParam = (k: string) => q.get(k) ?? hashParams.get(k);

      const type = getParam('type');
      const access_token  = getParam('access_token');
      const refresh_token = getParam('refresh_token');
      const code          = getParam('code');

      // Establecer sesión antes de entrar a la pantalla
      if (type === 'recovery' && access_token && refresh_token) {
        await supabase.auth.setSession({ access_token, refresh_token });
      } else if (code) {
        await supabase.auth.exchangeCodeForSession(code);
      } else {
        // Sin tokens ni code: algunos clientes no pasan query/hash correctamente
        console.warn('Deep link sin tokens ni code. No se pudo establecer sesión.');
      }

      await this.router.navigateByUrl('/auth/recuperar-contrasena', { replaceUrl: true });
    } catch (e) {
      console.error('Deep link parse error', e);
    }
  }
}
