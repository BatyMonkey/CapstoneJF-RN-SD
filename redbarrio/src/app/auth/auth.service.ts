import { Injectable } from '@angular/core';
import { supabase } from '../core/supabase.client';
import { Session } from '@supabase/supabase-js';
import { Capacitor } from '@capacitor/core';

// ==========================================================
// 🧩 Interfaces y tipos
// ==========================================================

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
  url_foto_perfil?: string | null;
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
  url_foto_perfil: string | null;
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
const UID_KEY = 'rb_last_uid';

// ==========================================================
// 🔑 Servicio principal de autenticación
// ==========================================================

@Injectable({ providedIn: 'root' })
export class AuthService {
  private currentSession: Session | null = null;
  private perfilCache: Perfil | null = null;

  constructor() {
    // 🔄 Mantiene la sesión activa tras reload o navegación
    supabase.auth.onAuthStateChange((_event, session) => {
      this.currentSession = session;
      if (session?.user?.id) {
        localStorage.setItem(UID_KEY, session.user.id);
      } else {
        localStorage.removeItem(UID_KEY);
      }
    });
  }

  // ==========================================================
  // 🧠 Persistencia de sesión
  // ==========================================================

  async waitForActiveSession(maxWaitMs = 2500): Promise<Session | null> {
    let waited = 0;
    const step = 250;
    let ses = (await supabase.auth.getSession()).data.session;

    while (!ses && waited < maxWaitMs) {
      await new Promise((res) => setTimeout(res, step));
      waited += step;
      ses = (await supabase.auth.getSession()).data.session;
    }

    if (!ses && localStorage.getItem(UID_KEY)) {
      const uid = localStorage.getItem(UID_KEY);
      if (uid) {
        const { data } = await supabase
          .from('usuario')
          .select('*')
          .eq('id_auth', uid)
          .maybeSingle();
        if (data) {
          this.perfilCache = data as Perfil;
          return {
            access_token: '',
            token_type: 'bearer',
            user: { id: uid } as any,
          } as Session;
        }
      }
    }

    this.currentSession = ses ?? null;
    return this.currentSession;
  }

  // ==========================================================
  // 🧩 Métodos auxiliares
  // ==========================================================

  private construirNombreCompleto(perfil: Perfil, extras: Partial<RegisterExtras>): string {
    const pNombre = perfil.primer_nombre || '';
    const sNombre = extras.segundo_nombre ?? perfil.segundo_nombre ?? '';
    const pApellido = perfil.primer_apellido || '';
    const sApellido = extras.segundo_apellido ?? perfil.segundo_apellido ?? '';
    return [pNombre, sNombre, pApellido, sApellido].filter((n) => n?.trim()).join(' ');
  }

  private construirNombreRegistro(payload: RegisterPayload): string {
    const pNombre = payload.primer_nombre || '';
    const sNombre = payload.segundo_nombre || '';
    const pApellido = payload.primer_apellido || '';
    const sApellido = payload.segundo_apellido || '';
    return [pNombre, sNombre, pApellido, sApellido].filter((n) => n?.trim()).join(' ');
  }

  // ==========================================================
  // 🧾 Registro y autenticación
  // ==========================================================

