import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule, ToastController } from '@ionic/angular';
import { Router } from '@angular/router';
import { VotacionesService } from '../services/votaciones.service';

interface OpcionVM { titulo: string; }

@Component({
  standalone: true,
  selector: 'app-generar-votacion',
  templateUrl: './generar-votacion.page.html',
  styleUrls: ['./generar-votacion.page.scss'],
  imports: [IonicModule, CommonModule, FormsModule],
})
export class GenerarVotacionPage implements OnInit {
  loading = false;
  errorMsg = '';

  titulo = '';
  descripcion = '';
  fechaInicio = '';
  fechaFin = '';

  opciones: OpcionVM[] = [{ titulo: '' }, { titulo: '' }];

  constructor(
    private votosSvc: VotacionesService,
    private toast: ToastController,
    private router: Router,
  ) {}

  ngOnInit(): void {
    const now = new Date();
    const end = new Date(now.getTime() + 48 * 3600 * 1000);
    this.fechaInicio = now.toISOString();
    this.fechaFin = end.toISOString();
  }

  addOpcion() { this.opciones.push({ titulo: '' }); }
  removeOpcion(i: number) { if (this.opciones.length > 2) this.opciones.splice(i, 1); }

  get puedeGuardar(): boolean {
  const t = (this.titulo ?? '').trim();

  const limpias = this.opciones
    .map(o => (o.titulo ?? '').trim())
    .filter(s => s.length > 0);              // 👈 predicado explícito

  const unicas = new Set(limpias);

  const ini = new Date(this.fechaInicio).getTime();
  const fin = new Date(this.fechaFin).getTime();
  const fechasOk =
    !!this.fechaInicio &&
    !!this.fechaFin &&
    Number.isFinite(ini) &&
    Number.isFinite(fin) &&
    ini < fin;

  return t.length > 0 && fechasOk && limpias.length >= 2 && limpias.length === unicas.size;
}


  async guardar() {
    if (!this.puedeGuardar) return;
    this.loading = true; this.errorMsg = '';

    try {
      const id = await this.votosSvc.crearVotacionConOpciones({
        titulo: this.titulo.trim(),
        descripcion: this.descripcion.trim() || undefined,
        fecha_inicio: this.fechaInicio,
        fecha_fin: this.fechaFin,
        opciones: this.opciones.map(o => o.titulo.trim()),
      });

      await this.presentToast('Votación creada correctamente ✅', 'success');
      await this.router.navigate(['/votacion', id]);
    } catch (e: any) {
      this.errorMsg = e?.message ?? 'No se pudo crear la votación';
      await this.presentToast(this.errorMsg, 'danger');
    } finally {
      this.loading = false;
    }
  }

  private async presentToast(message: string, color: 'success' | 'danger') {
    const t = await this.toast.create({ message, duration: 2500, position: 'top', color });
    await t.present();
  }
  
}
