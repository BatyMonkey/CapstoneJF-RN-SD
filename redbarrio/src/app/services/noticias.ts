import { Injectable } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { environment } from 'src/environments/environment';
import { Perfil } from '../auth/auth.service';

// Define una interfaz para tus noticias
export interface Noticia {
  id?: number;
  titulo: string;
  contenido: string;
  user_id?: string;
  fecha_creacion?: string;
  nombre_autor?: string;
  // CRUCIAL: Acepta string, null o undefined para compatibilidad con Storage
  url_foto?: string | null; 
}

@Injectable({
  providedIn: 'root'
})
export class NoticiasService {
  private supabase: SupabaseClient;
  private perfilCache: Perfil | null = null;
  private readonly TABLE_VIEW = 'noticias_con_autor';
  private readonly TABLE_NAME = 'noticias'; // Tabla real para INSERT
  private readonly BUCKET_NAME = 'noticias-bucket'; 

  constructor() {
    this.supabase = createClient(
      environment.supabaseUrl,
      environment.supabaseAnonKey
    );
  }

  /**
   * Intenta obtener la sesión del usuario. Devuelve el UID o null.
   */
  async getCurrentUserId(): Promise<string | null> {
    try {
      // Usamos getUser() para obtener la información del usuario actual.
      const { data: { user }, error } = await this.supabase.auth.getUser();
      if (error) throw error;
      return user?.id || null;
    } catch (error) {
      console.error("Error al obtener el usuario de Supabase:", error);
      return null;
    }
  }

  // Métodos para persistir un usuario "forzado" localmente (modo desarrollo)
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

  /**
   * Obtiene todas las noticias desde la vista (con JOIN de autor).
   */
  async getNoticias(): Promise<Noticia[] | null> {
    const { data, error } = await this.supabase
      .from(this.TABLE_VIEW)
      .select(`*`)
      .order('fecha_creacion', { ascending: false });

    if (error) {
      console.warn('Error al obtener noticias:', error);
      return null;
    }
    return data as Noticia[];
  }

  /**
   * Obtiene una sola noticia por ID para la página de detalle.
   */
  async getNoticiaById(id: number): Promise<Noticia | null> {
    const { data, error } = await this.supabase
      .from(this.TABLE_VIEW)
      .select(`*`)
      .eq('id', id)
      .single();

    if (error) {
      console.error('Error al obtener el detalle de la noticia:', error);
      return null;
    }
    return data as Noticia;
  }

  /**
   * Sube la foto al Supabase Storage usando crypto.randomUUID() para el nombre.
   * @param file El archivo de imagen.
   * @returns La URL pública del archivo o null si falla.
   */
  async subirFotoNoticia(file: File): Promise<string | null> {
    const fileExtension = file.name.split('.').pop();
    const fileName = `${crypto.randomUUID()}.${fileExtension}`; 

    const { data, error } = await this.supabase.storage
      .from(this.BUCKET_NAME)
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: false 
      });

    if (error) {
      console.error('Error al subir foto a Storage:', error);
      return null;
    }

    // Obtener la URL pública del archivo subido
    const { data: publicUrlData } = this.supabase.storage
      .from(this.BUCKET_NAME)
      .getPublicUrl(data.path);

    return publicUrlData.publicUrl;
  }

  /**
   * Crea una nueva noticia en la tabla 'noticias'.
   */
  async crearNoticia(noticia: Omit<Noticia, 'id'>): Promise<Noticia | null> {
    // La inserción debe ir a la tabla 'noticias'
    const { data, error } = await this.supabase
      .from(this.TABLE_NAME) 
      .insert([noticia])
      .select()
      .single();

    if (error) {
      console.error('Error al crear noticia:', error);
      return null;
    }
    return data as Noticia;
  }
}