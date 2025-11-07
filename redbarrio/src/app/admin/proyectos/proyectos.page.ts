import { Component, OnInit } from '@angular/core';
import { IonicModule, AlertController, ToastController } from '@ionic/angular';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SupabaseService } from 'src/app/services/supabase.service';

@Component({
  standalone: true,
  selector: 'app-proyectos',
  templateUrl: './proyectos.page.html',
  styleUrls: ['./proyectos.page.scss'],
  imports: [IonicModule, CommonModule, FormsModule],
})
export class ProyectosPage implements OnInit {
  proyectos: any[] = [];
  cargando = false;

  constructor(
    private supabase: SupabaseService,
    private toastCtrl: ToastController,
    private alertCtrl: AlertController
  ) {}

  // 🟢 Cargar proyectos al iniciar
  async ngOnInit() {
    await this.cargarPendientes();
  }

  // 🟢 Obtener proyectos pendientes desde Supabase
  async cargarPendientes() {
    this.cargando = true;
    try {
      this.proyectos = await this.supabase.getProyectosPendientes();
      console.log('✅ Proyectos cargados:', this.proyectos);
    } catch (error) {
      console.error('❌ Error al cargar proyectos:', error);
      this.mostrarToast('Error al cargar los proyectos.');
    } finally {
      this.cargando = false;
    }
  }

  // 🟢 Cambiar estado (publicar / rechazar)
  async cambiarEstado(proyecto: any, nuevoEstado: string) {
    const verbo = nuevoEstado === 'publicada' ? 'publicar' : 'rechazar';

    const alerta = await this.alertCtrl.create({
      header: `${verbo.charAt(0).toUpperCase() + verbo.slice(1)} proyecto`,
      message: `¿Seguro que deseas ${verbo} este proyecto?`,
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Confirmar',
          handler: async () => {
            try {
              console.log(
                '🟦 Cambiando estado de',
                proyecto.id_proyecto,
                '→',
                nuevoEstado
              );
              const result = await this.supabase.cambiarEstadoProyecto(
                proyecto.id_proyecto,
                nuevoEstado
              );
              console.log('✅ Resultado de Supabase:', result);
              this.mostrarToast(`Proyecto ${nuevoEstado}`);
              await this.cargarPendientes();
            } catch (error) {
              console.error('❌ Error al actualizar estado:', error);
              this.mostrarToast('Error al actualizar el estado.');
            }
          },
        },
      ],
    });

    await alerta.present();
  }

  // 🟢 Toast reutilizable
  async mostrarToast(mensaje: string) {
    const toast = await this.toastCtrl.create({
      message: mensaje,
      duration: 2000,
      color: 'primary',
    });
    await toast.present();
  }
  // 🟢 Método para refrescar con el deslizado hacia abajo
  async refrescar(event: any) {
    try {
      await this.cargarPendientes();
    } finally {
      event.target.complete(); // 🔹 Cierra el refresher correctamente
    }
  }
}
