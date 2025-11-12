import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { IonicModule, ToastController } from '@ionic/angular';
import { AuthService } from '../auth.service';
import { SupabaseService } from 'src/app/services/supabase.service';

@Component({
  standalone: true,
  selector: 'app-update-password',
  templateUrl: './update-password.page.html',
  styleUrls: ['../login/login.page.scss'],
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
    private supabaseService: SupabaseService
  ) {}

  async ngOnInit() {
    // Validación temprana: si no hay sesión, el cambio fallará.
    const { data: s } = await this.supabaseService.client.auth.getSession();
    if (!s.session) {
      this.errorMsg = 'No se detectó sesión de recuperación. Abre nuevamente el enlace del correo desde este dispositivo.';
    }
  }

  async updatePassword(form: NgForm) {
    this.errorMsg = '';
    this.successMsg = '';

    if (form.invalid || this.newPassword !== this.confirmPassword || this.newPassword.length < 8) {
      if (this.newPassword !== this.confirmPassword) this.errorMsg = 'Las contraseñas no coinciden.';
      else if (this.newPassword.length < 8) this.errorMsg = 'La contraseña debe tener al menos 8 caracteres.';
      else this.errorMsg = 'Por favor, completa la contraseña.';
      await this.mostrarToast(this.errorMsg, 'danger');
      return;
    }

    this.loading = true;

    try {
      // Garantiza sesión antes de actualizar
      const { data: s } = await this.supabaseService.client.auth.getSession();
      if (!s.session) {
        this.errorMsg = 'No se detectó sesión de recuperación. Abre nuevamente el enlace del correo desde este dispositivo.';
        await this.mostrarToast(this.errorMsg, 'danger');
        this.loading = false;
        return;
      }

      await this.auth.updateUser({ password: this.newPassword });

      this.successMsg = '¡Contraseña actualizada con éxito! Redirigiendo...';
      await this.mostrarToast(this.successMsg, 'success');
      await this.router.navigateByUrl('/auth/login', { replaceUrl: true });
    } catch (e: any) {
      console.error('Error al actualizar contraseña:', e);
      this.errorMsg = e?.message ?? 'Ocurrió un error al intentar cambiar la contraseña.';
      await this.mostrarToast(this.errorMsg, 'danger');
    } finally {
      this.loading = false;
    }
  }

  private async mostrarToast(message: string, color: 'success' | 'danger') {
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
