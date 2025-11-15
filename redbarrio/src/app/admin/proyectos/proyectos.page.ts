// src/app/proyectos/proyectos.page.ts

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
import { addIcons } from 'ionicons';
import { Router } from '@angular/router';
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
} from 'ionicons/icons';

@Component({
  standalone: true,
  selector: 'app-proyectos',
  templateUrl: './proyectos.page.html',
  styleUrls: ['./proyectos.page.scss'],
  imports: [IonicModule, CommonModule, FormsModule],
})
export class ProyectosPage implements OnInit {
  // ============================
  // ESTADO PRINCIPAL
  // ============================
  cargando = false;

  /** Proyectos con estado "publicada" */
  proyectosActivos: any[] = [];

  /** Proyectos con estado "pendiente" (solicitudes) */
  projectRequests: any[] = [];

  /** Tab principal: ver / crear */
  activeTab: 'manage' | 'create' = 'manage';

  /** Sub-tab dentro de manage */
  manageSubTab: 'active' | 'requests' = 'active';

  /** Compatibilidad con código antiguo (lista usada en algunos métodos) */
  proyectos: any[] = [];
  filtroActivo: 'todos' | 'proyecto' | 'actividad' = 'todos';

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
      'briefcase-outline': briefcaseOutline,
      'people-outline': peopleOutline,
      'time-outline': timeOutline,
      'eye-outline': eyeOutline,
      'add-outline': addOutline,
      'checkmark-circle-outline': checkmarkCircleOutline,
      'close-circle-outline': closeCircleOutline,
      'cash-outline': cashOutline,
      'calendar-number-outline': calendarNumberOutline,

