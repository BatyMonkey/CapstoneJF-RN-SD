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

  /** 🔄 Cargar registros de auditoría */
  async cargarAuditoria(event?: any) {
    this.loading = true;

    const { data, error } = await this.supabaseService
      .from('auditoria')
      .select('*')
      .order('fecha', { ascending: false });

    this.loading = false;
    if (event) event.target.complete();

    if (error) {
      console.error('❌ Error cargando auditoría:', error);
      this.registros = [];
      return;
    }

    // ✅ Parsear fechas y JSON del campo "detalle"
    this.registros = data.map((r: any) => {
      let detalle = r.detalle;

      // Si el detalle viene como string JSON, lo parseamos
      if (typeof detalle === 'string') {
        try {
          detalle = JSON.parse(detalle);
        } catch (e) {
          console.warn('⚠️ No se pudo parsear detalle:', e);
        }
      }

      return {
        ...r,
        fecha: r.fecha ? new Date(r.fecha) : null,
        detalle,
      };
    });
  }

  /** 🧩 Detecta si el valor es un array */
  isArray(value: any): boolean {
    return Array.isArray(value);
  }

  /** 📅 Detecta si el valor es una fecha ISO válida */
  isFecha(valor: any): boolean {
    if (typeof valor !== 'string') return false;
    return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(valor);
  }

  /** 📋 Ordena las claves del detalle en un orden lógico */
  orderedDetalleKeys(detalle: any): string[] {
    if (!detalle) return [];

    const keys = Object.keys(detalle);

    // Orden preferido
    const orden = [
      'titulo',
      'estado_anterior',
      'nuevo_estado',
      'id_actividad',
      'id_proyecto',
      'id_usuario',
      'opciones',
    ];

    const enOrden = orden.filter((k) => keys.includes(k));
    const resto = keys.filter((k) => !orden.includes(k));

    return [...enOrden, ...resto];
  }
}
