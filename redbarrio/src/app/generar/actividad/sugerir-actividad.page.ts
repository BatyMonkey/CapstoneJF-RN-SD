// src/app/sugerir-actividad/sugerir-actividad.page.ts

import { Component } from '@angular/core';
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
  selector: 'app-sugerir-actividad',
  templateUrl: './sugerir-actividad.page.html',
  styleUrls: ['./sugerir-actividad.page.scss'],
  imports: [IonicModule, CommonModule, FormsModule],
})
export class SugerirActividadPage {
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

  private supabase: SupabaseClient;
  enviando = false;

  // Flag de rol (controla textos y estado publicado/pendiente)
  esAdmin = false;

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

    // Detectar rol apenas se crea la página
    this.detectarRolUsuario();
  }

  // ==========================
  // Helper para determinar si es admin desde el objeto user
  // ==========================
  private getEsAdminFromUser(user: any): boolean {
    if (!user) return false;

    const userMeta = user.user_metadata || {};
    const appMeta = user.app_metadata || {};
    const meta = { ...userMeta, ...appMeta };

    console.log('👤 user_metadata:', userMeta);
    console.log('👤 app_metadata:', appMeta);

    // 1) Claves típicas con valor string
    const posiblesClaves = ['rol', 'role', 'perfil', 'tipo', 'tipo_usuario'];
    for (const key of posiblesClaves) {
      const valor = meta[key];
      if (typeof valor === 'string') {
        const val = valor.toLowerCase();
        if (val === 'admin' || val === 'administrador') {
          console.log('✅ esAdmin por clave directa:', key, valor);
          return true;
        }
      }
    }

    // 2) Banderas booleanas
    if (meta['is_admin'] === true || meta['isAdmin'] === true) {
      console.log('✅ esAdmin por bandera booleana is_admin/isAdmin');
      return true;
    }

    // 3) Como fallback, revisar todos los strings del metadata
    const valores = Object.values(meta)
      .filter((v) => typeof v === 'string')
      .map((v) => (v as string).toLowerCase());

    if (valores.some((v) => v === 'admin' || v === 'administrador')) {
      console.log('✅ esAdmin por búsqueda genérica en metadata:', valores);
      return true;
    }

    console.log('ℹ️ No se detectó rol admin en metadata');
    return false;
  }

  // ==========================
  // Detectar rol inicial
  // ==========================
  private async detectarRolUsuario() {
    try {
      const {
        data: { user },
      } = await this.supabase.auth.getUser();

      if (!user) {
        this.esAdmin = false;
        return;
      }

      this.esAdmin = this.getEsAdminFromUser(user);
      console.log('🔎 esAdmin (inicial):', this.esAdmin);
    } catch (e) {
      console.warn('⚠️ No se pudo determinar el rol del usuario:', e);
      this.esAdmin = false;
    }
  }

  // ==========================
  // Navegación
  // ==========================
  goBack() {
    this.navCtrl.back();
  }

  // ==========================
  // Imagen de referencia
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
  // Alertas bonitas
  // ==========================
  private async mostrarAlertaAccion(titulo: string, mensajeHtml: string) {
    const alerta = await this.alertCtrl.create({
      header: titulo,
      message: new IonicSafeString(mensajeHtml),
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
  }

  private async mostrarError(mensaje: string) {
    await this.mostrarAlertaAccion('Ups...', mensaje);
  }

  // ==========================
  // Enviar sugerencia / crear actividad
  // ==========================
  async enviarSugerencia() {
    if (this.enviando) return;

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
      message: 'Enviando información...',
      spinner: 'crescent',
      mode: 'ios',
    });

    this.enviando = true;
    await loading.present();

    try {
      // 1️⃣ Usuario actual
      const {
        data: { user },
        error: userError,
      } = await this.supabase.auth.getUser();

      if (userError || !user) {
        console.error('❌ Error obteniendo usuario:', userError);
        throw new Error(
          'Debes iniciar sesión para crear o sugerir una actividad.'
        );
      }

      // Recalcular esAdmin en base al user real
      this.esAdmin = this.getEsAdminFromUser(user);
      console.log('🔎 esAdmin (en envío):', this.esAdmin);

      let imagenUrl: string | null = null;

      // 2️⃣ Subir imagen (opcional) al bucket "proyectos"
      if (this.imagenFile) {
        const ext = this.imagenFile.name.split('.').pop() || 'jpg';
        const filePath = `actividades/${user.id}/${Date.now()}.${ext}`;

        const { data: uploadData, error: uploadError } = await this.supabase
          .storage
          .from('proyectos')
          .upload(filePath, this.imagenFile, {
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

      // 3️⃣ Insertar en la tabla actividad
      //    Admin → estado 'publicada'
      //    Vecino → estado 'pendiente'
      const estadoActividad = this.esAdmin ? 'publicada' : 'pendiente';

      const { error: insertError } = await this.supabase
        .from('actividad')
        .insert({
          id_auth: user.id,
          titulo: this.titulo.trim(),
          descripcion: this.descripcion.trim(),
          cupos_total: Number(this.cupos),
          fecha_inicio: inicio.toISOString(),
          fecha_fin: fin.toISOString(),
          estado: estadoActividad,
          imagen_url: imagenUrl,
        });

      if (insertError) {
        console.error('❌ Error al insertar actividad:', insertError);
        throw new Error(
          insertError.message ||
            'Ocurrió un problema al guardar la información.'
        );
      }

      // 4️⃣ Éxito: limpiar formulario y avisar
      this.resetFormulario();

      const tituloModal = this.esAdmin
        ? 'Actividad creada'
        : 'Sugerencia enviada';

      const mensajeModal = this.esAdmin
        ? `
          La actividad fue creada correctamente.<br/>
          <strong>Ya está publicada y visible para los vecinos.</strong>
        `
        : `
          Tu actividad fue enviada correctamente.<br/>
          <strong>Un administrador la revisará antes de publicarla.</strong>
        `;

      await this.mostrarAlertaAccion(tituloModal, mensajeModal);
    } catch (e: any) {
      console.error('❌ Error inesperado al enviar sugerencia:', e);
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
