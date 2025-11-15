// src/app/crear-noticia/crear-noticia.page.ts

import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  IonicModule,
  NavController,
  ToastController,
  LoadingController,
  AlertController,
  IonicSafeString,
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import {
  chevronBackOutline,
  addOutline,
  closeOutline,
  imageOutline,
  sendOutline,
  eyeOutline,
} from 'ionicons/icons';

import { SupabaseService } from 'src/app/services/supabase.service';
import { NoticiasService } from 'src/app/services/noticias';
import { SupabaseClient, User } from '@supabase/supabase-js';

const IMAGES_BUCKET = 'noticias-bucket';
const MAX_PARRAFOS = 5;
const MAX_IMAGENES = 5;

type NewsCategory = 'urgent' | 'event' | 'info' | 'success';

interface Paragraph {
  id: number;
  text: string;
}

@Component({
  standalone: true,
  selector: 'app-crear-noticia',
  templateUrl: './crear-noticia.page.html',
  styleUrls: ['./crear-noticia.page.scss'],
  imports: [CommonModule, IonicModule, FormsModule],
})
export class CrearNoticiaPage implements OnInit {
  // ===== STATE =====
  title = '';
  paragraphs: Paragraph[] = [];
  images: string[] = [];

  category: NewsCategory = 'info';

  archivosSeleccionados: (File | null)[] = new Array(MAX_IMAGENES).fill(null);
  estaSubiendoImagen = false;
  estaGuardando = false;

  supabase: SupabaseClient;
  usuarioAutenticado: User | null = null;
  nombreAutor: string | null = null;

  constructor(
    private navCtrl: NavController,
    private supabaseService: SupabaseService,
    private noticiasService: NoticiasService,
    private toastCtrl: ToastController,
    private loadingCtrl: LoadingController,
    private alertCtrl: AlertController
  ) {
    this.supabase = this.supabaseService.client;

    addIcons({
      'chevron-back-outline': chevronBackOutline,
      'add-outline': addOutline,
      'close-outline': closeOutline,
      'image-outline': imageOutline,
      'send-outline': sendOutline,
      'eye-outline': eyeOutline,
    });
  }

  async ngOnInit() {
    // Párrafo inicial
    this.addParagraph();
    await this.inicializarUsuarioYAutor();
  }

  // ============================
  // NAV
  // ============================
  goBack() {
    this.navCtrl.back();
  }

  // ============================
  // ALERTA ESTILO ACCIÓN
  // ============================
  async mostrarAlertaAccion(titulo: string, mensajeHtml: string) {
    const alerta = await this.alertCtrl.create({
      header: titulo,
      message: new IonicSafeString(mensajeHtml),
      mode: 'ios',
      cssClass: 'rb-action-alert',
      buttons: [
        {
          text: 'Cerrar',
          role: 'cancel',
        },
      ],
    });

    await alerta.present();
    await alerta.onDidDismiss();
  }

  // ============================
  // USUARIO / AUTOR
  // ============================
  async inicializarUsuarioYAutor() {
    const {
      data: { user },
    } = await this.supabase.auth.getUser();
    this.usuarioAutenticado = user;

    if (!user) {
      try {
        const perfilLocal = this.noticiasService.getUsuarioForzado?.() ?? null;
        if (perfilLocal) {
          this.usuarioAutenticado = {
            id: (perfilLocal.id_auth || perfilLocal.user_id) as string,
          } as any;
          this.nombreAutor = perfilLocal.nombre || 'Autor Desconocido';
          return;
        }
      } catch {
        // ignore
      }

      this.navCtrl.navigateRoot('/login');
      return;
    }

    try {
      const { data: perfil, error } = await this.supabase
        .from('usuario')
        .select('nombre')
        .eq('user_id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      this.nombreAutor = perfil?.nombre || 'Autor Desconocido';
    } catch {
      this.nombreAutor = 'Autor Desconocido';
    }
  }

  // ============================
  // PÁRRAFOS
  // ============================
  private crearParrafo(): Paragraph {
    return {
      id: Date.now() + Math.floor(Math.random() * 1000),
      text: '',
    };
  }

  addParagraph() {
    if (this.paragraphs.length < MAX_PARRAFOS) {
      this.paragraphs = [...this.paragraphs, this.crearParrafo()];
    }
  }

  removeParagraph(index: number) {
    if (this.paragraphs.length <= 1) return;
    this.paragraphs = this.paragraphs.filter((_, i) => i !== index);
  }

  trackByParagraph(index: number, item: Paragraph) {
    return item.id;
  }

  // ============================
  // MANEJO DE ARCHIVOS / IMÁGENES
  // ============================
  onFilesSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;

    const files = Array.from(input.files);

    for (const file of files) {
      const usados = this.archivosSeleccionados.filter((f) => f !== null).length;
      if (usados >= MAX_IMAGENES) break;

      const slotIndex = this.archivosSeleccionados.findIndex((f) => f === null);
      const idx = slotIndex === -1 ? usados : slotIndex;
      this.archivosSeleccionados[idx] = file;
    }

    this.rebuildImagePreviews();
    input.value = '';
  }

  private rebuildImagePreviews() {
    // Revocación de URLs antiguas opcional si quieres evitar fugas, aquí simple
    this.images = this.archivosSeleccionados
      .filter((f): f is File => !!f)
      .map((file) => URL.createObjectURL(file));
  }

  removeImage(index: number) {
    const usados = this.archivosSeleccionados
      .map((f, i) => ({ f, i }))
      .filter((x) => x.f);

    if (index < 0 || index >= usados.length) return;

    const realIndex = usados[index].i;
    this.archivosSeleccionados[realIndex] = null;
    this.rebuildImagePreviews();
  }

