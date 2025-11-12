// src/app/auth/auth-callback/auth-callback.page.ts
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule, ToastController } from '@ionic/angular';
import { ActivatedRoute, Router } from '@angular/router';
import { SupabaseService } from 'src/app/services/supabase.service';

@Component({
  standalone: true,
  selector: 'app-auth-callback',
  imports: [CommonModule, IonicModule],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-title>Procesando…</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding">
      <p>Validando el enlace de recuperación. Por favor espera…</p>
      <ion-text color="medium" *ngIf="dbg"><small>{{ dbg }}</small></ion-text>
    </ion-content>
  `,
})
export class AuthCallbackPage implements OnInit {
  dbg = '';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private supabase: SupabaseService,
    private toast: ToastController
  ) {}

  async ngOnInit(): Promise<void> {
    try {
      // URL completa (web): http://localhost:8100/auth/callback?... ó ...#access_token=...
      let url = window.location.href;
      const qp = this.route.snapshot.queryParamMap;
      const hash = window.location.hash?.startsWith('#')
        ? window.location.hash.slice(1)
        : window.location.hash;
      const hashParams = new URLSearchParams(hash || '');

      const access_token = hashParams.get('access_token');
      const refresh_token = hashParams.get('refresh_token');
      const typeHash = hashParams.get('type');

      const codeQuery = qp.get('code');
      const typeQuery = qp.get('type');

      this.dbg = `href=${url} | hash_access=${!!access_token} | query_code=${!!codeQuery}`;

      // 🔹 Caso 1: la plantilla de correo trae TOKENS en el hash (#access_token=...)
      if (access_token && refresh_token && (typeHash === 'recovery' || typeQuery === 'recovery')) {
        try {
          const { data, error } = await this.supabase.client.auth.setSession({
            access_token,
            refresh_token,
          });
          if (error) throw error;
          await this.router.navigateByUrl('/auth/recuperar-contrasena', { replaceUrl: true });
          return;
        } catch (err: any) {
          console.warn('[callback] setSession error:', err?.message || err);
          await this.failAndBack('No se pudo validar el enlace (tokens). Abre el link nuevamente desde tu correo.');
          return;
        }
      }

      // 🔹 Caso 2: la plantilla trae CODE en query (?code=...)
      if (codeQuery && !url.includes('code=')) {
        // reconstruimos una URL dummy con code y type para Supabase
        const type = typeQuery || 'recovery';
        url = `https://dummy/auth/callback?type=${encodeURIComponent(type)}&code=${encodeURIComponent(codeQuery)}`;
      }

      if (url.includes('code=')) {
        try {
          const { error } = await this.supabase.client.auth.exchangeCodeForSession(url);
          if (error) throw error;
          await this.router.navigateByUrl('/auth/recuperar-contrasena', { replaceUrl: true });
          return;
        } catch (err: any) {
          console.warn('[callback] exchange error:', err?.message || err);
          // Mensajes comunes: "Invalid or expired code" (ya usado / expirado)
          await this.failAndBack('No se pudo validar el enlace (código inválido o vencido). Solicita uno nuevo desde la app.');
          return;
        }
      }

      // 🔹 Sin tokens ni code
      await this.failAndBack('Enlace inválido. Solicita nuevamente la recuperación de contraseña.');
      return;

    } catch (e: any) {
      console.error('[callback] exception:', e?.message || e);
      await this.failAndBack('Ha ocurrido un error procesando el enlace.');
      return;
    }
  }

  private async failAndBack(msg: string) {
    const t = await this.toast.create({ message: msg, duration: 3500, color: 'danger' });
    await t.present();
    await this.router.navigateByUrl('/auth/login', { replaceUrl: true });
  }
}
