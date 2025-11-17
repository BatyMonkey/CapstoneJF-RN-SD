// src/app/admin/actividades/crear-actividad-admin/crear-actividad-admin.ts

import { Component, OnInit } from '@angular/core';
import {
  IonicModule,
  NavController,
  AlertController,
  LoadingController,
  IonicSafeString,
} from '@ionic/angular';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { addIcons } from 'ionicons';
import {
  chevronBackOutline,
  cloudUploadOutline,
  calendarOutline,
  timeOutline,
  peopleOutline,
  imageOutline,
  sendOutline,
} from 'ionicons/icons';

import { SupabaseClient } from '@supabase/supabase-js';
import { SupabaseService } from 'src/app/services/supabase.service';

@Component({
  standalone: true,
  selector: 'app-crear-actividad-admin',
  templateUrl: './crear-actividad-admin.page.html',
  styleUrls: ['./crear-actividad-admin.page.scss'],
  imports: [IonicModule, CommonModule, FormsModule],
})
export class CrearActividadAdminPage implements OnInit {
  // ===== Estado del formulario =====
  titulo = '';
  descripcion = '';
  cupos: number | null = null;

  fechaInicio = '';
  horaInicio = '';
  fechaFin = '';
  horaFin = '';

  imagenPreview: string | null = null;
  imagenFile: File | null = null;

  enviando = false;
  isAdmin = false;

  private supabase: SupabaseClient;

  constructor(
    private navCtrl: NavController,
    private supabaseService: SupabaseService,
    private alertCtrl: AlertController,
    private loadingCtrl: LoadingController
  ) {
    this.supabase = this.supabaseService.client;

    addIcons({
      'chevron-back-outline': chevronBackOutline,
      'image-outline': imageOutline,
      'people-outline': peopleOutline,
      'calendar-outline': calendarOutline,
      'time-outline': timeOutline,
      'send-outline': sendOutline,
      'cloud-upload-outline': cloudUploadOutline,
    });
  }

  // ==========================
  // Ciclo de vida
  // ==========================
  async ngOnInit() {
    await this.verificarAccesoAdmin();
  }

  // ==========================
  // Navegación
  // ==========================
  goBack() {
    this.navCtrl.back();
  }

  // ==========================
  // Imagen
  // ==========================
  onImageSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (!file) return;

    this.imagenFile = file;

