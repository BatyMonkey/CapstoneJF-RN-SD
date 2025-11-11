import { Component, OnInit } from '@angular/core';
import { IonicModule, AlertController, ToastController } from '@ionic/angular';
import { CommonModule } from '@angular/common';
import { SupabaseService } from 'src/app/services/supabase.service';

@Component({
  selector: 'app-noticias',
  templateUrl: './noticias.page.html',
  styleUrls: ['./noticias.page.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule],
})
export class NoticiasPage implements OnInit {
  noticias: any[] = [];
  estaCargando = false;

  constructor(
    private supabaseService: SupabaseService,
    private alertCtrl: AlertController,
    private toastCtrl: ToastController
  ) {}

  async ngOnInit() {
    await this.cargarNoticias();
  }

  /** Cargar noticias desde Supabase */
  async cargarNoticias() {
    this.estaCargando = true;
    const { data, error } = await this.supabaseService
      .from('noticias')
      .select('*')
      .order('fecha_creacion', { ascending: false });

    this.estaCargando = false;

    if (error) {
      console.error('Error cargando noticias:', error);
      this.noticias = [];
    } else {
      // ✅ Conversión para que el pipe date funcione bien
      this.noticias = data.map((n: any) => ({
        ...n,
        fecha_creacion: n.fecha_creacion ? new Date(n.fecha_creacion) : null,
        fecha_eliminacion: n.fecha_eliminacion
          ? new Date(n.fecha_eliminacion)
          : null,
      }));
    }
  }

  /** Confirmar eliminación */
  async confirmarEliminar(noticia: any) {
    const alert = await this.alertCtrl.create({
      header: 'Eliminar noticia',
      message: `¿Seguro que deseas eliminar "${noticia.titulo}"?`, // ✅ sin <b></b>
      cssClass: 'rb-alert', // ✅ clase personalizada
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

  /** Eliminar noticia */
  async eliminarNoticia(id: string) {
    // Buscar la noticia antes de eliminarla
    const noticia = this.noticias.find((n) => n.id === id);

    const { error } = await this.supabaseService
      .from('noticias')
      .delete()
      .eq('id', id);

    if (!error) {
      this.noticias = this.noticias.filter((n) => n.id !== id);

      // 🧾 Registrar acción en auditoría
      await this.supabaseService.registrarAuditoria(
        'eliminar noticia',
        'noticias',
        {
          id_noticia: id,
          titulo: noticia?.titulo || '(sin título)',
          fecha_creacion: noticia?.fecha_creacion || null,
          fecha_eliminacion: new Date().toISOString(),
        }
      );

      // Formatear fecha en zona horaria America/Santiago
      let fechaTexto = '';
      try {
        const fechaOriginal = noticia?.fecha_creacion
          ? new Date(noticia.fecha_creacion)
          : null;
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

      // ✅ Sin etiquetas HTML, con formato limpio
      const toast = await this.toastCtrl.create({
        message: `🗑️ Se eliminó la noticia "${
          noticia?.titulo || 'Sin título'
        }"${fechaTexto}.`,
        duration: 3500,
        color: 'success',
        position: 'bottom',
        cssClass: 'rb-toast',
      });
      toast.present();
    } else {
      console.error(error);
      const toast = await this.toastCtrl.create({
        message: '❌ Error al eliminar la noticia',
        duration: 2500,
        color: 'danger',
      });
      toast.present();
    }
  }
}
