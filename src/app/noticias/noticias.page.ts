// src/app/noticias/noticias.page.ts

import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { Router, RouterModule } from '@angular/router';

// Vuelve la importación de createClient y User para la autenticación
import { createClient, SupabaseClient, User } from '@supabase/supabase-js'; 
import { environment } from 'src/environments/environment';

// Definición de la interfaz para la noticia
interface Noticia {
  id: number;
  titulo: string;
  url_foto: string[] | null; 
  nombre_autor: string | null;
  fecha_creacion: string;
  parrafos: string[] | null; 
}

@Component({
  selector: 'app-noticias',
  templateUrl: './noticias.page.html',
  styleUrls: ['./noticias.page.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule, FormsModule, RouterModule]
})
export class NoticiasPage implements OnInit {

  supabase: SupabaseClient; 
  noticias: Noticia[] = [];
  estaCargando = false;
  
  // NUEVA VARIABLE: Para controlar la visibilidad del botón de crear
  esAdmin: boolean = false; 
  usuarioActual: User | null = null; // Para guardar el usuario

  constructor(
    private router: Router
  ) {
    // Inicialización directa del cliente (versión funcional)
    this.supabase = createClient(
      environment.supabaseUrl,
      environment.supabaseAnonKey
    );
  }

  ngOnInit() {
    // La primera vez que carga, intenta obtener todo
    this.cargarEstadoYNoticias();
  }

  ionViewWillEnter() {
    // Al volver a esta vista (ej: desde el login o crear), forzamos la recarga del estado
    this.cargarEstadoYNoticias();
  }
  
  // NUEVA FUNCIÓN: Combina la carga de noticias y el estado del usuario
  async cargarEstadoYNoticias() {
      await this.cargarEstadoUsuario();
      await this.cargarNoticias();
  }

  // NUEVA FUNCIÓN: Carga el estado del usuario y verifica el rol
  async cargarEstadoUsuario() {
      try {
          // 1. Obtener la sesión activa
          const { data: { user } } = await this.supabase.auth.getUser();
          this.usuarioActual = user;

          if (user) {
              // 2. Si hay usuario, consultar el rol en la tabla 'usuario'
              const { data: perfil, error } = await this.supabase
                  .from('usuario')
                  .select('rol') // <-- Asume que el rol está en la columna 'rol'
                  .eq('user_id', user.id)
                  .single();

              if (error && error.code !== 'PGRST116') throw error;
              
              // 3. Verificar si el rol es 'administrador' (o el valor que uses para el admin)
              // Aquí debes usar el valor exacto de la columna 'rol' para el admin
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
        .select('id, titulo, url_foto, nombre_autor, fecha_creacion, parrafos') 
        .order('fecha_creacion', { ascending: false });

      if (error) throw error;

      this.noticias = data as Noticia[];
      
    } catch (error) {
      console.error('Error al cargar noticias:', error);
    } finally {
      this.estaCargando = false;
    }
  }

  verDetalle(noticiaId: number) {
    this.router.navigate(['/noticias', noticiaId]);
  }

  navegarACrearNoticia() {
    this.router.navigate(['noticias/crear']);
  }
}