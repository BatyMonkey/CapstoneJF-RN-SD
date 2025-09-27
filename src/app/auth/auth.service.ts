import { Injectable } from '@angular/core';
import { supabase } from '../core/supabase.client';

export interface Perfil {
  id_usuario: string;
  id_auth: string;
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

async signUp(email: string, password: string, nombre: string) {
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) throw error;

  // obtén la sesión (si confirmación está OFF, ya hay sesión)
  const { data: sessionData } = await supabase.auth.getSession();
  const uid = sessionData.session?.user.id ?? data.user?.id;
  if (!uid) throw new Error('No hay sesión después del registro');

  const { error: upsertError } = await supabase
    .from('usuario')
    .insert({
      id_auth: uid,          // <-- DEBE coincidir con auth.uid()
      nombre,
      correo: email,
      rol: 'vecino',
      verificado: false,
    });

  if (upsertError) throw upsertError;
}

  async signIn(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  }

  async signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  }

  async session() {
    const { data } = await supabase.auth.getSession();
    return data.session ?? null;
  }

  onAuthChange(callback: (event: string) => void) {
    supabase.auth.onAuthStateChange((event) => callback(event));
  }

  async miPerfil(): Promise<Perfil | null> {
    const ses = await this.session();
    if (!ses?.user) return null;
    const { data, error } = await supabase
      .from('usuario')
      .select('*')
      .eq('id_auth', ses.user.id)
      .single();

    if (error) return null;
    return data as Perfil;
  }
}
