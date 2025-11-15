// src/app/espacios/crear-espacios/crear-espacio.page.ts

import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule, ToastController } from '@ionic/angular';
import { Router } from '@angular/router';
import { EspaciosService } from 'src/app/services/espacios.service';
import { HttpClientModule } from '@angular/common/http';
import { SupabaseService } from 'src/app/services/supabase.service';
// 🚀 IMPORTS CLAVE PARA FORMULARIOS REACTIVOS
import {
  FormGroup,
  FormControl,
  Validators,
  ReactiveFormsModule,
} from '@angular/forms';
// 🚀 IMPORTS CLAVE PARA PETICIONES HTTP
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { lastValueFrom } from 'rxjs';

// Define la interfaz de la picklist
interface TipoEspacio {
  id: number;
  nombre: string;
}

// 🚨 CONFIGURACIÓN DE MAPBOX 🚨
const MAPBOX_ACCESS_TOKEN =
  'sk.eyJ1IjoiYmF0eW1vbmtleSIsImEiOiJjbWdpYmltcGMwN2FoMmxweGtoYjNxajU5In0.2lE0EvGf4Onc4DhfytKERg';
const MAPBOX_API_URL = 'https://api.mapbox.com/geocoding/v5/mapbox.places/';

// Contexto de búsqueda avanzada para mayor precisión (Santiago, Chile)
const MAPBOX_SEARCH_CONTEXT = 'Santiago, Chile';
const SANTIAGO_BBOX = '-70.91,-33.72,-70.47,-33.25'; // Límites geográficos para RM

@Component({
  selector: 'app-crear-espacio',
  templateUrl: './crear-espacio.page.html',
  styleUrls: ['./crear-espacio.page.scss'],
  standalone: true,
  // 🚀 CORRECCIÓN FINAL: ReactiveFormsModule y HttpClientModule son obligatorios
  imports: [
    IonicModule,
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    HttpClientModule,
  ],
})
export class CrearEspacioPage implements OnInit {
  // 🚀 PROPIEDAD: El FormGroup que controla todo el formulario
  espacioForm!: FormGroup;

  // Variables de estado
  isSaving = false;
  error: string | null = null;

  // Variables para manejo de imágenes
  selectedFile: File | null = null;
  imageUrl: string | null = null;

  // Usar el cliente Supabase compartido que mantiene la sesión de la app
  private supabase = this.supabaseService.client;
  // Propiedades derivadas (la latitud/longitud en el HTML usan los getters)
  ubicacionSeleccionada: { latitud: number; longitud: number } | null = null;
  loading = false;

  tiposEspacio: TipoEspacio[] = [];

  constructor(
    private router: Router,
    private espaciosService: EspaciosService,
    private toastCtrl: ToastController,
    private http: HttpClient, // Inyección de HttpClient
    private supabaseService: SupabaseService
  ) {}

  async ngOnInit() {
    // Verificar autenticación al inicio
    const {
      data: { user },
    } = await this.supabase.auth.getUser();
    if (!user) {
      await this.mostrarToast(
        'Debes iniciar sesión para crear espacios',
        'warning'
      );
      this.router.navigate(['/login']);
      return;
    }
  }

  /**
   * Inicializa el FormGroup con todos los controles y validadores.
   */
  initForm() {
    this.espacioForm = new FormGroup({
      nombre: new FormControl('', [
        Validators.required,
        Validators.maxLength(100),
      ]),
      tipo: new FormControl(1, [Validators.required]),
      capacidad: new FormControl(null, [
        Validators.required,
        Validators.min(1),
      ]),
      descripcion: new FormControl(''),
      direccion_completa: new FormControl('', [
        Validators.required,
        Validators.minLength(10),
      ]),
      latitud: new FormControl(null), // Campo oculto para la coordenada
      longitud: new FormControl(null), // Campo oculto para la coordenada
      imagen_url: new FormControl(''), // Campo para la URL de la imagen
    });
    this.espacioForm.get('tipo')?.setValue(this.tiposEspacio[0].id);
  }

  // --- Getters (Resuelve TS2339 para latitud y longitud en el HTML) ---

  get latitud(): FormControl {
    return this.espacioForm.get('latitud') as FormControl;
  }
  get longitud(): FormControl {
    return this.espacioForm.get('longitud') as FormControl;
  }

