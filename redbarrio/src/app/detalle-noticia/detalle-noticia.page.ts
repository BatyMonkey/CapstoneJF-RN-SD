// src/app/detalle-noticia/detalle-noticia.page.ts

import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { environment } from 'src/environments/environment';
import { SupabaseService } from 'src/app/services/supabase.service';

// Definición de la interfaz para la noticia (ajustada a la nueva estructura)
interface DetalleNoticia {
  id: number;
  titulo: string;
  parrafos: string[] | null; // Array de párrafos
  nombre_autor: string | null;
  fecha_creacion: string;
  url_foto: string[] | null; // Array de URLs de fotos
}

// Interfaz para el contenido mixto que se renderizará
interface ContenidoMixtoItem {
  type: 'parrafo' | 'foto';
  value: string;
}

@Component({
  selector: 'app-detalle-noticia',
  templateUrl: './detalle-noticia.page.html',
  styleUrls: ['./detalle-noticia.page.scss'],
  standalone: true,
  imports: [CommonModule, IonicModule, RouterModule]
})
export class DetalleNoticiaPage implements OnInit {

  supabase: SupabaseClient;
  noticiaId: number | null = null;
  noticia: DetalleNoticia | null = null;
  estaCargando = true;

  // Array para almacenar párrafos y URLs mezclados
  contenidoMixto: ContenidoMixtoItem[] = [];

  constructor(private route: ActivatedRoute, private supabaseService: SupabaseService) {
    this.supabase = this.supabaseService.client;
  }

  ngOnInit() {
    const idParam = this.route.snapshot.paramMap.get('id');
    if (idParam) {
      this.noticiaId = parseInt(idParam, 10);
      this.cargarDetalleNoticia(this.noticiaId);
    } else {
      this.estaCargando = false;
    }
  }

  async cargarDetalleNoticia(id: number) {
    this.estaCargando = true;
    try {
      const { data, error } = await this.supabase
        .from('noticias')
        // Seleccionamos 'parrafos' y 'url_foto'
        .select('id, titulo, parrafos, nombre_autor, fecha_creacion, url_foto') 
        .eq('id', id)
        .single(); 

      if (error && error.code !== 'PGRST116') throw error; 

      if (data) {
        this.noticia = data as DetalleNoticia;
        // Llenar el array de contenido mezclado después de cargar
        this.mezclarContenido(); 
      } else {
        this.noticia = null;
      }

    } catch (error) {
      console.error('Error al cargar el detalle de la noticia:', error);
      this.noticia = null;
    } finally {
      this.estaCargando = false;
    }
  }

  // Lógica para mezclar el contenido: 2 párrafos por 1 foto
  private mezclarContenido() {
    this.contenidoMixto = [];
    if (!this.noticia) return;

    const parrafos = this.noticia.parrafos || [];
    const fotos = this.noticia.url_foto || [];

    let pIndex = 0;
    let fIndex = 0;

    // Intercalar el contenido: 2 párrafos por 1 foto
    // El bucle continúa mientras quede contenido en cualquiera de los dos arrays
    while (pIndex < parrafos.length || fIndex < fotos.length) {
      
      // 1. Agregar dos párrafos
      for (let i = 0; i < 2; i++) {
        if (pIndex < parrafos.length) {
          this.contenidoMixto.push({ type: 'parrafo', value: parrafos[pIndex] });
          pIndex++;
        }
      }

      // 2. Agregar una foto
      if (fIndex < fotos.length) {
        this.contenidoMixto.push({ type: 'foto', value: fotos[fIndex] });
        fIndex++;
      }
    }
    
    // Si quedan párrafos o fotos sobrantes, ya están incluidos debido al bucle 'while'
  }

  // Helper para formatear la fecha
  formatearFecha(fecha: string): string {
    // Maneja el caso de fecha nula si ocurre
    if (!fecha) return ''; 
    return new Date(fecha).toLocaleDateString('es-ES', { 
        year: 'numeric', month: 'long', day: 'numeric' 
    });
  }
}