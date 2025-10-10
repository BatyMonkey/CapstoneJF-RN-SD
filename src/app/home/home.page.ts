// src/app/home/home.page.ts (Unificado)

import { Component, OnInit } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { IonicModule, MenuController, AlertController } from '@ionic/angular';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../auth/auth.service';

// --- INICIO DE CÓDIGO DE noticias.page.ts ---
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
// --- FIN DE CÓDIGO DE noticias.page.ts ---


@Component({
  selector: 'app-home',
  standalone: true,
  templateUrl: './home.page.html',
  styleUrls: ['./home.page.scss'],
  imports: [IonicModule, CommonModule, RouterModule, FormsModule], 
})
export class HomePage implements OnInit { 
  
  // --- PROPIEDADES DE noticias.page.ts ---
  supabase: SupabaseClient; 
  noticias: Noticia[] = [];
  estaCargando = false;
  
  esAdmin: boolean = false; 
  usuarioActual: User | null = null; 
  // Nueva propiedad para almacenar el nombre del autor logeado
  nombreAutorActual: string | null = null; 
  // --- FIN DE PROPIEDADES DE noticias.page.ts ---

  constructor(
    private router: Router,
    private menu: MenuController,
    private auth: AuthService,
    private alertController: AlertController 
  ) {
    // Inicialización de Supabase
    this.supabase = createClient(
      environment.supabaseUrl,
      environment.supabaseAnonKey
    );
  }

  ngOnInit() {
    this.cargarEstadoYNoticias(); 
  }
  
  // --- MÉTODOS DE HOME.PAGE.TS ORIGINAL ---

  async go(path: string) {
    await this.router.navigate(['/', path]);
    await this.menu.close('main-menu');
  }

  async goVotacion() {
    await this.router.navigate(['/votacion', 'VOTACION-DEMOSTRACION']);
    await this.menu.close('main-menu');
  }

  async salir() {
    try {
      await this.auth.signOut();
    } finally {
      await this.menu.close('main-menu');
      await this.router.navigateByUrl('/login', { replaceUrl: true });
    }
  }

  // --- MÉTODOS DE NOTICIAS.PAGE.TS AÑADIDOS Y MODIFICADOS ---

  async cargarEstadoYNoticias() {
      await this.cargarEstadoUsuario();
      await this.cargarNoticias();
  }

  async cargarEstadoUsuario() {
      try {
          const { data: { user } } = await this.supabase.auth.getUser();
          this.usuarioActual = user;
          this.esAdmin = false; // Resetear el estado de administrador
          this.nombreAutorActual = null; // Resetear el nombre del autor
          
          if (user) {
              const { data: perfil, error } = await this.supabase
                  .from('usuario')
                  // SOLICITAR AHORA EL CAMPO 'nombre' ADEMÁS DE 'rol'
                  .select('rol, nombre') 
                  .eq('user_id', user.id)
                  .single();

              if (error && error.code !== 'PGRST116') throw error;
              
              this.esAdmin = perfil?.rol === 'administrador'; 
              // ASIGNAR EL NOMBRE DEL AUTOR
              this.nombreAutorActual = perfil?.nombre || 'Administrador/a';
              
          }
      } catch (error) {
          console.error('Error al cargar estado de usuario:', error);
          this.esAdmin = false;
          this.nombreAutorActual = null;
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
    // Al navegar a la página de creación, podrías pasar el nombre como parámetro si es necesario,
    // o simplemente confiar en que la página de creación de noticias acceda a esta misma variable/servicio.
    this.router.navigate(['noticias/crear']);
  }
  
  ionViewWillEnter() {
    // Forzamos la recarga del estado y noticias para mostrar la última data
    this.cargarEstadoYNoticias();
  }
}