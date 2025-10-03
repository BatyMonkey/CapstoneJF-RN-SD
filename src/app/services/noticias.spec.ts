import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Component({
  selector: 'app-noticias',
  templateUrl: './noticias.page.html',
  styleUrls: ['./noticias.page.scss'],
})
export class NoticiasPage implements OnInit {

  supabase: SupabaseClient;

  noticias: any[] = [];
  estaCargandoNoticias = false;
  rolUsuario: 'vecino' | 'admin' | null = null;

  constructor(private router: Router) {
    // ⚡️ Configura tu cliente de Supabase
    this.supabase = createClient(
      'https://TU_PROYECTO.supabase.co',
      'TU_PUBLIC_ANON_KEY'
    );
  }

  async ngOnInit() {
    await this.obtenerRolUsuario();
    await this.cargarNoticias();
  }

  // Obtiene el rol del usuario logueado
  async obtenerRolUsuario() {
    try {
      const { data: { user }, error } = await this.supabase.auth.getUser();

      if (error || !user) {
        console.error('Usuario no autenticado o error:', error);
        this.rolUsuario = 'vecino'; // por defecto
        return;
      }

      const { data: perfil, error: perfilError } = await this.supabase
        .from('perfiles')
        .select('rol')
        .eq('id', user.id)
        .single();

      if (perfilError) {
        console.error('Error al obtener rol:', perfilError);
        this.rolUsuario = 'vecino'; // fallback
      } else {
        this.rolUsuario = perfil?.rol === 'admin' ? 'admin' : 'vecino';
      }
    } catch (err) {
      console.error('Error inesperado obteniendo rol:', err);
      this.rolUsuario = 'vecino';
    }
  }

  // Cargar noticias desde la base
  async cargarNoticias() {
    this.estaCargandoNoticias = true;
    try {
      const { data, error } = await this.supabase
        .from('noticias')
        .select('*')
        .order('fecha_creacion', { ascending: false });

      if (error) {
        console.error('Error cargando noticias:', error);
        this.noticias = [];
      } else {
        this.noticias = data || [];
      }
    } catch (err) {
      console.error('Error inesperado al cargar noticias:', err);
      this.noticias = [];
    }
    this.estaCargandoNoticias = false;
  }

  // Redirigir a página de detalle
  abrirDetalleNoticia(noticiaId: string) {
    this.router.navigate(['/noticias', noticiaId]);
  }

  // Redirigir a página de crear (solo admins)
  irACrearNoticia() {
    if (this.rolUsuario === 'admin') {
      this.router.navigate(['/noticias/crear']);
    }
  }
}
