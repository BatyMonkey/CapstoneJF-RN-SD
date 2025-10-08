// src/app/pages/espacios/detalle-espacio/detalle-espacio.page.ts

import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule, ToastController } from '@ionic/angular';
import { ActivatedRoute } from '@angular/router';

import { EspaciosService, Espacio } from 'src/app/services/espacios.service';

// 🚨 1. CONFIGURACIÓN DE MAPBOX 🚨
const MAPBOX_ACCESS_TOKEN = 'sk.eyJ1IjoiYmF0eW1vbmtleSIsImEiOiJjbWdpYmltcGMwN2FoMmxweGtoYjNxajU5In0.2lE0EvGf4Onc4DhfytKERg'; // 🚨 Reemplaza con tu clave Mapbox

@Component({
  selector: 'app-detalle-espacio',
  templateUrl: './detalle-espacio.page.html',
  styleUrls: ['./detalle-espacio.page.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule, FormsModule],
})
export class DetalleEspacioPage implements OnInit {
  
  espacio: Espacio | null = null;
  isLoading = true;
  error: string | null = null;

  // Mapeo de IDs numéricos a nombres de tipo
  private tiposEspacioMap = new Map<number, string>([
    [1, 'Cancha'],
    [2, 'Sede'],
    [3, 'Parque'],
  ]);

  constructor(
    private activatedRoute: ActivatedRoute,
    private espaciosService: EspaciosService,
    private toastCtrl: ToastController,
  ) {}

  ngOnInit() {
    this.activatedRoute.params.subscribe(params => {
      // Convertimos el parámetro de la ruta (siempre string) a number
      const id = +params['id']; 
      
      if (id && !isNaN(id)) {
        this.cargarDetalleEspacio(id);
      } else {
        this.error = 'ID de espacio no proporcionado o inválido.';
        this.isLoading = false;
        this.mostrarToast(this.error, 'danger');
      }
    });
  }

  /**
   * Carga los detalles de un espacio específico.
   */
  async cargarDetalleEspacio(id: number) {
    this.isLoading = true;
    this.error = null;
    try {
      this.espacio = await this.espaciosService.obtenerEspacioPorId(id);
      
      if (!this.espacio) {
        this.error = 'El espacio solicitado no existe.';
        this.mostrarToast(this.error, 'warning');
      }
      
    } catch (e: any) {
      this.error = e.message || 'Error al cargar los detalles del espacio.';
      this.mostrarToast(this.error!, 'danger'); 
      
    } finally {
      this.isLoading = false;
    }
  }

  /**
   * Devuelve el nombre del tipo basado en el ID numérico.
   */
get tipoNombre(): string {
    if (this.espacio && this.espacio.tipo) {
      // 🚀 SOLUCIÓN: Usar parseInt() para asegurar que el ID sea un número
      const tipoIdNumerico = parseInt(this.espacio.tipo.toString(), 10);

      // Usar '||' para asegurar que, si el mapa no lo encuentra, devuelva 'Desconocido'
      return this.tiposEspacioMap.get(tipoIdNumerico) || 'Desconocido';
    }
    return 'N/A';
  }
  /**
   * 🚀 GETTER CRÍTICO: Construye la URL de la imagen del mapa estático de Mapbox.
   */
  get staticMapUrl(): string | null {
    if (!this.espacio || !this.espacio.latitud || !this.espacio.longitud) {
      return null;
    }

    const lat = this.espacio.latitud;
    const lng = this.espacio.longitud;
    
    // Configuración del estilo y tamaño
    const styleId = 'mapbox/streets-v11'; 
    const size = '600x250'; 
    const zoom = 15;        

    // Formato del marcador (pin-s-pitch+f00 significa un pin pequeño de color rojo)
    const markerOverlay = `pin-s-pitch+f00(${lng},${lat})`;
    
    // URL de la API de Static Images de Mapbox
    return `https://api.mapbox.com/styles/v1/${styleId}/static/${markerOverlay}/${lng},${lat},${zoom},0,0/${size}?access_token=${MAPBOX_ACCESS_TOKEN}`;
  }

  /**
   * Abre la ubicación en Google Maps usando la latitud y longitud.
   */
  openInExternalMap() {
    if (this.espacio) {
      const lat = this.espacio.latitud;
      const lng = this.espacio.longitud;
      
      // Formato correcto de Google Maps para buscar un punto
      const mapUrl = `http://maps.google.com/?q=${lat},${lng}`;
      
      window.open(mapUrl, '_system'); 

    } else {
      this.mostrarToast('Ubicación no disponible.', 'warning');
    }
  }
  
  /**
   * Muestra un Toast. (Corregido para ser accesible dentro de la clase)
   */
  async mostrarToast(message: string, color: string) {
    const toast = await this.toastCtrl.create({
      message,
      duration: 3000,
      color,
    });
    toast.present();
  }
}