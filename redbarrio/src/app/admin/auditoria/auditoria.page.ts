import { Component, OnInit } from '@angular/core';
import {
  IonicModule,
  LoadingController,
  ToastController,
} from '@ionic/angular';
import { CommonModule } from '@angular/common';
import { SupabaseService } from 'src/app/services/supabase.service';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

@Component({
  standalone: true,
  selector: 'app-auditoria',
  templateUrl: './auditoria.page.html',
  styleUrls: ['./auditoria.page.scss'],
  imports: [IonicModule, CommonModule, FormsModule, RouterLink],
})
export class AuditoriaPage implements OnInit {
  registros: any[] = [];
  loading = false;

  constructor(
    private supabaseService: SupabaseService,
    private loadingCtrl: LoadingController,
    private toastCtrl: ToastController
  ) {}

  async ngOnInit() {
    await this.cargarAuditoria();
  }

  async cargarAuditoria(event?: any) {
    this.loading = true;

    const loader = await this.loadingCtrl.create({
      message: 'Cargando auditoría...',
    });
    await loader.present();

    try {
      const { data, error } = await this.supabaseService
        .from('auditoria')
        .select('id, fecha, accion, tabla, detalle, nombre')
        .order('fecha', { ascending: false });

      if (error) throw error;

      this.registros = data || [];
    } catch (err) {
      console.error('❌ Error al cargar auditoría:', err);
      const toast = await this.toastCtrl.create({
        message: 'Error al cargar los registros de auditoría',
        color: 'danger',
        duration: 2500,
      });
      await toast.present();
    } finally {
      this.loading = false;
      await loader.dismiss();
      if (event) event.target.complete();
    }
  }

  orderedDetalleKeys(detalle: any): string[] {
  if (!detalle) return [];

  const keys = Object.keys(detalle);

  // Orden deseado
  const orden = ['titulo', 'estado_anterior', 'nuevo_estado', 'id_actividad'];

  // Primero los que están en "orden", en ese orden
  const enOrden = orden.filter(k => keys.includes(k));

  // Luego, cualquier otra clave que pueda venir en el JSON
  const resto = keys.filter(k => !orden.includes(k));

  return [...enOrden, ...resto];
}
}
