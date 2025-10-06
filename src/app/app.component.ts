import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule, MenuController } from '@ionic/angular';
import { Router, RouterOutlet, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { AuthService } from './auth/auth.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, IonicModule, RouterOutlet],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
})
export class AppComponent {
  currentUrl = '';

  constructor(
    private router: Router,
    private menu: MenuController,
    private auth: AuthService
  ) {
    this.currentUrl = this.router.url || '';
    this.router.events
      .pipe(filter((e) => e instanceof NavigationEnd))
      .subscribe((e: any) => {
        this.currentUrl = e?.urlAfterRedirects || e?.url || '';
      });
  }

  /** Devuelve true si la URL actual es exactamente el prefijo o comienza con "<prefijo>/" */
  isActive(prefix: string): boolean {
    if (!this.currentUrl) return false;
    return this.currentUrl === prefix || this.currentUrl.startsWith(prefix + '/');
  }

  /** Útil para chequear varias rutas a la vez */
  isActiveAny(prefixes: string[]): boolean {
    return prefixes.some((p) => this.isActive(p));
  }

  // Si quieres ocultar el menú en /auth/*, descomenta:
  // get hideMenuOnAuth(): boolean {
  //   return this.currentUrl.startsWith('/auth/');
  // }

  async go(url: string) {
    await this.menu.close('mainMenu');     // 👈 usa SIEMPRE el mismo id
    await this.router.navigateByUrl(url);
  }

  async salir() {
    try {
      await this.auth.signOut();
    } finally {
      await this.menu.close('mainMenu');
      await this.router.navigateByUrl('/login', { replaceUrl: true });
    }
  }
}
