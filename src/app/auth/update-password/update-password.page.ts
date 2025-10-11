// src/app/auth/update-password/update-password.page.ts

import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { IonicModule, ToastController } from '@ionic/angular';
import { AuthService } from '../auth.service'; // Asumo la ruta del servicio

@Component({
  standalone: true,
  selector: 'app-update-password',
  templateUrl: './update-password.page.html',
  styleUrls: ['../login/login.page.scss'], // 🚨 Reutilizamos los estilos de login
  imports: [IonicModule, CommonModule, FormsModule],
})
export class UpdatePasswordPage implements OnInit {
  newPassword = '';
  confirmPassword = '';

  loading = false;
  errorMsg = '';
  successMsg = ''; // Para mostrar el éxito antes de redirigir

  constructor(
    private auth: AuthService,
    private router: Router,
    private toastCtrl: ToastController
  ) {}

  ngOnInit() {
    // Al cargarse, este componente asume que Supabase ya ha detectado el token de recuperación
  }

  async updatePassword(form: NgForm) {
    this.errorMsg = '';
    this.successMsg = '';

    if (form.invalid || this.newPassword !== this.confirmPassword) {
      if (this.newPassword !== this.confirmPassword) {
        this.errorMsg = 'Las contraseñas no coinciden.';
      } else {
        this.errorMsg =
          'Por favor, completa la contraseña (mínimo 6 caracteres).';
      }
      return;
    }

    this.loading = true;

    try {
      // 🚨 Supabase actualiza la contraseña del usuario logueado actualmente
      await this.auth.updateUser({ password: this.newPassword });

      this.successMsg = '¡Contraseña actualizada con éxito! Redirigiendo...';

      // Mostrar toast de éxito y redirigir al login
      await this.mostrarToast(this.successMsg, 'success');

      // Redirigir al login para que el usuario ingrese con la nueva contraseña
      this.router.navigateByUrl('/auth/login', { replaceUrl: true });
    } catch (e: any) {
      console.error('Error al actualizar contraseña:', e);
      this.errorMsg =
        e?.message ?? 'Ocurrió un error al intentar cambiar la contraseña.';
    } finally {
      this.loading = false;
    }
  }

  private async mostrarToast(message: string, color: 'success' | 'danger') {
    const toast = await this.toastCtrl.create({
      message,
      duration: 3000,
      position: 'top',
      color: color,
    });
    await toast.present();
  }

  goToLogin() {
    if (this.loading) return;
    // Redirige al login para que el usuario pueda ingresar con su nueva contraseña
    this.router.navigateByUrl('/auth/login', { replaceUrl: true });
  }
}
