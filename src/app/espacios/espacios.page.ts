// src/app/pages/espacios/espacios.page.ts

import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { Router, RouterModule } from '@angular/router'; // Importado: RouterModule

// Importar el Servicio y la Interfaz Espacio
import { EspaciosService, Espacio } from 'src/app/services/espacios.service';
import { AuthService } from 'src/app/auth/auth.service'; 

@Component({
  selector: 'app-espacios',
  templateUrl: './espacios.page.html',
  styleUrls: ['./espacios.page.scss'],
  standalone: true,
  // AGREGADO: Se incluye RouterModule aquí para que [routerLink] funcione
  imports: [IonicModule, CommonModule, FormsModule, RouterModule] 
})
export class EspaciosPage implements OnInit {

  // Variables de estado
  espacios: Espacio[] = [];
  isLoading = false;
  error: string | null = null;
  isAdmin = false; 

  // Mapeo de IDs numéricos a nombres de tipo
  private tiposEspacioMap = new Map<number, string>([
    [1, 'Cancha'],
    [2, 'Sede'],
    [3, 'Parque'],
  ]);

  constructor(
    private espaciosService: EspaciosService,
    private router: Router,
    private authService: AuthService 
  ) { }

  ngOnInit() {
    this.checkUserRole();
    this.cargarEspacios();
  }

  async checkUserRole() {
    try {
        this.isAdmin = await this.authService.checkIfAdmin(); 
    } catch (e) {
        console.error("No se pudo determinar el rol del usuario:", e);
        this.isAdmin = false;
    }
  }
  
  async cargarEspacios(event?: any) {
    if (!event) {
      this.isLoading = true;
      this.error = null;
    }

    try {
      this.espacios = await this.espaciosService.obtenerEspacios();
    } catch (e: any) {
      this.error = e.message || 'Error desconocido al cargar los espacios.';
      this.espacios = [];
    } finally {
      this.isLoading = false;
      if (event) {
        event.target.complete();
      }
    }
  }
  
  /**
   * Convierte el ID numérico del tipo a su nombre en texto.
   */
  getTipoNombre(tipoId: number | string | undefined | null): string {
    if (tipoId === undefined || tipoId === null) {
        return 'N/A';
    }
    const idNumerico = parseInt(tipoId.toString(), 10);
    
    if (isNaN(idNumerico)) {
        return 'N/A';
    }
    return this.tiposEspacioMap.get(idNumerico) || 'Desconocido';
  }


  /**
   * Navega a la página de detalle usando el ID del espacio.
   */
  goToDetail(id: number) {
    this.router.navigateByUrl(`/espacios/${id}`);
  }

  /**
   * Navega a la página de creación de espacio.
   */
  irACrearEspacio() {
    this.router.navigateByUrl('espacios/crear');
  }
}