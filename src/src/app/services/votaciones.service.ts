import {
  createClient,
  SupabaseClient,
  RealtimePostgresInsertPayload,
  RealtimeChannel,
} from '@supabase/supabase-js';
import { environment } from 'src/environments/environment';
import { Injectable } from '@angular/core';

export interface Votacion {
  id: string;
  titulo: string;
  descripcion?: string;
  fecha_inicio: string;
  fecha_fin: string;
  creado_por: string;
}

export interface OpcionVotacion {
  id: string;
  votacion_id: string;
  titulo: string;
  descripcion?: string;
  total_votos: number;
}

export interface Voto {
  id: string;
  votacion_id: string;
  opcion_id: string;
  usuario_id: string;
  creado_en: string;
}

@Injectable({ providedIn: 'root' })
export class VotacionesService {
  private supabase: SupabaseClient;

  constructor() {
    this.supabase = createClient(environment.supabaseUrl, environment.supabaseAnonKey);
  }

  // --------- obtener votación + opciones (desde la VISTA con conteo) ----------
  async obtenerVotacionConOpciones(votacionId: string): Promise<{
    votacion: Votacion;
    opciones: OpcionVotacion[];
    miOpcionId?: string;
  }> {
    const [{ data: votacion, error: e1 }, { data: opciones, error: e2 }] = await Promise.all([
      this.supabase.from('votaciones').select('*').eq('id', votacionId).single(),
      // 👇 usa la vista que devuelve el conteo real
      this.supabase
        .from('opciones_votacion_conteo')
        .select('*')
        .eq('votacion_id', votacionId)
        .order('titulo', { ascending: true }),
    ]);
    if (e1) throw e1;
    if (e2) throw e2;

    let miOpcionId: string | undefined;
    const { data: authUser } = await this.supabase.auth.getUser();
    if (authUser.user) {
      const { data: voto } = await this.supabase
        .from('votos')
        .select('opcion_id')
        .eq('votacion_id', votacionId)
        .eq('usuario_id', authUser.user.id)
        .maybeSingle();
      if (voto) miOpcionId = (voto as any).opcion_id;
    }

    return {
      votacion: votacion as Votacion,
      opciones: (opciones ?? []) as OpcionVotacion[],
      miOpcionId,
    };
  }

  // --------- votar ----------
  async votar(votacionId: string, opcionId: string): Promise<void> {
    const { data: authUser } = await this.supabase.auth.getUser();
    if (!authUser.user) throw new Error('Debes iniciar sesión para votar');

    const { error } = await this.supabase.from('votos').insert({
      votacion_id: votacionId,
      opcion_id: opcionId,
      usuario_id: authUser.user.id,
    } as Partial<Voto>);

    if (error) throw error;
  }

  // --------- Realtime: INSERT en votos (para reflejar votos nuevos) ----------
  suscribirVotosInsertados(
    votacionId: string,
    handler: (payload: RealtimePostgresInsertPayload<Voto>) => void
  ): RealtimeChannel {
    return this.supabase
      .channel(`votos-insert-${votacionId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'votos', filter: `votacion_id=eq.${votacionId}` },
        (payload) => handler(payload as any)
      )
      .subscribe();
  }

  desuscribir(channel: RealtimeChannel) {
    this.supabase.removeChannel(channel);
  }
  
  async listarVotacionesActivas(): Promise<Votacion[]> {
    const nowIso = new Date().toISOString();

    const { data, error } = await this.supabase
      .from('votaciones')
      .select('*')
      .lte('fecha_inicio', nowIso)
      .gte('fecha_fin', nowIso)
      .order('fecha_fin', { ascending: true });

    if (error) throw error;
    return (data ?? []) as Votacion[];
  }
}
