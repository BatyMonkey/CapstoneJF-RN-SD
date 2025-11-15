import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';

import {
  IonHeader,
  IonContent,
  IonIcon,
  IonButtons,
  IonButton,
  IonChip,
  IonLabel,
  IonSpinner,
} from '@ionic/angular/standalone';

import { CommonModule, DatePipe } from '@angular/common';
import { SupabaseService } from 'src/app/services/supabase.service';
import { AuthService } from 'src/app/auth/auth.service';

@Component({
  standalone: true,
  selector: 'app-solicitudes',
  templateUrl: './solicitudes.page.html',
  styleUrls: ['./solicitudes.page.scss'],
  imports: [
    CommonModule,
    DatePipe,

    IonHeader,
    IonContent,
    IonIcon,
    IonButtons,
    IonButton,
    IonChip,
    IonLabel,
    IonSpinner,
  ],
})
export class SolicitudesPage implements OnInit {
  
  subtitulo = "Registros de Vecinos";
  activeTab: 'pendientes' | 'activos' = 'pendientes';

  solicitudesPendientes: any[] = [];
  solicitudesAprobadas: any[] = [];

  constructor(
    private router: Router,
    private supabaseService: SupabaseService,
    private authService: AuthService
  ) {}

  ngOnInit() {
    this.cargar();
  }

  goBack() {
    this.router.navigate(['/admin']);
  }

  async cargar() {
    const selectCampos = `
      id_usuario,
      nombre,
      correo,
      rut,
      direccion,
      telefono,
      status,
      url_foto_perfil,
      creado_en
    `;

    

    const { data: pendientes } = await this.supabaseService
      .from('usuario')
      .select(selectCampos)
      .eq('status', 'pendiente');

    const { data: activos } = await this.supabaseService
      .from('usuario')
      .select(selectCampos)
      .eq('status', 'activo');

    this.solicitudesPendientes = pendientes ?? [];
    this.solicitudesAprobadas = activos ?? [];
    
    console.log("🔍 Pendientes:", pendientes);
    console.log("🔍 Activos:", activos);
  }


  async aprobar(s: any) {
    await this.authService.cambiarEstadoUsuario(s.id_usuario, 'activo');
    this.cargar();
  }

  async rechazar(s: any) {
    await this.authService.cambiarEstadoUsuario(s.id_usuario, 'rechazado');
    this.cargar();
  }

  async desactivar(s: any) {
    await this.authService.cambiarEstadoUsuario(s.id_usuario, 'pendiente');
    this.cargar();
  }

  // ============================================================
  // 🔹 GENERAR URL PÚBLICA DE SUPABASE STORAGE
  // ============================================================
  getFotoPerfil(path: string | null): string {
    // Fallback universal
    const defaultAvatar = "assets/default_avatar.png";

    // Si no hay path válido → foto default
    if (!path || path === "null" || path === "undefined" || path.trim() === "") {
      return defaultAvatar;
    }

    // Si ya es URL pública → úsala directo
    if (path.startsWith("http")) {
      return path;
    }

    // Si es un path interno del bucket → generar URL pública
    const { data } = this.supabaseService.client.storage
      .from("perfiles-bucket")
      .getPublicUrl(path);

    return data?.publicUrl || defaultAvatar;
  }

  onAvatarError(event: any) {
    const fallback = "assets/default_avatar.png";

    if (event.target.src.includes(fallback)) {
      return; // evitar loops infinitos
    }

    event.target.src = fallback;
  }



}
