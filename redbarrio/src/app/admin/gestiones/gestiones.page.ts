// src/app/gestiones/gestiones.page.ts

import { Component } from '@angular/core';
import { IonicModule } from '@ionic/angular';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';

import { addIcons } from 'ionicons';
import {
  shieldCheckmarkOutline,
  briefcaseOutline,
  checkboxOutline,
  newspaperOutline,
  peopleOutline,
  calendarOutline,
  searchOutline,
  clipboardOutline,
  chevronBackOutline,
} from 'ionicons/icons';

import { SupabaseService } from 'src/app/services/supabase.service';

@Component({
  standalone: true,
  selector: 'app-gestiones',
  templateUrl: './gestiones.page.html',
  styleUrls: ['./gestiones.page.scss'],
  imports: [IonicModule, CommonModule, RouterModule],
})
export class GestionesPage {
  // 🔹 Estadísticas dinámicas
  solicitudesPendientes = 0;
  proyectosActivos = 0;
  eventosEsteMes = 0;
  vecinosRegistrados = 0;

  constructor(
    private router: Router,
    private supabaseService: SupabaseService
  ) {
    addIcons({
      'shield-checkmark-outline': shieldCheckmarkOutline,
      'briefcase-outline': briefcaseOutline,
      'checkbox-outline': checkboxOutline,
      'newspaper-outline': newspaperOutline,
      'people-outline': peopleOutline,
      'calendar-outline': calendarOutline,
      'search-outline': searchOutline,
      'clipboard-outline': clipboardOutline,
      'chevron-back-outline': chevronBackOutline,
    });
  }

  /** Se ejecuta cuando se vuelve a esta vista, incluso con gesto Android */
  ionViewDidEnter() {
    // Cargar estadísticas cada vez que entras
    this.cargarEstadisticas();

    // Reset visual de botones (lo que ya tenías)
    setTimeout(() => this.resetButtonsVisualState(), 80);
  }

  private resetButtonsVisualState() {
    const buttons = document.querySelectorAll('ion-button');

    buttons.forEach((btn) => {
      btn.classList.remove('ion-focused', 'ion-activated');
      btn.removeAttribute('aria-pressed');

      const shadow = (btn as any).shadowRoot;
      if (shadow) {
        const native = shadow.querySelector('.button-native') as HTMLElement;
        if (native) {
          native.classList.remove('ion-focused', 'ion-activated');
          native.style.transform = 'none';
          native.style.boxShadow = 'none';
        }
      }
    });

    document.body.style.transform = 'scale(1)';
    requestAnimationFrame(() => (document.body.style.transform = ''));
  }

  // =========================
  // 🔙 Navegación
  // =========================
  goBack() {
    this.router.navigate(['/home']);
  }

  irAGestionProyectos() {
    this.router.navigate(['/proyectos-admin']);
  }

  irAGenerarVotacion() {
    this.router.navigate(['/votaciones/admin']);
  }

  irAGestionNoticias() {
    this.router.navigate(['/noticias/admin']);
  }

  irARegistrosVecinos() {
    this.router.navigate(['/vecinos/admin']);
  }

  irAGestionActividades() {
    this.router.navigate(['/actividades/admin']);
  }

  irAGestionSolicitudes() {
    this.router.navigate(['/solicitudes/admin']);
  }

  irARegistroAuditoria() {
    this.router.navigate(['/auditoria']);
  }

  // =========================
  // 📊 Carga de estadísticas
  // =========================
  private async cargarEstadisticas() {
    const supa = this.supabaseService.client;

    try {
      // 📅 Rango de fechas para "eventos este mes"
      const ahora = new Date();
      const inicioMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1);
      const inicioMesSiguiente = new Date(
        ahora.getFullYear(),
        ahora.getMonth() + 1,
        1
      );

      const inicioIso = inicioMes.toISOString();
      const finIso = inicioMesSiguiente.toISOString();

      // Ejecutamos consultas en paralelo (sin head:true)
      const [
        actividadInscripcionRes,
        proyectoPostulacionRes,
        proyectosActivosRes,
        eventosMesRes,
        vecinosRes,
      ] = await Promise.all([
        // actividad_inscripcion
        supa
          .from('actividad_inscripcion')
          .select('id_inscripcion', { count: 'exact' }),
        // proyecto_postulacion
        supa
          .from('proyecto_postulacion')
          .select('id_postulacion', { count: 'exact' }),
        // proyecto con estado = 'publicada'
        supa
          .from('proyecto')
          .select('id_proyecto', { count: 'exact' })
          .eq('estado', 'publicada'),
        // evento este mes (por fecha_inicio)
        supa
          .from('evento')
          .select('id_evento, fecha_inicio', { count: 'exact' })
          .gte('fecha_inicio', inicioIso)
          .lt('fecha_inicio', finIso),
        // usuario (todos)
        supa.from('usuario').select('id_usuario', { count: 'exact' }),
      ]);

      // 🔍 Logs de debug
      console.log('actividad_inscripcion =>', {
        error: actividadInscripcionRes.error,
        count: actividadInscripcionRes.count,
        rows: actividadInscripcionRes.data?.length,
      });

      console.log('proyecto_postulacion =>', {
        error: proyectoPostulacionRes.error,
        count: proyectoPostulacionRes.count,
        rows: proyectoPostulacionRes.data?.length,
      });

      console.log('proyecto (publicada) =>', {
        error: proyectosActivosRes.error,
        count: proyectosActivosRes.count,
        rows: proyectosActivosRes.data?.length,
      });

      console.log('evento (este mes) =>', {
        error: eventosMesRes.error,
        count: eventosMesRes.count,
        rows: eventosMesRes.data?.length,
        rango: { inicioIso, finIso },
      });

      console.log('usuario =>', {
        error: vecinosRes.error,
        count: vecinosRes.count,
        rows: vecinosRes.data?.length,
      });

      const actividadCount = actividadInscripcionRes.count ?? 0;
      const postulacionCount = proyectoPostulacionRes.count ?? 0;
      const proyectosCount = proyectosActivosRes.count ?? 0;
      const eventosCount = eventosMesRes.count ?? 0;
      const vecinosCount = vecinosRes.count ?? 0;

      // Asignamos a las variables que usa el HTML
      this.solicitudesPendientes = actividadCount + postulacionCount;
      this.proyectosActivos = proyectosCount;
      this.eventosEsteMes = eventosCount;
      this.vecinosRegistrados = vecinosCount;
    } catch (error) {
      console.error('Error al cargar estadísticas del panel admin:', error);
      this.solicitudesPendientes = 0;
      this.proyectosActivos = 0;
      this.eventosEsteMes = 0;
      this.vecinosRegistrados = 0;
    }
  }
}
