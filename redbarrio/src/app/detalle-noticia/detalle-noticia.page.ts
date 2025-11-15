import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { SupabaseService } from 'src/app/services/supabase.service';
import { SupabaseClient } from '@supabase/supabase-js';
import { Location } from '@angular/common';
import { addIcons } from 'ionicons';
import {
  calendarOutline,
  personOutline,
  chevronBackOutline,
  personCircleOutline
} from 'ionicons/icons';

interface DetalleNoticia {
  id: number;
  titulo: string;
  parrafos: string[] | null;
  url_foto: string[] | null;
  nombre_autor: string | null;
  fecha_creacion: string;
}

@Component({
  selector: 'app-detalle-noticia',
  standalone: true,
  templateUrl: './detalle-noticia.page.html',
  styleUrls: ['./detalle-noticia.page.scss'],
  imports: [IonicModule, CommonModule, RouterModule],
})
export class DetalleNoticiaPage implements OnInit {

  noticiaId!: number;
  noticia: DetalleNoticia | null = null;
  contenidoMixto: { type: 'parrafo' | 'foto'; value: string }[] = [];
  estaCargando = true;

  supabase!: SupabaseClient;

  constructor(
    private route: ActivatedRoute,
    private supabaseService: SupabaseService,
    public location: Location
  ) {

    this.supabase = this.supabaseService.client;

    addIcons({
      'calendar-outline': calendarOutline,
      'person-outline': personOutline,
      'chevron-back-outline': chevronBackOutline,
      'person-circle-outline': personCircleOutline
    });
  }

  ngOnInit() {
    const idParam = this.route.snapshot.paramMap.get('id');
    if (idParam) {
      this.noticiaId = parseInt(idParam, 10);
      this.cargarDetalleNoticia(this.noticiaId);
    }
  }

  goBack() {
    this.location.back();
  }

  async cargarDetalleNoticia(id: number) {
    this.estaCargando = true;

    try {
      const { data, error } = await this.supabase
        .from('noticias')
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        console.error('❌ Error cargando noticia:', error);
        this.noticia = null;
        return;
      }

      this.noticia = data as DetalleNoticia;
      this.mezclarContenido();

    } catch (e) {
      console.error('❌ Error inesperado:', e);
      this.noticia = null;
    } finally {
      this.estaCargando = false;
    }
  }

  private mezclarContenido() {
    this.contenidoMixto = [];
    if (!this.noticia) return;

    const parrafos = this.noticia.parrafos || [];
    const fotos = this.noticia.url_foto || [];

    const max = Math.max(parrafos.length, fotos.length);

    for (let i = 0; i < max; i++) {
      if (parrafos[i]) {
        this.contenidoMixto.push({ type: 'parrafo', value: parrafos[i] });
      }
      if (fotos[i + 1]) {
        this.contenidoMixto.push({ type: 'foto', value: fotos[i + 1] });
      }
    }
  }
    get tieneFotoPrincipal(): boolean {
    return !!this.noticia?.url_foto && this.noticia!.url_foto!.length > 0;
  }


  formatearFecha(fecha: string): string {
    if (!fecha) return '';
    return new Date(fecha).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }
}
