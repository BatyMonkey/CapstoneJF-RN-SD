import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule, AlertController } from '@ionic/angular';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { supabase } from '../../../core/supabase.client';
import { AuthService } from '../../../auth/auth.service';

@Component({
  standalone: true,
  selector: 'app-generar-proyecto',
  templateUrl: './generar-proyecto.component.html',
  styleUrls: ['./generar-proyecto.component.scss'],
  imports: [CommonModule, IonicModule, ReactiveFormsModule],
})
export class GenerarProyectoComponent implements OnInit {
  proyectoForm!: FormGroup;
  perfil: any = null;
  isActividad = false;

  selectedFile: File | null = null;
  previewUrl: string | null = null;
  uploadedUrl: string | null = null;

  constructor(
    private fb: FormBuilder,
    private alertCtrl: AlertController,
    private auth: AuthService
  ) {}

  /** Inicializa el formulario y obtiene el perfil del usuario */
  async ngOnInit() {
    this.proyectoForm = this.fb.group({
      tipo: ['proyecto', Validators.required],
      titulo: ['', [Validators.required, Validators.minLength(3)]],
      descripcion: ['', [Validators.required, Validators.minLength(10)]],
      cupos_total: [null],
      fecha_inicio: [null],
      fecha_fin: [null],
    });

    this.perfil = await this.auth.miPerfil();
  }

  /** Cambia el modo entre proyecto y actividad */
  onTipoChange() {
    this.isActividad = this.proyectoForm.value.tipo === 'actividad';
  }

  /** Detecta cambio de fecha */
  onDateChange(field: 'fecha_inicio' | 'fecha_fin', event: any) {
    const value = event.detail?.value;
    this.proyectoForm.patchValue({ [field]: value });
  }

  /** Limpia el formulario */
  limpiarFormulario() {
    this.proyectoForm.reset({
      tipo: 'proyecto',
      titulo: '',
      descripcion: '',
      cupos_total: null,
      fecha_inicio: null,
      fecha_fin: null,
    });
    this.isActividad = false;
    this.selectedFile = null;
    this.previewUrl = null;
    this.uploadedUrl = null;
  }

  /** Maneja la selección de imagen y la sube al bucket */
  async onFileSelected(event: any) {
    const file = event.target.files[0];
    if (!file) return;

    this.selectedFile = file;
    const reader = new FileReader();
    reader.onload = () => (this.previewUrl = reader.result as string);
    reader.readAsDataURL(file);

    const fileName = `${Date.now()}_${file.name}`;
    const { error: uploadError } = await supabase.storage.from('proyectos').upload(fileName, file);

    if (uploadError) {
      console.error('Error al subir imagen:', uploadError.message);
      this.showAlert('Error', 'No se pudo subir la imagen al servidor.');
      return;
    }

    const { data: urlData } = supabase.storage.from('proyectos').getPublicUrl(fileName);
    this.uploadedUrl = urlData.publicUrl;
  }

  /** Envía el formulario a la base de datos */
  async generarProyecto() {
    if (this.proyectoForm.invalid) {
      this.showAlert('Error', 'Por favor completa todos los campos obligatorios.');
      return;
    }

    const formValue = this.proyectoForm.value;
    const id_auth = this.perfil?.id_auth;

    if (!id_auth) {
      this.showAlert('Error', 'No se pudo obtener la sesión del usuario.');
      return;
    }

    try {
      if (formValue.tipo === 'actividad') {
        // ===== INSERTAR ACTIVIDAD =====
        const { error } = await supabase.from('actividad').insert([
          {
            id_auth,
            titulo: formValue.titulo,
            descripcion: formValue.descripcion,
            cupos_total: formValue.cupos_total ?? 0,
            fecha_inicio: formValue.fecha_inicio,
            fecha_fin: formValue.fecha_fin,
            estado: 'publicada',
            imagen_url: this.uploadedUrl,
            creado_en: new Date().toISOString(),
            actualizado_en: new Date().toISOString(),
          },
        ]);

        if (error) throw error;
        await this.showAlert('Éxito', 'Actividad creada correctamente.');

      } else {
        // ===== INSERTAR PROYECTO =====
        const { error } = await supabase.from('proyecto').insert([
          {
            id_auth,
            titulo: formValue.titulo,
            descripcion: formValue.descripcion,
            estado: 'pendiente',
            fecha_creacion: new Date().toISOString(),
            actualizado_en: new Date().toISOString(),
            imagen_url: this.uploadedUrl,
          },
        ]);

        if (error) throw error;
        await this.showAlert('Éxito', 'Proyecto creado correctamente.');
      }

      this.limpiarFormulario();

    } catch (err: any) {
      console.error('Error al crear:', err);
      await this.showAlert('Error', err.message || 'No se pudo crear el registro.');
    }
  }

  /** Muestra un mensaje de alerta */
  private async showAlert(header: string, message: string) {
    const alert = await this.alertCtrl.create({
      header,
      message,
      buttons: ['OK'],
    });
    await alert.present();
  }
}