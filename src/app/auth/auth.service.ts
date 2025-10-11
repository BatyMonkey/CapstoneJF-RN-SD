import { Injectable } from '@angular/core';
import { supabase } from '../core/supabase.client';
import { Session } from '@supabase/supabase-js';

export interface Perfil {
  id_usuario: string;
  id_auth: string;
  user_id: string;
  nombre: string;
  correo: string;
  rol: 'vecino' | 'directorio' | 'administrador';
  direccion?: string | null;
  rut?: string | null;
  telefono?: string | null;
  verificado: boolean;
  creado_en: string;
  actualizado_en: string;
  segundo_nombre?: string | null;
  primer_apellido?: string | null;
  segundo_apellido?: string | null;
  primer_nombre: string | null;
  fecha_nacimiento?: string | null;
  sexo?: 'M' | 'F' | null;
}

type Rol = 'vecino' | 'directorio' | 'administrador';

export type RegisterExtras = Partial<{
  primer_nombre: string | null;
  segundo_nombre: string | null;
  primer_apellido: string | null;
  segundo_apellido: string | null;
  rut: string | null;
  direccion: string | null;
  telefono: string | null;
  rol: Rol;
  verificado: boolean;
  fecha_nacimiento: string | null;
  sexo: 'M' | 'F' | null;
}>;

export type RegisterPayload = {
  email: string;
  password: string;
  nombre?: string;
  primer_nombre?: string | null;
  segundo_nombre?: string | null;
  primer_apellido?: string | null;
  segundo_apellido?: string | null;
  rut?: string | null;
  direccion?: string | null;
  telefono?: string | null;
  fecha_nacimiento?: string | null;
  sexo?: 'M' | 'F' | null;
};

