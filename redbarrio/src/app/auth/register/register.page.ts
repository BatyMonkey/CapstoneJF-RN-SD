import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { IonicModule, ToastController, AlertController } from '@ionic/angular';
import { AuthService } from '../auth.service';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Capacitor } from '@capacitor/core';
import { OcrMlkitService } from '../../services/ocr-mlkit.service';
import { supabase } from '../../core/supabase.client';

@Component({
  selector: 'app-register',
  templateUrl: './register.page.html',
  styleUrls: ['./register.page.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule, FormsModule],
})
export class RegisterPage {
  // --- Form fields ---
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

  // nuevos
  fecha_nacimiento = ''; // YYYY-MM-DD
  sexo: 'M' | 'F' | '' = '';

  // --- UI state ---
  loading = false;
  errorMsg = '';
  rutInvalido = false;
  scanning = false;

  // Boleta de servicios
  boletaFile: File | null = null;
  boletaUrl: string | null = null;

  constructor(
    private router: Router,
    private toastCtrl: ToastController,
    private alertCtrl: AlertController,
    private auth: AuthService,
    private ocr: OcrMlkitService
  ) {}

  // =========================
  // OCR (on-device)
  // =========================
  async scanCedula() {
  try {
    // ✅ En web/PC: abrir selector de archivo y pasar a OCR
    if (Capacitor.getPlatform() === 'web') {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*'; // si tu OCR soporta PDF, puedes usar: 'image/*,application/pdf'
      input.onchange = async (e: any) => {
        const file: File | undefined = e?.target?.files?.[0];
        if (!file) return;

        const url = URL.createObjectURL(file);
        try {
          const res = await this.ocr.recognizeSmart(url);
          this.fillFromOcr(res);

          if (this.rut) this.rut = this.formatRutDisplay(this.rut);
          this.rutInvalido = !this.validaRutDV(this.rut);
          this.nombre = this.buildNombre();

          await this.toast('Datos autocompletados desde imagen local ✨');
        } catch (err: any) {
          console.error('❌ OCR (web) error:', err?.message || err);
          await this.toast(err?.message || 'No se pudo leer la imagen. Intenta otra.', 'warning');
        } finally {
          URL.revokeObjectURL(url);
        }
      };
      input.click();
      return;
    }

    // ✅ En dispositivo (Android/iOS): usar Cámara/Galería vía Capacitor
    this.scanning = true;

    const photo = await Camera.getPhoto({
      source: CameraSource.Prompt,
      resultType: CameraResultType.Uri,
      quality: 85,
      allowEditing: false,
      promptLabelPhoto: 'Galería',
      promptLabelPicture: 'Cámara',
    });

    const fileUrl = photo?.path || photo?.webPath;
    if (!fileUrl) throw new Error('No image');

    const res = await this.ocr.recognizeSmart(fileUrl);
    this.fillFromOcr(res);

    if (this.rut) this.rut = this.formatRutDisplay(this.rut);
    this.rutInvalido = !this.validaRutDV(this.rut);
    this.nombre = this.buildNombre();

    await this.toast('Datos autocompletados desde la cédula ✨');
  } catch (e: any) {
    console.error('❌ OCR ML Kit error:', e?.message || e);
    await this.toast(
      e?.message ? `OCR falló: ${e.message}` : 'No se pudo leer la cédula. Intenta con mejor luz/enfoque.',
      'warning'
    );
  } finally {
    this.scanning = false;
  }
}


  // Dispara el input file desde el botón (evita usar 'document' en el template)
  triggerBoleta(inputEl: HTMLInputElement) {
    if (inputEl) inputEl.click();
  }

  private fillFromOcr(res: {
    rut?: string | null;
    primerNombre?: string | null;
    segundoNombre?: string | null;
    primerApellido?: string | null;
    segundoApellido?: string | null;
    fechaNacimiento?: string | null;
    sexo?: 'M' | 'F' | null;
  }) {
    if (res.rut) this.rut = res.rut;
    if (res.primerNombre) this.primer_nombre = res.primerNombre;
    if (res.segundoNombre) this.segundo_nombre = res.segundoNombre ?? '';
    if (res.primerApellido) this.primer_apellido = res.primerApellido;
    if (res.segundoApellido) this.segundo_apellido = res.segundoApellido ?? '';
    if (res.fechaNacimiento) this.fecha_nacimiento = res.fechaNacimiento;
    if (res.sexo) this.sexo = res.sexo;
  }

  // =========================
  // Boleta de servicios
  // =========================
  onBoletaPicked(ev: Event) {
    const input = ev.target as HTMLInputElement;
    const file = input.files?.[0] || null;
    this.boletaFile = file;
    this.boletaUrl = null; // reset hasta subir en register()
  }

  private async uploadBoleta(file: File): Promise<string | null> {
    try {
      if (!file.size) throw new Error('El archivo está vacío.');
      if (file.size > 50 * 1024 * 1024) throw new Error('El archivo supera 50MB.');

      const BUCKET = 'boletas'; // nombre exacto del bucket
      const safeEmail = (this.email || 'sin-email')
        .replace(/[^a-z0-9@._-]/gi, '_')
        .toLowerCase();

      const extGuess = (file.name.split('.').pop() || '').toLowerCase();
      const ext = extGuess || (file.type?.includes('pdf') ? 'pdf' : 'jpg');
      const filename = `boleta_${Date.now()}.${ext}`;
      const path = `${safeEmail}/${filename}`; // sin "/" inicial

      const { error: upErr } = await supabase.storage
        .from(BUCKET)
        .upload(path, file, {
          upsert: true,
          cacheControl: '3600',
          contentType: file.type || (ext === 'pdf' ? 'application/pdf' : 'image/jpeg'),
        });

      if (upErr) {
        const msg = /permission|policy/i.test(upErr.message)
          ? 'Permiso denegado al subir. Revisa las políticas del bucket "boletas".'
          : /not found/i.test(upErr.message)
          ? 'Bucket "boletas" no encontrado.'
          : upErr.message;
        throw new Error(msg);
      }

      // Si el bucket es público:
      const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
      return data.publicUrl;

      // Si fuera privado:
      // const { data: signed } = await supabase.storage.from(BUCKET).createSignedUrl(path, 60 * 60 * 24);
      // return signed?.signedUrl || null;

    } catch (e: any) {
      console.error('Upload boleta error:', e?.message || e);
      await this.toast(e?.message || 'No se pudo subir la boleta. Intenta nuevamente.', 'danger');
      return null;
    }
  }

  // =========================
  // Utils
  // =========================
  private async toast(message: string, color: 'success' | 'danger' | 'warning' = 'success') {
    const t = await this.toastCtrl.create({ message, color, duration: 2200, position: 'top' });
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

  private formatRutDisplay(v: string): string {
    if (!v) return v;
    const raw = v.replace(/\s|\./g, '').toUpperCase();
    const m = raw.match(/^(\d+)-?([0-9K])$/i);
    if (!m) return raw;
    return `${m[1]}-${m[2].toUpperCase()}`;
  }

  private normalizaRut(v: string) { return (v || '').replace(/\./g, '').replace(/-/g, '').toUpperCase(); }
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
      buttons: [{ text: 'OK', handler: () => this.router.navigateByUrl('/home', { replaceUrl: true }) }],
      backdropDismiss: false,
      mode: 'ios',
    });
    await alert.present();
  }

  // =========================
  // Registro
  // =========================
  async register(f: NgForm) {
    this.loading = true;
    this.errorMsg = '';

    try {
      this.rutInvalido = !this.validaRutDV(this.rut);
      if (this.rutInvalido || !this.telefonoEsValido() || !f.valid) {
        await this.toast('Revisa los campos obligatorios.', 'warning');
        this.loading = false;
        return;
      }

      // Exigir boleta y subir ahora
      if (!this.boletaFile) {
        await this.toast('Debes subir una boleta de servicios para continuar.', 'warning');
        this.loading = false;
        return;
      }
      const url = await this.uploadBoleta(this.boletaFile);
      if (!url) {
        this.loading = false;
        return;
      }
      this.boletaUrl = url;

      this.nombre = this.buildNombre();

      const res = await this.auth.signUpFull({
        email: this.email.trim(),
        password: this.password,
        nombre: this.nombre,
        primer_nombre: this.primer_nombre || null,
        segundo_nombre: this.segundo_nombre || null,
        primer_apellido: this.primer_apellido || null,
        segundo_apellido: this.segundo_apellido || null,
        rut: this.rut || null,
        direccion: this.direccion || null,
        telefono: this.telefono || null,
        fecha_nacimiento: this.fecha_nacimiento || null,
        sexo: this.sexo || null,
        url_boleta_servicio: this.boletaUrl || null, // << nuevo campo
      });

      if (typeof (this.auth as any).signOut === 'function') {
        await (this.auth as any).signOut();
      }

      if (res?.needsEmailConfirm) {
        await this.toast('Cuenta creada. Revisa tu correo para confirmar.');
      } else {
        await this.toast('Cuenta creada. Inicia sesión para continuar.');
      }

      await this.router.navigateByUrl('/auth/login', { replaceUrl: true });
    } catch (e: any) {
      const raw = e?.message || 'No se pudo crear la cuenta.';
      const msg = /registered|exists|already/i.test(raw)
        ? 'Este correo ya está registrado.'
        : raw;
      this.errorMsg = msg;
      await this.toast(msg, 'danger');
    } finally {
      this.loading = false;
    }
  }
}
