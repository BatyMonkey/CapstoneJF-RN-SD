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
import { ActivatedRoute, Router } from '@angular/router';

import { SupabaseService } from 'src/app/services/supabase.service';
import { addIcons } from 'ionicons';
import {
  chevronBackOutline,
  saveOutline,
  trashOutline,
  alertCircleOutline,
  checkmarkCircleOutline,
  calendarOutline,
  peopleOutline,
  cashOutline,
} from 'ionicons/icons';

@Component({
  standalone: true,
  selector: 'app-editar-proyecto',
  templateUrl: './editar-proyecto.page.html',
  styleUrls: ['./editar-proyecto.page.scss'],
  imports: [CommonModule, IonicModule, ReactiveFormsModule],
})
export class EditarProyectoPage implements OnInit {
  form!: FormGroup;

  /** ID que viene por la ruta /admin/proyectos/editar/:id */
  proyectoId!: string;

  /** Proyecto completo para usar en el HTML: proyecto?.participantes, proyecto?.id, proyecto?.titulo */
  proyecto: any = null;

  /** Estados de UI */
  cargando = false;
  saved = false;             // *ngIf="saved"
  showDeleteConfirm = false; // *ngIf="showDeleteConfirm"

  /** Lista de estados con emojis para el <select> */
  estados = [
    { value: 'planificacion', label: '📋 Planificación' },
    { value: 'en-progreso', label: '⚙️ En Progreso' },
    { value: 'completado', label: '✅ Completado' },
    { value: 'cancelado', label: '⛔ Cancelado' },
  ];

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private fb: FormBuilder,
    private supabaseService: SupabaseService,
    private toastCtrl: ToastController,
    private alertCtrl: AlertController
  ) {
    addIcons({
      'chevron-back-outline': chevronBackOutline,
      'save-outline': saveOutline,
      'trash-outline': trashOutline,
      'alert-circle-outline': alertCircleOutline,
      'checkmark-circle-outline': checkmarkCircleOutline,
      'calendar-outline': calendarOutline,
      'people-outline': peopleOutline,
      'cash-outline': cashOutline,
    });
  }

  ngOnInit() {
    this.form = this.fb.group({
      titulo: ['', [Validators.required, Validators.minLength(3)]],
      // Control interno se llama estado_proyecto, y en BD también es estado_proyecto
      estado_proyecto: ['planificacion', Validators.required],
      descripcion: ['', [Validators.required, Validators.minLength(10)]],
      responsable: ['', Validators.required],
      fecha_inicio: ['', Validators.required],
      fecha_fin: [''],
      presupuesto: [''],
      // lo dejamos en el form por si el template lo usa
      objetivos: [''],
    });

    this.proyectoId = this.route.snapshot.paramMap.get('id') ?? '';
    if (!this.proyectoId) {
      console.warn('⚠️ No se recibió id de proyecto en la ruta');
      this.router.navigate(['/admin/proyectos']);
      return;
    }

    this.cargarProyecto();
  }

  // =========================
  // CARGAR PROYECTO DESDE SUPABASE
  // =========================
  async cargarProyecto() {
    this.cargando = true;
    try {
      const { data, error } = await this.supabaseService.client
        .from('proyecto')
        .select('*')
        .eq('id_proyecto', this.proyectoId)
        .single();

      if (error) throw error;
      if (!data) {
        await this.mostrarAlert(
          'Proyecto no encontrado',
          'No se encontró información para este proyecto.'
        );
        this.router.navigate(['/admin/proyectos']);
        return;
      }

      // Guardamos el proyecto completo
      this.proyecto = {
        ...data,
        id: data.id ?? data.id_proyecto,
      };

      // Mapear columna BD estado_proyecto → value del select
      const estadoForm = this.mapEstadoDbToForm(data.estado_proyecto);

      this.form.patchValue({
        titulo: data.titulo ?? '',
        estado_proyecto: estadoForm || 'planificacion',
        descripcion: data.descripcion ?? '',
        responsable: data.responsable ?? '',
        fecha_inicio: data.fecha_inicio
          ? String(data.fecha_inicio).substring(0, 10)
          : '',
        fecha_fin: data.fecha_fin
          ? String(data.fecha_fin).substring(0, 10)
          : '',
        presupuesto: data.presupuesto ?? '',
        objetivos: data.objetivos
          ? Array.isArray(data.objetivos)
            ? data.objetivos.join('\n')
            : String(data.objetivos)
          : '',
      });

      console.log('📥 Proyecto cargado para edición:', data);
    } catch (err) {
      console.error('🔥 Error al cargar proyecto:', err);
      this.mostrarToast('No se pudo cargar el proyecto');
    } finally {
      this.cargando = false;
    }
  }

  // =========================
  // GUARDAR CAMBIOS (ngSubmit)
  // =========================
  async guardarCambios() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.mostrarToast('Completa todos los campos obligatorios');
      return;
    }

    this.cargando = true;

    try {
      const valores = this.form.value;

      // Value del select → texto que se guarda en BD (estado_proyecto)
      const estadoDb = this.mapEstadoFormToDb(valores.estado_proyecto);

      const payload: any = {
        titulo: valores.titulo,
        descripcion: valores.descripcion,
        responsable: valores.responsable,
        fecha_inicio: valores.fecha_inicio || null,
        fecha_fin: valores.fecha_fin || null,
        presupuesto: valores.presupuesto || null,
        estado_proyecto: estadoDb, // 👈 columna real en BD
        actualizado_en: new Date().toISOString(),
      };

      console.log('📤 Actualizando proyecto →', payload);

      const { error } = await this.supabaseService.client
        .from('proyecto')
        .update(payload)
        .eq('id_proyecto', this.proyectoId);

      if (error) {
        console.error('🔥 Supabase update error:', error);
        throw error;
      }

      // Actualizar objeto local
      this.proyecto = {
        ...this.proyecto,
        ...payload,
      };

      // Auditoría
      await this.supabaseService.registrarAuditoria(
        'editar proyecto',
        'proyecto',
        {
          id_proyecto: this.proyectoId,
          titulo: payload.titulo,
          estado_proyecto: payload.estado_proyecto,
        }
      );

      this.saved = true;
      this.mostrarToast('Cambios guardados correctamente');

      setTimeout(() => {
        this.saved = false;
      }, 3000);
    } catch (err: any) {
      console.error('🔥 Error al guardar cambios:', err);
      const detalle =
        err?.message || err?.error_description || err?.hint || '';
      this.mostrarToast(
        detalle
          ? `Error al guardar los cambios: ${detalle}`
          : 'Error al guardar los cambios'
      );
    } finally {
      this.cargando = false;
    }
  }

  // =========================
  // ELIMINAR PROYECTO
  // =========================
  abrirConfirmarEliminar() {
    this.showDeleteConfirm = true;
  }

  cerrarConfirmarEliminar() {
    this.showDeleteConfirm = false;
  }

  async eliminarProyecto() {
    const confirmar = await this.mostrarAlertConfirm(
      '¿Eliminar proyecto?',
      `Esta acción no se puede deshacer. Se eliminará el proyecto "${
        this.proyecto?.titulo ?? this.form.value.titulo
      }".`
    );

    if (!confirmar) return;

    this.cargando = true;

    try {
      const { error } = await this.supabaseService.client
        .from('proyecto')
        .delete()
        .eq('id_proyecto', this.proyectoId);

      if (error) throw error;

      await this.supabaseService.registrarAuditoria(
        'eliminar proyecto',
        'proyecto',
        {
          id_proyecto: this.proyectoId,
          titulo: this.proyecto?.titulo ?? this.form.value.titulo,
        }
      );

      this.mostrarToast('Proyecto eliminado');
      this.showDeleteConfirm = false;
      this.router.navigate(['/admin/proyectos']);
    } catch (err) {
      console.error('🔥 Error al eliminar proyecto:', err);
      this.mostrarToast('No se pudo eliminar el proyecto');
    } finally {
      this.cargando = false;
    }
  }

  // =========================
  // NAVEGACIÓN
  // =========================
  goBack() {
    this.router.navigate(['/admin/proyectos']);
  }

  // =========================
  // MAPEOS ESTADO (BD <-> FORM)
  // =========================

  /** BD → value del select */
  private mapEstadoDbToForm(estado: any): string {
    if (!estado) return 'planificacion';
    const raw = String(estado).toLowerCase().trim();

    switch (raw) {
      case 'planificación':
      case 'planificacion':
      case '📋 planificación':
        return 'planificacion';

      case 'en progreso':
      case 'en-progreso':
      case '⚙️ en progreso':
        return 'en-progreso';

      case 'completado':
      case '✅ completado':
        return 'completado';

      case 'cancelado':
      case '⛔ cancelado':
        return 'cancelado';

      default:
        return 'planificacion';
    }
  }

  /** value del select → texto que se guarda en BD (estado_proyecto) */
  private mapEstadoFormToDb(value: string): string {
    switch (value) {
      case 'planificacion':
        return 'Planificación';
      case 'en-progreso':
        return 'En Progreso';
      case 'completado':
        return 'Completado';
      case 'cancelado':
        return 'Cancelado';
      default:
        return 'Planificación';
    }
  }

  // =========================
  // TOASTS / ALERTAS
  // =========================
  private async mostrarToast(message: string) {
    const toast = await this.toastCtrl.create({
      message,
      duration: 2500,
      position: 'top',
      cssClass: 'rb-toast-solid', // Asegúrate de tener esta clase en global.scss
    });
    await toast.present();
  }

  private async mostrarAlert(header: string, message: string) {
    const alert = await this.alertCtrl.create({
      header,
      message,
      buttons: ['OK'],
    });
    await alert.present();
  }

  private async mostrarAlertConfirm(
    header: string,
    message: string
  ): Promise<boolean> {
    return new Promise(async (resolve) => {
      const alert = await this.alertCtrl.create({
        header,
        message,
        buttons: [
          {
            text: 'Cancelar',
            role: 'cancel',
            handler: () => resolve(false),
          },
          {
            text: 'Eliminar',
            role: 'destructive',
            handler: () => resolve(true),
          },
        ],
      });

      await alert.present();
    });
  }
}
