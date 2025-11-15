import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  IonicModule,
  AlertController,
  ToastController,
} from '@ionic/angular';
import { Router } from '@angular/router';

import { addIcons } from 'ionicons';
import {
  chevronBackOutline,
  calendarOutline,
  briefcaseOutline,
  peopleOutline,
  timeOutline,
  eyeOutline,
  addOutline,
  checkmarkCircleOutline,
  closeCircleOutline,
  cashOutline,
  calendarNumberOutline,
  documentTextOutline,
  settingsOutline,
  pauseCircleOutline,
  createOutline,
  trashOutline,
} from 'ionicons/icons';

import { SupabaseService } from 'src/app/services/supabase.service';

type NewsCategory = 'urgent' | 'event' | 'info' | 'success';

interface NewsItem {
  id: number;
  title: string;
  category: NewsCategory;
  date: Date | null;
  image: string;
  content: string;
  author: string;
  paragraphs: string[];
}

@Component({
  standalone: true,
  selector: 'app-gestionar-noticias',
  templateUrl: './gestionar-noticias.page.html',
  styleUrls: ['./gestionar-noticias.page.scss'],
  imports: [IonicModule, CommonModule, FormsModule],
})
export class GestionarNoticiasPage implements OnInit {
  // solo usamos la vista de "Ver Noticias" en este módulo
  activeTab: 'manage' | 'create' = 'manage';

  newsList: NewsItem[] = [];
  estaCargando = false;

  constructor(
    private supabaseService: SupabaseService,
    private alertCtrl: AlertController,
    private toastCtrl: ToastController,
    private router: Router
  ) {
    addIcons({
      'chevron-back-outline': chevronBackOutline,
      'calendar-outline': calendarOutline,
      'briefcase-outline': briefcaseOutline,
      'people-outline': peopleOutline,
      'time-outline': timeOutline,
      'eye-outline': eyeOutline,
      'add-outline': addOutline,
      'checkmark-circle-outline': checkmarkCircleOutline,
      'close-circle-outline': closeCircleOutline,
      'cash-outline': cashOutline,
      'calendar-number-outline': calendarNumberOutline,
      'document-text-outline': documentTextOutline,
      'settings-outline': settingsOutline,
      'pause-circle-outline': pauseCircleOutline,
      'create-outline': createOutline,
      'trash-outline': trashOutline,
    });
  }

  async ngOnInit() {
    await this.cargarNoticias();
  }
  async ionViewWillEnter() {
    await this.cargarNoticias();
  }
  // ======================================================
  // Navegar a la página que ya crea noticias de verdad
  // ======================================================
  irACrearNoticia() {
    this.router.navigate(['/noticias/crear']);
  }

  // ======================================================
  // Cargar noticias desde Supabase (tabla public.noticias)
  // ======================================================
  async cargarNoticias() {
    this.estaCargando = true;

    const { data, error } = await this.supabaseService
      .from('noticias')
      .select('*')
      .order('fecha_creacion', { ascending: false });

    this.estaCargando = false;

    if (error) {
      console.error('Error cargando noticias:', error);
      this.newsList = [];
      return;
    }

    this.newsList = (data || []).map((n: any) => {
      // imagen desde url_foto (jsonb)
      let imageUrl = '';
      const urlFoto = n.url_foto;

      if (Array.isArray(urlFoto) && urlFoto.length > 0) {
        imageUrl = urlFoto[0];
      } else if (urlFoto && typeof urlFoto === 'object') {
        imageUrl = urlFoto.portada || urlFoto.url || urlFoto.foto || '';
      }

      // párrafos desde parrafos (jsonb)
      let paragraphs: string[] = [];
      if (Array.isArray(n.parrafos)) {
        paragraphs = n.parrafos;
      } else if (n.parrafos && typeof n.parrafos === 'object') {
        if (Array.isArray((n.parrafos as any).items)) {
          paragraphs = (n.parrafos as any).items;
        }
      }

      const firstParagraph = paragraphs.length > 0 ? paragraphs[0] : '';

      const rawCat = (n.categoria || 'info').toString().toLowerCase();
      const mappedCat: NewsCategory =
        rawCat === 'urgent' ||
        rawCat === 'event' ||
        rawCat === 'info' ||
        rawCat === 'success'
          ? rawCat
          : 'info';

      return {
        id: n.id as number,
        title: n.titulo || 'Sin título',
        category: mappedCat,
        date: n.fecha_creacion ? new Date(n.fecha_creacion) : null,
        image: imageUrl,
        content: firstParagraph,
        author: n.nombre_autor || 'Autor desconocido',
        paragraphs,
      } as NewsItem;
    });
  }

