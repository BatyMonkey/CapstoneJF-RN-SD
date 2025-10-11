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
}

@Injectable({ providedIn: 'root' })
export class AuthService {

  /**
   * Registra usuario en Auth y, si hay sesión disponible (confirmación OFF),
   * realiza upsert en public.usuario. Si hay confirmación ON, devuelve
   * needsEmailConfirm=true para que el insert se haga luego del primer login.
   */
  async signUp(email: string, password: string, nombre: string): Promise<{ needsEmailConfirm: boolean }> {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: nombre?.trim() || '' } },
    });
    if (error) throw error;

    // Si confirmación está OFF, habrá session; si está ON, no.
    const { data: sessionData } = await supabase.auth.getSession();
    const uid = sessionData.session?.user.id ?? data.user?.id ?? null;

    // Si no hay sesión aún (confirmación por correo)
    if (!sessionData.session) {
      // No podemos insertar por RLS (no auth.uid()), así que devolvemos bandera.
      return { needsEmailConfirm: true };
    }

    if (!uid) throw new Error('No se obtuvo el ID de auth del usuario.');

    // Insert/Upsert en tu tabla. Usamos onConflict para no duplicar.
    const nowIso = new Date().toISOString();
    const { error: upsertError } = await supabase
      .from('usuario')
      .upsert({
        id_auth: uid,         // Debe coincidir con auth.uid() para RLS
        user_id: uid,         
        nombre: nombre?.trim(),
        correo: email.toLowerCase().trim(),
        rol: 'vecino',
        verificado: false,
        creado_en: nowIso,
        actualizado_en: nowIso,
      }, { onConflict: 'id_auth' }); // o 'user_id' si ese es unique

    if (upsertError) throw upsertError;

    return { needsEmailConfirm: false };
  }

  /**
   * Llamar después de signIn, por si el registro no pudo crear fila en usuario
   * (confirmación ON). Hace upsert idempotente.
   */
  async ensureUsuarioRow(nombre?: string | null): Promise<void> {
    const { data: ses } = await supabase.auth.getSession();
    const uid = ses.session?.user?.id;
    const email = ses.session?.user?.email;
    if (!uid || !email) return;

    const nowIso = new Date().toISOString();
    const { error } = await supabase
      .from('usuario')
      .upsert({
        id_auth: uid,
        user_id: uid,
        nombre: (nombre ?? '').trim(),
        correo: email.toLowerCase().trim(),
        rol: 'vecino',
        verificado: false,
        actualizado_en: nowIso,
        // creado_en: si tu DB tiene DEFAULT now(), puedes omitirlo;
        // si no, lo mandamos para primera inserción:
        creado_en: nowIso,
      }, { onConflict: 'id_auth' });

    // No levantamos error al front si ya existe o falla suave
    if (error) console.warn('ensureUsuarioRow upsert warning:', error);
  }

  async signIn(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    // Intento de crear/actualizar la fila del usuario (por si no estaba)
    try { await this.ensureUsuarioRow(); } catch {}
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

  // Actualiza columnas extra en public.usuario (requiere sesión por RLS)
async updateUsuarioExtras(extras: Partial<{
  segundo_nombre: string | null;
  primer_apellido: string | null;
  segundo_apellido: string | null;
  rut: string | null;
  direccion: string | null;
  telefono: string | null;
  rol: 'vecino' | 'directorio' | 'admin';
  verificado: boolean;
}>) {
  const { data: ses } = await supabase.auth.getSession();
  const uid = ses.session?.user?.id;
  if (!uid) throw new Error('No hay sesión');

  const { error } = await supabase
    .from('usuario')
    .update({ ...extras, actualizado_en: new Date().toISOString() })
    .eq('id_auth', uid);

  if (error) throw error;
}

// Llamar al iniciar sesión para aplicar extras guardados si hubo confirmación por correo
async applyPendingExtrasIfAny() {
  const raw = localStorage.getItem('rb_pending_extras');
  if (!raw) return;
  try {
    const extras = JSON.parse(raw);
    await this.updateUsuarioExtras(extras);
  } finally {
    localStorage.removeItem('rb_pending_extras');
  }
}

}
