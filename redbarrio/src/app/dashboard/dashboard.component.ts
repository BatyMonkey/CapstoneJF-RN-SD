// src/app/dashboard/dashboard.component.ts

import { Component, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { FormsModule } from '@angular/forms';
import { MetricasService, Metrica } from './metricas.service';
import { BaseChartDirective } from 'ng2-charts';
import { ChartData, Chart, registerables, ChartOptions } from 'chart.js';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import { Capacitor } from '@capacitor/core';
import { Router } from '@angular/router';
import { Browser } from '@capacitor/browser';

import { SupabaseService } from 'src/app/services/supabase.service';

import { addIcons } from 'ionicons';
import {
  documentTextOutline,
  homeOutline,
  downloadOutline,
  statsChartOutline,
  chevronBackOutline,
} from 'ionicons/icons';

Chart.register(...registerables);

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, IonicModule, FormsModule, BaseChartDirective],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss'],
})
export class DashboardComponent implements OnInit {
  @ViewChild(BaseChartDirective) chart?: BaseChartDirective;

  metricas: Metrica[] = [];
  metricasOriginales: Metrica[] = [];
  totalIngresos = 0;
  totalGastos = 0;
  balance = 0;
  totalCertificados = 0;
  totalReservas = 0;
  cargando = true;
  errorMsg = '';
  filtroTipo: 'Todos' | 'Ingreso' | 'Gasto' = 'Todos';

  chartDataCategoria: ChartData<'doughnut'> = {
    labels: [],
    datasets: [
      {
        data: [],
        backgroundColor: ['#06b6d4', '#fbbf24', '#22c55e', '#3b82f6'],
      },
    ],
  };
  chartOptionsCategoria: ChartOptions<'doughnut'> = {};

  chartDataIngresosGastos: ChartData<'bar'> = { labels: [], datasets: [] };
  chartDataTopCategorias: ChartData<'bar'> = { labels: [], datasets: [] };
  tituloTopCategorias = 'Top Categorías';

  constructor(
    private metricasService: MetricasService,
    private router: Router,
    private supabaseService: SupabaseService
  ) {
    addIcons({
      documentTextOutline,
      homeOutline,
      downloadOutline,
      statsChartOutline,
      chevronBackOutline,
    });
  }

  // 🔙 Navegar atrás (o a /home)
  goBack() {
    this.router.navigateByUrl('/home');
  }

  async ngOnInit() {
    await this.cargarMetricas();
    await this.cargarKpis();
  }

  async cargarMetricas() {
    this.cargando = true;
    const { data, error } = await this.metricasService.getMetricas();

    if (error) {
      this.errorMsg = 'Error al cargar las métricas.';
      console.error(error);
    } else {
      this.metricasOriginales = data || [];
      this.aplicarFiltro();
    }

    this.cargando = false;
  }

  async cargarKpis() {
    try {
      const { totalCertificados, error: errorCert } =
        await this.metricasService.getTotalCertificados();
      const { totalReservas, error: errorRes } =
        await this.metricasService.getTotalReservas();

      if (!errorCert) this.totalCertificados = totalCertificados;
      if (!errorRes) this.totalReservas = totalReservas;
    } catch (err) {
      console.error('Error al cargar KPIs:', err);
    }
  }

  filtrarPorTipo(tipo: 'Todos' | 'Ingreso' | 'Gasto') {
    this.filtroTipo = tipo;
    this.aplicarFiltro();
  }

  aplicarFiltro() {
    this.metricas =
      this.filtroTipo === 'Todos'
        ? [...this.metricasOriginales]
        : this.metricasOriginales.filter(
            (m) => m.tipo_transaccion === this.filtroTipo
          );

    this.calcularTotales();
    this.actualizarGraficos();
  }

