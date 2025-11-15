// src/app/espacios/espacios.page.ts

import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  IonicModule,
  LoadingController,
  AlertController,
} from '@ionic/angular';
import { Router, RouterModule } from '@angular/router';

import { EspaciosService, Espacio } from 'src/app/services/espacios.service';
import { AuthService } from 'src/app/auth/auth.service';
import { SupabaseService } from 'src/app/services/supabase.service';

import { Browser } from '@capacitor/browser';
import { environment } from 'src/environments/environment';
import { addIcons } from 'ionicons';

import {
  chevronBackOutline,
  calendarOutline,
  timeOutline,
  peopleOutline,
  locationOutline,
  checkmarkOutline,
  cubeOutline,
  wifiOutline,
  restaurantOutline,
  waterOutline,
  volumeHighOutline,
  bulbOutline,
  flameOutline,
  createOutline,
  videocamOutline,
  snowOutline,
  basketballOutline,
  gridOutline,
  homeOutline,
  alertCircleOutline,
} from 'ionicons/icons';

type EspacioUI = Espacio & {
  precio?: string | null;
  servicios?: string[] | null;
};

@Component({
  selector: 'app-espacios',
  standalone: true,
  templateUrl: './espacios.page.html',
  styleUrls: ['./espacios.page.scss'],
  imports: [IonicModule, CommonModule, FormsModule, RouterModule],
})
export class EspaciosPage implements OnInit {


    // =========================================================
  // SERVICIOS (UI)
  // =========================================================

  nombreServicio(code: string): string {
    const map: Record<string, string> = {
      mesas_sillas: 'Mesas y sillas',
      wifi: 'WiFi',
      cocina: 'Cocina equipada',
      banos: 'Baños',
      sonido: 'Sistema de sonido',
      iluminacion: 'Iluminación LED',
      parrilla: 'Parrilla / Quincho',
      pizarra: 'Pizarra',
      proyector: 'Proyector',
      aire_acondicionado: 'Aire acondicionado',
      balones: 'Balones disponibles',
      graderias: 'Graderías',
    };
    return map[code] || code;
  }

  iconoServicio(code: string): string {
    const map: Record<string, string> = {
      mesas_sillas: 'cube-outline',
      wifi: 'wifi-outline',
      cocina: 'restaurant-outline',
      banos: 'water-outline',
      sonido: 'volume-high-outline',
      iluminacion: 'bulb-outline',
      parrilla: 'flame-outline',
      pizarra: 'create-outline',
      proyector: 'videocam-outline',
      aire_acondicionado: 'snow-outline',
      balones: 'basketball-outline',
      graderias: 'grid-outline',
    };
    return map[code] ?? 'checkmark-outline';
  }


  espacios: EspacioUI[] = [];
  isLoading = false;
  error: string | null = null;
  isAdmin = false;

  espacioSeleccionadoId: number | null = null;

  fechaArriendo = '';
  horaInicio = '';
  horaFin = '';
  motivo = '';

  errorHorario: string | null = null;

  constructor(
    private espaciosService: EspaciosService,
    private router: Router,
    private authService: AuthService,
    private supabaseService: SupabaseService,
    private loadingCtrl: LoadingController,
    private alertCtrl: AlertController
  ) {
    addIcons({
      'chevron-back-outline': chevronBackOutline,
      'calendar-outline': calendarOutline,
      'time-outline': timeOutline,
      'people-outline': peopleOutline,
      'location-outline': locationOutline,
      'checkmark-outline': checkmarkOutline,
      'alert-circle-outline': alertCircleOutline,
      'cube-outline': cubeOutline,
      'wifi-outline': wifiOutline,
      'restaurant-outline': restaurantOutline,
      'water-outline': waterOutline,
      'volume-high-outline': volumeHighOutline,
      'bulb-outline': bulbOutline,
      'flame-outline': flameOutline,
      'create-outline': createOutline,
      'videocam-outline': videocamOutline,
      'snow-outline': snowOutline,
      'basketball-outline': basketballOutline,
      'grid-outline': gridOutline,
      'home-outline': homeOutline,
    });
  }

  ngOnInit() {
    this.checkUserRole();
    this.cargar();
  }

  ionViewWillEnter() {
    this.isLoading = true;
    setTimeout(() => this.cargar(), 500);
  }

  private async cargar() {
    await this.cargarEspacios();
  }

  async checkUserRole() {
    try {
      this.isAdmin = await this.authService.checkIfAdmin();
    } catch {
      this.isAdmin = false;
    }
  }

  async cargarEspacios(event?: any) {
    if (!event) this.isLoading = true;

    try {
      this.espacios = (await this.espaciosService.obtenerEspacios()) as EspacioUI[];
    } catch (e: any) {
      this.error = e.message;
      this.espacios = [];
    } finally {
      this.isLoading = false;
      if (event) event.target.complete();
    }
  }

  seleccionarEspacio(espacio: EspacioUI) {
    this.errorHorario = null;
    this.espacioSeleccionadoId =
      this.espacioSeleccionadoId === espacio.id_espacio ? null : espacio.id_espacio;
  }

