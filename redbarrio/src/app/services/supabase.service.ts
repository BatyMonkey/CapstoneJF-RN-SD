import { Injectable } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { environment } from 'src/environments/environment';

@Injectable({
  providedIn: 'root'
})
export class SupabaseService {
  private supabase: SupabaseClient;

  constructor() {
    this.supabase = createClient(environment.supabaseUrl, environment.supabaseAnonKey);
  }

  /** Acceso directo al cliente si es necesario */
  get client(): SupabaseClient {
    return this.supabase;
  }

  /** Wrapper de auth */
  auth() {
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
}