  // 💡 Getter auxiliar (no usado en el HTML, pero necesario si existiera un botón de "seleccionar ubicación")
  seleccionarUbicacion() {
    alert('Funcionalidad de selección de mapa pendiente de implementar.');
  }

  // --- Lógica de Mapbox ---

  /**
   * Usa Mapbox Geocoding API para obtener coordenadas con alta precisión.
   */
  async obtenerCoordenadas(): Promise<boolean> {
    this.ubicacionSeleccionada = null;
    this.error = null;

    const direccion = this.espacioForm.get('direccion_completa')?.value;

    if (!direccion || direccion.trim().length < 10) {
      this.error = 'La dirección es muy corta.';
      return false;
    }

    try {
      // 1. Construir la consulta completa con el contexto de Santiago
      const fullQuery = `${direccion.trim()}, ${MAPBOX_SEARCH_CONTEXT}`;
      const query = encodeURIComponent(fullQuery);

      // 2. Construir la URL con BBOX y Access Token
      const url = `${MAPBOX_API_URL}${query}.json?bbox=${SANTIAGO_BBOX}&language=es&access_token=${MAPBOX_ACCESS_TOKEN}`;

      // 3. Petición HTTP
      const response: any = await lastValueFrom(this.http.get(url));

      if (response && response.features && response.features.length > 0) {
        // Mapbox devuelve las coordenadas como [longitud, latitud]
        const [longitude, latitude] = response.features[0].center;

        this.ubicacionSeleccionada = { latitud: latitude, longitud: longitude };

        // 4. Actualizamos los campos ocultos del formulario
        this.latitud.setValue(latitude);
        this.longitud.setValue(longitude);

        console.log('Mapbox encontró coordenadas:', this.ubicacionSeleccionada);
        return true;
      } else {
        this.error =
          'Dirección no encontrada. Intenta con más detalles o una dirección conocida.';
        await this.mostrarToast(this.error!, 'warning');
        return false;
      }
    } catch (e: any) {
      this.error =
        'Error al conectar con la API de Mapbox. Revisa tu Access Token.';
      await this.mostrarToast(this.error!, 'danger');
      console.error('Error de Mapbox:', e);
      return false;
    }
  }

  // --- Lógica Final ---

  /**
   * Maneja el envío del formulario.
   */
  // Método para manejar la selección de archivo
  async onFileSelected(event: any) {
    const file = event.target.files[0];
    console.log('[onFileSelected] Archivo seleccionado:', file);
    if (file) {
      this.selectedFile = file;
      // Ya no subimos la imagen aquí, solo guardamos la referencia
      this.imageUrl = null;
      this.espacioForm.patchValue({ imagen_url: '' });
      await this.mostrarToast('Imagen lista para subir al guardar', 'primary');
    } else {
      this.selectedFile = null; // Limpiar si se cancela la selección
      console.warn('[onFileSelected] No se seleccionó archivo.');
    }
  }

  // Método para subir imagen a Supabase
  private async uploadImageToSupabase(file: File): Promise<string | null> {
    try {
      // 1. Obtener la sesión actual para el ID del usuario
      const {
        data: { user },
      } = await this.supabase.auth.getUser();
      if (!user) throw new Error('Usuario no autenticado');

      const fileExt = file.name.split('.').pop();
      const fileName = `espacio_${Date.now()}_${Math.random()
        .toString(36)
        .slice(2)}.${fileExt}`;
      // Incluir ID del usuario en la ruta para cumplir con RLS
      const filePath = `public/${user.id}/espacios/${fileName}`;
      console.log('[uploadImageToSupabase] Preparando para subir:', {
        fileExt,
        fileName,
        filePath,
        file,
      });

      // **CONFIRMA ESTE NOMBRE EN SUPABASE: 'espacios-bucket'**
      const { data, error } = await this.supabase.storage
        .from('espacios-bucket')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false,
        });
      console.log('[uploadImageToSupabase] Resultado de upload:', {
        data,
        error,
      });

      if (error) {
        // Esto captura errores como RLS y tamaño de archivo
        console.error(
          '[uploadImageToSupabase] Error de Supabase al subir (Storage Error):',
          error.message
        );
        // Lanzamos un error más detallado
        throw new Error(
          `Error Supabase: ${error.message || 'Error desconocido al subir.'}`
        );
      }

