// src/app/pages/generar-votacion/generar-votacion.page.ts

import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
// 🚨 CORRECCIÓN: Usar ViewWillEnter en lugar de IonViewWillEnter
import { ViewWillEnter, IonicModule, ToastController } from '@ionic/angular'; 
import { Router, RouterModule } from '@angular/router';

import { VotacionesService } from '../services/votaciones.service'; // Asumiendo la ruta correcta

interface OpcionVM {
  titulo: string;
}

@Component({
  standalone: true,
  selector: 'app-generar-votacion',
  templateUrl: './generar-votacion.page.html',
  styleUrls: ['./generar-votacion.page.scss'],
  imports: [IonicModule, CommonModule, FormsModule, RouterModule], 
})
// 🚨 IMPLEMENTACIÓN CORREGIDA: Implementar ViewWillEnter
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
    private router: Router
  ) {}

  ngOnInit(): void {
    const now = new Date();
    const end = new Date(now.getTime() + 48 * 3600 * 1000); 
    this.fechaInicio = now.toISOString();
    this.fechaFin = end.toISOString();
  }
  
  // El gancho de ciclo de vida de Ionic, ahora con el nombre de interfaz correcto
  ionViewWillEnter() {
      // Esta función no es esencial aquí, pero se usa para implementar la interfaz.
      // Si el componente que lista las votaciones la implementa, se recargará.
  }

  addOpcion() {
    this.opciones.push({ titulo: '' });
  }
  removeOpcion(i: number) {
    if (this.opciones.length > 2) this.opciones.splice(i, 1);
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
      const id = await this.votosSvc.crearVotacionConOpciones({
        titulo: this.titulo.trim(),
        descripcion: this.descripcion?.trim() || undefined,
        fecha_inicio: this.fechaInicio,
        fecha_fin: this.fechaFin,
        opciones: this.opciones.map((o) => o.titulo.trim()),
      });

      await this.presentToast('Votación creada correctamente ✅', 'success');

      // 🚨 NAVEGACIÓN CORREGIDA: Forzamos la recarga al volver a la página de listado
      // Usamos replaceUrl: true para asegurar que el componente de destino se refresque.
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