  // ======================================================
  // Refresher (pull to refresh)
  // ======================================================
  async refrescar(event: any) {
    await this.cargarNoticias();
    event.target.complete();
  }

  // ======================================================
  // Confirmar eliminación (alert)
  // ======================================================
  async confirmarEliminar(noticia: NewsItem) {
    const alert = await this.alertCtrl.create({
      header: 'Eliminar noticia',
      message: `¿Seguro que deseas eliminar "${noticia.title}"?`,
      cssClass: 'rb-alert',
      buttons: [
        { text: 'Cancelar', role: 'cancel', cssClass: 'alert-cancel' },
        {
          text: 'Eliminar',
          cssClass: 'alert-delete',
          handler: () => this.eliminarNoticia(noticia.id),
        },
      ],
    });
    await alert.present();
  }

  // ======================================================
  // Eliminar noticia en Supabase + auditoría
  // ======================================================
  async eliminarNoticia(id: number) {
    const noticia = this.newsList.find((n) => n.id === id);

    const { error } = await this.supabaseService
      .from('noticias')
      .delete()
      .eq('id', id);

    if (error) {
      console.error(error);
      const toastErr = await this.toastCtrl.create({
        message: '❌ Error al eliminar la noticia',
        duration: 2500,
        color: 'danger',
      });
      toastErr.present();
      return;
    }

    this.newsList = this.newsList.filter((n) => n.id !== id);

    await this.supabaseService.registrarAuditoria(
      'eliminar noticia',
      'noticias',
      {
        id_noticia: id,
        titulo: noticia?.title || '(sin título)',
        fecha_creacion: noticia?.date || null,
        fecha_eliminacion: new Date().toISOString(),
      }
    );

    let fechaTexto = '';
    try {
      const fechaOriginal = noticia?.date || null;
      if (fechaOriginal) {
        const fechaLocal = new Intl.DateTimeFormat('es-CL', {
          dateStyle: 'short',
          timeStyle: 'short',
          timeZone: 'America/Santiago',
        }).format(fechaOriginal);
        fechaTexto = ` publicada el ${fechaLocal}`;
      }
    } catch (e) {
      console.warn('Error al formatear la fecha:', e);
    }

    const toast = await this.toastCtrl.create({
      message: `🗑️ Se eliminó la noticia "${
        noticia?.title || 'Sin título'
      }"${fechaTexto}.`,
      duration: 3500,
      color: 'success',
      position: 'bottom',
      cssClass: 'rb-toast',
    });
    toast.present();
  }

  // ======================================================
  // Acciones sobre noticias existentes
  // ======================================================
  onEditNews(news: NewsItem) {
    // Aquí luego puedes navegar a una página de edición
    alert('Función de editar en desarrollo');
  }

  // ======================================================
  // Helpers para categoría (icono y label)
  // ======================================================
  getCategoryIcon(category: NewsCategory) {
    switch (category) {
      case 'urgent':
        return '🚨';
      case 'event':
        return '📢';
      case 'info':
        return 'ℹ️';
      case 'success':
        return '✅';
      default:
        return 'ℹ️';
    }
  }

  getCategoryLabel(category: NewsCategory) {
    switch (category) {
      case 'urgent':
        return 'Urgente';
      case 'event':
        return 'Evento';
      case 'info':
        return 'Información';
      case 'success':
        return 'Anuncio';
      default:
        return 'Información';
    }
  }
}
