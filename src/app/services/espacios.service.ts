import { Injectable } from '@angular/core';
import { supabase } from '../core/supabase.client'; 

// 🚨 CORRECCIÓN 1: Cambiar 'ubicacion' por 'direccion_con' en la interfaz
export interface Espacio {
  id_espacio: number; 
  nombre: string;
  tipo: string; 
  capacidad: number;
  descripcion: string | null;
  creado_en: string;
  actualizado_e: string | null;
  
  // 💡 ESTO DEBE COINCIDIR EXACTAMENTE CON TU BASE DE DATOS
  direccion_completa: string; 
  
  latitud: number;
  longitud: number;
}

@Injectable({
  providedIn: 'root'
})
export class EspaciosService {

  constructor() { }

  /**
   * Obtiene la lista completa de espacios desde la tabla 'espacio'.
   */
  async obtenerEspacios(): Promise<Espacio[]> {
    const { data, error } = await supabase
      .from('espacio')
      .select('*') // Obtiene todos los campos
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
    
    // 🚨 ATENCIÓN: Se usa el ID numérico del 'tipo'
    const { data, error } = await supabase
      .from('espacio')
      .insert([
        {
          nombre: espacioData.nombre,
          descripcion: espacioData.descripcion,
          capacidad: espacioData.capacidad,
          tipo: espacioData.tipo, // 🚨 Insertando el ID numérico del tipo
          direccion_completa: espacioData.direccion_completa,
          latitud: espacioData.latitud,
          longitud: espacioData.longitud,
        }
      ])
      .select();

    if (error) {
      console.error('Error de Supabase al crear el espacio:', error);
      throw new Error(`Error al guardar: ${error.message}`);
    }

    return data;
  }
}