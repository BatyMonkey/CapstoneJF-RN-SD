// src/app/noticias/noticias.page.ts

import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule, AlertController } from '@ionic/angular'; 
import { Router, RouterModule } from '@angular/router';

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
  
  esAdmin: boolean = false; 
  usuarioActual: User | null = null; 

  constructor(
    private router: Router,
    private alertController: AlertController 
  ) {
    this.supabase = createClient(
      environment.supabaseUrl,
      environment.supabaseAnonKey
    );
  }

  ngOnInit() {
    this.cargarEstadoYNoticias();
  }

  ionViewWillEnter() {
    this.cargarEstadoYNoticias();
  }
  
  async cargarEstadoYNoticias() {
      await this.cargarEstadoUsuario();
      await this.cargarNoticias();
  }

  async cargarEstadoUsuario() {
      try {
          const { data: { user } } = await this.supabase.auth.getUser();
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

  // FUNCIÓN LLAMADA DESDE EL HTML (CONFIRMAR)
  async confirmarYEliminarNoticia(noticiaId: number) {
    const alert = await this.alertController.create({
      header: 'Confirmar Eliminación',
      message: '¿Estás seguro de que quieres eliminar esta noticia? Esta acción no se puede deshacer.',
      buttons: [
        {
          text: 'Cancelar',
          role: 'cancel',
          cssClass: 'secondary',
        },
        {
          text: 'Eliminar',
          handler: () => {
            this.eliminarNoticia(noticiaId);
          }
        }
      ]
    });

    await alert.present();
  }

  // FUNCIÓN QUE EJECUTA LA ELIMINACIÓN EN SUPABASE
  async eliminarNoticia(noticiaId: number) {
    this.estaCargando = true; 
    try {
      const { error } = await this.supabase
        .from('noticias')
        .delete()
        .eq('id', noticiaId);

      if (error) throw error;

      await this.cargarNoticias(); 

    } catch (error) {
      console.error('Error al intentar eliminar noticia:', error);
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