import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ViewWillEnter, IonicModule, ToastController } from '@ionic/angular';
import { Router, RouterModule } from '@angular/router';

import { VotacionesService } from '../services/votaciones.service';
import { SupabaseService } from 'src/app/services/supabase.service';

interface OpcionVM {
  titulo: string;
  descripcion?: string | null;
  image_url?: string | null;
  _blob?: Blob;
  _ext?: string;
  previewDataUrl?: string;
}

@Component({
  standalone: true,
  selector: 'app-generar-votacion',
  templateUrl: './generar-votacion.page.html',
  styleUrls: ['./generar-votacion.page.scss'],
  imports: [IonicModule, CommonModule, FormsModule, RouterModule],
})
export class GenerarVotacionPage implements OnInit, ViewWillEnter {
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
    private supabaseService: SupabaseService
  ) {}

  ngOnInit(): void {
    const now = new Date();
    const end = new Date(now.getTime() + 48 * 3600 * 1000);
    this.fechaInicio = now.toISOString();
    this.fechaFin = end.toISOString();
  }

  ionViewWillEnter() {}

  addOpcion() {
    this.opciones.push({ titulo: '' });
  }
  removeOpcion(i: number) {
    if (this.opciones.length > 2) this.opciones.splice(i, 1);
  }

  async pickImage(i: number) {
    try {
      const { blob, ext, previewDataUrl } = await this.votosSvc.pickPhoto();
      this.opciones[i]._blob = blob;
      this.opciones[i]._ext = ext;
      this.opciones[i].previewDataUrl = previewDataUrl;
    } catch (e: any) {
      this.errorMsg = e?.message || 'No se pudo obtener la imagen';
      await this.presentToast(this.errorMsg, 'danger');
    }
  }

  removeImage(i: number) {
    this.opciones[i]._blob = undefined;
    this.opciones[i]._ext = undefined;
    this.opciones[i].previewDataUrl = undefined;
    this.opciones[i].image_url = undefined;
  }

  get puedeGuardar(): boolean {
    const t = (this.titulo ?? '').trim();
    const limpias = this.opciones
      .map((o) => (o.titulo ?? '').trim())
      .filter((s) => s.length > 0);
    const unicas = new Set(limpias);
    const ini = new Date(this.fechaInicio).getTime();
    const fin = new Date(this.fechaFin).getTime();
    const fechasOk =
      !!this.fechaInicio &&
      !!this.fechaFin &&
      Number.isFinite(ini) &&
      Number.isFinite(fin) &&
      ini < fin;
    return (
      t.length > 0 &&
      fechasOk &&
      limpias.length >= 2 &&
      limpias.length === unicas.size
    );
  }

  async guardar() {
    if (!this.puedeGuardar) return;
    this.loading = true;
    this.errorMsg = '';

    try {
      const { data: auth } = await this.supabaseService.client.auth.getUser();
      const userId = auth?.user?.id || null;
      if (!userId) throw new Error('Debes iniciar sesión');

      // Subir imágenes pendientes y fijar URLs
      for (const op of this.opciones) {
        if (op._blob && op._ext) {
          op.image_url = await this.votosSvc.uploadOptionImage(
            op._blob,
            op._ext,
            userId
          );
          op._blob = undefined;
          op._ext = undefined;
        }
      }

      // Crear votación enviando titulo/descripcion/image_url por opción
      await this.votosSvc.crearVotacionConOpciones({
        titulo: this.titulo.trim(),
        descripcion: this.descripcion?.trim() || undefined,
        fecha_inicio: this.fechaInicio,
        fecha_fin: this.fechaFin,
        opciones: this.opciones
          .map((o) => ({
            titulo: (o.titulo ?? '').trim(),
            descripcion: (o.descripcion ?? null) as string | null,
            image_url: o.image_url ?? null,
          }))
          .filter((o) => o.titulo.length > 0),
      });

      // 🧾 Registrar acción en auditoría
      await this.supabaseService.registrarAuditoria(
        'crear votación',
        'votaciones',
        {
          titulo: this.titulo.trim(),
          descripcion: this.descripcion?.trim() || '',
          fecha_inicio: this.fechaInicio,
          fecha_fin: this.fechaFin,
          cantidad_opciones: this.opciones.filter((o) => o.titulo.length > 0)
            .length,
          opciones: this.opciones.map((o) => ({
            titulo: o.titulo,
            descripcion: o.descripcion,
            image_url: o.image_url,
          })),
        }
      );

      await this.presentToast('Votación creada correctamente ✅', 'success');
      await this.router.navigateByUrl(`/votaciones`, { replaceUrl: true });
    } catch (e: any) {
      this.errorMsg = e?.message ?? 'No se pudo crear la votación';
      await this.presentToast(this.errorMsg, 'danger');
    } finally {
      this.loading = false;
    }
  }

  private async presentToast(message: string, color: 'success' | 'danger') {
    const t = await this.toast.create({
      message,
      duration: 2500,
      position: 'top',
      color,
    });
    await t.present();
  }
}