  // =========================================================
  //  🔥 VALIDAR HORARIO — SIEMPRE COMPARAR EN UTC
  // =========================================================
  async validarHorario() {
    this.errorHorario = null;

    if (!this.espacioSeleccionadoId) return;
    if (!this.fechaArriendo || !this.horaInicio || !this.horaFin) return;

    // Convertir ingreso del usuario → UTC
    const inicioLocal = new Date(`${this.fechaArriendo}T${this.horaInicio}`);
    const finLocal = new Date(`${this.fechaArriendo}T${this.horaFin}`);

    const inicioUTC = new Date(inicioLocal.getTime() - inicioLocal.getTimezoneOffset() * 60000);
    const finUTC = new Date(finLocal.getTime() - finLocal.getTimezoneOffset() * 60000);

    // Validaciones básicas
    if (inicioUTC >= finUTC) {
      this.errorHorario = 'La hora de inicio debe ser menor a la hora de fin.';
      return;
    }

    const diffHoras = (finUTC.getTime() - inicioUTC.getTime()) / 3600000;

    if (diffHoras < 1) {
      this.errorHorario = 'El arriendo debe durar mínimo 1 hora.';
      return;
    }

    if (diffHoras > 3) {
      this.errorHorario = 'El arriendo no puede exceder 3 horas.';
      return;
    }

    // ================================
    // CONSULTAR LA VISTA DE RESERVAS PAGADAS (ya en UTC)
    // ================================
    const { data, error } = await this.supabaseService.client
      .from('vw_reservas_pagadas')
      .select('*')
      .eq('id_espacio', this.espacioSeleccionadoId);

    if (error) {
      console.error('Error obteniendo reservas:', error);
      this.errorHorario = 'No se pudo validar disponibilidad.';
      return;
    }

    for (const r of data || []) {
      const rInicio = new Date(r.fecha_inicio); // UTC ya
      const rFin = new Date(r.fecha_fin);

      // Comparar en UTC (ambos lados iguales)
      if (inicioUTC < rFin && finUTC > rInicio) {
        this.errorHorario = 'Este espacio ya está reservado en ese horario.';
        return;
      }
    }

    this.errorHorario = null;
  }

  // =========================================================
  //  SOLICITAR ARRIENDO
  // =========================================================
  async solicitarArriendo() {
    if (this.errorHorario) {
      this.mostrarAlerta('Horario no disponible', this.errorHorario);
      return;
    }

    if (!this.espacioSeleccionadoId || !this.fechaArriendo || !this.horaInicio || !this.horaFin) {
      this.mostrarAlerta('Error', 'Completa todos los campos.');
      return;
    }

    if (!this.motivo.trim()) {
      this.mostrarAlerta('Error', 'Debe ingresar un motivo.');
      return;
    }

    const session = await this.authService.session();
    const idUsuario = session?.user?.id;

    if (!idUsuario) {
      this.mostrarAlerta('Error', 'No se pudo obtener el usuario.');
      return;
    }

    const loading = await this.loadingCtrl.create({
      message: 'Procesando solicitud...',
      spinner: 'crescent',
    });
    await loading.present();

    // Guardar siempre en UTC
    const inicioLocal = new Date(`${this.fechaArriendo}T${this.horaInicio}`);
    const finLocal = new Date(`${this.fechaArriendo}T${this.horaFin}`);

    const inicioUTC = new Date(inicioLocal.getTime() - inicioLocal.getTimezoneOffset() * 60000);
    const finUTC = new Date(finLocal.getTime() - finLocal.getTimezoneOffset() * 60000);

    const evento_inicio = inicioUTC.toISOString();
    const evento_fin = finUTC.toISOString();

    try {
      // Crear evento
      const { data: evento, error: errEvento } =
        await this.supabaseService.client
          .from('evento')
          .insert([
            {
              titulo: 'Arriendo de espacio',
              descripcion: this.motivo,
              fecha_inicio: evento_inicio,
              fecha_fin: evento_fin,
            },
          ])
          .select()
          .single();
      if (errEvento) throw errEvento;

      // Crear reserva
      const { data: reserva, error: errReserva } =
        await this.supabaseService.client
          .from('reserva')
          .insert([
            {
              id_espacio: this.espacioSeleccionadoId,
              id_evento: evento.id_evento,
              id_auth: idUsuario,
            },
          ])
          .select()
          .single();
      if (errReserva) throw errReserva;

      // Crear orden pago
      const { error: errOrden } =
        await this.supabaseService.client
          .from('orden_pago')
          .insert([
            {
              id_auth: idUsuario,
              id_evento: evento.id_evento,
              id_espacio: this.espacioSeleccionadoId,
              monto: 1500,
              estado: 'pendiente',
            },
          ])
          .select()
          .single();
      if (errOrden) throw errOrden;

      // Simular Transbank
      const response = await fetch(
        `${environment.supabaseUrl}/functions/v1/transbank-simular`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id_reserva: reserva.id_reserva,
            monto: 1500,
            descripcion: `Pago arriendo espacio #${this.espacioSeleccionadoId}`,
          }),
        }
      );

      const sim = await response.json();

      if (sim.url && sim.token) {
        await Browser.open({
          url: `${sim.url}?token_ws=${sim.token}`,
          presentationStyle: 'fullscreen',
        });
      }

      loading.dismiss();

      // Reset
      this.espacioSeleccionadoId = null;
      this.fechaArriendo = '';
      this.horaInicio = '';
      this.horaFin = '';
      this.motivo = '';

    } catch (e) {
      console.error('Error al solicitar arriendo:', e);
      loading.dismiss();
      this.mostrarAlerta('Error', 'No se pudo completar la solicitud.');
    }
  }

  // =========================================================
  // UTILIDADES
  // =========================================================
  async mostrarAlerta(h: string, m: string) {
    const alert = await this.alertCtrl.create({
      header: h,
      message: m,
      buttons: ['OK'],
    });
    await alert.present();
  }

  irACrearEspacio() {
    this.router.navigateByUrl('espacio/crear');
  }

  handleRefresh(ev: any) {
    this.cargarEspacios().finally(() => ev.target.complete());
  }

  goBack() {
    this.router.navigateByUrl('/home');
  }

  formatearPrecio(precio: string): string {
    if (!precio) return '';
    const soloNumero = precio.replace(/\D/g, '');
    const conMiles = soloNumero.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return `$${conMiles}/hora`;
  }
}
