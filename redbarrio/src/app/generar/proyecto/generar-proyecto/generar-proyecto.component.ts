import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  IonicModule,
  ToastController,
  AlertController,
} from '@ionic/angular';
import {
  FormBuilder,
  FormGroup,
  Validators,
  ReactiveFormsModule,
} from '@angular/forms';
import { addIcons } from 'ionicons';
import {
  chevronBackOutline,
  calendarOutline,
  briefcaseOutline,
  peopleOutline,
  timeOutline,
  eyeOutline,
  addOutline,
  checkmarkCircleOutline,
  closeCircleOutline,
  cashOutline,
  calendarNumberOutline,
  documentTextOutline,
  settingsOutline,
  pauseCircleOutline,
  createOutline,
  trashOutline,
  imageOutline,
} from 'ionicons/icons';

import { SupabaseService } from 'src/app/services/supabase.service';
import { AuthService } from 'src/app/auth/auth.service';
import { Router } from '@angular/router';

@Component({
  standalone: true,
  selector: 'app-sugerir-proyecto',
  templateUrl: './generar-proyecto.component.html',
  styleUrls: ['./generar-proyecto.component.scss'],
  imports: [CommonModule, IonicModule, ReactiveFormsModule],
})
export class SugerirProyectoPage implements OnInit {
  form!: FormGroup;
  perfil: any = null;

  // Estado del componente
  submitted = false;
  cargando = false;

  // Imagen seleccionada
  selectedImageFile: File | null = null;
  imagenPreview: string | null = null;

  get esAdmin(): boolean {
    return (this.perfil?.rol || '').toLowerCase() === 'administrador';
  }

  constructor(
    private fb: FormBuilder,
    private auth: AuthService,
    private supabaseService: SupabaseService,
    private toastCtrl: ToastController,
    private alertCtrl: AlertController,
    private router: Router
  ) {
    addIcons({
      'chevron-back-outline': chevronBackOutline,
      'calendar-outline': calendarOutline,
      'briefcase-outline': briefcaseOutline,
      'people-outline': peopleOutline,
      'time-outline': timeOutline,
      'eye-outline': eyeOutline,
      'add-outline': addOutline,
      'checkmark-circle-outline': checkmarkCircleOutline,
      'close-circle-outline': closeCircleOutline,
      'cash-outline': cashOutline,
      'calendar-number-outline': calendarNumberOutline,
      'document-text-outline': documentTextOutline,
      'settings-outline': settingsOutline,
      'pause-circle-outline': pauseCircleOutline,
      'create-outline': createOutline,
      'trash-outline': trashOutline,
      'image-outline': imageOutline,
    });
  }

  async ngOnInit() {
    // Formulario unificado (admin / vecino)
    this.form = this.fb.group({
      titulo: ['', [Validators.required, Validators.minLength(3)]],
      descripcion: ['', [Validators.required, Validators.minLength(10)]],
      responsable: [''],
      presupuesto: [''], // numérico opcional
      fecha_inicio: [null], // requeridas solo en admin (validamos en enviar)
      fecha_fin: [null],
      estado_proyecto: ['Planificación', Validators.required],
    });

    this.perfil = await this.auth.miPerfil();
    console.log('🟦 Perfil cargado:', this.perfil);
  }

  // ============================
  // MANEJO DE IMAGEN
  // ============================

  onImageSelected(event: Event) {
    const input = event.target as HTMLInputElement;

    if (!input.files || input.files.length === 0) {
      return;
    }

    const file = input.files[0];
    this.selectedImageFile = file;

    const reader = new FileReader();
    reader.onload = () => {
      this.imagenPreview = reader.result as string;
    };
    reader.readAsDataURL(file);

    console.log('📷 Imagen seleccionada:', file.name, file.size, 'bytes');
  }

  eliminarImagen() {
    this.selectedImageFile = null;
    this.imagenPreview = null;
  }

  private async subirImagenProyecto(
    file: File,
    idAuth: string | number
  ): Promise<string | null> {
    try {
      const safeName = file.name.replace(/\s+/g, '_');
      const timestamp = Date.now();
      const path = `${idAuth}/${timestamp}-${safeName}`;

      const { data, error } = await this.supabaseService
        .storage()
        .from('proyectos')
        .upload(path, file, {
          cacheControl: '3600',
          upsert: true,
          contentType: file.type,
        });

      if (error) {
        console.error('💥 Error al subir imagen a Supabase Storage:', error);
        await this.mostrarToast('No se pudo subir la imagen del proyecto');
        return null;
      }

      console.log('✅ Imagen subida en ruta:', data?.path);

      const { data: publicData } = this.supabaseService
        .storage()
        .from('proyectos')
        .getPublicUrl(path);

      const publicUrl = publicData?.publicUrl || null;
      console.log('🌐 URL pública imagen:', publicUrl);

      return publicUrl;
    } catch (err) {
      console.error('💥 Excepción al subir imagen:', err);
      await this.mostrarToast('Ocurrió un error al subir la imagen');
      return null;
    }
  }

