import { createClient } from '@supabase/supabase-js';
import { environment } from '../../environments/environment';

/**
 * Cliente ÚNICO de Supabase (singleton).
 * - detectSessionInUrl: permite a Supabase leer tokens si alguna vez vuelven en la URL.
 * - storageKey: clave propia para evitar conflictos con otros proyectos.
 */
export const supabase = createClient(
  environment.supabaseUrl,
  environment.supabaseAnonKey,
  {
    auth: {
      storageKey: 'rb_auth',
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
    },
  }
);
