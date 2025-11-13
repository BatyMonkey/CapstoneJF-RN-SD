import { Component, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule, MenuController, Platform } from '@ionic/angular';
import { Router, RouterOutlet, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { AuthService } from './auth/auth.service';
import { SupabaseService } from 'src/app/services/supabase.service';
import { StatusBar, Style } from '@capacitor/status-bar';
import { App } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import('./dashboard/dashboard.component');

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

  private static _deepLinkInit = false;

  constructor(
    private router: Router,
    private menu: MenuController,
    private auth: AuthService,
    private platform: Platform,
    private ngZone: NgZone,
    private supabaseService: SupabaseService
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
    return (
      this.currentUrl === prefix || this.currentUrl.startsWith(prefix + '/')
    );
  }

  async go(url: string) {
  try {
    if (await this.menu.isOpen('mainMenu')) {
      await this.menu.close('mainMenu');
      // 🔹 Esperar un pequeño delay para evitar el conflicto con el lazy-load
      await new Promise(res => setTimeout(res, 75));
    }
  } catch {}

  await this.router.navigateByUrl(url, { replaceUrl: false });
}

  async salir() {
    try {
      await this.auth.signOut();
      this.isAdmin = false;
    } finally {
      try {
        if (await this.menu.isOpen('mainMenu'))
          await this.menu.close('mainMenu');
      } catch {}
      await this.router.navigateByUrl('/auth/login', { replaceUrl: true });
    }
  }

  private async refrescarRol() {
    try {
      if (this.isAuth) {
        this.isAdmin = false;
        return;
      }
      const {
        data: { user },
      } = await this.supabaseService.auth.getUser();
      if (!user) {
        this.isAdmin = false;
        return;
      }
      const { data: perfil, error } = await this.supabaseService.client
        .from('usuario')
        .select('rol')
        .eq('user_id', user.id)
        .maybeSingle();
      if (error) {
        this.isAdmin = false;
        return;
      }
      this.isAdmin = perfil?.rol === 'administrador';
    } catch {
      this.isAdmin = false;
    }
  }

  private async configurarStatusBar() {
    try {
      await StatusBar.setOverlaysWebView({ overlay: false });
      await StatusBar.setBackgroundColor({ color: '#000000' });
      await StatusBar.setStyle({ style: Style.Dark });
    } catch {}
  }

  /**
   * Deep links soportados:
   *  - redbarrio://app/pago-retorno?token_ws=...
   *  - capacitor://localhost/pago-retorno?token_ws=...  (fallback/legacy)
   *  - myapp://auth/reset?type=recovery&access_token=...&refresh_token=...
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

      // === 🔹 CASO PAGO (nuevo esquema): redbarrio://app/pago-retorno?token_ws=...
      if (
<<<<<<< Updated upstream
        (u.protocol === 'redbarrio:' && u.host === 'app' && u.pathname.startsWith('/pago-retorno')) ||
        // === 🔹 CASO PAGO (legacy): capacitor://localhost/pago-retorno?token_ws=...
        (u.protocol === 'capacitor:' && u.host === 'localhost' && u.pathname === '/pago-retorno')
=======
        (u.protocol === 'redbarrio:' &&
          u.host === 'app' &&
          u.pathname.startsWith('/pago-retorno')) ||
        (u.protocol === 'capacitor:' &&
          u.host === 'localhost' &&
          u.pathname === '/pago-retorno')
>>>>>>> Stashed changes
      ) {
        const token = u.searchParams.get('token_ws') || '';
        // Cierra la Custom Tab si se usó @capacitor/browser
        try {
          await Browser.close();
        } catch {}
        // Vuelve al router de Angular dentro del zone
        this.ngZone.run(() => {
          this.router.navigate(['/pago-retorno'], {
            queryParams: { token_ws: token },
            replaceUrl: true,
          });
        });
        return;
      }

      // === 🔹 CASO AUTH SUPABASE (mantener compatibilidad): myapp://auth/...
      if (u.protocol === 'myapp:' && u.host === 'auth') {
        const q = u.searchParams;
        const hashParams = new URLSearchParams(
          u.hash?.startsWith('#') ? u.hash.slice(1) : u.hash
        );
        const getParam = (k: string) => q.get(k) ?? hashParams.get(k);

        const type = getParam('type');
        const access_token = getParam('access_token');
        const refresh_token = getParam('refresh_token');
        const code = getParam('code');

        if (type === 'recovery' && access_token && refresh_token) {
<<<<<<< Updated upstream
          await this.supabaseService.auth.setSession({ access_token, refresh_token });
=======
          await this.supabaseService.client.auth.setSession({
            access_token,
            refresh_token,
          });
>>>>>>> Stashed changes
        } else if (code) {
          await this.supabaseService.auth.exchangeCodeForSession(code);
        } else {
          console.warn(
            'Deep link sin tokens ni code. No se pudo establecer sesión.'
          );
        }

        this.ngZone.run(() => {
          this.router.navigateByUrl('/auth/recuperar-contrasena', {
            replaceUrl: true,
          });
        });
        return;
      }

      // Otros esquemas/URLs ignorados
    } catch (e) {
      console.error('Deep link parse error', e);
    }
  }
  toggleChatbot() {
    // Emitimos un evento al componente chatbot global
    const ev = new CustomEvent('toggle-chatbot', { bubbles: true });
    window.dispatchEvent(ev);
  }
}