    const reader = new FileReader();
    reader.onload = () => {
      this.imagenPreview = reader.result as string;
    };
    reader.readAsDataURL(file);
  }

  eliminarImagen() {
    this.imagenFile = null;
    this.imagenPreview = null;
  }

  // ==========================
  // Helpers de alertas
  // ==========================
  private async mostrarAlertaAccion(titulo: string, mensajeHtml: string) {
    const alerta = await this.alertCtrl.create({
      header: titulo,
      message: new IonicSafeString(mensajeHtml),
      mode: 'ios',
      cssClass: 'rb-action-alert',
      buttons: [{ text: 'Cerrar', role: 'cancel' }],
    });

    await alerta.present();
  }

  private async mostrarError(mensaje: string) {
    await this.mostrarAlertaAccion('Ups...', mensaje);
  }

  // ==========================
  // Verificación de admin usando tabla "usuario"
  // ==========================
  private async esAdmin(): Promise<boolean> {
    try {
      // 1️⃣ Usuario autenticado
      const {
        data: { user },
        error,
      } = await this.supabase.auth.getUser();

      if (error || !user) {
        console.error('❌ Error en getUser:', error);
        return false;
      }

      // 2️⃣ Buscar su perfil en tabla usuario (id_auth → auth.users.id)
      const { data: perfil, error: perfilError } = await this.supabase
        .from('usuario')
        .select('rol')
        .eq('id_auth', user.id)
        .maybeSingle();

      if (perfilError) {
        console.error('❌ Error consultando tabla usuario:', perfilError);
        return false;
      }

      const rol = (perfil?.rol ?? '').toString().toLowerCase().trim();
      console.log('ℹ️ Rol obtenido desde tabla usuario:', rol);

      return rol === 'admin' || rol === 'administrador';
    } catch (e) {
      console.error('❌ Error inesperado en esAdmin():', e);
      return false;
    }
  }

  private async verificarAccesoAdmin() {
    try {
      const esAdmin = await this.esAdmin();
      this.isAdmin = esAdmin;

      if (!esAdmin) {
        const alerta = await this.alertCtrl.create({
          header: 'Acceso restringido',
          message:
            'Solo los administradores pueden crear actividades desde esta pantalla.',
          mode: 'ios',
          cssClass: 'rb-action-alert',
          buttons: [
            {
              text: 'Cerrar',
              role: 'cancel',
            },
          ],
        });

        await alerta.present();
        alerta.onDidDismiss().then(() => this.navCtrl.back());
      }
    } catch (e) {
      console.error('❌ Error verificando acceso admin:', e);

      const alerta = await this.alertCtrl.create({
        header: 'Acceso restringido',
        message: 'Ocurrió un problema al validar tus permisos.',
        mode: 'ios',
        cssClass: 'rb-action-alert',
        buttons: [
          {
            text: 'Cerrar',
            role: 'cancel',
          },
        ],
      });

      await alerta.present();
      alerta.onDidDismiss().then(() => this.navCtrl.back());
    }
  }

  // ==========================
  // Crear actividad (publicada)
  // ==========================
  async enviarActividad() {
    if (this.enviando) return;

    // Validación extra por si acaso
    if (!this.isAdmin) {
      return this.mostrarError(
        'Solo los administradores pueden crear actividades desde aquí.'
      );
    }

    // ---- Validaciones front ----
    if (!this.titulo.trim()) {
      return this.mostrarError(
        'Por favor ingresa un título para la actividad.'
      );
    }
    if (!this.descripcion.trim()) {
      return this.mostrarError('Por favor ingresa una descripción.');
    }
    if (!this.cupos || this.cupos <= 0) {
      return this.mostrarError('Por favor ingresa un número válido de cupos.');
    }
    if (!this.fechaInicio || !this.horaInicio) {
      return this.mostrarError(
        'Por favor selecciona la fecha y hora de inicio.'
      );
    }
    if (!this.fechaFin || !this.horaFin) {
      return this.mostrarError('Por favor selecciona la fecha y hora de fin.');
    }

    const inicio = new Date(`${this.fechaInicio}T${this.horaInicio}`);
    const fin = new Date(`${this.fechaFin}T${this.horaFin}`);

    if (isNaN(inicio.getTime()) || isNaN(fin.getTime())) {
      return this.mostrarError('Las fechas u horas ingresadas no son válidas.');
    }

    if (fin <= inicio) {
      return this.mostrarError(
        'La fecha de fin debe ser posterior a la fecha de inicio.'
      );
    }

    const loading = await this.loadingCtrl.create({
      message: 'Creando actividad...',
      spinner: 'crescent',
      mode: 'ios',
    });

    this.enviando = true;
    await loading.present();

    try {
      const {
        data: { user },
        error: userError,
      } = await this.supabase.auth.getUser();

      if (userError || !user) {
        throw new Error('No se pudo obtener el usuario actual.');
      }

      let imagenUrl: string | null = null;

      // Subir imagen si existe
      if (this.imagenFile) {
        const ext = this.imagenFile.name.split('.').pop() || 'jpg';
        const filePath = `actividades/${user.id}/${Date.now()}.${ext}`;

        const { data: uploadData, error: uploadError } =
          await this.supabase.storage
            .from('proyectos')
            .upload(filePath, this.imagenFile, {
              // ✅ imagenFile
              cacheControl: '3600',
              upsert: false,
            });

        if (uploadError) {
          console.error('❌ Error al subir imagen:', uploadError);
          throw new Error(
            'No se pudo subir la imagen. Intenta nuevamente más tarde.'
          );
        }

        const { data: publicData } = this.supabase.storage
          .from('proyectos')
          .getPublicUrl(uploadData.path);

        imagenUrl = publicData.publicUrl;
      }

      // Insertar actividad PUBLICADA
      const { error: insertError } = await this.supabase
        .from('actividad')
        .insert({
          id_auth: user.id,
          titulo: this.titulo.trim(),
          descripcion: this.descripcion.trim(),
          cupos_total: Number(this.cupos),
          fecha_inicio: inicio.toISOString(),
          fecha_fin: fin.toISOString(),
          estado: 'publicada', // 👈 admin: queda publicada al instante
          imagen_url: imagenUrl,
        });

      if (insertError) {
        console.error('❌ Error al insertar actividad:', insertError);
        throw new Error(
          insertError.message || 'Ocurrió un problema al guardar la actividad.'
        );
      }

      this.resetFormulario();

      await this.mostrarAlertaAccion(
        'Actividad creada',
        `
        La actividad fue creada y <strong>publicada inmediatamente</strong> para la comunidad.
      `
      );
    } catch (e: any) {
      console.error('❌ Error inesperado al crear actividad:', e);
      const msg =
        e?.message ||
        e?.error_description ||
        'Ocurrió un error inesperado. Intenta nuevamente más tarde.';
      await this.mostrarError(msg);
    } finally {
      this.enviando = false;
      loading.dismiss();
    }
  }

  // ==========================
  // Reset de formulario
  // ==========================
  private resetFormulario() {
    this.titulo = '';
    this.descripcion = '';
    this.cupos = null;
    this.fechaInicio = '';
    this.horaInicio = '';
    this.fechaFin = '';
    this.horaFin = '';
    this.imagenFile = null;
    this.imagenPreview = null;
  }
}
