// src/app/perfil/perfil.page.ts

import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { IonicModule, ToastController } from '@ionic/angular';
import { Router } from '@angular/router';

// 🚨 Importaciones de Supabase
import { supabase } from '../core/supabase.client'; 
import { User } from '@supabase/supabase-js'; 

import { AuthService, Perfil } from '../auth/auth.service'; 

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
    private router: Router
  ) {
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

  // --- Lógica de Carga y Actualización del Perfil ---

  async cargarPerfil() {
    this.isLoading = true;
    this.perfilActual = null;
    
    try {
      const userResult = await supabase.auth.getUser();
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
      console.error("Error al cargar perfil:", e);
      this.mostrarToast('Error crítico al cargar el perfil.', 'danger');
    } finally {
      this.isLoading = false;
    }
  }

  // 🚨 FUNCIÓN CRÍTICA 1: Elimina la foto anterior de Storage
  async eliminarFotoAnterior(url: string | null): Promise<void> {
    if (!url) return;
    
    // 1. Extrae el path del archivo de la URL pública de Supabase
    // La URL tiene el formato: .../storage/v1/object/public/perfiles-bucket/users/...
    const parts = url.split(PROFILE_BUCKET + '/');
    if (parts.length < 2) return;
    
    const filePath = parts[1]; // Esto es 'users/uid/avatar.jpg'
    
    // 2. Llama al método remove de Supabase Storage
    const { error } = await supabase.storage
      .from(PROFILE_BUCKET)
      .remove([filePath]);
      
    if (error) {
        console.error('Error al eliminar foto anterior:', error);
        // No lanzamos throw para no bloquear la subida del nuevo archivo
    }
  }

  // 🚨 FUNCIÓN CRÍTICA 2: Sube la nueva foto y prepara la eliminación
  async subirYActualizarFoto(): Promise<string | null> {
    if (!this.fotoFile || !this.usuarioActual) return null;

    this.isUploading = true;
    const user = this.usuarioActual;
    
    try {
        // 1. Definir la ruta del archivo (se recomienda usar el UID para el folder)
        const fileExt = this.fotoFile.name.split('.').pop();
        const filePath = `users/${user.id}/profile_avatar_${Date.now()}.${fileExt}`;
        
        // 2. Subir el nuevo archivo
        const { error: uploadError } = await supabase.storage
            .from(PROFILE_BUCKET)
            .upload(filePath, this.fotoFile, {
                cacheControl: '3600',
                upsert: false,
            });

        if (uploadError) throw uploadError;
        
        // 3. Obtener la URL pública del nuevo archivo
        const { data: publicUrlData } = supabase.storage
            .from(PROFILE_BUCKET)
            .getPublicUrl(filePath);
            
        const newUrl = publicUrlData.publicUrl;

        // 4. Eliminar la foto anterior de Storage
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

  // --- Lógica del Botón y Guardado ---

  onFileSelected(event: any) {
    const files = event.target.files;
    if (files.length > 0) {
      this.fotoFile = files[0];
    } else {
      this.fotoFile = null;
    }
  }

  async guardarCambios() {
    // Verificar si el formulario cambió O si se seleccionó una foto
    if (this.perfilForm.invalid || (!this.perfilForm.dirty && !this.fotoFile)) return; 
    
    this.isSaving = true;
    
    try {
    let fotoUrl: string | null = null;

    // 1. Subir foto si hay un archivo seleccionado
    if (this.fotoFile) {
      fotoUrl = await this.subirYActualizarFoto();
      if (!fotoUrl) {
        this.isSaving = false;
        return; // Falla si la subida falla
      }
    }

    // 2. Preparar el payload de actualización
    const formPayload = this.perfilForm.getRawValue();

    // 3. Crear el payload final combinando datos del formulario y la URL de la foto
    // Si no se subió una nueva foto, preservamos la URL existente en el perfil
    const finalPayload: PerfilUpdatePayload = {
      segundo_nombre: formPayload.segundo_nombre || null,
      segundo_apellido: formPayload.segundo_apellido || null,
      telefono: formPayload.telefono || null,
      url_foto_perfil: fotoUrl ?? this.perfilActual?.url_foto_perfil ?? null,
    };
        
        // 4. Llamar al servicio para actualizar los datos
        await this.authService.updateUsuarioExtras(finalPayload);
        
        this.mostrarToast('Perfil actualizado con éxito.', 'success');
        this.fotoFile = null; // Limpiar el archivo local
        
        await this.cargarPerfil(); // Recargar para mostrar la nueva foto/data
        
    } catch (e: any) {
        console.error('Error al guardar:', e);
        this.mostrarToast(`Error al guardar: ${e.message}`, 'danger');
    } finally {
        this.isSaving = false;
    }
  }

  // --- Utilidades ---
  
  async logout() {
      await this.authService.signOut(); 
      this.router.navigateByUrl('/auth/login', { replaceUrl: true });
  }

  async mostrarToast(message: string, color: 'success' | 'danger' | 'warning') {
    const toast = await this.toastController.create({
      message: message,
      duration: 3000,
      position: 'bottom',
      color: color,
    });
    await toast.present();
  }

  /*a*/
}