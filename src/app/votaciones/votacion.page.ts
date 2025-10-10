// src/app/votacion/votacion.page.ts

import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ViewWillEnter, IonicModule, ToastController } from '@ionic/angular';
import { ActivatedRoute } from '@angular/router';
import {
  VotacionesService,
  Votacion,
  OpcionVotacion,
} from '../services/votaciones.service';
import { SupabaseClient } from '@supabase/supabase-js';

@Component({
  selector: 'app-votacion',
  standalone: true,
  imports: [CommonModule, FormsModule, IonicModule],
  templateUrl: './votacion.page.html',
  styleUrls: ['./votacion.page.scss'],
})
export class VotacionPage implements OnInit, OnDestroy, ViewWillEnter {
  id!: string;
  cargando = true;
  errorMsg = '';

  votacion?: Votacion;
  opciones: OpcionVotacion[] = [];
  miOpcionId?: string;

  private canalVotos?: any;

  now = Date.now();
  private timer?: any;

  constructor(
    private route: ActivatedRoute,
    private votosSvc: VotacionesService
  ) {}

  async ngOnInit() {
    this.id = this.route.snapshot.paramMap.get('id')!;
    this.timer = setInterval(() => (this.now = Date.now()), 1000);
    await this.cargar();

    // Realtime: incrementa el conteo cuando entran votos nuevos
    this.canalVotos = this.votosSvc.suscribirVotosInsertados(
      this.id,
      (payload) => {
        const nuevo = (payload as any).new;
        const opcionId = nuevo?.opcion_id as string | undefined;
        if (!opcionId) return;
        const i = this.opciones.findIndex((o) => o.id === opcionId);
        if (i >= 0) {
          this.opciones[i] = {
            ...this.opciones[i],
            total_votos: (this.opciones[i].total_votos ?? 0) + 1,
          };
        }
      }
    );
  }

  ngOnDestroy(): void {
    if (this.canalVotos) this.votosSvc.desuscribir(this.canalVotos);
    if (this.timer) clearInterval(this.timer);
  }

  private async cargar() {
    this.cargando = true;
    this.errorMsg = '';
    try {
      const resp = await this.votosSvc.obtenerVotacionConOpciones(this.id);
      this.votacion = resp.votacion;
      this.opciones = resp.opciones;
      this.miOpcionId = resp.miOpcionId;
    } catch (e: any) {
      this.errorMsg = e?.message ?? 'No se pudo cargar la votación';
    } finally {
      this.cargando = false;
    }
  }

  /** Total de votos sumando todas las opciones */
  get totalVotos(): number {
    return this.opciones.reduce((acc, o) => acc + (o?.total_votos ?? 0), 0);
  }

  /** Porcentaje (0–100) como número redondeado para mostrar en texto/badge */
  percent(op: OpcionVotacion): number {
    const total = this.totalVotos;
    if (!total) return 0;
    const p = ((op?.total_votos ?? 0) * 100) / total;
    return Math.round(p); // entero; cambia a Math.round(p * 10) / 10 si quieres 1 decimal
  }

  /** Cadena "NN%" para la variable CSS --pct (barra de progreso) */
  pct(op: OpcionVotacion): string {
    return `${this.percent(op)}%`;
  }

  /** Mejor rendimiento en *ngFor */
  trackByOp(_: number, op: OpcionVotacion) {
    return op.id;
  }

  get bloqueada(): boolean {
    if (!this.votacion) return true;
    const now = this.now;
    const ini = new Date(this.votacion.fecha_inicio).getTime();
    const fin = new Date(this.votacion.fecha_fin).getTime();
    return now < ini || now > fin;
  }

  etiquetaTiempo(): string {
    if (!this.votacion) return '';
    const now = this.now;
    const ini = new Date(this.votacion.fecha_inicio).getTime();
    const fin = new Date(this.votacion.fecha_fin).getTime();

    if (now < ini) return `Inicia en: ${this.formatMs(ini - now)}`;
    if (now > fin) return 'Finalizada';
    return `Termina en: ${this.formatMs(fin - now)}`;
  }

  private formatMs(ms: number): string {
    if (ms <= 0) return '0s';
    let s = Math.floor(ms / 1000);
    const d = Math.floor(s / 86400);
    s %= 86400;
    const h = Math.floor(s / 3600);
    s %= 3600;
    const m = Math.floor(s / 60);
    s %= 60;
    if (d) return `${d}d ${h}h ${m}m`;
    if (h) return `${h}h ${m}m ${s}s`;
    return `${m}m ${s}s`;
  }

  async votar(opcion: OpcionVotacion) {
    if (!this.votacion) return;
    if (this.miOpcionId) {
      this.errorMsg = 'Ya emitiste tu voto en esta votación';
      return;
    }
    if (this.bloqueada) {
      this.errorMsg = 'La votación no está activa';
      return;
    }
    this.errorMsg = '';

    // Optimista
    const idx = this.opciones.findIndex((o) => o.id === opcion.id);
    const anterior = idx >= 0 ? this.opciones[idx].total_votos : 0;
    if (idx >= 0)
      this.opciones[idx] = { ...this.opciones[idx], total_votos: anterior + 1 };

    try {
      await this.votosSvc.votar(this.votacion.id, opcion.id);
      this.miOpcionId = opcion.id;
    } catch (e: any) {
      if (idx >= 0)
        this.opciones[idx] = { ...this.opciones[idx], total_votos: anterior };
      this.errorMsg = e?.message ?? 'No se pudo registrar tu voto';
    }
  }

  /**
   * 🚨 FUNCIÓN CORREGIDA: Aplica el retraso de 0.6s antes de la carga de datos.
   */
  ionViewWillEnter() {
    this.cargando = true; 
    
    // 🚀 DELAY DE 600ms: Da tiempo al servidor para que el voto/data se refleje.
    setTimeout(() => {
      this.cargar(); // Llama a la función de carga principal
    }, 600);
  }
}