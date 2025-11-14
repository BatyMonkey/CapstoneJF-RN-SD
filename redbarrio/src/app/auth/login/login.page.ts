import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  IonicModule,
  AlertController,
  ToastController,
} from '@ionic/angular';
import { AuthService } from '../auth.service';
import { RouterLink } from '@angular/router';

@Component({
  standalone: true,
  selector: 'app-login',
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
  imports: [IonicModule, CommonModule, FormsModule, RouterLink],
})
export class LoginPage {
  email = '';
  password = '';
  loading = false;
  errorMsg = '';
  loadingRecovery = false;

  constructor(
    private auth: AuthService,
    private router: Router,
    private alertCtrl: AlertController,
    private toastCtrl: ToastController
  ) {}

  // =========================
  // LOGIN
  // =========================
  async login() {
    this.loading = true;
    this.errorMsg = '';

    try {
      await this.auth.signIn(this.email, this.password);
      this.router.navigateByUrl('/home', { replaceUrl: true });
    } catch (e: any) {
      console.error('Error login:', e);

      const mapped = this.mapLoginErrorMessage(e?.message?.toString() || '');
      this.errorMsg = mapped;

      await this.mostrarAlertaLoginError(mapped);
    } finally {
      this.loading = false;
    }
  }

  private mapLoginErrorMessage(raw: string): string {
    const msg = raw.toLowerCase();

    if (
      msg.includes('invalid login credentials') ||
      msg.includes('invalid email or password') ||
      msg.includes('invalid login') ||
      msg.includes('invalid credentials')
    ) {
      return 'Correo o contraseña incorrectos. Verifica tus datos e inténtalo nuevamente.';
    }

    if (msg.includes('email not confirmed') || msg.includes('not confirmed')) {
      return 'Tu correo aún no ha sido confirmado. Revisa tu bandeja de entrada y la carpeta de spam.';
    }

    if (msg.includes('rate limit') || msg.includes('too many') || msg.includes('attempts')) {
      return 'Demasiados intentos. Espera unos minutos antes de volver a intentar.';
    }

    if (raw) return raw;
    return 'No pudimos iniciar sesión. Inténtalo nuevamente en unos minutos.';
  }

  private async mostrarAlertaLoginError(message: string) {
    const alert = await this.alertCtrl.create({
      header: 'No pudimos iniciar sesión',
      message:
        message ||
        'Ocurrió un problema al intentar iniciar sesión. Intenta nuevamente en unos minutos.',
      buttons: [
        {
          text: 'Entendido',
          role: 'confirm',
        },
      ],
      mode: 'ios',
      backdropDismiss: false,
    });

    await alert.present();
  }

  // =========================
  // TOAST GENÉRICO
  // =========================
  private async mostrarToast(
    message: string,
    color: 'success' | 'warning' | 'danger'
  ) {
    const toast = await this.toastCtrl.create({
      message,
      duration: 4000,
      color,
      position: 'top',
    });
    await toast.present();
  }

  // =========================
  // RECUPERAR CONTRASEÑA
  // =========================
  async requestPasswordRecovery() {
    if (!this.email.trim()) {
      await this.mostrarAlertaEmail();
      return;
    }
    await this.recoverPassword(this.email.trim());
  }

  private mapRecoveryErrorMessage(raw: string): string {
    const msg = raw.toLowerCase();

    if (msg.includes('invalid email') || msg.includes('email not found')) {
      return 'No encontramos una cuenta asociada a ese correo. Verifica que esté bien escrito.';
    }

    if (msg.includes('rate limit') || msg.includes('too many') || msg.includes('attempts')) {
      return 'Has realizado demasiadas solicitudes. Espera unos minutos antes de intentar nuevamente.';
    }

    return (
      raw ||
      'Error al procesar la solicitud de recuperación. Verifica el correo e intenta de nuevo.'
    );
  }

  async recoverPassword(email: string) {
    this.loadingRecovery = true;
    this.errorMsg = '';
    try {
      await this.auth.sendPasswordResetLink(email);

      // ✅ Modal “bonito” con OK, igual estilo que el resto
      const alert = await this.alertCtrl.create({
        header: 'Enlace enviado',
        message:
          'Te enviamos un enlace para restablecer tu contraseña.<br><br>' +
          '<strong>Revisa tu bandeja de entrada y la carpeta de spam.</strong>',
        buttons: [
          {
            text: 'OK',
            role: 'confirm',
          },
        ],
        mode: 'ios',
        backdropDismiss: false,
      });

      await alert.present();
    } catch (e: any) {
      console.error('Error de recuperación:', e?.message, e);
      const msg = this.mapRecoveryErrorMessage(e?.message?.toString() || '');
      this.errorMsg = msg;

      const alert = await this.alertCtrl.create({
        header: 'No se pudo enviar el enlace',
        message: msg,
        buttons: [
          {
            text: 'Entendido',
            role: 'confirm',
          },
        ],
        mode: 'ios',
        backdropDismiss: false,
      });
      await alert.present();
    } finally {
      this.loadingRecovery = false;
    }
  }

  // =========================
  // ALERT CON INPUT DE CORREO
  // =========================
  private async mostrarAlertaEmail() {
    const alert = await this.alertCtrl.create({
      header: 'Recuperar Contraseña',
      message: 'Ingresa tu correo electrónico asociado a la cuenta.',
      inputs: [
        {
          name: 'recoveryEmail',
          type: 'email',
          placeholder: 'ejemplo@correo.cl',
          value: this.email,
        },
      ],
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Enviar enlace',
          handler: async (data) => {
            const email = (data?.recoveryEmail || '').trim();

            if (!email) {
              await this.mostrarToast('Ingresa un correo válido', 'warning');
              return false;
            }

            this.email = email;
            await this.recoverPassword(email);
            return true;
          },
        },
      ],
      mode: 'ios',
    });

    await alert.present();
  }

  // =========================
  // NAVEGACIÓN
  // =========================
  goToRegister() {
    if (this.loading) return;
    this.router.navigateByUrl('/auth/register');
  }
}
