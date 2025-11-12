import { Injectable } from '@angular/core';
import {
  RealtimePostgresInsertPayload,
  RealtimeChannel,
} from '@supabase/supabase-js';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { SupabaseService } from 'src/app/services/supabase.service';

export interface Votacion {
  id: string;
  titulo: string;
  descripcion?: string;
  fecha_inicio: string;
  fecha_fin: string;
  creado_por: string;
  estado?: 'programada' | 'activa' | 'finalizada' | string;
}

export interface OpcionVotacion {
  id: string;
  votacion_id: string;
  titulo: string;
  descripcion?: string | null;
  total_votos?: number;
  image_url?: string | null;
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
  constructor(private supabaseService: SupabaseService) {}

  // ============= MEDIA (cámara/galería + upload) =============
  async pickPhoto(): Promise<{ blob: Blob; ext: string; previewDataUrl: string }> {
    const photo = await Camera.getPhoto({
      quality: 80,
      allowEditing: false,
      source: CameraSource.Prompt,
      resultType: CameraResultType.DataUrl,
    });
    if (!photo?.dataUrl) throw new Error('No se obtuvo imagen');
    const ext = (photo.format || 'jpg').toLowerCase();
    const blob = await this.dataUrlToBlob(photo.dataUrl, this.extToMime(ext));
    return { blob, ext, previewDataUrl: photo.dataUrl };
  }

  async uploadOptionImage(blob: Blob, ext: string, userId?: string): Promise<string> {
    const fileName = `${userId || 'admin'}/${Date.now()}.${ext}`;
    const { error } = await this.supabaseService.client.storage.from('votaciones').upload(fileName, blob, {
      contentType: blob.type,
      upsert: true,
    });
    if (error) throw error;
    const { data } = this.supabaseService.client.storage.from('votaciones').getPublicUrl(fileName);
    return data.publicUrl;
  }

  private async dataUrlToBlob(dataUrl: string, mime: string): Promise<Blob> {
    const res = await fetch(dataUrl);
    const buf = await res.arrayBuffer();
    return new Blob([buf], { type: mime });
  }
  private extToMime(ext: string): string {
    if (ext === 'png') return 'image/png';
    if (ext === 'gif') return 'image/gif';
    return 'image/jpeg';
  }

  // --------- obtener votación + opciones (desde la vista con conteo) ----------
  async obtenerVotacionConOpciones(votacionId: string): Promise<{
    votacion: Votacion;
    opciones: OpcionVotacion[];
    miOpcionId?: string;
  }> {
    const [{ data: votacion, error: e1 }, { data: opciones, error: e2 }] =
      await Promise.all([
        this.supabaseService.client.from('votaciones').select('*').eq('id', votacionId).single(),
        this.supabaseService.client
          .from('opciones_votacion_conteo')
          .select('*')
          .eq('votacion_id', votacionId)
          .order('titulo', { ascending: true }),
      ]);
    if (e1) throw e1;
    if (e2) throw e2;

    let miOpcionId: string | undefined;
    const { data: authUser } = await this.supabaseService.client.auth.getUser();
    if (authUser.user) {
      const { data: voto } = await this.supabaseService.client
        .from('votos')
        .select('opcion_id')
        .eq('votacion_id', votacionId)
        .eq('usuario_id', authUser.user.id)
        .maybeSingle();
      if (voto?.opcion_id) miOpcionId = voto.opcion_id as string;
    }

    return {
      votacion: votacion as Votacion,
      opciones: (opciones ?? []) as OpcionVotacion[],
      miOpcionId,
    };
  }

  // --------- votar ----------
  async votar(votacionId: string, opcionId: string): Promise<void> {
    const { data: authUser } = await this.supabaseService.client.auth.getUser();
    if (!authUser.user) throw new Error('Debes iniciar sesión para votar');

    const { error } = await this.supabaseService.client.from('votos').insert({
      votacion_id: votacionId,
      opcion_id: opcionId,
      usuario_id: authUser.user.id,
    });
    if (error) throw error;
  }

  // --------- realtime INSERT en votos ----------
  suscribirVotosInsertados(
    votacionId: string,
    handler: (payload: RealtimePostgresInsertPayload<Voto>) => void
  ): RealtimeChannel {
    return this.supabaseService.client
      .channel(`votos-insert-${votacionId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'votos',
          filter: `votacion_id=eq.${votacionId}`,
        },
        (payload) => handler(payload as RealtimePostgresInsertPayload<Voto>)
      )
      .subscribe();
  }

  desuscribir(channel: RealtimeChannel) {
    this.supabaseService.client.removeChannel(channel);
  }

  // --------- listar activas ----------
  async listarVotacionesActivas(): Promise<Votacion[]> {
    const { data, error } = await this.supabaseService.client
      .from('votaciones')
      .select('*')
      .eq('estado', 'activa')
      .order('fecha_fin', { ascending: true });
    if (error) throw error;
    return (data ?? []) as Votacion[];
  }

  // --------- listar finalizadas ----------
  async listarVotacionesFinalizadas(): Promise<Votacion[]> {
    const { data, error } = await this.supabaseService.client
      .from('votaciones')
      .select('*')
      .eq('estado', 'finalizada')
      .order('fecha_fin', { ascending: false });
    if (error) throw error;
    return (data || []) as Votacion[];
  }

  // --------- crear votación con opciones (soporta descripcion + image_url) ----------
  async crearVotacionConOpciones(input: {
    titulo: string;
    descripcion?: string;
    fecha_inicio: string; // ISO
    fecha_fin: string;    // ISO
    opciones: Array<
      string |
      { titulo: string; descripcion?: string | null; image_url?: string | null }
    >;
  }): Promise<string> {
    const {
      data: { user },
      error: authErr,
    } = await this.supabaseService.client.auth.getUser();
    if (authErr) throw authErr;
    if (!user) throw new Error('Debes iniciar sesión');

    const { data: vot, error: e1 } = await this.supabaseService.client
      .from('votaciones')
      .insert([{
        titulo: input.titulo,
        descripcion: input.descripcion ?? null,
        fecha_inicio: input.fecha_inicio,
        fecha_fin: input.fecha_fin,
        creado_por: user.id,
      }])
      .select('id')
      .single();
    if (e1) throw e1;

    const votacionId = vot.id as string;

    // normaliza opciones
    const limpias = input.opciones
      .map((o) =>
        typeof o === 'string'
          ? { titulo: o.trim(), descripcion: null, image_url: null }
          : {
              titulo: (o.titulo ?? '').trim(),
              descripcion: (o.descripcion ?? null) as string | null,
              image_url: (o.image_url ?? null) as string | null,
            }
      )
      .filter((o) => o.titulo.length > 0);

    if (limpias.length < 2) throw new Error('Agrega al menos dos opciones');

    const { error: e2 } = await this.supabaseService.client.from('opciones_votacion').insert(
      limpias.map((o) => ({
        votacion_id: votacionId,
        titulo: o.titulo,
        descripcion: o.descripcion,
        image_url: o.image_url,
      }))
    );
    if (e2) throw e2;

    return votacionId;
  }
}
