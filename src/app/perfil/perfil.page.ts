import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { IonicModule, ToastController } from '@ionic/angular';
import { Router } from '@angular/router';

// Asegúrate de que esta ruta sea correcta para tu AuthService
import { AuthService, Perfil } from '../auth/auth.service'; 

// Definimos la interfaz de payload con los campos editables
interface PerfilUpdatePayload {
  segundo_nombre: string | null;
  telefono: string | null;
  segundo_apellido: string | null;
}

// EXPRESIÓN REGULAR PARA TELÉFONO CHILENO: (+56) 9XXXXXXXX
const CHILE_PHONE_PATTERN = /^(\+?56)?\s?9\d{8}$/;


@Component({
  selector: 'app-perfil',
  templateUrl: './perfil.page.html',
  styleUrls: ['./perfil.page.scss'],
  standalone: true,
  // 💥 Solución al error NG01050: DEBE ESTAR ReactiveFormsModule
  imports: [IonicModule, CommonModule, ReactiveFormsModule], 
})
export class PerfilPage implements OnInit {
  
  perfilForm!: FormGroup;
  perfilActual: Perfil | null = null; 
  
  isLoading = false; 
  isSaving = false;  

  constructor(
    private fb: FormBuilder,
    private authService: AuthService, 
    private toastController: ToastController,
    private router: Router
  ) {
    this.perfilForm = this.fb.group({
      segundo_nombre: [null],
      // Validadores: Nulo (opcional) O debe cumplir el patrón chileno
      telefono: [null, [Validators.pattern(CHILE_PHONE_PATTERN)]], 
      segundo_apellido: [null] 
    });
  }

  ngOnInit() {
    this.cargarPerfil();
  }

  async cargarPerfil() {
    this.isLoading = true;
    this.perfilActual = null;
    
    try {
      const perfil = await this.authService.miPerfil(); 
      
      if (!perfil) {
        this.mostrarToast('No se pudo cargar el perfil. Intenta de nuevo.', 'danger');
        return;
      }
      
      this.perfilActual = perfil;

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

  async guardarCambios() {
    if (this.perfilForm.invalid || !this.perfilForm.dirty) return;

    this.isSaving = true;
    try {
      const payload: Partial<PerfilUpdatePayload> = this.perfilForm.value;
      
      await this.authService.updateUsuarioExtras(payload); 
      
      this.mostrarToast('Perfil actualizado con éxito.', 'success');
      
      await this.cargarPerfil();
      
    } catch (e: any) {
      console.error("Error al guardar perfil:", e);
      this.mostrarToast(e?.message ?? 'Error al guardar los cambios.', 'danger');
    } finally {
      this.isSaving = false;
    }
  }
  
  async logout() {
      await this.authService.signOut(); 
      this.router.navigateByUrl('/auth/login', { replaceUrl: true });
  }

  async mostrarToast(message: string, color: 'success' | 'danger') {
    const toast = await this.toastController.create({
      message: message,
      duration: 3000,
      position: 'bottom',
      color: color,
    });
    await toast.present();
  }
}