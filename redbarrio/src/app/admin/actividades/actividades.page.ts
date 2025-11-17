// src/app/admin-actividades/actividades.page.ts (adaptado de proyectos)

import { Component, OnInit } from '@angular/core';
import {
  IonicModule,
  AlertController,
  ToastController,
  IonicSafeString,
} from '@ionic/angular';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SupabaseService } from 'src/app/services/supabase.service';
import { AuthService } from 'src/app/auth/auth.service';
import { Router } from '@angular/router';
import { addIcons } from 'ionicons';
import {
  chevronBackOutline,
  calendarOutline,
  peopleOutline,
  timeOutline,
  eyeOutline,
  addOutline,
  checkmarkCircleOutline,
  closeCircleOutline,
  calendarNumberOutline,
  documentTextOutline,
  settingsOutline,
  pauseCircleOutline,
  createOutline,
  trashOutline,
} from 'ionicons/icons';

@Component({
  standalone: true,
  selector: 'app-actividades',
  templateUrl: './actividades.page.html',
  styleUrls: ['./actividades.page.scss'],
  imports: [IonicModule, CommonModule, FormsModule],
})
export class ActividadesAdminPage implements OnInit {
  // ============================
  // ESTADO PRINCIPAL
  // ============================
  cargando = false;

  /** Actividades con estado "publicada" */
  actividadesPublicadas: any[] = [];

  /** Actividades con estado "pendiente" (sugerencias) */
  activityRequests: any[] = [];

  /** Tab principal: ver / crear */
  activeTab: 'manage' | 'create' = 'manage';

  /** Sub-tab dentro de manage */
  manageSubTab: 'active' | 'requests' = 'active';

  constructor(
    private supabase: SupabaseService,
    private toastCtrl: ToastController,
    private alertCtrl: AlertController,
    private auth: AuthService,
    private router: Router
  ) {
    addIcons({
      'chevron-back-outline': chevronBackOutline,
      'calendar-outline': calendarOutline,
      'people-outline': peopleOutline,
      'time-outline': timeOutline,
      'eye-outline': eyeOutline,
      'add-outline': addOutline,
      'checkmark-circle-outline': checkmarkCircleOutline,
      'close-circle-outline': closeCircleOutline,
      'calendar-number-outline': calendarNumberOutline,
      'document-text-outline': documentTextOutline,
      'settings-outline': settingsOutline,
      'pause-circle-outline': pauseCircleOutline,
      'create-outline': createOutline,
      'trash-outline': trashOutline,
    });
  }

  // ==========================================================
  // CARGA AUTOMÁTICA AL ENTRAR
  // ==========================================================
  async ngOnInit() {
    console.log('🚀 Entrando al módulo de actividades...');
    await this.cargarActividades();
  }

  async ionViewWillEnter() {
    console.log('🔄 Refrescando actividades al entrar...');
    await this.cargarActividades();
  }

  // ==========================================================
  // OBTENER ACTIVIDADES PUBLICADAS Y PENDIENTES
  // ==========================================================
  private async cargarActividades() {
    this.cargando = true;

    try {
      console.log(
        '📡 Cargando actividades publicadas y sugerencias pendientes...'
      );

      // Actividades publicadas
      const { data: publicadas, error: errorPublicadas } =
        await this.supabase.client
          .from('actividad')
          .select('*')
          .eq('estado', 'publicada')
          .order('creado_en', { ascending: false });

      if (errorPublicadas) {
        console.error(
          '❌ Error cargando actividades publicadas:',
          errorPublicadas
        );
        throw errorPublicadas;
      }

      // Actividades pendientes (sugerencias)
      const { data: pendientes, error: errorPendientes } =
        await this.supabase.client
          .from('actividad')
          .select('*')
          .eq('estado', 'pendiente')
          .order('creado_en', { ascending: false });

      if (errorPendientes) {
        console.error(
          '❌ Error cargando sugerencias de actividades:',
          errorPendientes
        );
        throw errorPendientes;
      }

      this.actividadesPublicadas = publicadas || [];
      this.activityRequests = pendientes || [];

      console.log('✅ Actividades publicadas:', this.actividadesPublicadas);
      console.log('✅ Sugerencias de actividades:', this.activityRequests);
    } catch (error) {
      console.error('❌ Error al cargar actividades:', error);
      this.mostrarToast('Error al cargar las actividades');
    } finally {
      this.cargando = false;
    }
  }

