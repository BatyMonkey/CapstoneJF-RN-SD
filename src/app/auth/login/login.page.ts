// src/app/auth/login/login.page.ts
import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
// 🚨 CORRECCIÓN: Asegurar la importación de AlertController y ToastController
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
    private alertCtrl: AlertController, // Inyectado para la alerta de recuperación
    private toastCtrl: ToastController // 👈 CORRECCIÓN: ToastController inyectado
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

  // Helper para mostrar mensajes de forma consistente
  private async mostrarToast(message: string, color: 'success' | 'warning' | 'danger') {
    const toast = await this.toastCtrl.create({
        message,
        duration: 4000,
        color,
        position: 'top'
    });
    await toast.present();
  }


  // 🚨 FUNCIÓN PRINCIPAL: Muestra el diálogo de recuperación de contraseña
  async requestPasswordRecovery() {
    // Si no hay email, pide al usuario que lo ingrese
    if (!this.email.trim()) {
      await this.mostrarAlertaEmail();
      return;
    }
    await this.recoverPassword(this.email.trim());
  }
  
  // Maneja la lógica de Supabase para enviar el enlace
  async recoverPassword(email: string) {
    this.loadingRecovery = true;
    this.errorMsg = '';
    try {
      // 🚨 Debes implementar esta función en AuthService
      await this.auth.sendPasswordResetLink(email); 
      
      const successMsg = '¡Enlace enviado! Revisa tu correo electrónico (incluida la carpeta spam) para reestablecer tu contraseña.';
      
      await this.mostrarToast(successMsg, 'success');
      
    } catch (e: any) {
      console.error('Error de recuperación:', e);
      this.errorMsg = 'Error al procesar la solicitud. Verifica el correo e intenta de nuevo.';
      await this.mostrarToast(this.errorMsg, 'danger');
    } finally {
      this.loadingRecovery = false;
    }
  }

  // Alerta modal para ingresar el email si no está en el campo
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
              }
          ],
          buttons: [
              { text: 'Cancelar', role: 'cancel' },
              {
                  text: 'Enviar Enlace',
                  handler: (data) => {
                      const email = data.recoveryEmail?.trim();
                      if (email) {
                          this.email = email; 
                          this.recoverPassword(email);
                      }
                      return false; // Evita que la alerta se cierre si el email es nulo
                  }
              }
          ]
      });
      await alert.present();
  }

  // Navegar al registro
  goToRegister() {
    if (this.loading) return;
    this.router.navigateByUrl('/auth/register');
  }
}