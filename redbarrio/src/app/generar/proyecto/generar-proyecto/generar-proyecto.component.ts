import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule, AlertController } from '@ionic/angular';
import {
  ReactiveFormsModule,
  FormBuilder,
  FormGroup,
  Validators,
} from '@angular/forms';
import { SupabaseService } from 'src/app/services/supabase.service';
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
    private auth: AuthService,
    private supabaseService: SupabaseService
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
    const { error: uploadError } = await this.supabaseService.client.storage
      .from('proyectos')
      .upload(fileName, file);

    if (uploadError) {
      console.error('Error al subir imagen:', uploadError.message);
      this.showAlert('Error', 'No se pudo subir la imagen al servidor.');
      return;
    }

    const { data: urlData } = this.supabaseService.client.storage
      .from('proyectos')
      .getPublicUrl(fileName);
    this.uploadedUrl = urlData.publicUrl;
  }

  /** Envía el formulario a la base de datos */
  async generarProyecto() {
    if (this.proyectoForm.invalid) {
      this.showAlert(
        'Error',
        'Por favor completa todos los campos obligatorios.'
      );
      return;
    }

    const formValue = this.proyectoForm.value;
    const id_auth = this.perfil?.id_auth;
    const rol = this.perfil?.rol; // ✅ aseguramos el rol desde el perfil

    if (!id_auth) {
      this.showAlert('Error', 'No se pudo obtener la sesión del usuario.');
      return;
    }

    // ✅ Estado automático según el rol
    const estado = rol === 'administrador' ? 'publicada' : 'pendiente';

    try {
      if (formValue.tipo === 'actividad') {
        // ===== INSERTAR ACTIVIDAD =====
        const { error } = await this.supabaseService.client
          .from('actividad')
          .insert([
            {
              id_auth,
              titulo: formValue.titulo,
              descripcion: formValue.descripcion,
              cupos_total: formValue.cupos_total ?? 0,
              fecha_inicio: formValue.fecha_inicio,
              fecha_fin: formValue.fecha_fin,
              estado, // 🔹 Publicada o Pendiente según rol
              imagen_url: this.uploadedUrl,
              creado_en: new Date().toISOString(),
              actualizado_en: new Date().toISOString(),
            },
          ]);

        if (error) throw error;
        await this.showAlert('Éxito', 'Actividad creada correctamente.');

        // 🧾 Registrar acción en auditoría
        await this.supabaseService.registrarAuditoria(
          'crear actividad',
          'actividad',
          {
            titulo: formValue.titulo,
            descripcion: formValue.descripcion,
            cupos_total: formValue.cupos_total ?? 0,
            fecha_inicio: formValue.fecha_inicio,
            fecha_fin: formValue.fecha_fin,
            estado,
            imagen_url: this.uploadedUrl,
            rol_creador: rol,
          }
        );
      } else {
        // ===== INSERTAR PROYECTO =====
        const { error } = await this.supabaseService.client
          .from('proyecto')
          .insert([
            {
              id_auth,
              titulo: formValue.titulo,
              descripcion: formValue.descripcion,
              estado, // 🔹 Publicada o Pendiente según rol
              fecha_creacion: new Date().toISOString(),
              actualizado_en: new Date().toISOString(),
              imagen_url: this.uploadedUrl,
            },
          ]);

        if (error) throw error;
        await this.showAlert('Éxito', 'Proyecto creado correctamente.');

        // 🧾 Registrar acción en auditoría
        await this.supabaseService.registrarAuditoria(
          'crear proyecto',
          'proyecto',
          {
            titulo: formValue.titulo,
            descripcion: formValue.descripcion,
            estado,
            imagen_url: this.uploadedUrl,
            rol_creador: rol,
          }
        );
      }

      this.limpiarFormulario();
    } catch (err: any) {
      console.error('Error al crear:', err);
      await this.showAlert(
        'Error',
        err.message || 'No se pudo crear el registro.'
      );
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