  // ============================
  // ENVIAR PROYECTO
  // ============================
  async enviar() {
    if (this.form.invalid) {
      this.mostrarToast('Completa todos los campos obligatorios');
      return;
    }

    // Para administradores, exigimos fechas
    if (
      this.esAdmin &&
      (!this.form.value.fecha_inicio || !this.form.value.fecha_fin)
    ) {
      this.mostrarToast('Debes indicar fecha de inicio y término');
      return;
    }

    this.cargando = true;

    try {
      const id_auth = this.perfil?.id_auth;
      const rol = this.perfil?.rol || 'usuario';

      if (!id_auth) {
        await this.showAlert('Error', 'No existe sesión activa.');
        return;
      }

      // 1️⃣ Subir imagen si existe
      let imagenUrl: string | null = null;

      if (this.selectedImageFile) {
        imagenUrl = await this.subirImagenProyecto(
          this.selectedImageFile,
          id_auth
        );

        if (!imagenUrl) {
          // si falló la subida, cortamos el flujo
          throw new Error('No se pudo subir la imagen del proyecto');
        }
      }

      // Estado automático según rol
      const estado = rol.toLowerCase() === 'administrador' ? 'publicada' : 'pendiente';

      // Origen de la solicitud
      const solicitado = this.esAdmin
        ? 'Panel administración'
        : 'Sugerencia vecino';

      const presupuestoNumero =
        this.form.value.presupuesto && this.form.value.presupuesto !== ''
          ? Number(this.form.value.presupuesto)
          : null;

      const datos = {
        id_auth,
        titulo: this.form.value.titulo,
        descripcion: this.form.value.descripcion,
        estado,
        fecha_creacion: new Date().toISOString(),
        actualizado_en: new Date().toISOString(),
        imagen_url: imagenUrl,
        estado_proyecto: this.form.value.estado_proyecto || 'Planificación',
        presupuesto: presupuestoNumero,
        responsable:
          this.form.value.responsable && this.form.value.responsable.trim() !== ''
            ? this.form.value.responsable.trim()
            : null,
        solicitado,
        fecha_inicio: this.form.value.fecha_inicio || null,
        fecha_fin: this.form.value.fecha_fin || null,
      };

      console.log('📤 Insertando proyecto →', datos);

      const { error } = await this.supabaseService.client
        .from('proyecto')
        .insert([datos]);

      if (error) throw error;

      // Auditoría
      await this.supabaseService.registrarAuditoria(
        this.esAdmin
          ? 'crear proyecto desde panel admin'
          : 'crear sugerencia proyecto',
        'proyecto',
        {
          titulo: datos.titulo,
          estado: datos.estado,
          estado_proyecto: datos.estado_proyecto,
          presupuesto: datos.presupuesto,
          responsable: datos.responsable,
          solicitado,
          rol_creador: rol,
        }
      );

      this.submitted = true;

      // limpiamos imagen en memoria
      this.selectedImageFile = null;
      this.imagenPreview = null;
    } catch (err: any) {
      console.error('🔥 Error al enviar proyecto/sugerencia:', err);
      this.mostrarToast('Error al enviar la propuesta');
    } finally {
      this.cargando = false;
    }
  }

  // ============================
  // NUEVA SUGERENCIA / PROYECTO
  // ============================
  nuevaPropuesta() {
    this.form.reset({
      titulo: '',
      descripcion: '',
      responsable: '',
      presupuesto: '',
      fecha_inicio: null,
      fecha_fin: null,
      estado_proyecto: 'Planificación',
    });
    this.submitted = false;
    this.selectedImageFile = null;
    this.imagenPreview = null;
  }

  // ============================
  // REGRESAR AL INICIO
  // ============================
  volverAlInicio() {
    this.router.navigate(['/proyectos']);
  }

  goBack() {
    history.back();
  }

  irAAdminProyectos() {
    this.router.navigate(['/admin/proyectos']);
  }

  // ============================
  // Alertas y Toasts
  // ============================
  async mostrarToast(msg: string) {
    const toast = await this.toastCtrl.create({
      message: msg,
      duration: 2000,
      color: 'primary',
      position: 'top',
    });
    toast.present();
  }

  async showAlert(header: string, message: string) {
    const alert = await this.alertCtrl.create({
      header,
      message,
      buttons: ['OK'],
    });
    await alert.present();
  }
}
