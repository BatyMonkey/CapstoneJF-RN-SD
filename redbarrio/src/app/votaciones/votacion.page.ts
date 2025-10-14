import { Component, OnDestroy, OnInit, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ViewWillEnter, IonicModule, ToastController } from '@ionic/angular';
import { ActivatedRoute } from '@angular/router';
import {
  VotacionesService,
  Votacion,
  OpcionVotacion,
  Voto,
} from '../services/votaciones.service';
import { RealtimeChannel, RealtimePostgresInsertPayload } from '@supabase/supabase-js';

@Component({
  selector: 'app-votacion',
  standalone: true,
  imports: [CommonModule, FormsModule, IonicModule],
  templateUrl: './votacion.page.html',
  styleUrls: ['./votacion.page.scss'],
})
export class VotacionPage implements OnInit, OnDestroy, ViewWillEnter, AfterViewInit {
  id!: string;
  cargando = true;
  errorMsg = '';

  votacion?: Votacion;
  opciones: OpcionVotacion[] = [];
  miOpcionId?: string;

  private canalVotos?: RealtimeChannel;

  now = Date.now();
  private timer?: any;

  // Sheet / modal detalle
  detailOpen = false;
  selectedOp?: OpcionVotacion;
  presentingEl?: HTMLElement; // <- para sheet-style en iOS

  constructor(
    private route: ActivatedRoute,
    private votosSvc: VotacionesService,
    private toastCtrl: ToastController
  ) {}

  async ngOnInit() {
    this.id = this.route.snapshot.paramMap.get('id')!;
    this.timer = setInterval(() => (this.now = Date.now()), 1000);
    await this.cargar();

    // Realtime
    this.canalVotos = this.votosSvc.suscribirVotosInsertados(
      this.id,
      (payload: RealtimePostgresInsertPayload<Voto>) => {
        const opcionId = payload.new?.opcion_id as string | undefined;
        if (!opcionId) return;
        const i = this.opciones.findIndex((o) => o.id === opcionId);
        if (i >= 0) {
          this.opciones[i] = {
            ...this.opciones[i],
            total_votos: (this.opciones[i].total_votos ?? 0) + 1,
          };
          if (this.selectedOp?.id === opcionId) {
            this.selectedOp = { ...this.opciones[i] };
          }
        }
      }
    );
  }

  ngAfterViewInit(): void {
    // Elemento sobre el que se presenta el sheet (para efecto iOS)
    this.presentingEl = document.querySelector('ion-router-outlet') as HTMLElement | null || undefined;
  }

  ngOnDestroy(): void {
    if (this.canalVotos) this.votosSvc.desuscribir(this.canalVotos);
    if (this.timer) clearInterval(this.timer);
  }

  ionViewWillEnter() {
    this.cargando = true;
    setTimeout(() => this.cargar(), 600);
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
      console.error('Error cargar votación:', e);
    } finally {
      this.cargando = false;
    }
  }

  async handleRefresh(ev: CustomEvent) {
    try { await this.cargar(); }
    finally { (ev.target as HTMLIonRefresherElement)?.complete?.(); }
  }

  get totalVotos(): number {
    return this.opciones.reduce((acc, o) => acc + (o?.total_votos ?? 0), 0);
  }
  percent(op: OpcionVotacion): number {
    const total = this.totalVotos;
    if (!total) return 0;
    return Math.round(((op?.total_votos ?? 0) * 100) / total);
  }
  pct(op: OpcionVotacion): string { return `${this.percent(op)}%`; }
  trackByOp(_: number, op: OpcionVotacion) { return op.id; }

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
    const d = Math.floor(s / 86400); s %= 86400;
    const h = Math.floor(s / 3600); s %= 3600;
    const m = Math.floor(s / 60); s %= 60;
    if (d) return `${d}d ${h}h ${m}m`;
    if (h) return `${h}h ${m}m ${s}s`;
    return `${m}m ${s}s`;
  }

  async votar(opcion: OpcionVotacion) {
    if (!this.votacion) return;
    if (this.miOpcionId) { await this.mostrarToast('Ya emitiste tu voto en esta votación', 'danger'); return; }
    if (this.bloqueada) { await this.mostrarToast('La votación no está activa', 'warning'); return; }

    const idx = this.opciones.findIndex((o) => o.id === opcion.id);
    const anterior = idx >= 0 ? (this.opciones[idx].total_votos ?? 0) : 0;
    if (idx >= 0) this.opciones[idx] = { ...this.opciones[idx], total_votos: anterior + 1 };

    try {
      await this.votosSvc.votar(this.votacion.id, opcion.id);
      this.miOpcionId = opcion.id;
      if (this.selectedOp?.id === opcion.id) this.selectedOp = { ...this.opciones[idx] };
      await this.mostrarToast('Voto registrado correctamente ✅', 'success');
      if (this.detailOpen) this.closeDetail();
    } catch (e: any) {
      if (idx >= 0) this.opciones[idx] = { ...this.opciones[idx], total_votos: anterior };
      console.error('Error al votar:', e);
      await this.mostrarToast(e?.message ?? 'No se pudo registrar tu voto', 'danger');
    }
  }

  openDetail(op: OpcionVotacion) { this.selectedOp = op; this.detailOpen = true; }
  closeDetail() { this.detailOpen = false; this.selectedOp = undefined; }

  private async mostrarToast(message: string, color: 'success' | 'danger' | 'warning') {
    const toast = await this.toastCtrl.create({ message, duration: 3000, position: 'top', color });
    await toast.present();
  }
}

