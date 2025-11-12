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

// 👇 IMPORTA EL CHATBOT (ruta relativa a src/app/app.component.ts)
import { ChatbotComponent } from './components/chatbot.component';

// ✅ IMPORTAR IONICONS GLOBALES
import { addIcons } from 'ionicons';
import {
  homeOutline,
  chatbubbleOutline,
  calendarOutline,
  checkboxOutline,
  shieldCheckmarkOutline,
  personCircleOutline,
  documentTextOutline,
  callOutline,
  checkmarkCircleOutline,
  businessOutline,
  barChartOutline,
  bulbOutline,
  megaphoneOutline,
  closeOutline,
  paperPlaneOutline,
  sparklesOutline,
  helpCircleOutline,
  newspaperOutline,
} from 'ionicons/icons';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, IonicModule, RouterOutlet, ChatbotComponent],
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
    // ✅ Registrar íconos globales (footer + secciones)
    addIcons({
      homeOutline,
      chatbubbleOutline,
      calendarOutline,
      checkboxOutline,
      shieldCheckmarkOutline,
      personCircleOutline,
      documentTextOutline,
      callOutline,
      checkmarkCircleOutline,
      businessOutline,
      barChartOutline,
      bulbOutline,
      megaphoneOutline,
      closeOutline,
      paperPlaneOutline,
      sparklesOutline,
      helpCircleOutline,
      newspaperOutline,
    });

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
    try {
      if (await this.menu.isOpen('mainMenu')) {
        await this.menu.close('mainMenu');
        await new Promise((res) => setTimeout(res, 75));
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
        if (await this.menu.isOpen('mainMenu')) await this.menu.close('mainMenu');
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
      const { data: { user } } = await this.supabaseService.auth.getUser();
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

  private setupDeepLinks() {
    App.getLaunchUrl().then((launch) => {
      if (launch?.url) this.handleUrl(launch.url);
    });

    App.addListener('appUrlOpen', (data) => {
      if (data?.url) this.handleUrl(data.url);
    });
  }

  private async handleUrl(rawUrl: string) {
    try {
      const u = new URL(rawUrl);

      if (
        (u.protocol === 'redbarrio:' && u.host === 'app' && u.pathname.startsWith('/pago-retorno')) ||
        (u.protocol === 'capacitor:' && u.host === 'localhost' && u.pathname === '/pago-retorno')
      ) {
        const token = u.searchParams.get('token_ws') || '';
        try {
          await Browser.close();
        } catch {}
        this.ngZone.run(() => {
          this.router.navigate(['/pago-retorno'], {
            queryParams: { token_ws: token },
            replaceUrl: true,
          });
        });
        return;
      }

      if (u.protocol === 'myapp:' && u.host === 'auth') {
        const q = u.searchParams;
        const hashParams = new URLSearchParams(u.hash?.startsWith('#') ? u.hash.slice(1) : u.hash);
        const getParam = (k: string) => q.get(k) ?? hashParams.get(k);
        const type = getParam('type');
        const access_token = getParam('access_token');
        const refresh_token = getParam('refresh_token');
        const code = getParam('code');

        if (type === 'recovery' && access_token && refresh_token) {
          await this.supabaseService.client.auth.setSession({ access_token, refresh_token });
        } else if (code) {
          await this.supabaseService.client.auth.exchangeCodeForSession(rawUrl);
        } else {
          console.warn('Deep link sin tokens ni code. No se pudo establecer sesión.');
        }

        this.ngZone.run(() => {
          this.router.navigateByUrl('/auth/recuperar-contrasena', { replaceUrl: true });
        });
        return;
      }
    } catch (e) {
      console.error('Deep link parse error', e);
    }
  }
}
