// src/app/noticias/noticias.page.ts

import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { Router, RouterModule } from '@angular/router';

import { SupabaseClient, User } from '@supabase/supabase-js';
import { SupabaseService } from 'src/app/services/supabase.service';

import { addIcons } from 'ionicons';
import {
  alertCircleOutline,
  calendarOutline,
  informationCircleOutline,
  checkmarkCircleOutline,
} from 'ionicons/icons';

// ======================================================
// Tipos
// ======================================================
type NewsCategory = 'info' | 'urgent' | 'event' | 'success';

// Definición de la interfaz para la noticia
interface Noticia {
  id: number;
  titulo: string;
  nombre_autor: string;
  parrafos: string[];
  url_foto: string[];
  fecha_creacion: Date | null;
  categoria?: string | NewsCategory | null; // viene de noticias.categoria
}

@Component({
  selector: 'app-noticias',
  templateUrl: './noticias.page.html',
  styleUrls: ['./noticias.page.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule, FormsModule, RouterModule],
})
export class NoticiasPage implements OnInit {
  supabase: SupabaseClient;
  noticias: Noticia[] = [];
  estaCargando = false;

  esAdmin = false;
  usuarioActual: User | null = null;

  constructor(
    private router: Router,
    private supabaseService: SupabaseService
  ) {
    this.supabase = this.supabaseService.client;

    addIcons({
      'alert-circle-outline': alertCircleOutline,
      'calendar-outline': calendarOutline,
      'information-circle-outline': informationCircleOutline,
      'checkmark-circle-outline': checkmarkCircleOutline,
    });
  }

  // ======================================================
  // Ciclo de vida
  // ======================================================
  ngOnInit() {
    this.cargarEstadoYNoticias();
  }

  ionViewWillEnter() {
    this.cargarEstadoYNoticias();
  }

  // ======================================================
  // Estado usuario + noticias
  // ======================================================
  async cargarEstadoYNoticias() {
    await this.cargarEstadoUsuario();
    await this.cargarNoticias();
  }

  async cargarEstadoUsuario() {
    try {
      const {
        data: { user },
      } = await this.supabase.auth.getUser();
      this.usuarioActual = user;

      if (user) {
        const { data: perfil, error } = await this.supabase
          .from('usuario')
          .select('rol')
          .eq('user_id', user.id)
          .single();

        if (error && error.code !== 'PGRST116') throw error;

        this.esAdmin = perfil?.rol === 'administrador';
      } else {
        this.esAdmin = false;
      }
    } catch (error) {
      console.error('Error al cargar estado de usuario:', error);
      this.esAdmin = false;
    }
  }

  async cargarNoticias() {
    this.estaCargando = true;

    try {
      const { data, error } = await this.supabase
        .from('noticias')
        .select(
          'id, titulo, url_foto, nombre_autor, fecha_creacion, parrafos, categoria'
        )
        .order('fecha_creacion', { ascending: false });

      if (error) throw error;

      this.noticias = (data || []).map((n: any) => {
        // url_foto y parrafos pueden venir como jsonb (array) o como string JSON
        const fotos =
          Array.isArray(n.url_foto) && n.url_foto.length > 0
            ? n.url_foto
            : typeof n.url_foto === 'string' && n.url_foto.trim().startsWith('[')
            ? (JSON.parse(n.url_foto) as string[])
            : [];

        const parrafos =
          Array.isArray(n.parrafos) && n.parrafos.length > 0
            ? n.parrafos
            : typeof n.parrafos === 'string' &&
              n.parrafos.trim().startsWith('[')
            ? (JSON.parse(n.parrafos) as string[])
            : [];

        return {
          id: n.id,
          titulo: n.titulo,
          nombre_autor: n.nombre_autor ?? '',
          url_foto: fotos,
          parrafos,
          fecha_creacion: n.fecha_creacion
            ? new Date(n.fecha_creacion)
            : null,
          categoria: n.categoria ?? null,
        } as Noticia;
      });
    } catch (error) {
      console.error('Error al cargar noticias:', error);
      this.noticias = [];
    } finally {
      this.estaCargando = false;
    }
  }

  // ======================================================
  // Badge (color / icono) según categoría
  // ======================================================
  getBadgeClass(n: Noticia): NewsCategory {
    if (!n) return 'info';

    const rawCat = (n.categoria ?? '').toString().toLowerCase().trim();

    if (rawCat === 'urgent' || rawCat === 'urgente') return 'urgent';
    if (rawCat === 'event' || rawCat === 'evento') return 'event';
    if (rawCat === 'success' || rawCat === 'ok' || rawCat === 'anuncio')
      return 'success';
    if (
      rawCat === 'info' ||
      rawCat === 'informacion' ||
      rawCat === 'información'
    )
      return 'info';

    // Fallback si viene vacío o raro: usamos el título
    const t = (n.titulo || '').toLowerCase();
    if (t.includes('corte') || t.includes('urgencia')) return 'urgent';
    if (t.includes('reunión') || t.includes('evento')) return 'event';

    return 'info';
  }

  getBadgeIcon(n: Noticia): string {
    const badge = this.getBadgeClass(n);

    switch (badge) {
      case 'urgent':
        return 'alert-circle-outline';
      case 'event':
        return 'calendar-outline';
      case 'success':
        return 'checkmark-circle-outline';
      case 'info':
      default:
        return 'information-circle-outline';
    }
  }

  // ======================================================
  // Navegación
  // ======================================================
  verDetalle(noticiaId: number) {
    this.router.navigate(['/noticias', noticiaId]);
  }

  navegarACrearNoticia() {
    this.router.navigate(['noticias/crear']);
  }
}
