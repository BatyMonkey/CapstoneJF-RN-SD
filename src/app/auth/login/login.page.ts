import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule, AlertController, ToastController } from '@ionic/angular';
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

  async login() {
    this.loading = true;
    this.errorMsg = '';
    try {
      await this.auth.signIn(this.email, this.password);
      this.router.navigateByUrl('/home', { replaceUrl: true });
    } catch (e: any) {
      this.errorMsg = e?.message ?? 'Error al iniciar sesión';
    } finally {
      this.loading = false;
    }
  }

  private async mostrarToast(message: string, color: 'success' | 'warning' | 'danger') {
    const toast = await this.toastCtrl.create({
      message,
      duration: 4000,
      color,
      position: 'top',
    });
    await toast.present();
  }

  async requestPasswordRecovery() {
    if (!this.email.trim()) {
      await this.mostrarAlertaEmail();
      return;
    }
    await this.recoverPassword(this.email.trim());
  }

  async recoverPassword(email: string) {
    this.loadingRecovery = true;
    this.errorMsg = '';
    try {
      await this.auth.sendPasswordResetLink(email); // implementado en AuthService
      await this.mostrarToast(
        '¡Enlace enviado! Revisa tu correo (incluida la carpeta spam).',
        'success'
      );
    } catch (e: any) {
      console.error('Error de recuperación:', e?.message, e);
      this.errorMsg = 'Error al procesar la solicitud. Verifica el correo e intenta de nuevo.';
      await this.mostrarToast(this.errorMsg, 'danger');
    } finally {
      this.loadingRecovery = false;
    }
  }

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
          text: 'Enviar Enlace',
          // ⚠️ Hacemos el handler async para poder cerrar la alerta correctamente
          handler: async (data) => {
            const email = (data?.recoveryEmail || '').trim();

            if (!email) {
              await this.mostrarToast('Ingresa un correo válido', 'warning');
              // devolver false mantiene abierta la alerta
              return false;
            }

            // Actualiza el campo y dispara la recuperación
            this.email = email;
            // Cerramos la alerta antes o después; aquí la cerramos primero para UX ágil
            await alert.dismiss();

            // Lanza el flujo de recuperación (no bloquea el cierre)
            this.recoverPassword(email);

            // devolver true permite cierre (por si el dismiss anterior no ocurrió)
            return true;
          },
        },
      ],
      // Opcional: evita cierre tocando el fondo
      // backdropDismiss: false,
    });

    await alert.present();
  }

  goToRegister() {
    if (this.loading) return;
    this.router.navigateByUrl('/auth/register');
  }
}
