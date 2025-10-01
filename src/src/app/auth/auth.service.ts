// src/app/auth/auth.service.ts
import { Injectable } from '@angular/core';
import { supabase } from '../core/supabase.client';

export interface Perfil {
  id_usuario: string;   // PK de tabla usuario
  id_auth: string;      // FK → auth.users.id
  nombre: string;
  correo: string;
  rol: 'vecino'|'directorio'|'admin';
  direccion?: string;
  rut?: string;
  telefono?: string;
  verificado: boolean;
  creado_en: string;
  actualizado_en: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {

  // ----------------------------------------
  // REGISTRO
  // ----------------------------------------
  async signUp(email: string, password: string, nombre: string) {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) throw error;

    // Obtener id de usuario desde la sesión
    const { data: sessionData } = await supabase.auth.getSession();
    const uid = sessionData.session?.user.id ?? data.user?.id;
    if (!uid) throw new Error('No hay sesión después del registro');

    // Insertar en tabla usuario (solo si no existe)
    const { error: upsertError } = await supabase
      .from('usuario')
      .insert({
        id_auth: uid,   // referencia a auth.users.id
        nombre,
        correo: email,
        rol: 'vecino',
        verificado: false,
        creado_en: new Date().toISOString(),
        actualizado_en: new Date().toISOString(),
      });

    if (upsertError) throw upsertError;
  }

  // ----------------------------------------
  // LOGIN
  // ----------------------------------------
  async signIn(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  }

  // ----------------------------------------
  // LOGOUT
  // ----------------------------------------
  async signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  }

  // ----------------------------------------
  // SESIÓN ACTUAL
  // ----------------------------------------
  async session() {
    const { data } = await supabase.auth.getSession();
    return data.session ?? null;
  }

  // ----------------------------------------
  // OBSERVAR CAMBIO DE SESIÓN
  // ----------------------------------------
  onAuthChange(callback: (event: string) => void) {
    supabase.auth.onAuthStateChange((event) => callback(event));
  }

  // ----------------------------------------
  // PERFIL (tabla usuario)
  // ----------------------------------------
  async miPerfil(): Promise<Perfil | null> {
    const ses = await this.session();
    if (!ses?.user) return null;

    const { data, error } = await supabase
      .from('usuario')
      .select('*')
      .eq('id_auth', ses.user.id)   // 👈 usamos id_auth que apunta a auth.users.id
      .single();

    if (error) {
      console.error('❌ Error al obtener perfil:', error);
      return null;
    }
    return data as Perfil;
  }

  // ----------------------------------------
  // UID (auth.users.id) directo para usar en reserva
  // ----------------------------------------
  async miUID(): Promise<string | null> {
    const ses = await this.session();
    return ses?.user?.id ?? null;
  }
}