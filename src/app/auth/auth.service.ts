// src/app/auth/auth.service.ts

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
}

type Rol = 'vecino' | 'directorio' | 'administrador';

// Definición de los campos que PUEDE modificar el usuario
export type PerfilUpdatePayload = Partial<{
  segundo_nombre: string | null;
  segundo_apellido: string | null;
  telefono: string | null;
}>;

// Usamos este tipo para el registro inicial, que es más amplio
type RegisterExtras = PerfilUpdatePayload & Partial<{
  primer_nombre: string | null;
  primer_apellido: string | null;
  rut: string | null;
  direccion: string | null;
  rol: Rol;
  verificado: boolean;
}>;

export type RegisterPayload = {
  email: string;
  password: string;
  nombre: string; // Este campo será calculado/sobrescrito
  primer_nombre?: string | null;
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

    // 🎯 FUNCIÓN 1: Construye el nombre para la ACTUALIZACIÓN (usando datos actuales y nuevos)
    private construirNombreCompleto(perfil: Perfil, payload: PerfilUpdatePayload): string {
        // Obtenemos los valores fijos del perfil (primer_nombre, primer_apellido)
        const pNombre = perfil.primer_nombre || '';
        const pApellido = perfil.primer_apellido || '';
        
        // Obtenemos los valores actualizables: si vienen en payload, úsalos; si no, usa los del perfil.
        const sNombre = payload.segundo_nombre ?? perfil.segundo_nombre ?? '';
        const sApellido = payload.segundo_apellido ?? perfil.segundo_apellido ?? '';

        // Orden estricto: Primer Nombre + Segundo Nombre + Primer Apellido + Segundo Apellido
        return [pNombre, sNombre, pApellido, sApellido]
            .filter(n => n?.trim())
            .join(' ');
    }

    // 🎯 FUNCIÓN 2: Construye el nombre completo para el REGISTRO inicial
    private construirNombreRegistro(extras: RegisterPayload): string {
        const pNombre = extras.primer_nombre || '';
        const sNombre = extras.segundo_nombre || '';
        const pApellido = extras.primer_apellido || '';
        const sApellido = extras.segundo_apellido || '';

        // Orden estricto: Primer Nombre + Segundo Nombre + Primer Apellido + Segundo Apellido
        return [pNombre, sNombre, pApellido, sApellido]
            .filter(n => n?.trim())
            .join(' ');
    }


    /**
     * Registra usuario en Auth y realiza upsert en public.usuario.
     */
    async signUpFull(payload: RegisterPayload): Promise<{ needsEmailConfirm: boolean }> {
      const { email, password, ...extras } = payload;
      
      // Construir el nombre completo para guardar
      const nombreCompleto = this.construirNombreRegistro(payload);

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: nombreCompleto.trim() } },
      });
      if (error) throw error;
  
      const { data: sessionData } = await supabase.auth.getSession();
      const uid = sessionData.session?.user.id ?? data.user?.id ?? null;
  
      if (!sessionData.session) {
        localStorage.setItem(PENDING_KEY, JSON.stringify({ nombre: nombreCompleto, extras }));
        return { needsEmailConfirm: true };
      }
  
      if (!uid) throw new Error('No se obtuvo el ID de auth del usuario.');
  
      const nowIso = new Date().toISOString();
      const fullRow = {
        id_auth: uid,
        user_id: uid, 
        nombre: nombreCompleto.trim(), // Nombre completo correcto y persistente
        correo: email.toLowerCase().trim(),
        rol: 'vecino' as Rol,
        verificado: false,
        creado_en: nowIso,
        actualizado_en: nowIso,
        // CRÍTICO: Guardar los campos separados
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

    /**
     * Garantiza que exista una fila en la tabla 'usuario' para el usuario logueado.
     */
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
        if (nombre && nombre.trim()) row['nombre'] = nombre.trim();
        if (email) row['correo'] = email.toLowerCase().trim();

        const { error } = await supabase
            .from('usuario')
            .upsert(row, { onConflict: 'id_auth' });

        if (error) console.warn('ensureUsuarioRow upsert warning:', error);
    }

    /**
     * Inicia sesión y maneja datos pendientes de registro.
     */
    async signIn(email: string, password: string) {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;

        const pendingRaw = localStorage.getItem(PENDING_KEY);
        if (pendingRaw) {
            try {
                const pending = JSON.parse(pendingRaw) as { nombre?: string | null; extras?: RegisterExtras };
                await this.ensureUsuarioRow(pending?.nombre ?? null);
                
                if (pending?.extras) {
                    const updatePayload: PerfilUpdatePayload = {
                        segundo_nombre: pending.extras.segundo_nombre ?? null,
                        segundo_apellido: pending.extras.segundo_apellido ?? null,
                        telefono: pending.extras.telefono ?? null,
                    };
                    await this.updateUsuarioExtras(updatePayload);
                }
            } finally {
                localStorage.removeItem(PENDING_KEY);
            }
        } else {
            try { await this.ensureUsuarioRow(); } catch {}
        }

        return data;
    }

    /**
     * Cierra la sesión de Supabase.
     */
    async signOut() {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
    }

    /**
     * Obtiene la sesión actual.
     */
    async session(): Promise<Session | null> {
        const { data } = await supabase.auth.getSession();
        return data.session ?? null;
    }

    /**
     * Suscribe a cambios de autenticación.
     */
    onAuthChange(callback: (event: string) => void) {
        supabase.auth.onAuthStateChange((event) => callback(event));
    }

    /**
     * Obtiene la fila del perfil de la tabla 'usuario' para el usuario actual.
     */
    async miPerfil(): Promise<Perfil | null> {
        const ses = await this.session();
        if (!ses?.user) return null;
        const { data, error } = await supabase
            .from('usuario')
            .select('*')
            .eq('id_auth', ses.user.id) 
            .single();

        // PGRST116 significa "no hay filas" (normal si RLS está activo y no coincide)
        if (error && error.code !== 'PGRST116') {
            console.error("Error al obtener perfil:", error);
            return null;
        }
        
        return data as Perfil;
    }

    /**
     * Obtiene el ID de Supabase Auth del usuario actual.
     */
    async miUID(): Promise<string | null> {
        const ses = await this.session();
        return ses?.user?.id ?? null;
    }

    /**
     * Actualiza las columnas extras del usuario, reconstruyendo el nombre completo.
     */
    async updateUsuarioExtras(extras: PerfilUpdatePayload) {
        const { data: ses } = await supabase.auth.getSession();
        const uid = ses.session?.user?.id;
        if (!uid) throw new Error('No hay sesión');
        
        // 1. OBTENER el perfil actual para tener los valores fijos (primer_nombre, primer_apellido)
        const perfilActual = await this.miPerfil();
        if (!perfilActual) throw new Error('No se pudo obtener el perfil para actualizar el nombre completo.');

        // 2. CONSTRUIR el nombre completo actualizado con la lógica de persistencia
        const nuevoNombreCompleto = this.construirNombreCompleto(perfilActual, extras);
        
        // 3. Preparar el payload de actualización FINAL
        // Esto solo enviará a la base de datos los campos de 'extras' (los modificados) 
        // y el campo 'nombre' reconstruido.
        const updatePayload = {
            ...extras, 
            nombre: nuevoNombreCompleto, 
            actualizado_en: new Date().toISOString(),
        };

        const { error } = await supabase
            .from('usuario')
            .update(updatePayload)
            .eq('id_auth', uid); 

        if (error) throw error;
    }
}