import { Injectable } from '@angular/core';
import { supabase } from '../core/supabase.client';

export interface Metrica {
  id_transaccion: number;
  fecha: string;
  tipo_transaccion: 'Ingreso' | 'Gasto';
  monto: number;
  nombre_item: string;
  descripcion?: string;
  categoria: string;
  tipo_fondo: string;
  fuente_destino?: string;
  estado_ejecucion: 'Proyectado' | 'Ejecutado' | 'Pendiente' | 'Cancelado';
  creado_en: string;
}

@Injectable({
  providedIn: 'root'
})
export class MetricasService {
  constructor() {}

  // 📊 Obtiene todas las métricas vecinales
  async getMetricas() {
    const { data, error } = await supabase
      .from('metricas_vecinales')
      .select('*')
      .order('fecha', { ascending: false });

    return { data, error };
  }

  // 📈 Calcula totales de ingresos, gastos y balance
  async getTotales() {
    const { data, error } = await supabase
      .from('metricas_vecinales')
      .select('tipo_transaccion, monto');

    if (error || !data) return { error };

    const ingresos = data
      .filter((d: any) => d.tipo_transaccion === 'Ingreso')
      .reduce((acc: number, cur: any) => acc + Number(cur.monto), 0);

    const gastos = data
      .filter((d: any) => d.tipo_transaccion === 'Gasto')
      .reduce((acc: number, cur: any) => acc + Number(cur.monto), 0);

    return {
      ingresos,
      gastos,
      balance: ingresos - gastos
    };
  }

  // 👇 Agrega estos métodos dentro de la clase MetricasService
  async getTotalCertificados() {
    const { count, error } = await supabase
      .from('certificados')
      .select('*', { count: 'exact', head: true }); // ✅ modo conteo sin traer datos
    return { totalCertificados: count || 0, error };
  }

  async getTotalReservas() {
    const { count, error } = await supabase
      .from('reserva')
      .select('*', { count: 'exact', head: true });
    return { totalReservas: count || 0, error };
  }

}
