import { Injectable } from '@angular/core';
import { SupabaseService } from './supabase.service';

export interface Espacio {
  id_espacio: number;
  nombre: string;
  capacidad: number;
  descripcion: string | null;
  creado_en: string;
  actualizado_en: string;

  // Campos de ubicación
  direccion_completa: string;
  latitud: number;
  longitud: number;

  // Nuevos campos que estás usando en la app
  precio: string;                 // texto, ej: "$10.000/hora"
  servicios: string[];            // array de servicios
  imagen_url?: string | null;     // URL de la imagen asociada al espacio
}

@Injectable({
  providedIn: 'root',
})
export class EspaciosService {
  constructor(private supabaseService: SupabaseService) {}

  /**
   * Obtiene la lista completa de espacios desde la tabla 'espacio'.
   */
  async obtenerEspacios(): Promise<Espacio[]> {
    const { data, error } = await this.supabaseService.client
      .from('espacio')
      .select('*')
      .order('nombre', { ascending: true });

    if (error) {
      console.error('Error al obtener los espacios:', error);
      throw new Error('No se pudo cargar la lista de espacios.');
    }

    return (data as Espacio[]) || [];
  }

  /**
   * Crea un nuevo espacio en la tabla 'espacio' de la base de datos.
   */
  async crearNuevoEspacio(espacioData: any): Promise<any> {
    console.log('Datos a insertar:', espacioData);

    const { data, error } = await this.supabaseService.client
      .from('espacio')
      .insert([
        {
          nombre: espacioData.nombre,
          descripcion: espacioData.descripcion,
          capacidad: espacioData.capacidad,
          // 👇 ya NO se usa 'tipo'
          direccion_completa: espacioData.direccion_completa,
          latitud: espacioData.latitud,
          longitud: espacioData.longitud,
          imagen_url: espacioData.imagen_url || null,
          precio: espacioData.precio,                 // nuevo campo
          servicios: espacioData.servicios || [],     // array de servicios
        },
      ])
      .select();

    if (error) {
      console.error('Error de Supabase al crear el espacio:', error);
      throw new Error(`Error al guardar: ${error.message}`);
    }

    return data;
  }

  async obtenerEspacioPorId(id: number): Promise<Espacio | null> {
    const { data, error } = await this.supabaseService.client
      .from('espacio')
      .select('*')
      .eq('id_espacio', id)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Error al obtener espacio por ID:', error);
      throw new Error(`No se pudo cargar el espacio: ${error.message}`);
    }

    return (data as Espacio) || null;
  }
}
