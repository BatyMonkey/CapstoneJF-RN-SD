// src/app/pages/espacios/crear-espacio/crear-espacio.page.ts

import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule, ToastController } from '@ionic/angular';
import { Router } from '@angular/router';
import { EspaciosService } from 'src/app/services/espacios.service';

// Declara Google como global (asumiendo que la API se carga en index.html)
declare let google: any; 

// 🚨 Definición de la estructura de la picklist
interface TipoEspacio {
  id: number;
  nombre: string;
}

@Component({
  selector: 'app-crear-espacio',
  templateUrl: './crear-espacio.page.html',
  styleUrls: ['./crear-espacio.page.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule, FormsModule],
})
export class CrearEspacioPage implements OnInit {
  
  // Datos del formulario
  nombre = '';
  descripcion: string | null = null;
  capacidad: number | null = null;
  
  // 🚨 Propiedad para almacenar el ID numérico seleccionado
  tipoSeleccionadoId: number | null = null; 
  
  direccionCompleta = ''; 
  
  ubicacionSeleccionada: { latitud: number, longitud: number } | null = null;

  loading = false;
  errorMsg = '';
  
  // 🚨 Lista de tipos de espacio con sus IDs numéricos
  tiposEspacio: TipoEspacio[] = [
    { id: 1, nombre: 'Cancha' },
    { id: 2, nombre: 'Sede' },
    { id: 3, nombre: 'Parque' },
  ];

  constructor(
    private router: Router,
    private espaciosService: EspaciosService,
    private toastCtrl: ToastController
  ) {}

  ngOnInit() {
    // La API de Google Maps debe cargarse en index.html
  }

  /**
   * Usa Geocodificación directa para obtener coordenadas desde la dirección ingresada.
   */
  async obtenerCoordenadas(): Promise<boolean> {
    this.ubicacionSeleccionada = null;
    this.errorMsg = '';

    if (!this.direccionCompleta.trim()) {
      this.errorMsg = 'Debes ingresar una dirección.';
      return false;
    }

    if (typeof google === 'undefined' || !google.maps.Geocoder) {
      this.errorMsg = 'Error interno: Google Maps API no está cargada correctamente.';
      this.mostrarToast(this.errorMsg, 'danger');
      return false;
    }

    const geocoder = new google.maps.Geocoder();

    return new Promise((resolve) => {
      geocoder.geocode({ 'address': this.direccionCompleta }, (results: any, status: any) => {
        if (status === 'OK' && results[0]) {
          const location = results[0].geometry.location;
          this.ubicacionSeleccionada = {
            latitud: location.lat(),
            longitud: location.lng(),
          };
          resolve(true); 
        } else {
          this.errorMsg = 'Dirección no encontrada. Por favor, sé más específico o revisa la ortografía.';
          this.mostrarToast(this.errorMsg, 'warning');
          resolve(false);
        }
      });
    });
  }

  async crearEspacio() {
    this.loading = true;
    this.errorMsg = '';

    // 1. Validar que se haya seleccionado un tipo
    if (this.tipoSeleccionadoId === null) {
      this.errorMsg = 'Debes seleccionar un tipo de espacio.';
      this.mostrarToast(this.errorMsg, 'warning');
      this.loading = false;
      return;
    }

    // 2. Obtener las coordenadas a partir de la dirección
    const coordenadasObtenidas = await this.obtenerCoordenadas();

    if (!coordenadasObtenidas || !this.ubicacionSeleccionada) {
      this.loading = false;
      return; 
    }

    try {
      const nuevoEspacio = {
        nombre: this.nombre,
        descripcion: this.descripcion,
        capacidad: this.capacidad,
        
        // 🚨 CAMBIO: Se inserta el ID numérico del tipo en la columna 'tipo'
        tipo: this.tipoSeleccionadoId, 
        
        direccion_completa: this.direccionCompleta.trim(), 
        latitud: this.ubicacionSeleccionada.latitud,
        longitud: this.ubicacionSeleccionada.longitud,
      };
      
      // Llamada al servicio para crear el registro en la base de datos
      await this.espaciosService.crearNuevoEspacio(nuevoEspacio);

      await this.mostrarToast('Espacio creado con éxito!', 'success');
      this.router.navigateByUrl('/espacios', { replaceUrl: true });
      
    } catch (e: any) {
      this.errorMsg = e.message || 'Error al crear el espacio.';
      this.mostrarToast(this.errorMsg, 'danger');
    } finally {
      this.loading = false;
    }
  }

  private async mostrarToast(message: string, color: string) {
    const toast = await this.toastCtrl.create({
      message,
      duration: 3000,
      color,
    });
    toast.present();
  }
}