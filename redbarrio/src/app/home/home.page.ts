// src/app/home/home.page.ts
import { Component, OnInit } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { IonicModule, MenuController, AlertController } from '@ionic/angular';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClientModule } from '@angular/common/http';

import { AuthService } from '../auth/auth.service';
import { supabase as sb } from '../core/supabase.client';
import { ChatbotComponent } from '../components/chatbot.component';

interface Noticia {
  id: number;
  titulo: string;
  url_foto: string[] | null;
  nombre_autor: string | null;
  fecha_creacion: string;
  parrafos: string[] | null;
}

@Component({
  selector: 'app-home',
  standalone: true,
  templateUrl: './home.page.html',
  styleUrls: ['./home.page.scss'],
  imports: [
    IonicModule,
    CommonModule,
    RouterModule,
    FormsModule,
    HttpClientModule,
    ChatbotComponent,
  ],
})
export class HomePage implements OnInit {
  private supabase = sb;

  noticias: Noticia[] = [];
  estaCargando = false;

  esAdmin = false;
  usuarioActual: any = null;
  nombreAutorActual: string | null = null;

  showChat = false;
  showChatHint = true;

  constructor(
    private router: Router,
    private menu: MenuController,
    private auth: AuthService,
    private alertController: AlertController,
  ) {}

  ngOnInit() {
    this.cargarEstadoYNoticias();
  }

  toggleChat() {
    this.showChat = !this.showChat;
    if (this.showChat) {
      this.showChatHint = false;
    }
  }

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

  async cargarEstadoYNoticias() {
    await this.cargarEstadoUsuario();
    await this.cargarNoticias();
  }

  async cargarEstadoUsuario() {
    try {
      const { data } = await this.supabase.auth.getUser();
      const user = data.user;
      this.usuarioActual = user;
      this.esAdmin = false;
      this.nombreAutorActual = null;

      if (user) {
        const { data: perfil, error } = await this.supabase
          .from('usuario')
          .select('rol, nombre')
          .eq('user_id', user.id)
          .single();

        if (error && error.code !== 'PGRST116') throw error;

        this.esAdmin = perfil?.rol === 'administrador';
        this.nombreAutorActual = perfil?.nombre || 'Administrador/a';
      }
    } catch (err) {
      console.error('Error al cargar estado de usuario:', err);
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
      this.noticias = (data ?? []) as Noticia[];
    } catch (err) {
      console.error('Error al cargar noticias:', err);
    } finally {
      this.estaCargando = false;
    }
  }

  async confirmarYEliminarNoticia(noticiaId: number) {
    const alert = await this.alertController.create({
      header: 'Confirmar Eliminación',
      message: '¿Estás seguro de que quieres eliminar esta noticia?',
      buttons: [
        { text: 'Cancelar', role: 'cancel', cssClass: 'secondary' },
        { text: 'Eliminar', handler: () => this.eliminarNoticia(noticiaId) },
      ],
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
    } catch (err) {
      console.error('Error al eliminar noticia:', err);
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

  ionViewWillEnter() {
    this.cargarEstadoYNoticias();
  }
}