  // ============================
  // SUBIDA A SUPABASE STORAGE
  // ============================
  private async subirImagenes(): Promise<string[] | null> {
    const fullSession = await this.supabaseService.auth.getSession();
    const session = fullSession.data.session;
    const user = this.usuarioAutenticado;

    if (!session) {
      alert('No hay sesión activa en Supabase. Debes iniciar sesión para subir imágenes.');
      return null;
    }

    if (!user) {
      alert(
        'No se pudo determinar el usuario para la subida de imágenes. Inicia sesión y vuelve a intentarlo.'
      );
      return null;
    }

    const archivosValidos = this.archivosSeleccionados.filter(
      (f): f is File => !!f
    );
    if (archivosValidos.length === 0) {
      alert('Debes seleccionar al menos una imagen (portada).');
      return null;
    }

    this.estaSubiendoImagen = true;
    const urls: string[] = [];

    try {
      for (let previewIndex = 0; previewIndex < archivosValidos.length; previewIndex++) {
        const file = archivosValidos[previewIndex];
        const filePath = `${
          user.id
        }/noticias/${Date.now()}_${previewIndex}_${file.name.replace(/ /g, '_')}`;

        const uploadResp = await this.supabase.storage
          .from(IMAGES_BUCKET)
          .upload(filePath, file);

        if (uploadResp.error) {
          console.error('Supabase upload error:', uploadResp.error);
          alert(
            'Error subiendo imágenes: ' +
              (uploadResp.error.message || JSON.stringify(uploadResp.error))
          );
          this.estaSubiendoImagen = false;
          return null;
        }

        const publicUrlResp = await this.supabase.storage
          .from(IMAGES_BUCKET)
          .getPublicUrl(filePath);

        const publicUrl = publicUrlResp?.data?.publicUrl;
        if (!publicUrl) {
          alert('No se pudo obtener la URL pública de la imagen.');
          this.estaSubiendoImagen = false;
          return null;
        }

        urls.push(publicUrl);
      }

      this.estaSubiendoImagen = false;
      return urls;
    } catch (error) {
      console.error('Error subiendo imágenes:', error);
      this.estaSubiendoImagen = false;
      alert('Error subiendo las imágenes. Intenta de nuevo.');
      return null;
    }
  }

  // ============================
  // CREAR / PUBLICAR NOTICIA
  // ============================
  get canPublish(): boolean {
    const tieneTitulo = !!this.title.trim();
    const tieneImagen = this.images.length > 0;
    const tieneContenido = this.paragraphs.some(
      (p) => p.text && p.text.trim().length > 0
    );
    return tieneTitulo && tieneImagen && tieneContenido && !this.estaGuardando;
  }

  async handlePublish() {
    if (!this.canPublish) {
      const toast = await this.toastCtrl.create({
        message:
          'Debes agregar título, al menos un párrafo y una imagen de portada.',
        duration: 2500,
        color: 'warning',
      });
      await toast.present();
      return;
    }

    this.estaGuardando = true;
    const loader = await this.loadingCtrl.create({
      message: 'Publicando noticia...',
    });
    await loader.present();

    try {
      const urlsFotos = await this.subirImagenes();
      if (!urlsFotos) {
        await loader.dismiss();
        this.estaGuardando = false;
        return;
      }

      const parrafosLimpios = this.paragraphs
        .map((p) => p.text.trim())
        .filter((p) => p.length > 0);

      const nuevaNoticia: any = {
        titulo: this.title.trim(),
        parrafos: parrafosLimpios,
        url_foto: urlsFotos,
        nombre_autor: this.nombreAutor,
        categoria: this.category,
        fecha_creacion: new Date().toISOString(),
      };

      if (this.usuarioAutenticado?.id) {
        nuevaNoticia.user_id = this.usuarioAutenticado.id;
      }

      const { error } = await this.supabase
        .from('noticias')
        .insert(nuevaNoticia);

      if (error) {
        console.error('Error al guardar noticia en Supabase:', error);
        const toast = await this.toastCtrl.create({
          message:
            'Hubo un error al crear la noticia. Detalle: ' + error.message,
          duration: 3000,
          color: 'danger',
        });
        await toast.present();
      } else {
        // Auditoría
        try {
          await this.supabaseService.registrarAuditoria(
            'crear noticia',
            'noticias',
            {
              titulo: nuevaNoticia.titulo,
              user_id: nuevaNoticia.user_id,
              nombre_autor: nuevaNoticia.nombre_autor,
              url_foto: nuevaNoticia.url_foto,
              categoria: nuevaNoticia.categoria,
            }
          );
        } catch (e) {
          console.warn('Error registrando auditoría de noticia', e);
        }

        // ✅ ALERTA ESTILO ACCIÓN
        await this.mostrarAlertaAccion(
          'Noticia creada',
          `<p>La noticia <b>${nuevaNoticia.titulo}</b> se creó correctamente y ya está disponible para los vecinos.</p>`
        );

        // Reset
        this.title = '';
        this.paragraphs = [];
        this.addParagraph();
        this.images = [];
        this.archivosSeleccionados = new Array(MAX_IMAGENES).fill(null);
        this.category = 'info';

        this.goBack();
      }
    } catch (err) {
      console.error('Error inesperado al crear noticia:', err);
      const toast = await this.toastCtrl.create({
        message: 'Ocurrió un error inesperado.',
        duration: 2500,
        color: 'danger',
      });
      await toast.present();
    } finally {
      await loader.dismiss();
      this.estaGuardando = false;
    }
  }
}
