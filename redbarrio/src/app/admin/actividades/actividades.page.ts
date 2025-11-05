import { Component, OnInit } from '@angular/core';
import { IonicModule, AlertController, ToastController } from '@ionic/angular';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SupabaseService } from 'src/app/services/supabase.service';

@Component({
  standalone: true, // ✅ página sin módulo
  selector: 'app-actividades',
  templateUrl: './actividades.page.html',
  styleUrls: ['./actividades.page.scss'],
  imports: [IonicModule, CommonModule, FormsModule], // ✅ necesario para <ion-*> tags
})
export class ActividadesPage implements OnInit {
  actividades: any[] = [];
  cargando = false;

  constructor(
    private supabase: SupabaseService,
    private toastCtrl: ToastController,
    private alertCtrl: AlertController
  ) {}

  // 🟢 Cargar actividades al iniciar
  async ngOnInit() {
    await this.cargarPendientes();
  }

  // 🟢 Obtener actividades pendientes desde Supabase
  async cargarPendientes() {
    this.cargando = true;
    try {
      this.actividades = await this.supabase.getActividadesPendientes();
      console.log('✅ Actividades cargadas:', this.actividades);
    } catch (error) {
      console.error('❌ Error al cargar actividades:', error);
      this.mostrarToast('Error al cargar las actividades');
    } finally {
      this.cargando = false;
    }
  }

  // 🟢 Cambiar estado (aceptar / rechazar)
  async cambiarEstado(actividad: any, nuevoEstado: string) {
    const verbo = nuevoEstado === 'aceptado' ? 'aceptar' : 'rechazar';

    const alerta = await this.alertCtrl.create({
      header: `${verbo.charAt(0).toUpperCase() + verbo.slice(1)} actividad`,
      message: `¿Seguro que deseas ${verbo} esta actividad?`,
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Confirmar',
          handler: async () => {
            try {
              console.log('🟦 Cambiando estado de', actividad.id_actividad, 'a', nuevoEstado);
              const result = await this.supabase.cambiarEstadoActividad(actividad.id_actividad, nuevoEstado);
              console.log('✅ Resultado de Supabase:', result);
              this.mostrarToast(`Actividad ${nuevoEstado}`);
              await this.cargarPendientes();
            } catch (error) {
              console.error('❌ Error al actualizar estado:', error);
              this.mostrarToast('Error al actualizar el estado');
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
}
