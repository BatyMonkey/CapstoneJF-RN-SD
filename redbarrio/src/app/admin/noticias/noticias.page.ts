import { Component, OnInit } from '@angular/core';
import { IonicModule, AlertController, ToastController } from '@ionic/angular';
import { CommonModule } from '@angular/common';
import { SupabaseService } from 'src/app/supabase.service';

@Component({
  selector: 'app-noticias',
  templateUrl: './noticias.page.html',
  styleUrls: ['./noticias.page.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule],
})
export class NoticiasPage implements OnInit {
  noticias: any[] = [];
  loading = false;

  constructor(
    private supabase: SupabaseService,
    private alertCtrl: AlertController,
    private toastCtrl: ToastController
  ) {}

  async ngOnInit() {
    await this.cargarNoticias();
  }

  async cargarNoticias() {
    this.loading = true;
    const { data, error } = await this.supabase.from('noticia').select('*').order('fecha', { ascending: false });
    this.loading = false;

    if (error) {
      console.error(error);
      this.noticias = [];
    } else {
      this.noticias = data;
    }
  }

  async confirmarEliminar(id: string) {
    const alert = await this.alertCtrl.create({
      header: 'Eliminar noticia',
      message: '¿Seguro que deseas eliminar esta noticia?',
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Eliminar',
          handler: () => this.eliminarNoticia(id),
        },
      ],
    });
    await alert.present();
  }

  async eliminarNoticia(id: string) {
    const { error } = await this.supabase.from('noticia').delete().eq('id', id);
    if (!error) {
      this.noticias = this.noticias.filter(n => n.id !== id);
      const toast = await this.toastCtrl.create({
        message: '🗑 Noticia eliminada correctamente',
        duration: 2000,
        color: 'success',
      });
      toast.present();
    } else {
      console.error(error);
    }
  }
}
