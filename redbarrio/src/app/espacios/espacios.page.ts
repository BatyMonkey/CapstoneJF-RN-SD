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
  espacios: EspacioUI[] = [];
  isLoading = false;
  error: string | null = null;
  isAdmin = false;

  // 🔹 Estado de selección + formulario (tipo Figma)
  espacioSeleccionadoId: number | null = null;

  fechaArriendo = '';
  horaInicio = '';
  horaFin = '';
  motivo = '';

  // Mapeo de tipos
  private tiposEspacioMap = new Map<number, string>([
    [1, 'Cancha'],
    [2, 'Sede'],
    [3, 'Parque'],
  ]);

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

      // 🔹 Iconos usados en los servicios
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
    setTimeout(() => this.cargar(), 600);
  }

  private async cargar() {
    await this.cargarEspacios();
  }

  async checkUserRole() {
    try {
      this.isAdmin = await this.authService.checkIfAdmin();
    } catch (e) {
      console.error('No se pudo determinar el rol del usuario:', e);
      this.isAdmin = false;
    }
  }

  async cargarEspacios(event?: any) {
    if (!event) {
      this.isLoading = true;
      this.error = null;
    }

    try {
      this.espacios =
        (await this.espaciosService.obtenerEspacios()) as EspacioUI[];
    } catch (e: any) {
      this.error = e.message || 'Error desconocido al cargar los espacios.';
      this.espacios = [];
    } finally {
      this.isLoading = false;
      if (event) {
        event.target.complete();
      }
    }
  }

  // 🔹 Seleccionar / deseleccionar espacio
  seleccionarEspacio(espacio: EspacioUI) {
    if (this.espacioSeleccionadoId === espacio.id_espacio) {
      this.espacioSeleccionadoId = null;
      return;
    }
    this.espacioSeleccionadoId = espacio.id_espacio;
  }

  // 🔹 Mapeo de servicios → nombre bonito
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

  // 🔹 Mapeo de servicios → ícono Ionic
  iconoServicio(code: string): string {
    switch (code) {
      case 'mesas_sillas':
        return 'cube-outline';
      case 'wifi':
        return 'wifi-outline';
      case 'cocina':
        return 'restaurant-outline';
      case 'banos':
        return 'water-outline';
      case 'sonido':
        return 'volume-high-outline';
      case 'iluminacion':
        return 'bulb-outline';
      case 'parrilla':
        return 'flame-outline';
      case 'pizarra':
        return 'create-outline';
      case 'proyector':
        return 'videocam-outline';
      case 'aire_acondicionado':
        return 'snow-outline';
      case 'balones':
        return 'basketball-outline';
      case 'graderias':
        return 'grid-outline';
      default:
        return 'checkmark-outline';
    }
  }

  // 🔹 Helper de alerta (equivalente a mostrarAlerta)
  private async mostrarAlerta(header: string, message: string) {
    const alert = await this.alertCtrl.create({
      header,
      message,
      buttons: ['OK'],
    });
    await alert.present();
  }

  /** 🔥 Enviar solicitud desde la vista de ESPACIOS y procesar pago (misma lógica que enviarSolicitud) */
  async solicitarArriendo() {
    // ✅ Validaciones equivalentes al "this.solicitudForm.invalid"
    if (!this.espacioSeleccionadoId) {
      await this.mostrarAlerta('Error', 'Por favor selecciona un espacio.');
      return;
    }
    if (!this.fechaArriendo) {
      await this.mostrarAlerta('Error', 'Por favor selecciona una fecha.');
      return;
    }
    if (!this.horaInicio || !this.horaFin) {
      await this.mostrarAlerta('Error', 'Por favor selecciona el horario.');
      return;
    }
    if (!this.motivo.trim()) {
      await this.mostrarAlerta(
        'Error',
        'Por favor describe el motivo del arriendo.'
      );
      return;
    }

    const espacio = this.espacios.find(
      (e) => e.id_espacio === this.espacioSeleccionadoId
    );

    // 🔹 Construimos un formData equivalente al de solicitudForm
    const fecha = this.fechaArriendo; // 'YYYY-MM-DD'
    const evento_inicio = `${fecha}T${this.horaInicio}:00`;
    const evento_fin = `${fecha}T${this.horaFin}:00`;

    const formData: any = {
      id_espacio: this.espacioSeleccionadoId,
      evento_titulo: espacio?.nombre || 'Arriendo de espacio comunitario',
      evento_descripcion: this.motivo,
      evento_inicio,
      evento_fin,
    };

    // ⬇️⬇️ LÓGICA COPIADA de enviarSolicitud (sin cambios de flujo) ⬇️⬇️

    const session = await this.authService.session();
    const idUsuario = session?.user?.id || null;

    if (!idUsuario) {
      this.mostrarAlerta('Error', 'No se pudo obtener el usuario autenticado.');
      return;
    }

    const loading = await this.loadingCtrl.create({
      message: 'Procesando solicitud...',
      spinner: 'crescent',
    });
    await loading.present();

    try {
      // 1️⃣ Crear evento
      const { data: eventoData, error: eventoError } =
        await this.supabaseService.client
          .from('evento')
          .insert([
            {
              titulo: formData.evento_titulo,
              descripcion: formData.evento_descripcion,
              fecha_inicio: formData.evento_inicio,
              fecha_fin: formData.evento_fin,
            },
          ])
          .select()
          .single();

      if (eventoError) throw eventoError;

      // 2️⃣ Crear reserva
      const espacioId = Number(formData.id_espacio);
      const { data: reservaData, error: reservaError } =
        await this.supabaseService.client
          .from('reserva')
          .insert([
            {
              id_espacio: espacioId,
              id_evento: eventoData.id_evento,
              id_auth: idUsuario,
              fecha: new Date().toISOString(),
              creado_en: new Date().toISOString(),
            },
          ])
          .select()
          .single();

      if (reservaError) throw reservaError;

      // 3️⃣ Generar orden de pago local
      const { data: ordenData, error: ordenError } =
        await this.supabaseService.client
          .from('orden_pago')
          .insert([
            {
              id_auth: idUsuario,
              id_evento: eventoData.id_evento,
              id_espacio: espacioId,
              monto: 1500,
              estado: 'pendiente',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
          ])
          .select()
          .single();

      if (ordenError) throw ordenError;

      // 🧾 Registrar acción en auditoría
      await this.supabaseService.registrarAuditoria(
        'enviar solicitud de reserva',
        'reserva',
        {
          evento: {
            id_evento: eventoData.id_evento,
            titulo: eventoData.titulo,
            fecha_inicio: eventoData.fecha_inicio,
            fecha_fin: eventoData.fecha_fin,
          },
          reserva: {
            id_reserva: reservaData.id_reserva,
            id_espacio: espacioId,
            fecha: reservaData.fecha,
          },
          orden_pago: {
            id_orden: ordenData.id_orden,
            monto: ordenData.monto,
            estado: ordenData.estado,
          },
          fecha_solicitud: new Date().toISOString(),
        }
      );

      // 4️⃣ Simular pago Transbank
      const response = await fetch(
        `${environment.supabaseUrl}/functions/v1/transbank-simular`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id_reserva: reservaData.id_reserva,
            monto: 1500,
            descripcion: `Pago arriendo espacio #${espacioId}`,
          }),
        }
      );

      if (!response.ok) throw new Error('Error al iniciar simulación de pago');

      const simData = await response.json();

      if (simData.url && simData.token) {
        await Browser.open({
          url: `${simData.url}?token_ws=${simData.token}`,
          presentationStyle: 'fullscreen',
        });
      } else {
        throw new Error('No se recibió token o URL de Transbank.');
      }

      await loading.dismiss();

      // Opcional: limpiar formulario y selección
      this.espacioSeleccionadoId = null;
      this.fechaArriendo = '';
      this.horaInicio = '';
      this.horaFin = '';
      this.motivo = '';
    } catch (error) {
      console.error('Error al enviar solicitud:', error);
      await loading.dismiss();
      this.mostrarAlerta(
        'Error',
        'No se pudo completar la reserva ni el pago.'
      );
    }
  }

  getTipoNombre(tipoId: number | string | undefined | null): string {
    if (tipoId === undefined || tipoId === null) return 'N/A';
    const idNumerico = parseInt(tipoId.toString(), 10);
    if (isNaN(idNumerico)) return String(tipoId);
    return this.tiposEspacioMap.get(idNumerico) || 'Desconocido';
  }

  goToDetail(id: number) {
    this.router.navigateByUrl(`/espacios/${id}`);
  }

  irACrearEspacio() {
    this.router.navigateByUrl('espacio/crear');
  }

  async handleRefresh(ev: CustomEvent) {
    try {
      await this.cargarEspacios();
    } finally {
      (ev.target as HTMLIonRefresherElement)?.complete?.();
    }
  }

  goBack() {
    this.router.navigateByUrl('/home');
  }

  formatearPrecio(precio: string): string {
    if (!precio) return '';

    // Elimina caracteres que no sean números
    const soloNumero = precio.replace(/\D/g, '');

    // Formatea con puntos como miles
    const conMiles = soloNumero.replace(/\B(?=(\d{3})+(?!\d))/g, '.');

    return `$${conMiles}/hora`;
  }
}