  // ==========================================================
  // HELPERS DE FORMATO
  // ==========================================================
  formatFecha(fechaIso?: string): string {
    if (!fechaIso) return '';
    const d = new Date(fechaIso);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString('es-CL', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  }

  formatFechaHora(fechaIso?: string): string {
    if (!fechaIso) return '';
    const d = new Date(fechaIso);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleString('es-CL', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  formatFechaActividad(fechaIso?: string): string {
    return this.formatFecha(fechaIso);
  }

  // ==========================================================
  // CAMBIO DE ESTADO GENÉRICO (actividad / sugerencia)
  // ==========================================================
  async cambiarEstadoGenerico(
    item: any,
    nuevoEstado: string,
    tipo: 'actividad' | 'sugerencia'
  ) {
    const esPublicar = nuevoEstado === 'publicada';

    const verbo =
      tipo === 'actividad'
        ? esPublicar
          ? 'publicar'
          : 'actualizar'
        : esPublicar
        ? 'aprobar'
        : 'rechazar';

    const etiqueta = tipo === 'actividad' ? 'actividad' : 'sugerencia';

    const alerta = await this.alertCtrl.create({
      header: `${verbo.charAt(0).toUpperCase() + verbo.slice(1)} ${etiqueta}`,
      message: `¿Seguro que deseas ${verbo} esta ${etiqueta}?`,
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Confirmar',
          handler: async () => {
            try {
              console.log(
                `🟦 Cambiando estado de ${item.id_actividad} (${etiqueta}) → ${nuevoEstado}`
              );

              const { error } = await this.supabase.client
                .from('actividad')
                .update({
                  estado: nuevoEstado,
                  actualizado_en: new Date().toISOString(),
                })
                .eq('id_actividad', item.id_actividad);

              if (error) {
                console.error(
                  '❌ Error Supabase al cambiar estado de actividad:',
                  error
                );
                throw error;
              }

              // Auditoría
              await this.supabase.registrarAuditoria(
                `${verbo} ${etiqueta}`,
                'actividad',
                {
                  titulo: item.titulo || '(sin título)',
                  id_actividad: item.id_actividad,
                  estado_anterior: item.estado,
                  nuevo_estado: nuevoEstado,
                  origen: tipo,
                }
              );

              const accionTexto =
                esPublicar && tipo === 'sugerencia'
                  ? 'aprobada'
                  : nuevoEstado === 'rechazada'
                  ? 'rechazada'
                  : 'actualizada';

              const tituloActividad = item.titulo || '(sin título)';
              const sujeto =
                tipo === 'actividad'
                  ? 'La actividad'
                  : 'La sugerencia de actividad';

              await this.mostrarAlertaAccion(
                'Acción realizada',
                `${sujeto} <strong>${tituloActividad}</strong> fue <strong>${accionTexto}</strong> satisfactoriamente.`
              );

              await this.cargarActividades();
            } catch (error) {
              console.error('❌ Error al actualizar estado:', error);
              await this.mostrarAlertaAccion(
                'Error',
                'Ocurrió un problema al actualizar el estado. Intenta nuevamente.'
              );
            }
          },
        },
      ],
    });

    await alerta.present();
  }

  // ==========================================================
  // USO EN ACTIVIDADES PUBLICADAS
  // ==========================================================
  async cambiarEstadoActividad(actividad: any, nuevoEstado: string) {
    await this.cambiarEstadoGenerico(actividad, nuevoEstado, 'actividad');
  }

  // ==========================================================
  // USO EN SUGERENCIAS (Aprobar / Rechazar)
  // ==========================================================
  async aprobarSugerencia(request: any) {
    await this.cambiarEstadoGenerico(request, 'publicada', 'sugerencia');
  }

  async rechazarSugerencia(request: any) {
    await this.cambiarEstadoGenerico(request, 'rechazada', 'sugerencia');
  }

  // ==========================================================
  // ELIMINAR ACTIVIDAD PUBLICADA
  // ==========================================================
  async eliminarActividad(actividad: any) {
    const titulo = (actividad?.titulo || '(sin título)').trim();

    const alerta = await this.alertCtrl.create({
      header: 'Eliminar actividad',
      message: `¿Seguro que deseas eliminar la actividad "${titulo}"? Esta acción no se puede deshacer.`,
      mode: 'ios',
      cssClass: 'rb-confirm-alert',
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Eliminar',
          role: 'destructive',
          handler: async () => {
            try {
              console.log(
                '🗑 Eliminando actividad id_actividad=',
                actividad.id_actividad
              );

              const { error } = await this.supabase.client
                .from('actividad')
                .delete()
                .eq('id_actividad', actividad.id_actividad);

              if (error) {
                console.error(
                  '❌ Error Supabase al eliminar actividad:',
                  error
                );
                throw error;
              }

              await this.supabase.registrarAuditoria(
                'eliminar actividad',
                'actividad',
                {
                  titulo,
                  id_actividad: actividad.id_actividad,
                  estado_anterior: actividad.estado,
                  nuevo_estado: 'eliminada',
                }
              );

              await this.mostrarAlertaAccion(
                'Acción realizada',
                `La actividad <strong>${titulo}</strong> fue <strong>eliminada</strong> satisfactoriamente.`
              );

              await this.cargarActividades();
            } catch (err) {
              console.error('❌ Error al eliminar la actividad:', err);
              await this.mostrarAlertaAccion(
                'Error',
                'Ocurrió un problema al eliminar la actividad.'
              );
            }
          },
        },
      ],
    });

