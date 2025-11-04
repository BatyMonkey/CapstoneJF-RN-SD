import { Component, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { FormsModule } from '@angular/forms';
import { MetricasService, Metrica } from './metricas.service';
import { BaseChartDirective } from 'ng2-charts';
import { ChartData, ChartType, Chart, registerables } from 'chart.js';
Chart.register(...registerables);

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, IonicModule, FormsModule, BaseChartDirective],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss']
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

  chartDataCategoria: ChartData<'doughnut'> = { labels: [], datasets: [{ data: [] }] };
  chartDataIngresosGastos: ChartData<'bar'> = { labels: [], datasets: [] };
  chartDataTopCategorias: ChartData<'bar'> = { labels: [], datasets: [] };
  tituloTopCategorias = 'Top Categorías';

  constructor(private metricasService: MetricasService) {}

  async ngOnInit() {
    await this.cargarMetricas();
    await this.cargarKpis(); // ✅ KPIs globales
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

  // ✅ Cargar totales globales de certificados y reservas
  async cargarKpis() {
    try {
      const { totalCertificados, error: errorCert } = await this.metricasService.getTotalCertificados();
      const { totalReservas, error: errorRes } = await this.metricasService.getTotalReservas();

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
    this.metricas = this.filtroTipo === 'Todos'
      ? [...this.metricasOriginales]
      : this.metricasOriginales.filter(m => m.tipo_transaccion === this.filtroTipo);

    this.calcularTotales();
    this.actualizarGraficos();
  }

  calcularTotales() {
    const ingresos = this.metricas.filter(m => m.tipo_transaccion === 'Ingreso');
    const gastos = this.metricas.filter(m => m.tipo_transaccion === 'Gasto');

    this.totalIngresos = ingresos.reduce((acc, i) => acc + Number(i.monto || 0), 0);
    this.totalGastos = gastos.reduce((acc, i) => acc + Number(i.monto || 0), 0);
    this.balance = this.totalIngresos - this.totalGastos;
  }

  actualizarGraficos() {
    // 1️⃣ Distribución por Categoría con %
    const categorias = new Map<string, number>();
    this.metricas.forEach(m => {
      const valor = categorias.get(m.categoria) || 0;
      categorias.set(m.categoria, valor + Number(m.monto));
    });

    const categoriasArr = Array.from(categorias.entries());
    const totalGeneral = categoriasArr.reduce((acc, [, val]) => acc + val, 0);
    const labelsConPorcentaje = categoriasArr.map(([cat, val]) => {
      const porcentaje = totalGeneral ? (val / totalGeneral) * 100 : 0;
      return `${cat} (${porcentaje.toFixed(1)}%)`;
    });

    this.chartDataCategoria = {
      labels: labelsConPorcentaje,
      datasets: [{
        data: categoriasArr.map(([_, val]) => val),
        backgroundColor: [
          '#2563eb', '#16a34a', '#f59e0b', '#ef4444', '#8b5cf6',
          '#0ea5e9', '#14b8a6', '#f97316', '#84cc16'
        ]
      }]
    };

    // 2️⃣ Ingresos vs Gastos Mensual
    const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    const ingresosPorMes = new Array(12).fill(0);
    const gastosPorMes = new Array(12).fill(0);

    this.metricas.forEach(m => {
      const mes = new Date(m.fecha).getMonth();
      if (m.tipo_transaccion === 'Ingreso') ingresosPorMes[mes] += Number(m.monto);
      else if (m.tipo_transaccion === 'Gasto') gastosPorMes[mes] += Number(m.monto);
    });

    this.chartDataIngresosGastos = {
      labels: meses,
      datasets: [
        { label: 'Ingresos', data: ingresosPorMes, backgroundColor: '#16a34a' },
        { label: 'Gastos', data: gastosPorMes, backgroundColor: '#ef4444' }
      ]
    };

    // 3️⃣ Top Categorías dinámico (Ingreso / Gasto / Todos)
    const categoriasMap = new Map<string, number>();

    if (this.filtroTipo === 'Ingreso') {
      this.metricas
        .filter(m => m.tipo_transaccion === 'Ingreso')
        .forEach(m => {
          const valor = categoriasMap.get(m.categoria) || 0;
          categoriasMap.set(m.categoria, valor + Number(m.monto));
        });
      this.tituloTopCategorias = 'Top Categorías de Ingreso';
    } else if (this.filtroTipo === 'Gasto') {
      this.metricas
        .filter(m => m.tipo_transaccion === 'Gasto')
        .forEach(m => {
          const valor = categoriasMap.get(m.categoria) || 0;
          categoriasMap.set(m.categoria, valor + Number(m.monto));
        });
      this.tituloTopCategorias = 'Top Categorías de Gasto';
    } else {
      this.metricas.forEach(m => {
        const valor = categoriasMap.get(m.categoria) || 0;
        categoriasMap.set(m.categoria, valor + Number(m.monto));
      });
      this.tituloTopCategorias = 'Top Categorías (Ingresos + Gastos)';
    }

    const topCategorias = Array.from(categoriasMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    this.chartDataTopCategorias = {
      labels: topCategorias.map(([cat]) => cat),
      datasets: [{
        label: 'Monto total',
        data: topCategorias.map(([_, val]) => val),
        backgroundColor: this.filtroTipo === 'Gasto'
          ? ['#ef4444', '#f97316', '#f59e0b', '#84cc16', '#3b82f6']
          : this.filtroTipo === 'Ingreso'
          ? ['#16a34a', '#22c55e', '#84cc16', '#3b82f6', '#14b8a6']
          : ['#8b5cf6', '#6366f1', '#14b8a6', '#22d3ee', '#84cc16']
      }]
    };

    this.chart?.update();
  }
}
