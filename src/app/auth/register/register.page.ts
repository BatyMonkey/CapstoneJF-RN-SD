import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { IonicModule, ToastController, AlertController } from '@ionic/angular';
import { AuthService } from '../auth.service';

@Component({
  standalone: true,
  selector: 'app-register',
  templateUrl: './register.page.html',
  styleUrls: ['./register.page.scss'],
  imports: [IonicModule, CommonModule, FormsModule],
})
export class RegisterPage {
  primer_nombre = '';
  segundo_nombre = '';
  primer_apellido = '';
  segundo_apellido = '';
  rut = '';
  direccion = '';
  telefono = '';
  email = '';
  password = '';
  nombre = '';

  loading = false;
  errorMsg = '';
  rutInvalido = false;

  constructor(
    private router: Router,
    private toastCtrl: ToastController,
    private alertCtrl: AlertController,
    private auth: AuthService
  ) {}

  private async toast(message: string, color: 'success' | 'danger' | 'warning' = 'success') {
    const t = await this.toastCtrl.create({
      message, color, duration: 2500, position: 'top',
      buttons: [{ text: 'OK', role: 'cancel' }],
    });
    await t.present();
  }

  private buildNombre(): string {
    return [
      this.primer_nombre?.trim(),
      this.segundo_nombre?.trim(),
      this.primer_apellido?.trim(),
      this.segundo_apellido?.trim(),
    ].filter(Boolean).join(' ');
  }

  private normalizaRut(v: string): string {
    return (v || '').replace(/\./g, '').replace(/-/g, '').toUpperCase();
  }

  private validaRutDV(rut: string): boolean {
    const v = this.normalizaRut(rut);
    if (v.length < 2) return false;
    const cuerpo = v.slice(0, -1);
    const dv = v.slice(-1);
    if (!/^\d+$/.test(cuerpo)) return false;

    let suma = 0, multiplo = 2;
    for (let i = cuerpo.length - 1; i >= 0; i--) {
      suma += parseInt(cuerpo[i], 10) * multiplo;
      multiplo = multiplo === 7 ? 2 : multiplo + 1;
    }
    const resto = 11 - (suma % 11);
    const dvCalc = (resto === 11) ? '0' : (resto === 10) ? 'K' : String(resto);
    return dv.toUpperCase() === dvCalc;
  }

  telefonoEsValido(): boolean {
    const re = /^(\+?56)?\s?9\d{8}$/;
    return re.test((this.telefono || '').trim());
  }

  onRutBlur() { this.rutInvalido = !this.validaRutDV(this.rut); }

  private async showSuccessAlert() {
    const alert = await this.alertCtrl.create({
      header: '¡Registro exitoso! 🎉',
      subHeader: 'Tu cuenta fue creada correctamente',
      message: 'Ya puedes iniciar sesión en RedBarrio 🏡',
      buttons: [
        {
          text: 'OK',
          cssClass: 'ok-button',
          handler: () => this.router.navigateByUrl('/auth/login', { replaceUrl: true }),
        },
      ],
      cssClass: 'custom-success-alert',
      backdropDismiss: false,
      mode: 'ios',
    });
    await alert.present();
  }
  
  /**
   * 🚨 Método añadido para manejar el click del botón 'Volver' en el HTML.
   * Redirige al login.
   */
  goToLogin() {
    if (this.loading) return; // Evita la navegación si el registro está en proceso
    this.router.navigateByUrl('/auth/login', { replaceUrl: true });
  }

  async register(f: NgForm) {
    this.loading = true;
    this.errorMsg = '';

    try {
      // Validaciones
      this.rutInvalido = !this.validaRutDV(this.rut);
      if (this.rutInvalido || !this.telefonoEsValido() || !f.valid) {
        await this.toast('Revisa los campos obligatorios.', 'warning');
        this.loading = false;
        return;
      }

      // Nombre concatenado para la columna `nombre`
      this.nombre = this.buildNombre();

      // Registro completo: persiste TODOS los campos (incluye primer_nombre)
      const res = await this.auth.signUpFull({
        email: this.email.trim(),
        password: this.password,
        nombre: this.buildNombre(), // "Juan Andrés Pérez Soto"
        primer_nombre: this.primer_nombre || null, // <-- importante
        segundo_nombre: this.segundo_nombre || null,
        primer_apellido: this.primer_apellido || null,
        segundo_apellido: this.segundo_apellido || null,
        rut: this.rut || null,
        direccion: this.direccion || null,
        telefono: this.telefono || null,
      });

      if (res.needsEmailConfirm) {
        await this.toast('Te enviamos un correo para confirmar tu cuenta. Revisa tu bandeja ✉️');
        await this.router.navigateByUrl('/auth/login', { replaceUrl: true });
        return;
      }

      await this.showSuccessAlert();

    } catch (e: any) {
      const raw = e?.message || 'No se pudo crear la cuenta.';
      const msg = /registered|exists|already/i.test(raw)
        ? 'Este correo ya está registrado. Intenta iniciar sesión.'
        : raw;
      this.errorMsg = msg;
      await this.toast(msg, 'danger');
    } finally {
      this.loading = false;
    }
  }
}