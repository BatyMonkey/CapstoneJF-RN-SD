import { Component } from '@angular/core';
import {
  IonicModule,
  ModalController,
  ToastController,
  LoadingController,
} from '@ionic/angular';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { EspaciosService } from 'src/app/services/espacios.service';
import { addIcons } from 'ionicons';
import {
  closeCircleOutline,
  checkmarkCircleOutline,
  alertCircleOutline,
  saveOutline,
  reorderThreeOutline,
  footballOutline,
  snowOutline,
  videocamOutline,
  createOutline,
  flameOutline,
  bulbOutline,
  volumeHighOutline,
  waterOutline,
  pizzaOutline,
  wifiOutline,
  restaurantOutline,
  cashOutline,
} from 'ionicons/icons';

addIcons({
  'close-circle-outline': closeCircleOutline,
  'checkmark-circle-outline': checkmarkCircleOutline,
  'alert-circle-outline': alertCircleOutline,
  'save-outline': saveOutline,
  'reorder-three-outline': reorderThreeOutline,
  'football-outline': footballOutline,
  'snow-outline': snowOutline,
  'videocam-outline': videocamOutline,
  'wifi-outline': wifiOutline,
  'create-outline': createOutline,
  'flame-outline': flameOutline,
  'bulb-outline': bulbOutline,
  'volume-high-outline': volumeHighOutline,
  'water-outline': waterOutline,
  'pizza-outline': pizzaOutline,
  'restaurant-outline': restaurantOutline,
  'cash-outline': cashOutline,
});

interface Coordenadas {
  lat: number;
  lng: number;
}

@Component({
  standalone: true,
  selector: 'app-crear-espacio-modal',
  templateUrl: './crear-espacio-modal.component.html',
  styleUrls: ['./crear-espacio-modal.component.scss'],
  imports: [IonicModule, CommonModule, FormsModule],
})
export class CrearEspacioModalPage {
  // Campos del formulario
  nombre = '';
  descripcion = '';
  capacidad: number | null = null;
  precio = '';
  direccion = '';

  // Servicios seleccionados
  serviciosSeleccionados: string[] = [];

  // Archivo de imagen seleccionado
  imagenFile: File | null = null;

  // Coordenadas obtenidas desde Mapbox
  coordenadas: Coordenadas | null = null;

  isSaving = false;

  // Token real de Mapbox
  private readonly MAPBOX_TOKEN =
    'pk.eyJ1IjoiYmF0eW1vbmtleSIsImEiOiJjbWk1OTdueGkyZTNiMmlvbDZ4cnJocDRuIn0.zfHtbHqrPLGO5XP4ckQzcw';

  // Misma lista de servicios que en el HTML
  readonly serviciosDisponibles: string[] = [
    'Mesas y sillas',
    'WiFi',
    'Cocina equipada',
    'Baños',
    'Sistema de sonido',
    'Iluminación LED',
    'Parrilla',
    'Pizarra',
    'Proyector',
    'Aire acondicionado',
    'Balones disponibles',
    'Graderías',
  ];

  constructor(
    private modalCtrl: ModalController,
    private toastCtrl: ToastController,
    private loadingCtrl: LoadingController,
    private espaciosService: EspaciosService
  ) {}

  // Cerrar sin guardar
  cancelar() {
    this.modalCtrl.dismiss(null, 'cancel');
  }