    await alerta.present();
  }

  // ==========================================================
  // REFRESHER
  // ==========================================================
  async refrescar(event: any) {
    await this.cargarActividades();
    event.target.complete();
  }

  // ==========================================================
  // TOAST SIMPLE
  // ==========================================================
  async mostrarToast(mensaje: string) {
    const toast = await this.toastCtrl.create({
      message: mensaje,
      duration: 2000,
      color: 'primary',
      position: 'top',
    });
    await toast.present();
  }

  // ==========================================================
  // UI HELPERS (TABS / NAVEGACIÓN)
  // ==========================================================
  setManageSubTab(tab: 'active' | 'requests') {
    this.manageSubTab = tab;
  }

  irAGenerarActividad() {
    // Ajusta la ruta según como la tengas definida
    this.router.navigate(['admin/actividades/crear-actividad']);
  }

  // ==========================================================
  // ESTADO DE LA ACTIVIDAD (chip)
  // ==========================================================
  getEstadoActividadLabel(estado?: string): string {
    const e = (estado || '').toLowerCase().trim();

    if (e.includes('pend')) return 'Pendiente';
    if (e.includes('rech')) return 'Rechazada';
    return 'Publicada';
  }

  getEstadoActividadClass(estado?: string): string {
    const e = (estado || '').toLowerCase().trim();

    if (e.includes('pend')) return 'status-pendiente';
    if (e.includes('rech')) return 'status-rechazada';
    return 'status-publicada';
  }

  getEstadoActividadIcon(estado?: string): string {
    const e = (estado || '').toLowerCase().trim();

    if (e.includes('pend')) return 'time-outline';
    if (e.includes('rech')) return 'close-circle-outline';
    return 'checkmark-circle-outline';
  }

  // Botón EDITAR (admin)
  editarActividad(actividad: any) {
    const id = actividad.id_actividad ?? actividad.id;

    if (!id) {
      console.warn('⚠️ Actividad sin id válido:', actividad);
      return;
    }

    // Ajusta la ruta al formulario de edición de actividades
    this.router.navigate(['/admin/actividades/editar', id]);
  }

  // ==========================================================
  // ALERTA DE CONFIRMACIÓN DE ACCIÓN (estilo modal bonito)
  // ==========================================================
  async mostrarAlertaAccion(titulo: string, mensajeHtml: string) {
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
}
