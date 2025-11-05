import { Injectable } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { environment } from 'src/environments/environment';

@Injectable({
  providedIn: 'root',
})
export class SupabaseService {
  private supabase: SupabaseClient;

  constructor() {
    this.supabase = createClient(
      environment.supabaseUrl,
      environment.supabaseAnonKey
    );
  }

  /** Acceso directo al cliente si es necesario */
  get client(): SupabaseClient {
    return this.supabase;
  }

  /** Wrapper de auth */
  get auth() {
    return this.supabase.auth;
  }

  /** Wrapper para tablas */
  from(table: string) {
    return this.supabase.from(table);
  }

  /** Wrapper para almacenamiento */
  storage() {
    return this.supabase.storage;
  }

  /** Wrapper para funciones RPC / Edge Functions */
  functions() {
    return this.supabase.functions;
  }

  // 👇 NUEVOS MÉTODOS
  async getActividadesPendientes() {
    const { data, error } = await this.from('actividad')
      .select('*')
      .eq('estado', 'pendiente');
    if (error) throw error;
    return data;
  }

  async cambiarEstadoActividad(id: string, nuevoEstado: string) {
  console.log('🟢 Actualizando actividad', id, '→', nuevoEstado);

  const { data, error } = await this.from('actividad')
    .update({ estado: nuevoEstado })
    .eq('id_actividad', id) // 👈 Usa el nombre real de la columna UUID
    .select();

  if (error) {
    console.error('❌ Error Supabase:', error);
    throw error;
  }

  console.log('✅ Actividad actualizada:', data);
  return data;
}
}