      // Obtener la URL pública
      const { data: publicData } = this.supabase.storage
        .from('espacios-bucket')
        .getPublicUrl(filePath);
      console.log('[uploadImageToSupabase] URL pública obtenida:', publicData);

      if (!publicData.publicUrl) {
        console.error(
          '[uploadImageToSupabase] No se pudo obtener la URL pública.'
        );
        throw new Error('No se pudo obtener la URL pública de la imagen.');
      }

      return publicData.publicUrl;
    } catch (error: any) {
      // Este bloque es el que probablemente está capturando el 'Failed to fetch'
      console.error(
        '[uploadImageToSupabase] Error grave de red/fetch. Revisa CORS/RLS/Token:',
        error.message || error
      );
      // 🔥 Cambiamos el error lanzado para ayudar a diagnosticar
      throw new Error(
        error.message ||
          'Fallo de conexión al servidor de Storage. Revisa el bucket y CORS.'
      );
    }
  }

  async guardarEspacio() {
    // Verificar autenticación antes de proceder
    const {
      data: { user },
    } = await this.supabase.auth.getUser();
    if (!user) {
      this.error = 'Debes iniciar sesión para crear espacios';
      await this.mostrarToast(this.error, 'warning');
      this.router.navigate(['/login']);
      return;
    }

    this.espacioForm.markAllAsTouched();

    if (this.espacioForm.invalid) {
      this.error =
        'Por favor, completa todos los campos obligatorios y corrige los errores.';
      this.mostrarToast(this.error!, 'danger');
      return;
    }

    this.isSaving = true;
    this.error = null;

    // 1. Obtener coordenadas ANTES de guardar
    const coordenadasObtenidas = await this.obtenerCoordenadas();

    if (!coordenadasObtenidas || !this.ubicacionSeleccionada) {
      this.isSaving = false;
      return;
    }

    let imageUrlFinal = '';
    // 2. Subir imagen si se seleccionó un archivo
    if (this.selectedFile) {
      try {
        // 🔥 Await es clave aquí, y la función usa throw para manejo de errores.
        const url = await this.uploadImageToSupabase(this.selectedFile);

        if (!url) {
          // Ya se mostró un toast en la función de subida, pero aseguramos
          await this.mostrarToast(
            'No se pudo subir la imagen. Intenta de nuevo.',
            'danger'
          );
          this.isSaving = false;
          return;
        }
        imageUrlFinal = url;
      } catch (e: any) {
        // Captura cualquier error lanzado desde uploadImageToSupabase
        console.error('Error al subir imagen en guardarEspacio:', e);
        await this.mostrarToast(
          e.message || 'Error al subir la imagen a Supabase.',
          'danger'
        );
        this.isSaving = false;
        return;
      }
    }

    try {
      // Usamos los valores del formulario y las coordenadas para el payload
      const nuevoEspacio = {
        nombre: this.espacioForm.value.nombre,
        descripcion: this.espacioForm.value.descripcion,
        capacidad: this.espacioForm.value.capacidad,
        tipo: this.espacioForm.value.tipo,
        direccion_completa: this.espacioForm.value.direccion_completa,
        latitud: this.ubicacionSeleccionada.latitud,
        longitud: this.ubicacionSeleccionada.longitud,
        imagen_url: imageUrlFinal || null, // Usamos la URL final o null
      };

      await this.espaciosService.crearNuevoEspacio(nuevoEspacio);

      // 🧾 Registrar acción en auditoría
      await this.supabaseService.registrarAuditoria('crear espacio', 'espacios', {
        nombre: nuevoEspacio.nombre,
        tipo: nuevoEspacio.tipo,
        capacidad: nuevoEspacio.capacidad,
        direccion_completa: nuevoEspacio.direccion_completa,
        latitud: nuevoEspacio.latitud,
        longitud: nuevoEspacio.longitud,
        imagen_url: nuevoEspacio.imagen_url,
      });

      await this.mostrarToast('Espacio creado con éxito!', 'success');
      this.router.navigateByUrl('/espacios', { replaceUrl: true });
    } catch (e: any) {
      this.error =
        e.message || 'Error al crear el espacio en la base de datos.';
      this.mostrarToast(this.error!, 'danger');
    } finally {
      this.isSaving = false;
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
