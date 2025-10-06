import { Injectable } from '@angular/core';
import { supabase } from '../core/supabase.client';

export interface Perfil {
  id_usuario: string;
  id_auth: string;
  user_id: string;
  nombre: string;
  correo: string;
  rol: 'vecino' | 'directorio' | 'admin';
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
}

type Rol = 'vecino' | 'directorio' | 'admin';

type RegisterExtras = Partial<{
  primer_nombre: string | null;
  segundo_nombre: string | null;
  primer_apellido: string | null;
  segundo_apellido: string | null;
  rut: string | null;
  direccion: string | null;
  telefono: string | null;
  rol: Rol;
  verificado: boolean;
}>;

type RegisterPayload = {
  email: string;
  password: string;
  nombre: string;                 // nombre completo (columna `nombre`)
  primer_nombre?: string | null;  // campos separados
  segundo_nombre?: string | null;
  primer_apellido?: string | null;
  segundo_apellido?: string | null;
  rut?: string | null;
  direccion?: string | null;
  telefono?: string | null;
};

const PENDING_KEY = 'rb_pending_full';

@Injectable({ providedIn: 'root' })
export class AuthService {

  async signUpFull(payload: RegisterPayload): Promise<{ needsEmailConfirm: boolean }> {
    const { email, password, nombre, ...extras } = payload;

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: (nombre ?? '').trim() } },
    });
    if (error) throw error;

    const { data: sessionData } = await supabase.auth.getSession();
    const uid = sessionData.session?.user.id ?? data.user?.id ?? null;

    // Sin sesión (confirmación ON) -> guardamos todo para el primer login
    if (!sessionData.session) {
      localStorage.setItem(PENDING_KEY, JSON.stringify({ nombre, extras }));
      return { needsEmailConfirm: true };
    }

    if (!uid) throw new Error('No se obtuvo el ID de auth del usuario.');

    const nowIso = new Date().toISOString();
    const fullRow = {
      id_auth: uid,
      user_id: uid,
      nombre: (nombre ?? '').trim(),
      correo: email.toLowerCase().trim(),
      rol: 'vecino' as Rol,
      verificado: false,
      creado_en: nowIso,
      actualizado_en: nowIso,
      // separados
      primer_nombre: (extras.primer_nombre ?? null) as string | null,
      segundo_nombre: (extras.segundo_nombre ?? null) as string | null,
      primer_apellido: (extras.primer_apellido ?? null) as string | null,
      segundo_apellido: (extras.segundo_apellido ?? null) as string | null,
      rut: (extras.rut ?? null) as string | null,
      direccion: (extras.direccion ?? null) as string | null,
      telefono: (extras.telefono ?? null) as string | null,
    };

    const { error: upsertError } = await supabase
      .from('usuario')
      .upsert(fullRow, { onConflict: 'id_auth' });

    if (upsertError) throw upsertError;

    return { needsEmailConfirm: false };
  }

  // ⚠️ No sobrescribir 'nombre' si no viene
  async ensureUsuarioRow(nombre?: string | null): Promise<void> {
    const { data: ses } = await supabase.auth.getSession();
    const uid = ses.session?.user?.id;
    const email = ses.session?.user?.email;
    if (!uid || !email) return;

    const nowIso = new Date().toISOString();

    // Construimos el objeto dinámicamente
    const row: Record<string, any> = {
      id_auth: uid,
      user_id: uid,
      rol: 'vecino',
      verificado: false,
      actualizado_en: nowIso,
      creado_en: nowIso,
    };
    if (nombre && nombre.trim()) row['nombre'] = nombre.trim();
    if (email) row['correo'] = email.toLowerCase().trim();


    const { error } = await supabase
      .from('usuario')
      .upsert(row, { onConflict: 'id_auth' });

    if (error) console.warn('ensureUsuarioRow upsert warning:', error);
  }

  async signIn(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;

    // Si había datos pendientes (confirmación ON), creamos la fila base con 'nombre'
    // y luego actualizamos extras. Si no, no tocamos 'nombre'.
    const pendingRaw = localStorage.getItem(PENDING_KEY);
    if (pendingRaw) {
      try {
        const pending = JSON.parse(pendingRaw) as { nombre?: string | null; extras?: RegisterExtras };
        await this.ensureUsuarioRow(pending?.nombre ?? null);
        if (pending?.extras) await this.updateUsuarioExtras(pending.extras);
      } finally {
        localStorage.removeItem(PENDING_KEY);
      }
    } else {
      // Garantiza fila base si faltara, pero sin pisar 'nombre'
      try { await this.ensureUsuarioRow(); } catch {}
    }

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

  async miUID(): Promise<string | null> {
    const ses = await this.session();
    return ses?.user?.id ?? null;
  }

  async updateUsuarioExtras(extras: RegisterExtras) {
    const { data: ses } = await supabase.auth.getSession();
    const uid = ses.session?.user?.id;
    if (!uid) throw new Error('No hay sesión');

    // Nunca tocamos 'nombre' aquí: solo extras
    const { error } = await supabase
      .from('usuario')
      .update({ ...extras, actualizado_en: new Date().toISOString() })
      .eq('id_auth', uid);

    if (error) throw error;
  }
}