  async signUpFull(payload: RegisterPayload): Promise<{ needsEmailConfirm: boolean }> {
    const { email, password, ...extras } = payload;
    const nombreCompleto = payload.nombre?.trim() || this.construirNombreRegistro(payload);

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: nombreCompleto } },
    });
    if (error) throw error;

    const { data: sessionData } = await supabase.auth.getSession();
    const uid = sessionData.session?.user.id ?? data.user?.id ?? null;

    // Si requiere verificación de email
    if (!sessionData.session) {
      localStorage.setItem(PENDING_KEY, JSON.stringify({ nombre: nombreCompleto, extras }));
      return { needsEmailConfirm: true };
    }

    if (!uid) throw new Error('No se obtuvo el ID de auth del usuario.');

    const nowIso = new Date().toISOString();
    const row = {
      id_auth: uid,
      user_id: uid,
      nombre: nombreCompleto,
      correo: email.toLowerCase().trim(),
      rol: 'vecino' as Rol,
      verificado: false,
      creado_en: nowIso,
      actualizado_en: nowIso,
      ...extras,
    };

    const { error: upsertError } = await supabase.from('usuario').upsert(row, { onConflict: 'id_auth' });
    if (upsertError) throw upsertError;

    return { needsEmailConfirm: false };
  }

  async signIn(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;

    if (data.user?.id) localStorage.setItem(UID_KEY, data.user.id);

    // Si había registro pendiente, se completa
    const pendingRaw = localStorage.getItem(PENDING_KEY);
    if (pendingRaw) {
      try {
        const pending = JSON.parse(pendingRaw) as { nombre?: string | null; extras?: RegisterExtras };
        await this.ensureUsuarioRow(pending?.nombre ?? null);
        if (pending?.extras) {
          await this.updateUsuarioExtras(pending.extras);
        }
      } finally {
        localStorage.removeItem(PENDING_KEY);
      }
    } else {
      await this.ensureUsuarioRow();
    }

    // Guarda el perfil en caché local
    const perfil = await this.miPerfil();
    if (perfil) this.setUsuarioForzado(perfil);

    return data;
  }

  async signOut() {
    await supabase.auth.signOut();
    this.currentSession = null;
    this.perfilCache = null;
    localStorage.removeItem(UID_KEY);
    localStorage.removeItem('rb_usuario_activo');
  }

  // ==========================================================
  // 👤 Perfil y sesión
  // ==========================================================

  async session(): Promise<Session | null> {
    const { data } = await supabase.auth.getSession();
    return data.session ?? null;
  }

  async miUID(): Promise<string | null> {
    const ses = await this.waitForActiveSession();
    return ses?.user?.id ?? localStorage.getItem(UID_KEY);
  }

  async miPerfil(): Promise<Perfil | null> {
    if (this.perfilCache) return this.perfilCache;

    const ses = await this.waitForActiveSession();
    const uid = ses?.user?.id ?? localStorage.getItem(UID_KEY);
    if (!uid) return null;

    const { data, error } = await supabase.from('usuario').select('*').eq('id_auth', uid).maybeSingle();
    if (error) {
      console.warn('Error al obtener perfil:', error.message);
      return null;
    }

    this.perfilCache = data as Perfil;
    return this.perfilCache;
  }

  async ensureUsuarioRow(nombre?: string | null): Promise<void> {
    const ses = await this.waitForActiveSession();
    const uid = ses?.user?.id;
    const email = ses?.user?.email;
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

    const { error } = await supabase.from('usuario').upsert(row, { onConflict: 'id_auth' });
    if (error) console.warn('ensureUsuarioRow warning:', error.message);
  }

  async updateUsuarioExtras(extras: RegisterExtras) {
    const ses = await this.waitForActiveSession();
    const uid = ses?.user?.id ?? localStorage.getItem(UID_KEY);
    if (!uid) throw new Error('No hay sesión');

    const perfil = await this.miPerfil();
    if (!perfil) throw new Error('No se pudo obtener el perfil para actualizar.');

    const nuevoNombre = this.construirNombreCompleto(perfil, extras);
    const payload = { ...extras, nombre: nuevoNombre, actualizado_en: new Date().toISOString() };

    const { error } = await supabase.from('usuario').update(payload).eq('id_auth', uid);
    if (error) throw error;

    this.perfilCache = { ...perfil, ...payload };
  }

  async checkIfAdmin(): Promise<boolean> {
    try {
      const perfil = await this.miPerfil();
      return perfil?.rol === 'administrador' || perfil?.rol === 'directorio';
    } catch {
      return false;
    }
  }

  // ==========================================================
  // 🔐 Recuperación de contraseña y actualización
  // ==========================================================

  async sendPasswordResetLink(email: string): Promise<void> {
    const redirectUrl = 'myapp://auth/reset';
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: redirectUrl });
    if (error) {
      if (error.message?.includes('not found')) throw new Error('No se encontró una cuenta con ese correo.');
      throw error;
    }
  }

  async updateUser(attributes: { password?: string; data?: object }): Promise<void> {
    const { error } = await supabase.auth.updateUser(attributes);
    if (error) throw new Error(error.message);
  }

  // ==========================================================
  // 🧰 Modo desarrollo (persistencia local de usuario)
  // ==========================================================

  getUsuarioForzado(): Perfil | null {
    try {
      const perfilCache = this.perfilCache;
      if (perfilCache) return perfilCache;

      const perfilLocal = localStorage.getItem('rb_usuario_activo');
      if (perfilLocal) return JSON.parse(perfilLocal) as Perfil;

      return null;
    } catch {
      return null;
    }
  }

  setUsuarioForzado(perfil: Perfil) {
    this.perfilCache = perfil;
    localStorage.setItem('rb_usuario_activo', JSON.stringify(perfil));
  }
}