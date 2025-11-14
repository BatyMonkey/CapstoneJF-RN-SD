import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  IonicModule,
  ViewWillEnter,
  ViewWillLeave,
  NavController,
} from '@ionic/angular';
import { Router } from '@angular/router';
import { VotacionesService, Votacion } from '../services/votaciones.service';

// 👇 Registrar íconos
import { addIcons } from 'ionicons';
import {
  chevronBackOutline,
  checkboxOutline,
  calendarOutline,
  timeOutline,
  chevronForwardOutline,
} from 'ionicons/icons';

@Component({
  selector: 'app-votaciones-list',
  standalone: true,
  imports: [CommonModule, IonicModule],
  templateUrl: './votaciones-list.page.html',
  styleUrls: ['./votaciones-list.page.scss'],
})
export class VotacionesListPage
  implements OnInit, OnDestroy, ViewWillEnter, ViewWillLeave
{
  cargandoActivas = true;
  cargandoFinalizadas = true;
  errorActivas = '';
  errorFinalizadas = '';

  activas: Votacion[] = [];
  finalizadas: Votacion[] = [];

  // pestaña seleccionada en el UI
  activeTab: 'activas' | 'finalizadas' = 'activas';

  now = Date.now();
  private timer?: any;

  constructor(
    private votosSvc: VotacionesService,
    private router: Router,
    private navCtrl: NavController
  ) {
    // Registrar íconos que se usan en el HTML
    addIcons({
      chevronBackOutline,
      checkboxOutline,
      calendarOutline,
      timeOutline,
      chevronForwardOutline,
    });
  }

  async ngOnInit() {
    this.timer = setInterval(() => (this.now = Date.now()), 1000);
    await this.cargarTodo();
  }

  ionViewWillEnter() {
    // siempre entrar mostrando las activas
    this.activeTab = 'activas';
  }

  ionViewWillLeave() {
    // nada especial por ahora
  }

  ngOnDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  async cargarTodo(event?: any) {
    this.cargandoActivas = true;
    this.cargandoFinalizadas = true;
    this.errorActivas = '';
    this.errorFinalizadas = '';

    try {
      const [a, f] = await Promise.all([
        this.votosSvc.listarVotacionesActivas(),
        this.votosSvc.listarVotacionesFinalizadas?.() ??
          this.votosSvc.listarVotacionesActivas(),
      ]);
      this.activas = a || [];
      this.finalizadas = f || [];
    } catch (e: any) {
      this.errorActivas =
        e?.message ?? 'No se pudieron cargar las votaciones activas.';
      this.errorFinalizadas =
        e?.message ?? 'No se pudieron cargar las votaciones finalizadas.';
    } finally {
      this.cargandoActivas = false;
      this.cargandoFinalizadas = false;
      if (event) event.target.complete?.();
    }
  }

  irDetalle(v: Votacion) {
    this.router.navigate(['/votacion', v.id]);
  }

  tiempoRestante(fecha_fin: string): string {
    const ms = new Date(fecha_fin).getTime() - this.now;
    if (ms <= 0) return 'Finalizada';
    let s = Math.floor(ms / 1000);
    const d = Math.floor(s / 86400);
    s %= 86400;
    const h = Math.floor(s / 3600);
    s %= 3600;
    const m = Math.floor(s / 60);
    s %= 60;
    if (d > 0) return `${d}d ${h}h ${m}m`;
    if (h > 0) return `${h}h ${m}m ${s}s`;
    return `${m}m ${s}s`;
  }

  trackById(_i: number, v: Votacion) {
    return v.id;
  }

  // 🔙 Botón de volver en el header
  goBack() {
    if (window.history.length > 1) {
      this.navCtrl.back();
    } else {
      // fallback: ir al home si no hay historial
      this.navCtrl.navigateRoot('/home');
    }
  }
}
