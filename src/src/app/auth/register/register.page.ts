import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule, ToastController } from '@ionic/angular';
import { supabase } from '../../core/supabase.client';

@Component({
  standalone: true,
  selector: 'app-register',
  templateUrl: './register.page.html',
  styleUrls: ['./register.page.scss'],
  imports: [IonicModule, CommonModule, FormsModule],
})
export class RegisterPage {
  nombre = '';
  email = '';
  password = '';
  loading = false;

  // solo por si quieres mostrar también el error en la página
  errorMsg = '';

  constructor(
    private router: Router,
    private toastCtrl: ToastController
  ) {}

  private async toast(message: string, color: 'success' | 'danger' | 'warning' = 'success') {
    const t = await this.toastCtrl.create({
      message,
      color,
      duration: 2800,
      position: 'top',
      buttons: [{ text: 'OK', role: 'cancel' }],
    });
    await t.present();
  }

  async register() {
    this.loading = true;
    this.errorMsg = '';

    try {
      // 1) Crear usuario en Auth
      const { data, error } = await supabase.auth.signUp({
        email: this.email.trim(),
        password: this.password,
        options: {
          data: { full_name: this.nombre?.trim() || '' },
        },
      });

      if (error) {
        // Mensaje amable si el correo ya existe
        const msg = /registered|exists|already/i.test(error.message)
          ? 'Este correo ya está registrado. Intenta iniciar sesión.'
          : error.message || 'No se pudo crear la cuenta.';
        this.errorMsg = msg;
        await this.toast(msg, 'danger');
        return;
      }

      const authId = data.user?.id;
      const hasSession = !!data.session;

      // 2) Si tu proyecto requiere confirmación por correo, no habrá sesión todavía
      if (!hasSession) {
        await this.toast('Te enviamos un correo para confirmar tu cuenta. Revisa tu bandeja ✉️', 'success');
        // En este escenario no podemos insertar en tu tabla perfil por RLS.
        // Lo haremos al primer login si así lo decides.
        await this.router.navigateByUrl('/auth/login', { replaceUrl: true });
        return;
      }

      // 3) Si hay sesión, insertamos en tu tabla `usuario`
      if (!authId) throw new Error('No se obtuvo el ID de auth del usuario.');

      const { error: insErr } = await supabase.from('usuario').insert({
        user_id: authId,          // ajusta nombres de columnas a tu esquema
        id_auth: authId,          // si existe en tu tabla
        nombre: this.nombre,
        correo: this.email,
        creado_en: new Date().toISOString(), // si tu tabla lo tiene
      });
      if (insErr) {
        // No bloqueamos el flujo, pero avisamos.
        console.warn('No se pudo insertar en tabla usuario:', insErr);
      }

      await this.toast('Cuenta creada con éxito. ¡Ya puedes iniciar sesión! 🎉', 'success');
      await this.router.navigateByUrl('/auth/login', { replaceUrl: true });
    } catch (e: any) {
      const msg = e?.message ?? 'Error al registrar la cuenta.';
      this.errorMsg = msg;
      await this.toast(msg, 'danger');
    } finally {
      this.loading = false;
    }
  }
}