      // 🔹 Estados de proyecto
      'document-text-outline': documentTextOutline, // Planificación
      'settings-outline': settingsOutline, // En Progreso
      'pause-circle-outline': pauseCircleOutline, // Pausado
      'create-outline': createOutline,
      'trash-outline': trashOutline,
    });
  }

  // ==========================================================
  // CARGA AUTOMÁTICA AL ENTRAR
  // ==========================================================
  async ngOnInit() {
    console.log('🚀 Entrando al módulo de proyectos...');
    await this.cargarProyectos();
  }

  async ionViewWillEnter() {
    console.log('🔄 Refrescando proyectos al entrar...');
    await this.cargarProyectos();
  }

  // ==========================================================
  // OBTENER PROYECTOS PUBLICADOS Y PENDIENTES
  // ==========================================================
  private async cargarProyectos() {
    this.cargando = true;

    try {
      console.log(
        '📡 Cargando proyectos activos (publicados) y solicitudes...'
      );

      // Proyectos activos (estado = 'publicada')
      const { data: activos, error: errorActivos } = await this.supabase.client
        .from('proyecto')
        .select('*')
        .eq('estado', 'publicada')
        .order('fecha_creacion', { ascending: false });

      if (errorActivos) {
        console.error('❌ Error cargando proyectos activos:', errorActivos);
        throw errorActivos;
      }

      // Proyectos pendientes (solicitudes)
      const { data: pendientes, error: errorPendientes } =
        await this.supabase.client
          .from('proyecto')
          .select('*')
          .eq('estado', 'pendiente')
          .order('fecha_creacion', { ascending: false });

      if (errorPendientes) {
        console.error(
          '❌ Error cargando solicitudes de proyectos:',
          errorPendientes
        );
        throw errorPendientes;
      }

      this.proyectosActivos = activos || [];
      this.projectRequests = pendientes || [];

      // compatibilidad
      this.proyectos = this.proyectosActivos;

      console.log('✅ Proyectos activos:', this.proyectosActivos);
      console.log('✅ Solicitudes de proyectos:', this.projectRequests);
    } catch (error) {
      console.error('❌ Error al cargar proyectos:', error);
      this.mostrarToast('Error al cargar los proyectos');
    } finally {
      this.cargando = false;
    }
  }

  // ==========================================================
  // HELPERS DE FORMATO BÁSICO (por si más adelante los usas)
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

  getCuposTexto(p: any): string {
    if (!p.cupos_total) return '';
    const ocupados = p.cupos_ocupados || 0;
    const disponibles = p.cupos_total - ocupados;
    return `Cupos: ${disponibles} / ${p.cupos_total} disponibles`;
  }

  getOcupacionPorcentaje(p: any): number {
    if (!p.cupos_total || p.cupos_total <= 0) return 0;
    const ocupados = p.cupos_ocupados || 0;
    return Math.min(100, Math.max(0, (ocupados / p.cupos_total) * 100));
  }

  getBarClass(p: any): string {
    const pct = this.getOcupacionPorcentaje(p);
    return pct > 80 ? 'ocupacion-fill danger' : 'ocupacion-fill ok';
  }

  // ==========================================================
  // CAMBIO DE ESTADO GENÉRICO (proyecto / solicitud)
  // ==========================================================
  async cambiarEstadoGenerico(
    item: any,
    nuevoEstado: string,
    tipo: 'proyecto' | 'solicitud'
  ) {
    const esPublicar = nuevoEstado === 'publicada';

    const verbo =
      tipo === 'proyecto'
        ? esPublicar
          ? 'publicar'
          : 'rechazar'
        : esPublicar
        ? 'aprobar'
        : 'rechazar';

    const etiqueta = tipo === 'proyecto' ? 'proyecto' : 'solicitud';

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
                `🟦 Cambiando estado de ${item.id_proyecto} (${etiqueta}) → ${nuevoEstado}`
              );

              // 👇 aquí el cambio: sin destructuring de { error }
              const result = await this.supabase.cambiarEstadoProyecto(
                item.id_proyecto,
                nuevoEstado
              );
              console.log('✅ Resultado de Supabase:', result);

              // Auditoría
              await this.supabase.registrarAuditoria(
                `${verbo} ${etiqueta}`,
                'proyecto',
                {
                  titulo: item.titulo || '(sin título)',
                  id_proyecto: item.id_proyecto,
                  estado_anterior: item.estado,
                  nuevo_estado: nuevoEstado,
                  origen: tipo,
                }
              );

              const accionTexto =
                verbo === 'aprobar'
                  ? 'aprobado'
                  : verbo === 'rechazar'
                  ? 'rechazado'
                  : 'actualizado';

              const tituloProyecto = item.titulo || '(sin título)';
              const sujeto =
                tipo === 'proyecto'
                  ? 'El proyecto'
                  : 'La solicitud del proyecto';

              await this.mostrarAlertaAccion(
                'Acción realizada',
                `${sujeto} <strong>${tituloProyecto}</strong> fue <strong>${accionTexto}</strong> satisfactoriamente.`
              );

              await this.cargarProyectos();
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
  // USO EN PROYECTOS ACTIVOS (wrapper por si lo usas)
  // ==========================================================
  async cambiarEstado(proyecto: any, nuevoEstado: string) {
    await this.cambiarEstadoGenerico(proyecto, nuevoEstado, 'proyecto');
  }

  // ==========================================================
  // USO EN SOLICITUDES (botones Aprobar / Rechazar)
  // ==========================================================
  async aprobarSolicitud(request: any) {
    await this.cambiarEstadoGenerico(request, 'publicada', 'solicitud');
  }

  // Botón RECHAZAR de solicitudes (elimina el registro)
  async rechazarSolicitud(request: any) {
    const titulo = (request?.titulo || '(sin título)').trim();

    const alerta = await this.alertCtrl.create({
      header: 'Rechazar solicitud',
      message: `¿Seguro que deseas rechazar y eliminar la solicitud del proyecto "${titulo}"?`,
      mode: 'ios',
      cssClass: 'rb-confirm-alert',
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Confirmar',
          handler: async () => {
            try {
              console.log(
                '🟥 Eliminando solicitud id_proyecto=',
                request.id_proyecto
              );

              const { error } = await this.supabase.client
                .from('proyecto')
                .delete()
                .eq('id_proyecto', request.id_proyecto);

              if (error) {
                console.error(
                  '❌ Error Supabase al eliminar solicitud:',
                  error
                );
                throw error;
              }

              await this.supabase.registrarAuditoria(
                'eliminar solicitud',
                'proyecto',
                {
                  titulo,
                  id_proyecto: request.id_proyecto,
                  origen: 'solicitud',
                }
              );

              await this.mostrarAlertaAccion(
                'Acción realizada',
                `La solicitud del proyecto <strong>${titulo}</strong> fue <strong>rechazada</strong> y eliminada satisfactoriamente.`
              );

              await this.cargarProyectos();
            } catch (err) {
              console.error('❌ Error al eliminar la solicitud:', err);
              await this.mostrarAlertaAccion(
                'Error',
                'Ocurrió un problema al eliminar la solicitud. Intenta nuevamente.'
              );
            }
          },
        },
      ],
    });

    await alerta.present();
  }

  // ==========================================================
  // ELIMINAR PROYECTO ACTIVO
  // ==========================================================
  async rechazarProyecto(proyecto: any) {
    const titulo = (proyecto?.titulo || '(sin título)').trim();

    const alerta = await this.alertCtrl.create({
      header: 'Eliminar proyecto',
      message: `¿Seguro que deseas eliminar el proyecto "${titulo}"? Esta acción no se puede deshacer.`,
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
                '🗑 Eliminando proyecto id_proyecto=',
                proyecto.id_proyecto
              );

              const { error } = await this.supabase.client
                .from('proyecto')
                .delete()
                .eq('id_proyecto', proyecto.id_proyecto);

              if (error) {
                console.error('❌ Error Supabase al eliminar proyecto:', error);
                throw error;
              }

              await this.supabase.registrarAuditoria(
                'eliminar proyecto',
                'proyecto',
                {
                  titulo,
                  id_proyecto: proyecto.id_proyecto,
                  estado_anterior: proyecto.estado,
                  nuevo_estado: 'eliminado',
                }
              );

              await this.mostrarAlertaAccion(
                'Acción realizada',
                `El proyecto <strong>${titulo}</strong> fue <strong>eliminado</strong> satisfactoriamente.`
              );

              await this.cargarProyectos();
            } catch (err) {
              console.error('❌ Error al eliminar proyecto:', err);
              await this.mostrarAlertaAccion(
                'Error',
                'Ocurrió un problema al eliminar el proyecto.'
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
    await this.cargarProyectos();
    event.target.complete();
  }

  // ==========================================================
  // TOAST SIMPLE (ya casi no lo usamos, pero lo dejo)
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

  goBack() {
    history.back();
  }

  irAGenerarProyecto() {
    this.router.navigate(['generar/proyecto']);
  }

  // ==========================================================
  // FORMATO PRESUPUESTO (input numérico simple)
  // ==========================================================
  formatPresupuesto(valor: any): string {
    if (valor === null || valor === undefined || valor === '') {
      return '';
    }

    const numero = Number(valor);
    if (isNaN(numero)) {
      return String(valor);
    }

    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      maximumFractionDigits: 0,
    }).format(numero);
  }

  // ==========================================================
  // ESTADO DEL PROYECTO (chip amarillo)
  // ==========================================================
  getEstadoProyectoLabel(estado?: string): string {
    const e = (estado || '').toLowerCase().trim();

    if (e.includes('progreso')) return 'En Progreso';
    if (e.includes('complet')) return 'Completado';
    if (e.includes('paus')) return 'Pausado';
    if (e.includes('plan')) return 'Planificación';

    return 'Planificación';
  }

  /** Formato de presupuesto para tarjetas (activos / solicitudes) */
  getPresupuestoProyecto(p: any): string {
    if (p.presupuesto_est || p.presupuesto) {
      const valor = Number(p.presupuesto_est ?? p.presupuesto);
      if (!isNaN(valor)) {
        return new Intl.NumberFormat('es-CL', {
          style: 'currency',
          currency: 'CLP',
          maximumFractionDigits: 0,
        }).format(valor);
      }
      return p.presupuesto_est ?? p.presupuesto;
    }

    if (p.monto) {
      const valor = Number(p.monto);
      if (!isNaN(valor)) {
        return new Intl.NumberFormat('es-CL', {
          style: 'currency',
          currency: 'CLP',
          maximumFractionDigits: 0,
        }).format(valor);
      }
      return p.monto;
    }

    return 'Presupuesto por definir';
  }

  getEstadoProyectoClass(estado?: string): string {
    const e = (estado || '').toLowerCase().trim();

    if (e.includes('progreso')) return 'status-en-progreso';
    if (e.includes('complet')) return 'status-completado';
    if (e.includes('paus')) return 'status-pausado';
    if (e.includes('plan')) return 'status-planificacion';

    return 'status-planificacion';
  }

  // Fechas inicio / fin del proyecto (gris bajo presupuesto)
  formatFechaProyecto(fechaIso?: string): string {
    if (!fechaIso) return '';
    const d = new Date(fechaIso);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString('es-CL', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  }

  // Formato numérico simple (3.500.000)
  formatNumero(valor: any): string {
    if (valor === null || valor === undefined) return '';

    const num =
      typeof valor === 'number'
        ? valor
        : parseFloat(valor.toString().replace(/\./g, '').replace(/,/g, '.'));

    if (isNaN(num)) return valor.toString();

    return num.toLocaleString('es-CL');
  }

  getEstadoProyectoIcon(estado?: string): string {
    const e = (estado || '').toLowerCase().trim();

    if (e.includes('progreso')) return 'settings-outline';
    if (e.includes('complet')) return 'checkmark-circle-outline';
    if (e.includes('paus')) return 'pause-circle-outline';
    if (e.includes('plan')) return 'document-text-outline';

    return 'document-text-outline';
  }

  // Botón EDITAR
  editarProyecto(proyecto: any) {
    // Tomamos el id desde id_proyecto o id, según venga de Supabase
    const id = proyecto.id_proyecto ?? proyecto.id;

    if (!id) {
      console.warn('⚠️ Proyecto sin id válido:', proyecto);
      return;
    }

    // Navegar a /admin/proyectos/editar/:id
    this.router.navigate(['/admin/proyectos/editar', id]);
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
