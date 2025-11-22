// src/app/espacios/espacios.page.ts

import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  IonicModule,
  LoadingController,
  AlertController,
  ModalController,
  ToastController,
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
  addOutline,
  mapOutline,
} from 'ionicons/icons';

import { CrearEspacioModalPage } from './crear-espacio-modal/crear-espacio-modal.page';

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

  /**
   * Normaliza el valor que viene de la BD (label o código)
   * a un código interno estable: mesas_sillas, wifi, cocina, etc.
   */
  private normalizarServicio(codeOrLabel: string): string {
    if (!codeOrLabel) return '';

    // bajar a minúsculas y quitar tildes
    let v = codeOrLabel
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');

    if (v.includes('mesa')) return 'mesas_sillas';
    if (v.includes('wifi')) return 'wifi';
    if (v.includes('cocina')) return 'cocina';
    if (v.includes('bano') || v.includes('baño')) return 'banos';
    if (v.includes('sonido')) return 'sonido';
    if (v.includes('led') || v.includes('iluminacion')) return 'iluminacion';
    if (v.includes('parrilla') || v.includes('quincho')) return 'parrilla';
    if (v.includes('pizarra')) return 'pizarra';
    if (v.includes('proyector')) return 'proyector';
    if (v.includes('aire acondicionado')) return 'aire_acondicionado';
    if (v.includes('balon')) return 'balones';
    if (v.includes('grader')) return 'graderias';

    // si ya venía como código o algo raro, lo devolvemos tal cual
    return codeOrLabel;
  }

  nombreServicio(codeOrLabel: string): string {
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

    const code = this.normalizarServicio(codeOrLabel);
    return map[code] || codeOrLabel;
  }

  iconoServicio(codeOrLabel: string): string {
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

    const code = this.normalizarServicio(codeOrLabel);
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
    private alertCtrl: AlertController,
    private modalCtrl: ModalController,
    private toastCtrl: ToastController
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
      'add-outline': addOutline,
      'map-outline': mapOutline,
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
      this.espacios =
        (await this.espaciosService.obtenerEspacios()) as EspacioUI[];
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
      this.espacioSeleccionadoId === espacio.id_espacio
        ? null
        : espacio.id_espacio;
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

    const inicioUTC = new Date(
      inicioLocal.getTime() - inicioLocal.getTimezoneOffset() * 60000
    );
    const finUTC = new Date(
      finLocal.getTime() - finLocal.getTimezoneOffset() * 60000
    );

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
  //  SOLICITAR ARRIENDO (con cobro según precio del espacio)
  // =========================================================
  async solicitarArriendo() {
    if (this.errorHorario) {
      this.mostrarAlerta('Horario no disponible', this.errorHorario);
      return;
    }

    if (
      !this.espacioSeleccionadoId ||
      !this.fechaArriendo ||
      !this.horaInicio ||
      !this.horaFin
    ) {
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

    // ==============================
    // OBTENER ESPACIO Y SU PRECIO
    // ==============================
    const espacio = this.espacios.find(
      (e) => e.id_espacio === this.espacioSeleccionadoId
    );

    if (!espacio) {
      this.mostrarAlerta(
        'Error',
        'No se pudo obtener la información del espacio.'
      );
      return;
    }

    // precio viene como texto desde la BD (ej: "5000", "5.000", "$5000")
    const precioTexto = (espacio.precio ?? '').toString();
    const soloNumero = precioTexto.replace(/\D/g, ''); // dejar solo dígitos

    if (!soloNumero) {
      this.mostrarAlerta(
        'Error',
        'Este espacio no tiene un precio configurado.'
      );
      return;
    }

    const precioPorHora = parseInt(soloNumero, 10);

    if (isNaN(precioPorHora) || precioPorHora <= 0) {
      this.mostrarAlerta(
        'Error',
        'El precio del espacio es inválido. Contacta a la administración.'
      );
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

    const inicioUTC = new Date(
      inicioLocal.getTime() - inicioLocal.getTimezoneOffset() * 60000
    );
    const finUTC = new Date(
      finLocal.getTime() - finLocal.getTimezoneOffset() * 60000
    );

    const evento_inicio = inicioUTC.toISOString();
    const evento_fin = finUTC.toISOString();

    // Calcular duración en horas (para cobrar por hora)
    const diffHoras =
      (finUTC.getTime() - inicioUTC.getTime()) / 3600000; // ms → horas

    // Por seguridad, volvemos a validar rango
    if (diffHoras < 1 || diffHoras > 3) {
      await loading.dismiss();
      this.mostrarAlerta(
        'Error',
        'La duración del arriendo debe ser entre 1 y 3 horas.'
      );
      return;
    }

    // Monto total = precio por hora * horas de arriendo
    const monto = Math.round(precioPorHora * diffHoras);

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

      // Crear orden pago con el MONTO REAL del espacio
      const { error: errOrden } = await this.supabaseService.client
        .from('orden_pago')
        .insert([
          {
            id_auth: idUsuario,
            id_evento: evento.id_evento,
            id_espacio: this.espacioSeleccionadoId,
            monto: monto,
            estado: 'pendiente',
          },
        ])
        .select()
        .single();
      if (errOrden) throw errOrden;

      // ==========================
      // LLAMAR FUNCIÓN TRANSBANK
      // ==========================
      const response = await fetch(
        `${environment.supabaseUrl}/functions/v1/transbank-simular`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id_reserva: reserva.id_reserva,
            monto: monto,
            descripcion: `Pago arriendo espacio #${this.espacioSeleccionadoId}`,
          }),
        }
      );

      if (!response.ok) {
        const text = await response.text().catch(() => '');
        console.error(
          'Error HTTP en transbank-simular:',
          response.status,
          text
        );
        throw new Error('La función de pago respondió con error.');
      }

      const sim: any = await response.json().catch((e) => {
        console.error('Error parseando JSON de transbank-simular:', e);
        throw new Error('Respuesta inválida desde la función de pago.');
      });

      console.log('Transbank sim response:', sim);

      // Soportar distintos formatos de respuesta
      const url =
        sim.url ||
        sim.redirect_url ||
        sim.data?.url ||
        sim.data?.redirect_url;
      const token =
        sim.token ||
        sim.token_ws ||
        sim.data?.token ||
        sim.data?.token_ws;

      if (!url || !token) {
        console.error('Respuesta de transbank-simular sin url/token:', sim);
        throw new Error(
          'La función de pago no entregó la URL o el token de Transbank.'
        );
      }

      await Browser.open({
        url: `${url}?token_ws=${token}`,
        presentationStyle: 'fullscreen',
      });

      await loading.dismiss();

      // Reset
      this.espacioSeleccionadoId = null;
      this.fechaArriendo = '';
      this.horaInicio = '';
      this.horaFin = '';
      this.motivo = '';
    } catch (e) {
      console.error('Error al solicitar arriendo:', e);
      await loading.dismiss();
      this.mostrarAlerta(
        'Error',
        'No se pudo completar la solicitud de pago. Intenta nuevamente.'
      );
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

  // ============================
  // MODAL CREAR ESPACIO
  // ============================
  async abrirCrearEspacioModal() {
    const modal = await this.modalCtrl.create({
      component: CrearEspacioModalPage,
      cssClass: 'crear-espacio-modal',
    });

    await modal.present();

    const { data, role } = await modal.onDidDismiss();

    // Si se cerró con éxito desde la modal
    if (role === 'success') {
      // Recargar lista de espacios desde Supabase
      await this.cargarEspacios();

      // Si la modal devuelve el espacio creado, lo dejamos seleccionado
      const creado =
        data?.espacio && Array.isArray(data.espacio)
          ? data.espacio[0]
          : data?.espacio;

      if (creado?.id_espacio) {
        this.espacioSeleccionadoId = creado.id_espacio;
      }
    }
  }

  // ============================
  // VER EN MAPA
  // ============================
  async verEnMapa(espacio: any, event: Event) {
    // Evita que se dispare el click de la tarjeta
    event.stopPropagation();

    if (!espacio) return;

    let url: string | null = null;

    // 1) Si hay latitud y longitud, usamos SOLO las coordenadas
    if (espacio.latitud && espacio.longitud) {
      const lat = espacio.latitud;
      const lng = espacio.longitud;

      // Formato que entiende bien Google Maps:
      // https://www.google.com/maps/search/?api=1&query=-33.5189,-70.7641
      url = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
    }
    // 2) Si no hay coordenadas pero sí dirección, buscamos por dirección
    else if (espacio.direccion_completa) {
      const query = encodeURIComponent(espacio.direccion_completa);
      url = `https://www.google.com/maps/search/?api=1&query=${query}`;
    }

    if (!url) {
      const toast = await this.toastCtrl.create({
        message: 'Este espacio no tiene ubicación configurada.',
        duration: 2500,
        position: 'top',
        color: 'warning',
        icon: 'alert-circle-outline',
        cssClass: 'rb-toast-warning',
      });
      await toast.present();
      return;
    }

    // En móvil normalmente abre la app de mapas
    window.open(url, '_blank');
  }
}
