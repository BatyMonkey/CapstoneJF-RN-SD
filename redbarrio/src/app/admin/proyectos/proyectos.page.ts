import { Component, OnInit } from '@angular/core';
import { IonicModule, AlertController, ToastController } from '@ionic/angular';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SupabaseService } from 'src/app/services/supabase.service';
import { AuthService } from 'src/app/auth/auth.service';

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
    private alertCtrl: AlertController,
    private auth: AuthService
  ) {}

  // ==========================================================
  // CARGA AUTOMÁTICA AL ENTRAR
  // ==========================================================
  async ngOnInit() {
    console.log('🚀 Entrando al módulo de proyectos...');
    await this.cargarPendientes();
  }

  async ionViewWillEnter() {
    // Por si se regresa al módulo y se necesita refrescar automáticamente
    console.log('🔄 Refrescando proyectos al entrar...');
    await this.cargarPendientes();
  }

  // ==========================================================
  // OBTENER PROYECTOS PENDIENTES
  // ==========================================================
  async cargarPendientes() {
    this.cargando = true;
    try {
      console.log('📡 Cargando proyectos pendientes...');
      this.proyectos = await this.supabase.getProyectosPendientes();
      console.log('✅ Proyectos cargados:', this.proyectos);
    } catch (error) {
      console.error('❌ Error al cargar proyectos:', error);
      this.mostrarToast('Error al cargar los proyectos');
    } finally {
      this.cargando = false;
    }
  }

  // ==========================================================
  // CAMBIAR ESTADO
  // ==========================================================
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
              console.log(`🟦 Cambiando estado de ${proyecto.id_proyecto} → ${nuevoEstado}`);
              const result = await this.supabase.cambiarEstadoProyecto(
                proyecto.id_proyecto,
                nuevoEstado
              );
              console.log('✅ Resultado de Supabase:', result);
              await this.mostrarToast(`Proyecto ${nuevoEstado}`);
              await this.cargarPendientes();
            } catch (error) {
              console.error('❌ Error al actualizar estado:', error);
              await this.mostrarToast('Error al actualizar el estado');
            }
          },
        },
      ],
    });

    await alerta.present();
  }

  // ==========================================================
  // REFRESHER
  // ==========================================================
  async refrescar(event: any) {
    await this.cargarPendientes();
    event.target.complete();
  }

  // ==========================================================
  // TOAST
  // ==========================================================
  async mostrarToast(mensaje: string) {
    const toast = await this.toastCtrl.create({
      message: mensaje,
      duration: 2000,
      color: 'primary',
      position: 'top',
    });
    await toast.present();
  }
}
