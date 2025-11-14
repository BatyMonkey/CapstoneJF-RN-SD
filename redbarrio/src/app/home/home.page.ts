import { Component, OnInit } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { IonicModule, MenuController, AlertController } from '@ionic/angular';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClientModule } from '@angular/common/http';

import { AuthService } from '../auth/auth.service';
import { SupabaseService } from 'src/app/services/supabase.service';
import { ChatbotComponent } from 'src/app/components/chatbot.component';

// ✅ Registra SOLO los iconos que usa este componente
import { addIcons } from 'ionicons';
import {
  documentTextOutline,
  callOutline,
  checkmarkDoneOutline,
  businessOutline,
  barChartOutline,
  bulbOutline,
  megaphoneOutline,
  calendarOutline
} from 'ionicons/icons';

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
  noticias: Noticia[] = [];
  estaCargando = false;

  esAdmin = false;
  usuarioActual: any = null;
  nombreAutorActual: string | null = null;
  nombreUsuario: string | null = null;

  showChat = false;
  showChatHint = true;

  constructor(
    private router: Router,
    private menu: MenuController,
    private auth: AuthService,
    private alertController: AlertController,
    private supabaseService: SupabaseService
  ) {
    // ✅ Registra los íconos usados en esta página
    addIcons({
      'document-text-outline': documentTextOutline,
      'call-outline': callOutline,
      // importante: coincide con el HTML
      'checkmark-done-outline': checkmarkDoneOutline,
      'business-outline': businessOutline,
      'bar-chart-outline': barChartOutline,
      'bulb-outline': bulbOutline,
      'megaphone-outline': megaphoneOutline,
      'calendar-outline': calendarOutline
    });
  }

  // ==========================
  // Ciclo de vida
  // ==========================
  async ngOnInit() {
    console.log('🏁 HomePage → ngOnInit()');
    await this.cargarEstadoYNoticias();
  }

  async ionViewWillEnter() {
    await this.cargarEstadoYNoticias();
  }

  // ==========================
  // Navegación
  // ==========================
  async go(path: string) {
    await this.menu.close('main-menu');
    await this.router.navigateByUrl('/' + path); // este te funcionaba
  }


  navigateTo(path: string) {
    this.go(path);
  }

  async goVotacion() {
    await this.menu.close('main-menu');
    await this.router.navigate(['/votacion', 'VOTACION-DEMOSTRACION']);
  }

  navigateToSpaces() {
    this.router.navigate(['/espacios']);
  }

  // Si tu routing no tiene /transparencia, cambia a /dashboard
  navigateToMetrics() {
    this.router.navigate(['/dashboard']);
  }

  navigateToSuggestProject() {
    this.router.navigate(['/generar/proyecto']);
  }

  async salir() {
    try {
      await this.auth.signOut();
    } finally {
      await this.menu.close('main-menu');
      await this.router.navigateByUrl('/login', { replaceUrl: true });
    }
  }

  // ==========================
  // Chatbot
  // ==========================
  toggleChat() {
    this.showChat = !this.showChat;
    console.log('💬 toggleChat() ejecutado → showChat =', this.showChat);
    if (this.showChat) this.showChatHint = false;
  }

  // ==========================
  // Estado de usuario y noticias
  // ==========================
  async cargarEstadoYNoticias() {
    await this.cargarEstadoUsuario();
    await this.cargarNoticias();
  }

  async cargarEstadoUsuario() {
    try {
      const { data } = await this.supabaseService.client.auth.getUser();
      const user = data.user;

      this.usuarioActual = user;
      this.esAdmin = false;
      this.nombreAutorActual = null;
      this.nombreUsuario = 'Vecino/a'; // valor por defecto

      if (!user) {
        console.warn('⚠️ No hay usuario autenticado');
        return;
      }

      console.log('🧩 Usuario logueado (Auth ID):', user.id);

      // Buscar por id_auth (correcto según tu BD)
      const { data: perfil, error } = await this.supabaseService.client
        .from('usuario')
        .select('rol, nombre')
        .eq('id_auth', user.id)
        .single();

      if (error) {
        console.error('❌ Error al consultar perfil:', error);
        return;
      }

      if (!perfil) {
        console.warn('⚠️ No se encontró perfil para el usuario con id_auth =', user.id);
        return;
      }

      console.log('✅ Perfil encontrado:', perfil);

      this.esAdmin = perfil.rol === 'administrador';
      this.nombreAutorActual = perfil.nombre || 'Administrador/a';
      this.nombreUsuario = perfil.nombre || 'Vecino/a';
    } catch (err) {
      console.error('Error al cargar estado de usuario:', err);
      this.esAdmin = false;
      this.nombreAutorActual = null;
      this.nombreUsuario = 'Vecino/a';
    }
  }

  async cargarNoticias() {
    this.estaCargando = true;
    try {
      const { data, error } = await this.supabaseService.client
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

  // ==========================================================
  // Funciones auxiliares para las noticias dinámicas
  // ==========================================================
  verDetalle(noticiaId: number) {
    this.router.navigate(['/noticias', noticiaId]);
  }

  getIconColor(noticia: any) {
    const index = this.noticias.indexOf(noticia);
    return index % 2 === 0 ? 'yellow' : 'cyan';
  }
}
