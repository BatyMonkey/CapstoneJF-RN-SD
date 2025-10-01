import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule, ToastController } from '@ionic/angular';
import { NoticiasService, Noticia } from '../services/noticias'; // Revisar esta importación para asegurar que el path sea correcto
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-noticias',
  templateUrl: './noticias.page.html',
  styleUrls: ['./noticias.page.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule, FormsModule, RouterModule] // RouterModule es clave aquí
})
export class NoticiasPage implements OnInit {

  public noticias: Noticia[] = []; 
  public nuevaNoticia: Noticia = { titulo: '', contenido: '' }; 
  public fotoArchivo: File | null = null;
  public estaCargando: boolean = false;
  // ******* CORRECCIÓN CLAVE *******
  public estaCargandoNoticias: boolean = true; // Agregada para resolver TS2551
  // ******* CORRECCIÓN CLAVE *******

  // Mensajes de error específicos para la UI
  public mensajeError: string | null = null; 
  public esUsuarioAutenticado: boolean = false; // Se añade para el control del botón

  constructor(
    private noticiasService: NoticiasService,
    private cdr: ChangeDetectorRef, 
    private toastController: ToastController
  ) { }

  async ngOnInit() {
    await this.verificarAutenticacion();
    this.cargarNoticias();
  }

  // Nuevo método para verificar si el usuario está logueado
  async verificarAutenticacion() {
    const userId = await this.noticiasService.getCurrentUserId();
    this.esUsuarioAutenticado = !!userId;
    this.cdr.detectChanges(); 
  }

  async presentToast(message: string, color: 'success' | 'danger') {
    const toast = await this.toastController.create({
      message: message,
      duration: 3000,
      position: 'top',
      color: color
    });
    toast.present();
  }

  async cargarNoticias() {
    this.estaCargandoNoticias = true; // Inicia la carga
    try {
      const data = await this.noticiasService.getNoticias();
      if (data) {
        this.noticias = data;
        this.cdr.detectChanges(); 
      } else {
        console.error('Fallo al cargar noticias. Revisa las políticas RLS y la configuración de la vista.');
      }
    } catch (error) {
      console.error('Error cargando noticias:', error);
    } finally {
      this.estaCargandoNoticias = false; // Finaliza la carga
    }
  }
  
  // Renombrado de handleFotoChange a handleFileSelect para coincidir con el HTML
  handleFileSelect(event: any) {
    const files = event.target.files;
    if (files && files.length > 0) {
      this.fotoArchivo = files[0];
      // Si la noticia ya tenía una URL, se limpia al subir una nueva foto
      this.nuevaNoticia.url_foto = undefined; 
    } else {
      this.fotoArchivo = null;
    }
    this.mensajeError = null; 
  }

  async publicarNoticia() { 
    this.mensajeError = null;
    
    // 1. Validar autenticación
    const userId = await this.noticiasService.getCurrentUserId(); 
    
    if (!userId) {
        this.presentToast('Debes iniciar sesión para publicar noticias.', 'danger');
        return;
    }
    
    // 2. Validar campos obligatorios
    if (!this.nuevaNoticia.titulo?.trim() || !this.nuevaNoticia.contenido?.trim() || !this.fotoArchivo) {
      this.mensajeError = 'Faltan campos obligatorios o la foto.';
      this.presentToast('Error: Faltan título, contenido o la foto.', 'danger');
      return;
    }
    
    this.estaCargando = true;
    let fotoUrl: string | null = null;

    try {
      // 3. Subir la foto
      if (this.fotoArchivo) {
        fotoUrl = await this.noticiasService.subirFotoNoticia(this.fotoArchivo);
        
        if (fotoUrl === null) {
            this.mensajeError = 'Error al subir la foto al servidor.';
            this.presentToast('Error: No se pudo subir la imagen.', 'danger');
            return;
        }
      }

      // 4. Asignar datos finales y publicar
      this.nuevaNoticia.url_foto = fotoUrl;
      this.nuevaNoticia.user_id = userId; // Asignamos el ID del autor
      
      const noticiaCreada = await this.noticiasService.crearNoticia(this.nuevaNoticia);

      if (noticiaCreada) {
        this.presentToast('Noticia publicada con éxito.', 'success');
        
        // Recargar la lista
        await this.cargarNoticias(); 
        
        // Limpiar el formulario y el archivo
        this.nuevaNoticia = { titulo: '', contenido: '' };
        this.fotoArchivo = null;
        
        // Limpiar el input file (requiere referencia directa en un entorno real, pero aquí solo reiniciamos el modelo)
        
      } else {
        this.mensajeError = 'La publicación falló. Revisa RLS de INSERT y el user_id.';
        this.presentToast('Error al crear la noticia en la DB.', 'danger');
      }
    } catch (error) {
      console.error('Error al publicar la noticia:', error);
      this.mensajeError = 'Ocurrió un error inesperado al publicar.';
      this.presentToast('Error: Ocurrió un error inesperado.', 'danger');
    } finally {
      this.estaCargando = false;
    }
  }
}