  calcularTotales() {
    const ingresos = this.metricas.filter(
      (m) => m.tipo_transaccion === 'Ingreso'
    );
    const gastos = this.metricas.filter(
      (m) => m.tipo_transaccion === 'Gasto'
    );

    this.totalIngresos = ingresos.reduce(
      (acc, i) => acc + Number(i.monto || 0),
      0
    );
    this.totalGastos = gastos.reduce(
      (acc, i) => acc + Number(i.monto || 0),
      0
    );
    this.balance = this.totalIngresos - this.totalGastos;
  }

  actualizarGraficos() {
    // 1️⃣ DONUT Distribución por categoría
    const categorias = new Map<string, number>();
    this.metricas.forEach((m) => {
      const valor = categorias.get(m.categoria) || 0;
      categorias.set(m.categoria, valor + Number(m.monto));
    });

    const categoriasArr = Array.from(categorias.entries());
    const valores = categoriasArr.map(([_, val]) => val);
    const totalGeneral = valores.reduce((acc, v) => acc + v, 0);

    const labelsConPorcentaje = categoriasArr.map(([cat, val]) => {
      const pct = totalGeneral ? (val / totalGeneral) * 100 : 0;
      return `${cat} (${pct.toFixed(1)}%)`;
    });

    this.chartDataCategoria = {
      labels: labelsConPorcentaje,
      datasets: [
        {
          data: valores,
          backgroundColor: [
            '#06b6d4',
            '#fbbf24',
            '#22c55e',
            '#3b82f6',
            '#8b5cf6',
            '#14b8a6',
            '#f97316',
            '#84cc16',
          ],
          borderColor: '#ffffff',
          borderWidth: 4,
          hoverOffset: 6,
        },
      ],
    };

    this.chartOptionsCategoria = {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '65%',
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            usePointStyle: true,
            padding: 16,
            font: { size: 11 },
          },
        },
        tooltip: {
          callbacks: {
            label: (context) => {
              const label = (context.label || '').toString();
              const value = context.raw as number;
              const total = valores.reduce((acc, v) => acc + v, 0);
              const pct = total ? (value / total) * 100 : 0;
              return `${label}: $${value.toLocaleString(
                'es-CL'
              )} (${pct.toFixed(1)}%)`;
            },
          },
        },
      },
    };

    // 2️⃣ Ingresos vs Gastos mensual
    const meses = [
      'Ene',
      'Feb',
      'Mar',
      'Abr',
      'May',
      'Jun',
      'Jul',
      'Ago',
      'Sep',
      'Oct',
      'Nov',
      'Dic',
    ];
    const ingresosPorMes = new Array(12).fill(0);
    const gastosPorMes = new Array(12).fill(0);

    this.metricas.forEach((m) => {
      const mes = new Date(m.fecha).getMonth();
      if (m.tipo_transaccion === 'Ingreso')
        ingresosPorMes[mes] += Number(m.monto);
      else if (m.tipo_transaccion === 'Gasto')
        gastosPorMes[mes] += Number(m.monto);
    });

    this.chartDataIngresosGastos = {
      labels: meses,
      datasets: [
        {
          label: 'Ingresos',
          data: ingresosPorMes,
          backgroundColor: '#16a34a',
        },
        {
          label: 'Gastos',
          data: gastosPorMes,
          backgroundColor: '#ef4444',
        },
      ],
    };

    // 3️⃣ Top Categorías dinámico
    const categoriasMap = new Map<string, number>();

    if (this.filtroTipo === 'Ingreso') {
      this.metricas
        .filter((m) => m.tipo_transaccion === 'Ingreso')
        .forEach((m) => {
          const valor = categoriasMap.get(m.categoria) || 0;
          categoriasMap.set(m.categoria, valor + Number(m.monto));
        });
      this.tituloTopCategorias = 'Top Categorías de Ingreso';
    } else if (this.filtroTipo === 'Gasto') {
      this.metricas
        .filter((m) => m.tipo_transaccion === 'Gasto')
        .forEach((m) => {
          const valor = categoriasMap.get(m.categoria) || 0;
          categoriasMap.set(m.categoria, valor + Number(m.monto));
        });
      this.tituloTopCategorias = 'Top Categorías de Gasto';
    } else {
      this.metricas.forEach((m) => {
        const valor = categoriasMap.get(m.categoria) || 0;
        categoriasMap.set(m.categoria, valor + Number(m.monto));
      });
      this.tituloTopCategorias =
        'Top Categorías (Ingresos + Gastos)';
    }

    const topCategorias = Array.from(categoriasMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    this.chartDataTopCategorias = {
      labels: topCategorias.map(([cat]) => cat),
      datasets: [
        {
          label: 'Monto total',
          data: topCategorias.map(([_, val]) => val),
          backgroundColor:
            this.filtroTipo === 'Gasto'
              ? ['#ef4444', '#f97316', '#f59e0b', '#84cc16', '#3b82f6']
              : this.filtroTipo === 'Ingreso'
              ? ['#16a34a', '#22c55e', '#84cc16', '#3b82f6', '#14b8a6']
              : ['#8b5cf6', '#6366f1', '#14b8a6', '#22d3ee', '#84cc16'],
        },
      ],
    };

    this.chart?.update();
  }

  // ========================================================
  // DESCARGAR TRANSPARENCIA ✅ vía Supabase Storage
  // ========================================================
  async descargarTransparencia() {
    try {
      if (!this.metricas || this.metricas.length === 0) {
        alert('No hay datos disponibles para exportar.');
        return;
      }

      const dataExcel = this.metricas.map((m) => ({
        Fecha: m.fecha ? m.fecha.split(' ')[0].replace(/-/g, '/') : '',
        'Tipo transacción': m.tipo_transaccion,
        Monto: m.monto,
        'Nombre item': m.nombre_item,
        Descripción: m.descripcion || '',
        Categoría: m.categoria,
        'Tipo fondo': m.tipo_fondo,
        'Fuente destino': m.fuente_destino || '',
      }));

      const ws: XLSX.WorkSheet = XLSX.utils.json_to_sheet(dataExcel);
      const wb: XLSX.WorkBook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Transparencia');

      const fileName = `detalle_transparencia_${new Date()
        .toISOString()
        .slice(0, 10)}.xlsx`;

      const platform = Capacitor.getPlatform();

      if (platform === 'web') {
        // 🌐 Navegador (PC): puedes descargar directo o subir a Supabase igual,
        // pero mantenemos la descarga directa porque funciona bien.
        const wbArray = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
        const blob = new Blob([wbArray], {
          type:
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        });
        saveAs(blob, fileName);
        return;
      }

      // 📱 App (Android/iOS): subimos el archivo a Supabase y descargamos desde ahí
      const wbArray = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      const blob = new Blob([wbArray], {
        type:
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });

      // Ruta dentro del bucket
      const timestamp = Date.now();
      const path = `excel/${timestamp}-${fileName}`;

      // 🔸 Usa un bucket llamado 'transparencia' (créalo en Supabase),
      // o cambia 'transparencia' por algún bucket que ya tengas, p. ej. 'proyectos'
      const { data, error } = await this.supabaseService
        .storage()
        .from('Transparencia')
        .upload(path, blob, {
          cacheControl: '3600',
          upsert: false,
          contentType:
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        });

      if (error) {
        console.error('❌ Error al subir Excel a Supabase:', error);
        alert(
          'Ocurrió un problema al subir el archivo de transparencia. Intenta nuevamente.'
        );
        return;
      }

      const { data: publicData } = this.supabaseService
        .storage()
        .from('Transparencia')
        .getPublicUrl(path);

      const publicUrl = publicData?.publicUrl;

      if (!publicUrl) {
        alert(
          'No se pudo obtener la URL pública del archivo. Revisa la configuración del bucket.'
        );
        return;
      }

      // 🧭 Abrimos en el navegador del sistema para que maneje la descarga
      await Browser.open({ url: publicUrl });
    } catch (error: any) {
      console.error('Error al generar / subir / abrir el Excel:', error);
      alert(
        `Error al generar o descargar el archivo: ${
          error?.message || error?.toString() || ''
        }`
      );
    }
  }
}
