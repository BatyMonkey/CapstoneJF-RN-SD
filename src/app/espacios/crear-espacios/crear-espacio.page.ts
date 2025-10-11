// src/app/pages/espacios/crear-espacios/crear-espacio.page.ts

import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { 
  FormGroup, 
  FormControl, 
  Validators, 
  ReactiveFormsModule 
} from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { Router } from '@angular/router';

// Asumimos que tienes el servicio de Espacios y la interfaz Espacio
import { EspaciosService, Espacio } from 'src/app/services/espacios.service';

@Component({
  selector: 'app-crear-espacio',
  templateUrl: './crear-espacio.page.html',
  styleUrls: ['./crear-espacio.page.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule, ReactiveFormsModule] 
})
export class CrearEspacioPage implements OnInit {

  // El FormGroup que controla todo el formulario
  espacioForm!: FormGroup;

  // Variables de estado
  isSaving = false; 
  error: string | null = null; 
  
  // Datos para el ion-select (Tipo de Espacio)
  tiposEspacio = [
    { id: 1, nombre: 'Cancha' },
    { id: 2, nombre: 'Sede' },
    { id: 3, nombre: 'Parque' },
  ];

  constructor(
    private espaciosService: EspaciosService,
    private router: Router
  ) { }

  ngOnInit() {
    this.initForm();
  }

  /**
   * Inicializa el FormGroup con todos los controles y validadores.
   */
  initForm() {
    this.espacioForm = new FormGroup({
      nombre: new FormControl('', [Validators.required, Validators.maxLength(100)]),
      // 💡 Inicializamos con el primer tipo (ID: 1) para evitar que inicie en null
      tipo: new FormControl(1, [Validators.required]), 
      capacidad: new FormControl(null),
      descripcion: new FormControl(''),
      direccion_completa: new FormControl('', [Validators.required]),
      latitud: new FormControl(null),
      longitud: new FormControl(null),
    });
  }

  // --- Getters para acceder fácilmente a los controles en el HTML/TS ---

  get latitud(): FormControl {
    return this.espacioForm.get('latitud') as FormControl;
  }

  get longitud(): FormControl {
    return this.espacioForm.get('longitud') as FormControl;
  }


  // --- Funcionalidad ---

  /**
   * Maneja el envío del formulario, llamando al servicio para guardar.
   */
  async guardarEspacio() {
    if (this.espacioForm.invalid) {
      this.espacioForm.markAllAsTouched();
      return;
    }

    this.isSaving = true;
    this.error = null;
    
    // Convertimos el valor del formulario a un tipo Espacio (aunque es parcial)
    const nuevoEspacio: Partial<Espacio> = this.espacioForm.value;

    try {
      // 🚨 CORRECCIÓN: Llamamos al método correcto del servicio: crearNuevoEspacio
      await this.espaciosService.crearNuevoEspacio(nuevoEspacio);
      
      // Redirigir al listado de espacios
      this.router.navigate(['/espacios']); 

    } catch (e: any) {
      this.error = e.message || 'Error al intentar guardar el espacio.';
    } finally {
      this.isSaving = false;
    }
  }
}