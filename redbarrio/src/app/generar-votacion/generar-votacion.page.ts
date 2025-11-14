import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule, ToastController } from '@ionic/angular';
import { Router, RouterModule } from '@angular/router';
import { VotacionesService } from '../services/votaciones.service';
import { SupabaseService } from 'src/app/services/supabase.service';
import { ViewChildren, QueryList, ElementRef } from '@angular/core';


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
export class GenerarVotacionPage implements OnInit {
  @ViewChildren('fileInput') fileInputs!: QueryList<ElementRef<HTMLInputElement>>;

  loading = false;
  errorMsg = '';

  // ================================
  // CAMPOS GENERALES
  // ================================
  titulo = '';
  descripcion = '';

  // ================================
  // FECHAS Y HORAS (SEPARADAS)
  // ================================
  fechaInicio = '';   // yyyy-mm-dd
  horaInicio = '';    // hh:mm
  fechaTermino = '';
  horaTermino = '';

  // ================================
  // OPCIONES DE LA VOTACIÓN
  // ================================
  opciones: OpcionVM[] = [{ titulo: '' }, { titulo: '' }];

  constructor(
    private votosSvc: VotacionesService,
    private toast: ToastController,
    private router: Router,
    private supabaseService: SupabaseService
  ) {}

  ngOnInit(): void {
    // Inicializamos fecha/hora actuales
    const now = new Date();
    const end = new Date(now.getTime() + 48 * 3600 * 1000);

    // Convertimos FECHA al formato YYYY-MM-DD
    this.fechaInicio = now.toISOString().substring(0, 10);
    this.fechaTermino = end.toISOString().substring(0, 10);

    // Convertimos HORA al formato HH:mm
    const pad = (n: number) => n.toString().padStart(2, '0');
    this.horaInicio = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
    this.horaTermino = `${pad(end.getHours())}:${pad(end.getMinutes())}`;
  }

  // ============================================================
  // BOTÓN "VOLVER" DEL HEADER PERSONALIZADO
  // ============================================================
  goBack() {
    this.router.navigate(['/votaciones'], { replaceUrl: true });
  }


  // ============================================================
  // OPCIONES
  // ============================================================
  addOpcion() {
    this.opciones.push({ titulo: '' });
  }

  removeOpcion(i: number) {
    if (this.opciones.length > 2) this.opciones.splice(i, 1);
  }

  // ============================================================
  // SUBIR IMAGEN OPCIÓN
  // ============================================================
  async onFileSelected(i: number, event: Event) {
    try {
      const input = event.target as HTMLInputElement;
      const file = input.files && input.files[0];
      if (!file) return;

      const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();

      this.opciones[i]._blob = file;
      this.opciones[i]._ext = ext;
      this.opciones[i].previewDataUrl = await this.readFileAsDataUrl(file);

      input.value = '';
    } catch (e: any) {
      this.errorMsg = e?.message || 'No se pudo obtener la imagen';
      await this.presentToast(this.errorMsg, 'danger');
    }
  }

  private readFileAsDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () =>
        reject(new Error('No se pudo leer el archivo de imagen'));
      reader.readAsDataURL(file);
    });
  }

  removeImage(i: number) {
    this.opciones[i]._blob = undefined;
    this.opciones[i]._ext = undefined;
    this.opciones[i].previewDataUrl = undefined;
    this.opciones[i].image_url = undefined;
  }

  // ============================================================
  // VALIDACIÓN PARA HABILITAR BOTÓN "CREAR VOTACIÓN"
  // ============================================================
  get puedeGuardar(): boolean {
    const t = this.titulo.trim();

    // Validar mínimo 2 opciones con título no vacío
    const limpias = this.opciones
      .map((o) => o.titulo.trim())
      .filter((s) => s.length > 0);

    const unicas = new Set(limpias);

    // Validar fechas y horas
    if (!this.fechaInicio || !this.horaInicio || !this.fechaTermino || !this.horaTermino)
      return false;

    const inicio = new Date(`${this.fechaInicio}T${this.horaInicio}`).getTime();
    const fin = new Date(`${this.fechaTermino}T${this.horaTermino}`).getTime();
    const fechasOk = Number.isFinite(inicio) && Number.isFinite(fin) && inicio < fin;

    return (
      t.length > 0 &&
      fechasOk &&
      limpias.length >= 2 &&
      limpias.length === unicas.size
    );
  }

  // ============================================================
  // GUARDAR VOTACIÓN EN SUPABASE
  // ============================================================
  async guardar() {
    if (!this.puedeGuardar) return;

    this.loading = true;
    this.errorMsg = '';

    try {
      const { data: auth } = await this.supabaseService.client.auth.getUser();
      const userId = auth?.user?.id;
      if (!userId) throw new Error('Debes iniciar sesión');

      // FECHAS CONSTRUIDAS EN FORMATO ISO
      const fechaInicioISO = `${this.fechaInicio}T${this.horaInicio}`;
      const fechaFinISO = `${this.fechaTermino}T${this.horaTermino}`;

      // ⇢ Subir imágenes
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

      // ⇢ Crear votación
      await this.votosSvc.crearVotacionConOpciones({
        titulo: this.titulo.trim(),
        descripcion: this.descripcion.trim() || undefined,
        fecha_inicio: fechaInicioISO,
        fecha_fin: fechaFinISO,
        opciones: this.opciones
          .map((o) => ({
            titulo: o.titulo.trim(),
            descripcion: o.descripcion || null,
            image_url: o.image_url || null,
          }))
          .filter((o) => o.titulo.length > 0),
      });

      // Auditoría
      await this.supabaseService.registrarAuditoria(
        'crear votación',
        'votaciones',
        {
          titulo: this.titulo.trim(),
          descripcion: this.descripcion.trim(),
          fecha_inicio: fechaInicioISO,
          fecha_fin: fechaFinISO,
          cantidad_opciones: this.opciones.filter((o) => o.titulo.trim()).length,
          opciones: this.opciones,
        }
      );

      await this.presentToast('Votación creada correctamente ✅', 'success');
      await this.router.navigateByUrl('/votaciones', { replaceUrl: true });
    } catch (e: any) {
      this.errorMsg = e?.message ?? 'No se pudo crear la votación';
      await this.presentToast(this.errorMsg, 'danger');
    } finally {
      this.loading = false;
    }
  }

  // ============================================================
  // TOAST
  // ============================================================
  private async presentToast(message: string, color: 'success' | 'danger') {
  const t = await this.toast.create({
    message,
    duration: 2500,
    position: 'bottom',    // 👈 Cambiado aquí
    color,
    animated: true,
    cssClass: 'custom-toast'
  });
  await t.present();
}

}