  // Input file
  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.imagenFile = input.files[0];
    } else {
      this.imagenFile = null;
    }
  }

  // Toggle de servicios
  toggleServicio(label: string) {
    if (this.serviciosSeleccionados.includes(label)) {
      this.serviciosSeleccionados = this.serviciosSeleccionados.filter(
        (s) => s !== label
      );
    } else {
      this.serviciosSeleccionados = [...this.serviciosSeleccionados, label];
    }
  }

  estaServicioSeleccionado(label: string): boolean {
    return this.serviciosSeleccionados.includes(label);
  }

  // ============================
  //  MAPBOX GEOCODING
  // ============================
  private async geocodificarDireccionConMapbox(): Promise<boolean> {
    this.coordenadas = null;

    const direccionTrim = this.direccion.trim();
    if (!direccionTrim) {
      await this.mostrarToast(
        'La dirección del espacio es obligatoria',
        'warning'
      );
      return false;
    }

    if (!this.MAPBOX_TOKEN) {
      console.warn('[CrearEspacioModal] Falta configurar el token de Mapbox');
      await this.mostrarToast(
        'Error interno: falta configurar el token de Mapbox',
        'danger'
      );
      return false;
    }

    try {
      const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
        direccionTrim
      )}.json?access_token=${this.MAPBOX_TOKEN}&limit=1&language=es&country=cl`;

      const resp = await fetch(url);
      if (!resp.ok) {
        throw new Error(`Error HTTP ${resp.status}`);
      }

      const data = await resp.json();

      if (!data.features || data.features.length === 0) {
        await this.mostrarToast(
          'No se encontraron coordenadas para esa dirección. Intenta ser más específico.',
          'warning'
        );
        return false;
      }

      const feature = data.features[0];
      const [lng, lat] = feature.center;

      this.coordenadas = { lat, lng };
      return true;
    } catch (error) {
      console.error(
        '[CrearEspacioModal] Error geocodificando con Mapbox',
        error
      );
      await this.mostrarToast(
        'Ocurrió un error al obtener las coordenadas. Revisa tu conexión.',
        'danger'
      );
      return false;
    }
  }

  // ============================
  //  GUARDAR ESPACIO
  // ============================
  async guardar() {
    if (this.isSaving) return;

    // Validaciones básicas
    if (!this.nombre.trim()) {
      await this.mostrarToast(
        'El nombre del espacio es obligatorio',
        'warning'
      );
      return;
    }

    if (!this.descripcion.trim()) {
      await this.mostrarToast('La descripción es obligatoria', 'warning');
      return;
    }

    if (!this.capacidad || this.capacidad <= 0) {
      await this.mostrarToast('La capacidad debe ser mayor a 0', 'warning');
      return;
    }

    if (!this.precio.trim()) {
      await this.mostrarToast('El precio es obligatorio', 'warning');
      return;
    }

    // Dirección obligatoria
    if (!this.direccion.trim()) {
      await this.mostrarToast(
        'La dirección del espacio es obligatoria',
        'warning'
      );
      return;
    }

    this.isSaving = true;

    const loading = await this.loadingCtrl.create({
      message: 'Guardando espacio...',
      spinner: 'crescent',
    });
    await loading.present();

    try {
      // 1) Geocodificar con Mapbox
      const ok = await this.geocodificarDireccionConMapbox();
      if (!ok || !this.coordenadas) {
        this.isSaving = false;
        await loading.dismiss();
        return;
      }

      // 2) (Opcional) subir imagen a Supabase Storage más adelante
      let imagen_url: string | null = null;
      // TODO: aquí subimos this.imagenFile y llenamos imagen_url

      // 3) Payload para la tabla
      const payload: any = {
        nombre: this.nombre.trim(),
        descripcion: this.descripcion.trim(),
        capacidad: this.capacidad,
        precio: this.precio.trim(),
        servicios: this.serviciosSeleccionados,
        imagen_url,
        direccion_completa: this.direccion.trim(),
        latitud: this.coordenadas.lat,
        longitud: this.coordenadas.lng,
      };

      const nuevoEspacio = await this.espaciosService.crearNuevoEspacio(
        payload
      );

      await this.mostrarToast('Espacio creado con éxito', 'success');

      // Devolvemos el espacio creado al padre
      this.modalCtrl.dismiss({ espacio: nuevoEspacio }, 'success');
    } catch (error) {
      console.error('[CrearEspacioModal] Error al crear espacio', error);
      await this.mostrarToast('Ocurrió un error al crear el espacio', 'danger');
    } finally {
      this.isSaving = false;
      loading.dismiss();
    }
  }

  private async mostrarToast(
    message: string,
    type: 'success' | 'warning' | 'danger'
  ) {
    const toast = await this.toastCtrl.create({
      message,
      duration: 2500,
      mode: 'ios', // estilo iOS
      position: 'top',
      cssClass: ['rb-toast-solid', `rb-toast-${type}`], // 👈 clase nueva
    });

    await toast.present();
  }
}
