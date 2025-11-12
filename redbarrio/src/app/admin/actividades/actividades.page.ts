import { Component, OnInit } from '@angular/core';
import { IonicModule, AlertController, ToastController } from '@ionic/angular';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SupabaseService } from 'src/app/services/supabase.service';

@Component({
  standalone: true,
  selector: 'app-actividades',
  templateUrl: './actividades.page.html',
  styleUrls: ['./actividades.page.scss'],
  imports: [IonicModule, CommonModule, FormsModule],
})
export class ActividadesPage implements OnInit {
  actividades: any[] = [];
  cargando = false;

  constructor(
    private supabase: SupabaseService,
    private toastCtrl: ToastController,
    private alertCtrl: AlertController
  ) {}

  async ngOnInit() {
    await this.cargarPendientes();
  }

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

  async onRefresh(event: any) {
    try {
      await this.cargarPendientes();
    } finally {
      // 🔹 Cierra el spinner del refresher
      event.target.complete();
    }
  }

  async cambiarEstado(actividad: any, nuevoEstado: string) {
    const verbo = nuevoEstado === 'publicada' ? 'publicar' : 'rechazar';

    const alerta = await this.alertCtrl.create({
      header: `${verbo.charAt(0).toUpperCase() + verbo.slice(1)} actividad`,
      message: `¿Seguro que deseas ${verbo} esta actividad?`,
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Confirmar',
          handler: async () => {
            try {
              const result = await this.supabase.cambiarEstadoActividad(
                actividad.id_actividad,
                nuevoEstado
              );

              console.log('✅ Resultado Supabase:', result);

              // 🧾 Registrar auditoría con el mismo servicio
              await this.supabase.registrarAuditoria(
                `${verbo} actividad`,
                'actividad',
                {
                  id_actividad: actividad.id_actividad,
                  titulo: actividad.titulo || '(sin título)',
                  estado_anterior: actividad.estado,
                  nuevo_estado: nuevoEstado,
                }
              );

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

  async mostrarToast(mensaje: string) {
    const toast = await this.toastCtrl.create({
      message: mensaje,
      duration: 2000,
      color: 'primary',
    });
    await toast.present();
  }
}
