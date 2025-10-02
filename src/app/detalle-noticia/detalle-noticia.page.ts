import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { NoticiasService, Noticia } from '../services/noticias';
import { ActivatedRoute } from '@angular/router';

@Component({
  selector: 'app-detalle-noticia',
  templateUrl: './detalle-noticia.page.html',
  // Se elimina la referencia al SCSS que no existe (Error NG2008)
  styleUrls: [], 
  standalone: true,
  imports: [IonicModule, CommonModule, FormsModule]
})
export class DetalleNoticiaPage implements OnInit {

  public noticia: Noticia | null = null;
  // Propiedad faltante que causaba el error TS2339
  public estaCargando: boolean = true; 
  public errorCarga: boolean = false;

  constructor(
    private route: ActivatedRoute,
    private noticiasService: NoticiasService
  ) { }

  ngOnInit() {
    this.cargarDetalleNoticia();
  }

  async cargarDetalleNoticia() {
    this.estaCargando = true;
    this.errorCarga = false;
    
    try {
      // 1. Obtener el ID de la URL
      const idString = this.route.snapshot.paramMap.get('id');
      const id = idString ? parseInt(idString, 10) : NaN;

      if (isNaN(id)) {
        console.error('ID de noticia no válido.');
        this.errorCarga = true;
        this.noticia = null;
        return;
      }

      // 2. Cargar la noticia por ID usando el servicio
      const data = await this.noticiasService.getNoticiaById(id);

      if (data) {
        this.noticia = data;
      } else {
        this.errorCarga = true;
        this.noticia = null;
        console.warn('No se encontró la noticia o falló la carga.');
      }

    } catch (error) {
      console.error('Error al cargar detalle de la noticia:', error);
      this.errorCarga = true;
    } finally {
      this.estaCargando = false;
    }
  }
}