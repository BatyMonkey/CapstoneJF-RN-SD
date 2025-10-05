// src/app/detalle-noticia/detalle-noticia.page.ts

import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular'; // Mantiene la importación correcta
import { ActivatedRoute } from '@angular/router';

// Dependencias de Supabase
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { environment } from 'src/environments/environment'; 

// Define la interfaz de tus datos
interface NoticiaDetalle {
  id: number;
  titulo: string;
  url_foto: string[] | null; 
  nombre_autor: string | null;
  fecha_creacion: string;
  parrafos: string[] | null; 
}

@Component({
  selector: 'app-detalle-noticia',
  templateUrl: './detalle-noticia.page.html',
  styleUrls: ['./detalle-noticia.page.scss'],
  standalone: true,
  // Esta importación es la que debe funcionar para todos los componentes de Ionic
  imports: [IonicModule, CommonModule, FormsModule] 
})
export class DetalleNoticiaPage implements OnInit { 

  supabase: SupabaseClient; 
  noticia: NoticiaDetalle | null = null;
  estaCargando = true;

  constructor(
    private activatedRoute: ActivatedRoute
  ) {
    this.supabase = createClient(
      environment.supabaseUrl,
      environment.supabaseAnonKey
    );
  }

  ngOnInit() {
    this.cargarNoticia();
  }
  
  // FUNCIÓN QUE CONECTA EL DISEÑO A LA BASE DE DATOS
  async cargarNoticia() {
    this.estaCargando = true;
    this.noticia = null; 

    try {
      const noticiaId = this.activatedRoute.snapshot.paramMap.get('id');

      if (!noticiaId) {
        this.estaCargando = false;
        return;
      }
      
      const { data, error } = await this.supabase
        .from('noticias')
        .select('id, titulo, url_foto, nombre_autor, fecha_creacion, parrafos')
        .eq('id', noticiaId)
        .single(); 

      if (error) throw error;
      
      this.noticia = data as NoticiaDetalle;

    } catch (error) {
      console.error('Error al cargar noticia:', error);
      this.noticia = null; 
    } finally {
      this.estaCargando = false;
    }
  }
}