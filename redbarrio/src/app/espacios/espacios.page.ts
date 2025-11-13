// src/app/espacios/espacios.page.ts

import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { Router, RouterModule } from '@angular/router';

import { EspaciosService, Espacio } from 'src/app/services/espacios.service';
import { AuthService } from 'src/app/auth/auth.service';
import { addIcons } from 'ionicons';
import {
  chevronBackOutline,
  calendarOutline,
  timeOutline,
  peopleOutline,
  locationOutline,
  checkmarkOutline,
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

  // 🔹 Solo guardamos el ID, nunca el objeto
  espacioSeleccionadoId: number | null = null;

  // 🔹 Formulario
  fechaArriendo = '';
  horaInicio = '';
  horaFin = '';
  motivo = '';

  private tiposEspacioMap = new Map<number, string>([
    [1, 'Cancha'],
    [2, 'Sede'],
    [3, 'Parque'],
  ]);

  constructor(
    private espaciosService: EspaciosService,
    private router: Router,
    private authService: AuthService
  ) {
    addIcons({
      'chevron-back-outline': chevronBackOutline,
      'calendar-outline': calendarOutline,
      'time-outline': timeOutline,
      'people-outline': peopleOutline,
      'location-outline': locationOutline,
      'checkmark-outline': checkmarkOutline,
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
      if (event) event.target.complete();
    }
  }

  // ============================================================
  //   🔹 Seleccionar espacio (igual al mockup React)
  // ============================================================
  seleccionarEspacio(espacio: EspacioUI) {
    if (this.espacioSeleccionadoId === espacio.id_espacio) {
      this.espacioSeleccionadoId = null; // deseleccionar
      return;
    }
    this.espacioSeleccionadoId = espacio.id_espacio;
  }

  // ============================================================
  //   🔹 ÍCONOS / nombres fancy
  // ============================================================
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

  // ============================================================
  //   🔹 Enviar solicitud (mockup completo)
  // ============================================================
  solicitarArriendo() {
    if (!this.espacioSeleccionadoId)
      return alert('Por favor selecciona un espacio');
    if (!this.fechaArriendo) return alert('Por favor selecciona una fecha');
    if (!this.horaInicio || !this.horaFin)
      return alert('Selecciona un horario');
    if (!this.motivo.trim()) return alert('Describe el motivo');

    const espacioObj = this.espacios.find(
      (e) => e.id_espacio === this.espacioSeleccionadoId
    );

    if (!espacioObj) {
      alert('Error interno: espacio no encontrado');
      return;
    }

    const solicitud = {
      espacioId: espacioObj.id_espacio,
      espacioNombre: espacioObj.nombre,
      fecha: this.fechaArriendo,
      horaInicio: this.horaInicio,
      horaFin: this.horaFin,
      motivo: this.motivo,
    };

    console.log('Solicitud enviada:', solicitud);
    alert('¡Solicitud enviada exitosamente!');

    // reset
    this.espacioSeleccionadoId = null;
    this.fechaArriendo = '';
    this.horaInicio = '';
    this.horaFin = '';
    this.motivo = '';
  }

  getTipoNombre(tipoId: number | string | undefined | null): string {
    if (tipoId === undefined || tipoId === null) return 'N/A';
    const num = Number(tipoId);
    return this.tiposEspacioMap.get(num) || 'Desconocido';
  }

  goToDetail(id: number) {
    this.router.navigateByUrl(`/espacios/${id}`);
  }

  irACrearEspacio() {
    this.router.navigateByUrl('/espacio/crear');
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
}
