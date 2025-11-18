// src/app/perfil/perfil.page.ts

import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormBuilder,
  FormGroup,
  Validators,
  ReactiveFormsModule,
} from '@angular/forms';
import { IonicModule, ToastController, ModalController } from '@ionic/angular';
import { Router } from '@angular/router';

// 🚨 Importaciones de Supabase
import { SupabaseService } from 'src/app/services/supabase.service';
import { User } from '@supabase/supabase-js';

import { AuthService, Perfil } from '../auth/auth.service';

// 👉 Íconos Ionicons
import { addIcons } from 'ionicons';
import {
  chatbubbleEllipsesOutline,
  pencilOutline,
  checkmarkCircleOutline,
  timeOutline,
  mailOutline,
  callOutline,
  locationOutline,
  calendarOutline,
  notificationsOutline,
  shieldCheckmarkOutline,
  createOutline,
  chevronForwardOutline,
  logOutOutline,
} from 'ionicons/icons';

// 👉 Modal de edición de perfil
import { EditarPerfilModalComponent } from './editar-perfil-modal/editar-perfil-modal.page';

// 🚨 CONFIGURACIÓN DE STORAGE
const PROFILE_BUCKET = 'perfiles-bucket'; // 🚨 AJUSTA ESTE NOMBRE AL DE TU BUCKET DE PERFILES

// Definición de los campos que PUEDE modificar el usuario
interface PerfilUpdatePayload {
  segundo_nombre: string | null;
  telefono: string | null;
  segundo_apellido: string | null;
  url_foto_perfil?: string | null; // Nuevo campo opcional para la foto
}

// EXPRESIÓN REGULAR PARA TELÉFONO CHILENO
const CHILE_PHONE_PATTERN = /^(\+?56)?\s?9\d{8}$/;

