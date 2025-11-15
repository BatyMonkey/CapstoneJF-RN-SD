// src/app/proyectos/proyectos.page.ts

import { Component, OnInit } from '@angular/core';
import { IonicModule, AlertController, ToastController } from '@ionic/angular';
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
  cashOutline,
  closeCircleOutline,
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

  // (quedan por si quieres reutilizarlos luego)
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
      'cash-outline': cashOutline,
      'close-circle-outline': closeCircleOutline,
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

      // Proyectos pendientes (solicitudes de publicación)
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

      // Por compatibilidad, si quieres seguir usando this.proyectos:
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
  // HELPERS DE FORMATO (FRONT)
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
  private async cambiarEstadoGenerico(
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

              // Ambas (proyectos y solicitudes) viven en la tabla "proyecto"
              const result = await this.supabase.cambiarEstadoProyecto(
                item.id_proyecto,
                nuevoEstado
              );

              console.log('✅ Resultado de Supabase:', result);

              // 🧾 Registrar acción en auditoría
              await this.supabase.registrarAuditoria(
                `${verbo} ${etiqueta}`,
                'proyecto',
                {
                  titulo: item.titulo || '(sin título)',
                  id_proyecto: item.id_proyecto,
                  estado_anterior: item.estado,
                  nuevo_estado: nuevoEstado,
                  origen: tipo, // opcional
                }
              );

              // 🔔 Modal de confirmación con estética de alerta
              await this.mostrarConfirmacionAccion(tipo, item.titulo, verbo);

              // Recarga listas (activos + solicitudes)
              await this.cargarProyectos();
            } catch (error) {
              console.error('❌ Error al actualizar estado:', error);
              await this.mostrarToast('Error al actualizar el estado');
            }
          },
        },
      ],
    });

    await alerta.present();
  }

  // ==========================================================
  // USO EN PROYECTOS ACTIVOS (por ejemplo botón Eliminar)
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

  async rechazarSolicitud(request: any) {
    await this.cambiarEstadoGenerico(request, 'rechazada', 'solicitud');
  }

  // ==========================================================
  // REFRESHER
  // ==========================================================
  async refrescar(event: any) {
    await this.cargarProyectos();
    event.target.complete();
  }

  // ==========================================================
  // TOAST
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
    // Si quieres usar Router: this.router.navigate(['/gestiones']);
    history.back();
  }

  irAGenerarProyecto() {
    // Ajusta la ruta según tu routing real
    this.router.navigate(['generar/proyecto']);
  }
  // Formatea el presupuesto numérico como $3.500.000
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
  /**
   * Muestra un modal de confirmación con estética de alerta:
   * "El proyecto X fue rechazado satisfactoriamente"
   */
  private async mostrarConfirmacionAccion(
    tipo: 'proyecto' | 'solicitud',
    titulo: string,
    verbo: string
  ) {
    const accionPasado = this.getAccionPasado(verbo);

    const sujeto =
      tipo === 'proyecto' ? 'El proyecto' : 'La solicitud del proyecto';

    const nombre = (titulo || '(sin título)').trim();

    const alerta = await this.alertCtrl.create({
      header: 'Acción realizada',
      // 👇 Mensaje sin etiquetas HTML
      message: `${sujeto} "${nombre}" fue ${accionPasado} satisfactoriamente.`,
      buttons: [
        {
          text: 'Cerrar',
          role: 'cancel',
        },
      ],
    });

    await alerta.present();
  }

  private getAccionDesdeEstado(estado: string): string {
    switch (estado) {
      case 'publicada':
        return 'publicado';
      case 'rechazada':
        return 'rechazado';
      case 'aprobada':
        return 'aprobado';
      default:
        return estado || 'actualizado';
    }
  }
  /** Convierte el verbo a pasado: publicar -> publicado, aprobar -> aprobado, etc. */
  private getAccionPasado(verbo: string): string {
    switch (verbo) {
      case 'publicar':
        return 'publicado';
      case 'aprobar':
        return 'aprobado';
      case 'rechazar':
        return 'rechazado';
      default:
        return 'actualizado';
    }
  }
  // Mapea estado_proyecto (texto de BD) a clases de color del pill
  getEstadoProyectoClase(estado?: string | null): string {
    if (!estado) {
      return 'status-in-progress';
    }

    const e = estado.toLowerCase();

    if (e.includes('plan')) return 'status-planning';
    if (e.includes('progreso')) return 'status-in-progress';
    if (e.includes('complet') || e.includes('finaliz'))
      return 'status-completed';
    if (e.includes('paus')) return 'status-paused';

    return 'status-planning';
  }

  // Botón EDITAR (placeholder: aquí rediriges al formulario de edición)
  editarProyecto(proyecto: any) {
    console.log('✏️ Editar proyecto', proyecto);
    // ejemplo: this.router.navigate(['editar/proyecto', proyecto.id_proyecto]);
  }

  // Botón ELIMINAR de proyectos activos
  rechazarProyecto(proyecto: any) {
    this.cambiarEstadoGenerico(proyecto, 'rechazada', 'proyecto');
  }
}
