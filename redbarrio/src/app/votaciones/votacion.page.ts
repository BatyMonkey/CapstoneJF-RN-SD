import {
  Component,
  OnDestroy,
  OnInit,
  AfterViewInit,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  ViewWillEnter,
  IonicModule,
  AlertController,
} from '@ionic/angular';
import { ActivatedRoute } from '@angular/router';
import {
  VotacionesService,
  Votacion,
  OpcionVotacion,
  Voto,
} from '../services/votaciones.service';
import {
  RealtimeChannel,
  RealtimePostgresInsertPayload,
} from '@supabase/supabase-js';
import { NavController } from '@ionic/angular';

// 👇 registrar íconos
import { addIcons } from 'ionicons';
import { chevronBackOutline, checkboxOutline } from 'ionicons/icons';

@Component({
  selector: 'app-votacion',
  standalone: true,
  imports: [CommonModule, FormsModule, IonicModule],
  templateUrl: './votacion.page.html',
  styleUrls: ['./votacion.page.scss'],
})
export class VotacionPage
  implements OnInit, OnDestroy, ViewWillEnter, AfterViewInit
{
  id!: string;
  cargando = true;
  errorMsg = '';

  votacion?: Votacion;
  opciones: OpcionVotacion[] = [];
  miOpcionId?: string; // opción ya votada en BD

  // opción seleccionada en UI (antes de confirmar)
  selectedOptionId?: string;

  private canalVotos?: RealtimeChannel;

  now = Date.now();
  private timer?: any;

  // Modal detalle
  detailOpen = false;
  selectedOp?: OpcionVotacion;
  presentingEl?: HTMLElement;

  constructor(
    private route: ActivatedRoute,
    private votosSvc: VotacionesService,
    private alertCtrl: AlertController,
    private navCtrl: NavController
  ) {
    // 🔹 Registrar íconos usados en la página
    addIcons({
      chevronBackOutline,
      checkboxOutline,
    });
  }

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
    this.presentingEl =
      (document.querySelector('ion-router-outlet') as HTMLElement | null) ||
      undefined;
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

      // si ya votó, marcamos esa opción como seleccionada
      this.selectedOptionId = this.miOpcionId;
    } catch (e: any) {
      this.errorMsg = e?.message ?? 'No se pudo cargar la votación';
      console.error('Error cargar votación:', e);
    } finally {
      this.cargando = false;
    }
  }

  async handleRefresh(ev: CustomEvent) {
    try {
      await this.cargar();
    } finally {
      (ev.target as HTMLIonRefresherElement)?.complete?.();
    }
  }

  /* ==== helpers de votos / porcentajes ==== */
  get totalVotos(): number {
    return this.opciones.reduce((acc, o) => acc + (o?.total_votos ?? 0), 0);
  }

  percent(op: OpcionVotacion): number {
    const total = this.totalVotos;
    if (!total) return 0;
    return Math.round(((op?.total_votos ?? 0) * 100) / total);
  }

  pct(op: OpcionVotacion): string {
    return `${this.percent(op)}%`;
  }

  trackByOp(_: number, op: OpcionVotacion) {
    return op.id;
  }

  /* ==== estado de la votación ==== */

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

  tiempoResumen(): string {
    if (!this.votacion) return '';
    const now = this.now;
    const ini = new Date(this.votacion.fecha_inicio).getTime();
    const fin = new Date(this.votacion.fecha_fin).getTime();
    if (now < ini) return this.formatMs(ini - now);
    if (now > fin) return 'Finalizada';
    return this.formatMs(fin - now);
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

  estadoChipLabel(): string {
    if (!this.votacion) return '';
    const now = this.now;
    const ini = new Date(this.votacion.fecha_inicio).getTime();
    const fin = new Date(this.votacion.fecha_fin).getTime();
    if (now < ini) return 'Pendiente';
    if (now > fin) return 'Finalizada';
    return 'En curso';
  }

  estadoChipClass(): string {
    const label = this.estadoChipLabel();
    if (label === 'En curso') return 'state-open';
    if (label === 'Finalizada') return 'state-closed';
    return 'state-pending';
  }

  /* ==== selección y confirmación de voto ==== */

  seleccionarOpcion(op: OpcionVotacion) {
    // Si ya votó o está bloqueada, no permitimos cambiar
    if (this.miOpcionId || this.bloqueada) return;
    this.selectedOptionId = op.id;
  }

  isOpcionSeleccionada(op: OpcionVotacion): boolean {
    return (
      this.selectedOptionId === op.id ||
      (!this.selectedOptionId && this.miOpcionId === op.id)
    );
  }

  get selectedOption(): OpcionVotacion | undefined {
    return this.opciones.find((o) => o.id === this.selectedOptionId);
  }

  get puedeConfirmar(): boolean {
    return !!this.selectedOption && !this.miOpcionId && !this.bloqueada;
  }

  async confirmarVoto() {
    const op = this.selectedOption;
    if (!op) return;

    const msg =
      `Vas a votar por "${op.titulo}". ` +
      'Recuerda que tu voto no se puede cambiar.';

    const alert = await this.alertCtrl.create({
      header: 'Confirmar voto',
      message: msg,
      buttons: [
        {
          text: 'Cancelar',
          role: 'cancel',
        },
        {
          text: 'OK',
          handler: () => this.votar(op),
        },
      ],
    });

    await alert.present();
  }

  async votar(opcion: OpcionVotacion) {
    if (!this.votacion) return;

    if (this.miOpcionId) {
      await this.mostrarAlerta(
        'Aviso',
        'Ya emitiste tu voto en esta votación.'
      );
      return;
    }

    if (this.bloqueada) {
      await this.mostrarAlerta('Aviso', 'La votación no está activa.');
      return;
    }

    const idx = this.opciones.findIndex((o) => o.id === opcion.id);
    const anterior = idx >= 0 ? this.opciones[idx].total_votos ?? 0 : 0;

    // 🔹 Actualización optimista local
    if (idx >= 0) {
      this.opciones[idx] = {
        ...this.opciones[idx],
        total_votos: anterior + 1,
      };
    }

    try {
      // 🔹 Registrar voto en backend
      await this.votosSvc.votar(this.votacion.id, opcion.id);
      this.miOpcionId = opcion.id;
      this.selectedOptionId = opcion.id;

      if (this.selectedOp?.id === opcion.id && idx >= 0) {
        this.selectedOp = { ...this.opciones[idx] };
      }

      // 🔄 Recargar datos desde Supabase
      await this.cargar();

      // ✅ ALERT de éxito sin HTML
      const okAlert = await this.alertCtrl.create({
        header: 'Voto registrado',
        message:
          'Tu voto ha sido registrado correctamente. Gracias por participar en la votación.',
        buttons: [
          {
            text: 'OK',
            role: 'confirm',
          },
        ],
      });
      await okAlert.present();

      if (this.detailOpen) this.closeDetail();
    } catch (e: any) {
      // rollback si falló
      if (idx >= 0) {
        this.opciones[idx] = {
          ...this.opciones[idx],
          total_votos: anterior,
        };
      }
      console.error('Error al votar:', e);

      const msg =
        e?.message ??
        'No se pudo registrar tu voto. Por favor, inténtalo nuevamente.';

      await this.mostrarAlerta('Error', msg);
    }
  }

  /* ==== modal detalle ==== */

  openDetail(op: OpcionVotacion) {
    this.selectedOp = op;
    this.detailOpen = true;
  }

  closeDetail() {
    this.detailOpen = false;
    this.selectedOp = undefined;
  }

  /* ==== helper de alerta simple ==== */

  private async mostrarAlerta(header: string, message: string) {
    const alert = await this.alertCtrl.create({
      header,
      message,
      buttons: ['OK'],
    });
    await alert.present();
  }

  goBack() {
    if (window.history.length > 1) {
      this.navCtrl.back();
    } else {
      this.navCtrl.navigateRoot('/votaciones');
    }
  }
}
