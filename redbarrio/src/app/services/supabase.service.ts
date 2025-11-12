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

  // 🟢 Obtener actividades pendientes
  async getActividadesPendientes() {
    const { data, error } = await this.from('actividad')
      .select('*')
      .eq('estado', 'pendiente');

    if (error) {
      console.error('❌ Error al obtener actividades:', error);
      throw error;
    }

    return data;
  }

  /**
   * 🟢 Cambia el estado de una actividad (publicar o rechazar)
   */
  async cambiarEstadoActividad(id_actividad: string, nuevoEstado: string) {
    try {
      console.log(`🔄 Cambiando estado de ${id_actividad} a ${nuevoEstado}`);

      const { data, error } = await this.from('actividad')
        .update({ estado: nuevoEstado }) // ← ahora guarda "publicada" o "rechazada"
        .eq('id_actividad', id_actividad)
        .select();

      if (error) {
        console.error('❌ Error al cambiar estado:', error);
        throw error;
      }

      console.log('✅ Actividad actualizada correctamente:', data);
      return data;
    } catch (err) {
      console.error('❌ Error inesperado al actualizar actividad:', err);
      throw err;
    }
  }

  /** =========================================================
   * 🔹 Obtener proyectos pendientes
   * ========================================================= */
  async getProyectosPendientes() {
    const { data, error } = await this.supabase
      .from('proyecto')
      .select('*')
      .eq('estado', 'pendiente')
      .order('fecha_creacion', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  /** =========================================================
   * 🔹 Cambiar estado de un proyecto
   * ========================================================= */
  /** =========================================================
   * 🔹 Cambiar estado de un proyecto
   * ========================================================= */
  async cambiarEstadoProyecto(id_proyecto: string, nuevoEstado: string) {
    console.log('🟦 Actualizando proyecto →', id_proyecto, 'a', nuevoEstado);

    if (!id_proyecto) {
      console.error('❌ No se recibió id_proyecto válido');
      throw new Error('ID de proyecto no válido.');
    }

    const { data, error, status } = await this.supabase
      .from('proyecto')
      .update({
        estado: nuevoEstado,
        actualizado_en: new Date().toISOString(),
      })
      .eq('id_proyecto', id_proyecto)
      .select();

    console.log('🟨 Estado HTTP:', status);
    if (error) {
      console.error('❌ Error Supabase:', error.message);
      throw error;
    }

    if (!data?.length) {
      console.warn(
        '⚠️ No se actualizó ninguna fila. Verifica id_proyecto:',
        id_proyecto
      );
    } else {
      console.log('✅ Proyecto actualizado:', data);
    }

    return data;
  }

  /** Registra una acción de auditoría */
  async registrarAuditoria(accion: string, tabla: string, detalle: any) {
    try {
      const { data: userData, error: userError } =
        await this.supabase.auth.getUser();
      if (userError) throw userError;

      const user = userData?.user;
      if (!user) return;

      // 🔎 Buscar nombre del usuario desde la tabla "usuario"
      const { data: perfil, error: perfilError } = await this.supabase
        .from('usuario')
        .select('nombre')
        .eq('id_auth', user.id)
        .single();

      const nombre_usuario = perfil?.nombre || '(sin nombre)';

      // 🧾 Registrar auditoría
      const { error } = await this.supabase.from('auditoria').insert({
        id_auth: user.id,
        nombre_usuario,
        accion,
        tabla,
        detalle,
      });

      if (error) throw error;

      console.log('📝 Auditoría registrada:', accion, tabla, detalle);
    } catch (err) {
      console.error('❌ Error al registrar auditoría:', err);
    }
  }
}
