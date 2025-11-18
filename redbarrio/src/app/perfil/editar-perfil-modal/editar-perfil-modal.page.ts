// src/app/perfil/editar-perfil-modal/editar-perfil-modal.component.ts

import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  IonicModule,
  ModalController,
  ToastController,
} from '@ionic/angular';
import {
  FormBuilder,
  FormGroup,
  Validators,
  ReactiveFormsModule,
} from '@angular/forms';

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
  chevronBackOutline,
  alertCircleOutline,
  saveOutline,
} from 'ionicons/icons';

// Ajusta la ruta según tu estructura de carpetas
import { AuthService, Perfil } from '../../auth/auth.service';

// Definimos la interfaz de payload con los campos editables
interface PerfilUpdatePayload {
  segundo_nombre: string | null;
  telefono: string | null;
  segundo_apellido: string | null;
}

// EXPRESIÓN REGULAR PARA TELÉFONO CHILENO: (+56) 9XXXXXXXX
const CHILE_PHONE_PATTERN = /^(\+?56)?\s?9\d{8}$/;

@Component({
  standalone: true,
  selector: 'app-editar-perfil-modal',
  templateUrl: './editar-perfil-modal.component.html',
  styleUrls: ['./editar-perfil-modal.component.scss'],
  imports: [IonicModule, CommonModule, ReactiveFormsModule],
})
export class EditarPerfilModalComponent implements OnInit {
  @Input() perfilActual: Perfil | null = null;

  perfilForm!: FormGroup;
  isSaving = false;

  constructor(
    private fb: FormBuilder,
    private modalCtrl: ModalController,
    private authService: AuthService,
    private toastCtrl: ToastController
  ) {
    // Form con los 3 campos editables
    this.perfilForm = this.fb.group({
      segundo_nombre: [null],
      telefono: [null, [Validators.pattern(CHILE_PHONE_PATTERN)]],
      segundo_apellido: [null],
    });

    // Registro de íconos que se usan en la modal
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
      chevronBackOutline,
      alertCircleOutline,
        saveOutline,
    });
  }

  ngOnInit(): void {
    // Cargar datos iniciales en el form cuando llegue perfilActual
    if (this.perfilActual) {
      this.perfilForm.patchValue({
        segundo_nombre: this.perfilActual.segundo_nombre,
        telefono: this.perfilActual.telefono,
        segundo_apellido: this.perfilActual.segundo_apellido,
      });
      this.perfilForm.markAsPristine();
    }
  }

  // Nombre completo solo para mostrar en la caja azul
  get nombreCompleto(): string {
    if (!this.perfilActual) return '';
    return this.perfilActual.nombre || '';
  }

  // Acceso rápido al control de teléfono (para errores en template si quieres)
  get telefonoCtrl() {
    return this.perfilForm.get('telefono');
  }

  async guardarCambios() {
    // Si el form es inválido o no se tocó nada, no hacemos nada
    if (this.perfilForm.invalid || !this.perfilForm.dirty) {
      this.close();
      return;
    }

    this.isSaving = true;

    try {
      const raw = this.perfilForm.value;

      const payload: PerfilUpdatePayload = {
        segundo_nombre: raw.segundo_nombre || null,
        segundo_apellido: raw.segundo_apellido || null,
        telefono: raw.telefono || null,
      };

      // Actualizar datos extra del usuario
      await this.authService.updateUsuarioExtras(payload);

      await this.showToast('Perfil actualizado con éxito.', 'success');

      // Cerramos devolviendo role 'saved' para que el padre pueda recargar
      this.modalCtrl.dismiss(null, 'saved');
    } catch (e: any) {
      console.error('Error al guardar perfil desde la modal:', e);
      await this.showToast(
        e?.message ?? 'Error al guardar los cambios.',
        'danger'
      );
    } finally {
      this.isSaving = false;
    }
  }

  close() {
    this.modalCtrl.dismiss(null, 'cancel');
  }

  private async showToast(
    message: string,
    color: 'success' | 'danger'
  ) {
    const toast = await this.toastCtrl.create({
      message,
      duration: 3000,
      position: 'bottom',
      color,
    });
    await toast.present();
  }
}
