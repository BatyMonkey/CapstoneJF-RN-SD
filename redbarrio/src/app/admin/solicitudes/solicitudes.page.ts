import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule, ToastController } from '@ionic/angular';
import { AuthService } from 'src/app/auth/auth.service';
import { SupabaseService } from 'src/app/services/supabase.service';

interface Perfil {
  id_usuario: string;
  id_auth: string;
  email?: string;
  nombre?: string;
  rol?: string;
  rol_usuario?: string;
  status?: string;
  [key: string]: any;
}

@Component({
  standalone: true,
  selector: 'app-solicitudes',
  templateUrl: './solicitudes.page.html',
  styleUrls: ['./solicitudes.page.scss'],
  imports: [IonicModule, CommonModule],
})
export class SolicitudesPage implements OnInit {
  solicitudes: any[] = [];
  cargando = false;

  constructor(
    private authService: AuthService,
    private supabaseService: SupabaseService,
    private toastCtrl: ToastController
  ) {}

  async ngOnInit() {
    await this.cargarSolicitudes();
  }

  // =====================================================
  // 🔹 Obtener perfil del usuario autenticado
  // =====================================================
  async miPerfil(): Promise<Perfil | null> {
    try {
      const perfil = await this.authService.obtenerPerfilActual();
      console.log('Perfil autenticado:', perfil);
      return perfil;
    } catch (err) {
      console.error('Error al obtener perfil:', err);
      return null;
    }
  }

  // =====================================================
  // 🔹 Cargar solicitudes pendientes (solo administradores)
  // =====================================================
  async cargarSolicitudes() {
    this.cargando = true;
    try {
      const session = await this.supabaseService.auth().getSession();
      console.log('🔑 UID autenticado:', session.data?.session?.user?.id);
      const perfil = await this.miPerfil();

      // ✅ Verificamos que el usuario sea administrador
      if (
        perfil?.rol_usuario === 'administrador' ||
        perfil?.rol === 'administrador'
      ) {
        const { data, error } = await this.supabaseService
          .from('usuario')
          .select('id_usuario, nombre, correo, status, rol')
          .eq('status', 'pendiente');

        if (error) {
          console.error('Error al consultar solicitudes:', error);
          await this.mostrarToast('Error al obtener solicitudes', 'danger');
          this.solicitudes = [];
          return;
        }

        console.log('Solicitudes obtenidas:', data);
        this.solicitudes = data || [];
      } else {
        console.warn(
          'El usuario no es administrador, no puede ver solicitudes'
        );
        await this.mostrarToast(
          'No tienes permisos para ver las solicitudes',
          'warning'
        );
        this.solicitudes = [];
      }
    } catch (err) {
      console.error('Error general al cargar solicitudes:', err);
      await this.mostrarToast('Error al cargar solicitudes', 'danger');
    } finally {
      this.cargando = false;
    }
  }

  // =====================================================
  // 🔹 Cambiar estado (Aprobar / Rechazar)
  // =====================================================
  async cambiarEstado(solicitud: any, nuevoEstado: string) {
    if (solicitud.procesando) return;
    solicitud.procesando = true;

    try {
      const ok = await this.authService.cambiarEstadoUsuario(
        solicitud.id_usuario,
        nuevoEstado
      );

      if (ok) {
        this.solicitudes = this.solicitudes.filter(
          (s) => s.id_usuario !== solicitud.id_usuario
        );

        await this.mostrarToast(
          nuevoEstado === 'activo'
            ? 'Solicitud aprobada correctamente'
            : 'Solicitud rechazada correctamente',
          nuevoEstado === 'activo' ? 'success' : 'medium'
        );
      }
    } catch (err) {
      console.error('Error al cambiar estado:', err);
      await this.mostrarToast('Error al cambiar estado', 'danger');
    } finally {
      solicitud.procesando = false;
    }
  }

  // =====================================================
  // 🔹 Mostrar toast reutilizable
  // =====================================================
  private async mostrarToast(mensaje: string, color: string = 'primary') {
    const toast = await this.toastCtrl.create({
      message: mensaje,
      duration: 2000,
      color,
    });
    await toast.present();
  }
}
