// src/app/pages/espacios/espacios.page.ts

import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule, ToastController } from '@ionic/angular';
import { EspaciosService, Espacio } from 'src/app/services/espacios.service'; 
import { AuthService } from 'src/app/auth/auth.service'; // 🚨 IMPORTA TU SERVICIO DE AUTENTICACIÓN
import { Router } from '@angular/router'; // Necesario para la navegación

@Component({
  selector: 'app-espacios',
  templateUrl: './espacios.page.html',
  styleUrls: ['./espacios.page.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule],
})
export class EspaciosPage implements OnInit {
  espacios: Espacio[] = [];
  isLoading = true;
  error: string | null = null;
  
  // 🚨 NUEVA PROPIEDAD: Indica si el usuario es administrador
  isAdmin = false; 

  constructor(
    private espaciosService: EspaciosService,
    private toastCtrl: ToastController,
    private authService: AuthService, // 🚨 INYECTA AuthService
    private router: Router
  ) { }

  async ngOnInit() {
    await this.verificarRol(); // 🚨 Verifica el rol primero
    this.cargarEspacios();
  }
  
  // 🚨 NUEVA FUNCIÓN: Obtiene el perfil y establece isAdmin
  async verificarRol() {
    const perfil = await this.authService.miPerfil();
    this.isAdmin = perfil?.rol === 'administrador';
  }

  // NUEVA FUNCIÓN: Redirige al formulario de creación
  irACrearEspacio() {
    this.router.navigateByUrl('/espacios/crear'); // 🚨 Ajusta esta ruta a tu módulo de creación
  }
  
  // ... [El resto de las funciones cargarEspacios y mostrarToast son las mismas]
  async cargarEspacios(event?: any) {
    this.isLoading = true;
    this.error = null;
    // ... [cuerpo de la función cargarEspacios]
    try {
      this.espacios = await this.espaciosService.obtenerEspacios();
    } catch (e: any) {
      const errorMessage = e.message || 'Error desconocido al cargar los espacios.';
      this.error = errorMessage; 
      this.mostrarToast(errorMessage, 'danger');
      this.espacios = [];
    } finally {
      this.isLoading = false;
      if (event) {
        event.target.complete();
      }
    }
  }

  private async mostrarToast(message: string, color: string) {
    const toast = await this.toastCtrl.create({
      message,
      duration: 3000,
      color,
    });
    toast.present();
  }
  
}