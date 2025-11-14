import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { IonicModule, ToastController, AlertController } from '@ionic/angular';
import { AuthService } from '../auth.service';
import { SupabaseService } from 'src/app/services/supabase.service';

@Component({
  standalone: true,
  selector: 'app-update-password',
  templateUrl: './update-password.page.html',
  styleUrls: ['./update-password.page.scss'],
  imports: [IonicModule, CommonModule, FormsModule],
})
export class UpdatePasswordPage implements OnInit {
  newPassword = '';
  confirmPassword = '';
  loading = false;
  errorMsg = '';
  successMsg = '';

  constructor(
    private auth: AuthService,
    private router: Router,
    private toastCtrl: ToastController,
    private alertCtrl: AlertController,
    private supabaseService: SupabaseService
  ) {}

  async ngOnInit() {
    const { data: s } = await this.supabaseService.client.auth.getSession();
    if (!s.session) {
      this.errorMsg =
        'No se detectó sesión de recuperación. Abre nuevamente el enlace del correo desde este dispositivo.';
      await this.mostrarToast(this.errorMsg, 'danger');
    }
  }

  private mapPasswordError(raw: string): string {
    const msg = raw || '';

    if (/password.*(short|weak)|at least/i.test(msg)) {
      return 'La nueva contraseña es demasiado débil. Usa al menos 8 caracteres combinando letras y números.';
    }

    if (/token.*expired|session.*not.*found|invalid.*token/i.test(msg)) {
      return 'El enlace de recuperación ya fue usado o ha expirado. Solicita un nuevo correo de recuperación.';
    }

    if (/rate.*limit|too.*many.*requests/i.test(msg)) {
      return 'Demasiados intentos de cambio. Espera unos minutos y vuelve a intentarlo.';
    }

    return raw || 'Ocurrió un error al intentar cambiar la contraseña.';
  }

  private async mostrarAlertaOk(header: string, message: string) {
    const alert = await this.alertCtrl.create({
      header,
      message,
      buttons: [
        {
          text: 'OK',
          role: 'confirm',
          handler: () => {
            this.router.navigateByUrl('/auth/login', { replaceUrl: true });
          },
        },
      ],
      backdropDismiss: false,
      mode: 'ios',
    });
    await alert.present();
  }

  async updatePassword(form: NgForm) {
    this.errorMsg = '';
    this.successMsg = '';

    if (
      form.invalid ||
      this.newPassword !== this.confirmPassword ||
      this.newPassword.length < 8
    ) {
      if (this.newPassword !== this.confirmPassword) {
        this.errorMsg = 'Las contraseñas no coinciden.';
      } else if (this.newPassword.length < 8) {
        this.errorMsg = 'La contraseña debe tener al menos 8 caracteres.';
      } else {
        this.errorMsg = 'Por favor, completa la nueva contraseña.';
      }

      await this.mostrarToast(this.errorMsg, 'danger');
      return;
    }

    this.loading = true;

    try {
      // Garantiza sesión antes de actualizar
      const { data: s } = await this.supabaseService.client.auth.getSession();
      if (!s.session) {
        this.errorMsg =
          'No se detectó sesión de recuperación. Abre nuevamente el enlace del correo desde este dispositivo.';
        await this.mostrarToast(this.errorMsg, 'danger');
        this.loading = false;
        return;
      }

      await this.auth.updateUser({ password: this.newPassword });

      this.successMsg =
        'Tu contraseña fue actualizada correctamente. Ahora puedes iniciar sesión con tu nueva clave.';
      // 👉 Aquí usamos modal con OK, y recién ahí navegamos al login
      await this.mostrarAlertaOk('Contraseña actualizada', this.successMsg);
    } catch (e: any) {
      console.error('Error al actualizar contraseña:', e);
      const raw =
        e?.message ?? 'Ocurrió un error al intentar cambiar la contraseña.';
      this.errorMsg = this.mapPasswordError(raw);
      await this.mostrarToast(this.errorMsg, 'danger');
    } finally {
      this.loading = false;
    }
  }

  private async mostrarToast(
    message: string,
    color: 'success' | 'danger' | 'warning'
  ) {
    const toast = await this.toastCtrl.create({
      message,
      duration: 3000,
      position: 'top',
      color,
    });
    await toast.present();
  }

  goToLogin() {
    if (this.loading) return;
    this.router.navigateByUrl('/auth/login', { replaceUrl: true });
  }
}