const PENDING_KEY = 'rb_pending_full';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private construirNombreCompleto(
    perfil: Perfil,
    extras: Partial<RegisterExtras>
  ): string {
    const pNombre = perfil.primer_nombre || '';
    const sNombre = extras.segundo_nombre ?? perfil.segundo_nombre ?? '';
    const pApellido = perfil.primer_apellido || '';
    const sApellido = extras.segundo_apellido ?? perfil.segundo_apellido ?? '';
    return [pNombre, sNombre, pApellido, sApellido]
      .filter((n) => n?.trim())
      .join(' ');
  }

  private construirNombreRegistro(payload: RegisterPayload): string {
    const pNombre = payload.primer_nombre || '';
    const sNombre = payload.segundo_nombre || '';
    const pApellido = payload.primer_apellido || '';
    const sApellido = payload.segundo_apellido || '';
    return [pNombre, sNombre, pApellido, sApellido]
      .filter((n) => n?.trim())
      .join(' ');
  }

  async signUpFull(
    payload: RegisterPayload
  ): Promise<{ needsEmailConfirm: boolean }> {
    const { email, password, ...extras } = payload;

    const nombreCompleto =
      payload.nombre?.trim() || this.construirNombreRegistro(payload);

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: nombreCompleto } },
    });
    if (error) throw error;

    const { data: sessionData } = await supabase.auth.getSession();
    const uid = sessionData.session?.user.id ?? data.user?.id ?? null;

    if (!sessionData.session) {
      localStorage.setItem(
        PENDING_KEY,
        JSON.stringify({ nombre: nombreCompleto, extras })
      );
      return { needsEmailConfirm: true };
    }

    if (!uid) throw new Error('No se obtuvo el ID de auth del usuario.');

    const nowIso = new Date().toISOString();
    const fullRow = {
      id_auth: uid,
      user_id: uid,
      nombre: nombreCompleto,
      correo: email.toLowerCase().trim(),
      rol: 'vecino' as Rol,
      verificado: false,
      creado_en: nowIso,
      actualizado_en: nowIso,
      primer_nombre: extras.primer_nombre ?? null,
      segundo_nombre: extras.segundo_nombre ?? null,
      primer_apellido: extras.primer_apellido ?? null,
      segundo_apellido: extras.segundo_apellido ?? null,
      rut: extras.rut ?? null,
      direccion: extras.direccion ?? null,
      telefono: extras.telefono ?? null,
      fecha_nacimiento: extras.fecha_nacimiento ?? null,
      sexo: extras.sexo ?? null,
    };

    const { error: upsertError } = await supabase
      .from('usuario')
      .upsert(fullRow, { onConflict: 'id_auth' });

    if (upsertError) throw upsertError;

    return { needsEmailConfirm: false };
  }

  async ensureUsuarioRow(nombre?: string | null): Promise<void> {
    const { data: ses } = await supabase.auth.getSession();
    const uid = ses.session?.user?.id;
    const email = ses.session?.user?.email;
    if (!uid || !email) return;

    const nowIso = new Date().toISOString();
    const row: Record<string, any> = {
      id_auth: uid,
      user_id: uid,
      rol: 'vecino',
      verificado: false,
      actualizado_en: nowIso,
      creado_en: nowIso,
    };

    if (nombre?.trim()) row['nombre'] = nombre.trim();
    if (email) row['correo'] = email.toLowerCase().trim();

    const { error } = await supabase
      .from('usuario')
      .upsert(row, { onConflict: 'id_auth' });

    if (error) console.warn('ensureUsuarioRow upsert warning:', error);
  }

  async signIn(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;

    const pendingRaw = localStorage.getItem(PENDING_KEY);
    if (pendingRaw) {
      try {
        const pending = JSON.parse(pendingRaw) as {
          nombre?: string | null;
          extras?: RegisterExtras;
        };
        await this.ensureUsuarioRow(pending?.nombre ?? null);
        if (pending?.extras) {
          await this.updateUsuarioExtras(pending.extras);
        }
      } finally {
        localStorage.removeItem(PENDING_KEY);
      }
    } else {
      try {
        await this.ensureUsuarioRow();
      } catch {}
    }

    return data;
  }

  async signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  }

  async session(): Promise<Session | null> {
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

    if (error) {
      console.error('Error al obtener perfil:', error);
      return null;
    }

    return data as Perfil;
  }

  async miUID(): Promise<string | null> {
    const ses = await this.session();
    return ses?.user?.id ?? null;
  }

  async updateUsuarioExtras(extras: RegisterExtras) {
    const { data: ses } = await supabase.auth.getSession();
    const uid = ses.session?.user?.id;
    if (!uid) throw new Error('No hay sesión');

    const perfil = await this.miPerfil();
    if (!perfil)
      throw new Error('No se pudo obtener el perfil para actualizar.');

    const nuevoNombre = this.construirNombreCompleto(perfil, extras);

    const payload: Record<string, any> = {
      ...extras,
      nombre: nuevoNombre,
      actualizado_en: new Date().toISOString(),
    };

    const { error } = await supabase
      .from('usuario')
      .update(payload)
      .eq('id_auth', uid);

    if (error) throw error;
  }

  async checkIfAdmin(): Promise<boolean> {
    try {
      const perfil = await this.miPerfil();
      return perfil?.rol === 'administrador' || perfil?.rol === 'directorio';
    } catch (e) {
      console.error('Error al verificar el rol de administrador:', e);
      return false;
    }
  }

  async sendPasswordResetLink(email: string): Promise<void> {
    // 🚨 NOTA: La URL debe ser la dirección completa (localhost:port/ruta) de tu componente.
    const redirectUrl = 'http://localhost:8100/auth/recuperar-contrasena';

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      // 🚨 CORRECCIÓN CLAVE: Esto asegura que el email apunte al lugar correcto en tu app.
      redirectTo: redirectUrl,
    });

    if (error) {
      // Manejo de errores (ej: correo no encontrado)
      if (error.message.includes('not found')) {
        throw new Error('No se encontró una cuenta con ese correo.');
      }
      throw error;
    }
  }

  async updateUser(attributes: {
    password?: string;
    data?: object;
  }): Promise<void> {
    const { error } = await supabase.auth.updateUser(attributes);

    if (error) {
      throw new Error(error.message);
    }
  }
}
