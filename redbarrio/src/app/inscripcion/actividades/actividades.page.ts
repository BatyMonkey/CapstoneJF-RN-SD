import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { IonicModule, LoadingController, AlertController } from '@ionic/angular';
import { FormsModule } from '@angular/forms';
import { SupabaseService } from 'src/app/services/supabase.service';
import { AuthService, Perfil } from 'src/app/auth/auth.service';
import { addIcons } from 'ionicons';
import {
  documentTextOutline,
  briefcaseOutline,
  checkmarkDoneOutline,
  businessOutline,
  barChartOutline,
  bulbOutline,
  megaphoneOutline,
  calendarOutline,
  chevronBackOutline,
  addOutline,
} from 'ionicons/icons';

@Component({
  standalone: true,
  selector: 'app-actividades',
  templateUrl: './actividades.page.html',
  styleUrls: ['./actividades.page.scss'],
  imports: [CommonModule, IonicModule, FormsModule],
})
export class ActividadesPage implements OnInit {
  perfil: Perfil | null = null;
  elementos: any[] = [];
  elementosFiltrados: any[] = [];
  isLoading = true;
  filtro: string = 'todos'; // todos | actividades

  constructor(
    private auth: AuthService,
    private router: Router,
    private loadingCtrl: LoadingController,
    private alertCtrl: AlertController,
    private supabaseService: SupabaseService
  ) {
    addIcons({
      'document-text-outline': documentTextOutline,
      'briefcase-outline': briefcaseOutline,
      // importante: coincide con el HTML
      'checkmark-done-outline': checkmarkDoneOutline,
      'business-outline': businessOutline,
      'bar-chart-outline': barChartOutline,
      'bulb-outline': bulbOutline,
      'megaphone-outline': megaphoneOutline,
      'calendar-outline': calendarOutline,
      'chevron-back-outline': chevronBackOutline,
      'add-outline': addOutline,
    });
  }

  async ngOnInit() {
    await this.validarSesion();
    await this.cargarListado();
  }

  // ✅ Validar sesión persistente (sin redirigir en desarrollo)
  async validarSesion() {
    try {
      const ses = await this.auth.waitForActiveSession();
      let perfil = await this.auth.miPerfil();

      if (!perfil) {
        const localPerfil = localStorage.getItem('rb_usuario_activo');
        if (localPerfil) perfil = JSON.parse(localPerfil);
      }

      if (!perfil) {
        console.warn('⚠️ No hay sesión válida, usando modo local temporal.');
        return;
      }

      this.perfil = perfil;
      console.log('✅ Sesión activa o restaurada:', perfil);
    } catch (error) {
      console.error('Error validando sesión:', error);
    }
  }

  // ✅ Cargar proyectos y actividades
  async cargarListado() {
    this.isLoading = true;
    const loading = await this.loadingCtrl.create({
      message: 'Cargando actividades...',
      spinner: 'crescent',
    });
    await loading.present();

    try {
      const [actividadesRes] = await Promise.all([
        this.supabaseService.client
          .from('actividad')
          .select('*')
          .eq('estado', 'publicada'), // ✅ solo publicadas
      ]);

      if (actividadesRes.error) throw actividadesRes.error;

      const actividades = (actividadesRes.data || []).map((a) => ({
        ...a,
        tipo: 'actividad',
        fecha: a.fecha || a.creado_en || new Date().toISOString(),
      }));

      this.elementos = [...actividades].sort(
        (a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime()
      );

      this.filtrarListado();
      console.log('✅ Listado cargado (solo publicados):', this.elementos);
    } catch (err) {
      console.error('Error al cargar listado:', err);
      await this.mostrarAlerta('Error', 'No se pudo cargar el listado.');
    } finally {
      this.isLoading = false;
      loading.dismiss();
    }
  }

  // ✅ Filtro visual entre y actividades
  filtrarListado() {
    switch (this.filtro) {
      case 'actividades':
        this.elementosFiltrados = this.elementos.filter(
          (e) => e.tipo === 'actividad'
        );
        break;
      default:
        this.elementosFiltrados = this.elementos;
    }
  }

  // ✅ Ver detalle y navegar correctamente (respetando app-routing)
  async verDetalle(item: any) {
    try {
      // Asegura que hay sesión o usa modo local
      let uid = await this.auth.miUID();

      if (!uid) {
        const perfilLocal = localStorage.getItem('rb_usuario_activo');
        if (perfilLocal) {
          const perfil = JSON.parse(perfilLocal);
          this.auth.setUsuarioForzado(perfil);
          uid = perfil.id_auth;
        }
      }

      if (!uid) {
        console.warn('⚠️ No se detectó sesión, redirigiendo al login');
        this.router.navigate(['/auth/login']);
        return;
      }

      // 🧭 Redirigir usando parámetro de ruta
      if (item.id_proyecto) {
      } else if (item.id_actividad) {
        this.router.navigate([
          '/inscripcion/inscripcion-proyecto',
          item.id_actividad,
        ]);
      } else {
        console.error('❌ Elemento sin ID de proyecto o actividad');
      }
    } catch (error) {
      console.error('Error al abrir inscripción:', error);
      this.router.navigate(['/auth/login']);
    }
  }

  // ✅ Botón del header (flecha) — vuelve a la pantalla anterior
  goBack() {
    if (window.history.length > 1) {
      window.history.back();
    } else {
      // ruta de seguridad si entra directo por deep-link
      this.router.navigate(['/']);
    }
  }

  goSugerir() {
    this.router.navigate(['generar/actividad'])
  }

  // ✅ Mostrar alerta genérica
  async mostrarAlerta(header: string, message: string) {
    const alert = await this.alertCtrl.create({
      header,
      message,
      buttons: ['Aceptar'],
    });
    await alert.present();
  }
}
