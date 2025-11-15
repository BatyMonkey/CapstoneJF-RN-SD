import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule, ToastController, AlertController } from '@ionic/angular';
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
  sendOutline,
  bulbOutline,
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

  // Imagen
  selectedFile: File | null = null;
  previewUrl: string | null = null;
  uploadedUrl: string | null = null;

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
      'send-outline': sendOutline,
      'bulb-outline': bulbOutline,
    });
  }

  async ngOnInit() {
    // Primero obtenemos el perfil para saber si es admin
    this.perfil = await this.auth.miPerfil();
    console.log('🟦 Perfil cargado:', this.perfil);

    const fechaValidators = this.esAdmin ? [Validators.required] : [];

    this.form = this.fb.group({
      titulo: ['', [Validators.required, Validators.minLength(3)]],
      descripcion: ['', [Validators.required, Validators.minLength(10)]],
      responsable: [''],
      presupuesto: [''],
      fecha_inicio: [null, fechaValidators],
      fecha_fin: [null, fechaValidators],
      estado_proyecto: ['Planificación', Validators.required],
    });
  }

  // ============================
  // MANEJO DE IMAGEN
  // ============================
  async onFileSelected(event: any) {
    const file = event.target.files[0];
    if (!file) return;

    this.selectedFile = file;

    // Preview local
    const reader = new FileReader();
    reader.onload = () => (this.previewUrl = reader.result as string);
    reader.readAsDataURL(file);

    // Subir a Supabase Storage (bucket "proyectos")
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

  // ============================
  // ENVIAR PROYECTO
  // ============================
  async enviar() {
    if (this.form.invalid) {
      this.mostrarToast('Completa todos los campos obligatorios');
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

      // Estado automático según rol
      const estado = rol === 'administrador' ? 'publicada' : 'pendiente';

      const presupuestoValor = this.form.value.presupuesto;
      const presupuesto =
        presupuestoValor !== null &&
        presupuestoValor !== undefined &&
        presupuestoValor !== ''
          ? Number(presupuestoValor)
          : null;

      const datos = {
        id_auth,
        titulo: this.form.value.titulo,
        descripcion: this.form.value.descripcion,
        estado,
        fecha_creacion: new Date().toISOString(),
        actualizado_en: new Date().toISOString(),
        imagen_url: this.uploadedUrl || null,
        estado_proyecto: this.form.value.estado_proyecto || 'Planificación',
        presupuesto,
        responsable: this.form.value.responsable || null,
        solicitado: null, // ya no usamos categoría
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
        'crear sugerencia proyecto',
        'proyecto',
        {
          titulo: datos.titulo,
          presupuesto: datos.presupuesto,
          estado,
          estado_proyecto: datos.estado_proyecto,
          rol_creador: rol,
        }
      );

      this.submitted = true;
    } catch (err: any) {
      console.error('🔥 Error al enviar sugerencia:', err);
      this.mostrarToast('Error al enviar la propuesta');
    } finally {
      this.cargando = false;
    }
  }

  // ============================
  // NUEVA SUGERENCIA
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
    this.previewUrl = null;
    this.uploadedUrl = null;
    this.selectedFile = null;
    this.submitted = false;
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