@Component({
  selector: 'app-perfil',
  templateUrl: './perfil.page.html',
  styleUrls: ['./perfil.page.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule, ReactiveFormsModule],
})
export class PerfilPage implements OnInit {
  perfilForm!: FormGroup;
  perfilActual: Perfil | null = null;

  isLoading = false;
  isSaving = false;

  // PROPIEDADES DE FOTO
  usuarioActual: User | null = null;
  fotoFile: File | null = null; // Archivo seleccionado por el usuario
  isUploading = false;

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private toastController: ToastController,
    private router: Router,
    private supabaseService: SupabaseService,
    private modalCtrl: ModalController
  ) {
    // 👇 Registrar íconos usados en el HTML de perfil
    addIcons({
      chatbubbleEllipsesOutline,
      pencilOutline,
      checkmarkCircleOutline,
      timeOutline,
      mailOutline,
      callOutline,
      locationOutline,
      calendarOutline,
      notificationsOutline,
      shieldCheckmarkOutline,
      createOutline,
      chevronForwardOutline,
      logOutOutline,
    });

    this.perfilForm = this.fb.group({
      // CAMPOS BLOQUEADOS (se llenan pero no se pueden editar)
      nombre: [{ value: '', disabled: true }],
      correo: [{ value: '', disabled: true }],
      rut: [{ value: '', disabled: true }],
      direccion: [{ value: '', disabled: true }],
      primer_apellido: [{ value: '', disabled: true }],

      // CAMPOS MODIFICABLES
      segundo_nombre: [null],
      telefono: [null, [Validators.pattern(CHILE_PHONE_PATTERN)]],
      segundo_apellido: [null],
    });
  }

  async ngOnInit() {
    await this.cargarPerfil();
  }

  // =======================
  //  MODAL EDITAR PERFIL
  // =======================

  async openEditPerfilModal() {
    const modal = await this.modalCtrl.create({
      component: EditarPerfilModalComponent,
      componentProps: {
        perfilActual: this.perfilActual,
      },
      cssClass: 'edit-perfil-modal',
    });

    await modal.present();

    const { role } = await modal.onDidDismiss();

    // Más adelante, si la modal guarda cambios reales, aquí
    // podrías recargar el perfil:
    if (role === 'saved') {
      await this.cargarPerfil();
    }
  }

  // --- Lógica de Carga y Actualización del Perfil ---

  async cargarPerfil() {
    this.isLoading = true;
    this.perfilActual = null;

    try {
      const userResult = await this.supabaseService.client.auth.getUser();
      this.usuarioActual = userResult.data.user; // Obtener el objeto User de Supabase

      const perfil = await this.authService.miPerfil();

      if (!perfil) {
        this.mostrarToast('No se pudo cargar el perfil.', 'danger');
        return;
      }

      this.perfilActual = perfil;

      // Aplicar los valores cargados al formulario y marcar como limpio
      this.perfilForm.patchValue({
        segundo_nombre: perfil.segundo_nombre,
        telefono: perfil.telefono,
        segundo_apellido: perfil.segundo_apellido,
      });

      this.perfilForm.markAsPristine();
    } catch (e) {
      console.error('Error al cargar perfil:', e);
      this.mostrarToast('Error crítico al cargar el perfil.', 'danger');
    } finally {
      this.isLoading = false;
    }
  }

  // 🚨 FUNCIÓN CRÍTICA 1: Elimina la foto anterior de Storage
  async eliminarFotoAnterior(url: string | null): Promise<void> {
    if (!url) return;

    const parts = url.split(PROFILE_BUCKET + '/');
    if (parts.length < 2) return;

    const filePath = parts[1];

    const { error } = await this.supabaseService.client.storage
      .from(PROFILE_BUCKET)
      .remove([filePath]);

    if (error) {
      console.error('Error al eliminar foto anterior:', error);
    }
  }

  // 🚨 FUNCIÓN CRÍTICA 2: Sube la nueva foto y prepara la eliminación
  async subirYActualizarFoto(): Promise<string | null> {
    if (!this.fotoFile || !this.usuarioActual) return null;

    this.isUploading = true;
    const user = this.usuarioActual;

    try {
      const fileExt = this.fotoFile.name.split('.').pop();
      const filePath = `users/${user.id}/profile_avatar_${Date.now()}.${fileExt}`;

      const { error: uploadError } = await this.supabaseService.client.storage
        .from(PROFILE_BUCKET)
        .upload(filePath, this.fotoFile, {
          cacheControl: '3600',
          upsert: false,
        });

      if (uploadError) throw uploadError;

      const { data: publicUrlData } = this.supabaseService.client.storage
        .from(PROFILE_BUCKET)
        .getPublicUrl(filePath);

      const newUrl = publicUrlData.publicUrl;

      if (this.perfilActual?.url_foto_perfil) {
        await this.eliminarFotoAnterior(this.perfilActual.url_foto_perfil);
      }

      return newUrl;
    } catch (e) {
      console.error('Fallo en la subida:', e);
      this.mostrarToast('Fallo la subida de la foto.', 'danger');
      return null;
    } finally {
      this.isUploading = false;
    }
  }

  async onFileSelected(event: any) {
    const files: FileList | null = event.target.files;

    if (!files || files.length === 0) {
      this.fotoFile = null;
      return;
    }

    // Guardamos el archivo seleccionado
    this.fotoFile = files[0];

    // Disparamos el flujo de guardado (subir a Supabase + actualizar perfil)
    await this.guardarCambios();
  }

  async guardarCambios() {
    if (this.perfilForm.invalid || (!this.perfilForm.dirty && !this.fotoFile))
      return;

    this.isSaving = true;

    try {
      let fotoUrl: string | null = null;

      if (this.fotoFile) {
        fotoUrl = await this.subirYActualizarFoto();
        if (!fotoUrl) {
          this.isSaving = false;
          return;
        }
      }

      const formPayload = this.perfilForm.getRawValue();

      const finalPayload: PerfilUpdatePayload = {
        segundo_nombre: formPayload.segundo_nombre || null,
        segundo_apellido: formPayload.segundo_apellido || null,
        telefono: formPayload.telefono || null,
        url_foto_perfil: fotoUrl ?? this.perfilActual?.url_foto_perfil ?? null,
      };

      await this.authService.updateUsuarioExtras(finalPayload);

      this.mostrarToast('Perfil actualizado con éxito.', 'success');
      this.fotoFile = null;

      await this.cargarPerfil();
    } catch (e: any) {
      console.error('Error al guardar:', e);
      this.mostrarToast(`Error al guardar: ${e.message}`, 'danger');
    } finally {
      this.isSaving = false;
    }
  }

  async logout() {
    await this.authService.signOut();
    this.router.navigateByUrl('/auth/login', { replaceUrl: true });
  }

  async mostrarToast(
    message: string,
    color: 'success' | 'danger' | 'warning'
  ) {
    const toast = await this.toastController.create({
      message: message,
      duration: 3000,
      position: 'bottom',
      color: color,
    });
    await toast.present();
  }
}
