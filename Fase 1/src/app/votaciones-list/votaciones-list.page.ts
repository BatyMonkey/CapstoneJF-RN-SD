import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { Router } from '@angular/router';
import { VotacionesService, Votacion } from '../services/votaciones.service';

@Component({
  selector: 'app-votaciones-list',
  standalone: true,
  imports: [CommonModule, IonicModule],
  templateUrl: './votaciones-list.page.html',
  styleUrls: ['./votaciones-list.page.scss'],
})
export class VotacionesListPage implements OnInit, OnDestroy {
  cargando = true;
  errorMsg = '';
  votaciones: Votacion[] = [];

  now = Date.now();
  private timer?: any;

  constructor(private votosSvc: VotacionesService, private router: Router) {}

  async ngOnInit() {
    this.timer = setInterval(() => (this.now = Date.now()), 1000);
    await this.cargar();
  }

  ngOnDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  async cargar() {
    this.cargando = true;
    this.errorMsg = '';
    try {
      this.votaciones = await this.votosSvc.listarVotacionesActivas();
    } catch (e: any) {
      this.errorMsg = e?.message ?? 'No se pudieron cargar las votaciones.';
    } finally {
      this.cargando = false;
    }
  }

  irDetalle(v: Votacion) {
    this.router.navigate(['/votacion', v.id]);
  }

  tiempoRestante(fecha_fin: string): string {
    const ms = new Date(fecha_fin).getTime() - this.now;
    if (ms <= 0) return 'Finalizada';
    let s = Math.floor(ms / 1000);
    const d = Math.floor(s / 86400); s %= 86400;
    const h = Math.floor(s / 3600);  s %= 3600;
    const m = Math.floor(s / 60);    s %= 60;
    if (d > 0) return `${d}d ${h}h ${m}m`;
    if (h > 0) return `${h}h ${m}m ${s}s`;
    return `${m}m ${s}s`;
  }
}
