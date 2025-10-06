import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule, AlertController } from '@ionic/angular';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { supabase } from '../../../core/supabase.client';
import { AuthService } from '../../../auth/auth.service';

@Component({
  selector: 'app-generar-proyecto',
  standalone: true,
  templateUrl: './generar-proyecto.component.html',
  styleUrls: ['./generar-proyecto.component.scss'],
  imports: [CommonModule, IonicModule, ReactiveFormsModule],
})
export class GenerarProyectoComponent implements OnInit {
  proyectoForm!: FormGroup;
  perfil: any;

  constructor(
    private fb: FormBuilder,
    private alertCtrl: AlertController,
    private auth: AuthService
  ) {}

  async ngOnInit() {
    // Inicializa el formulario sin campo editable de estado
    this.proyectoForm = this.fb.group({
      titulo: ['', [Validators.required, Validators.minLength(5)]],
      descripcion: ['', [Validators.required, Validators.minLength(10)]],
    });

    // Traer perfil del usuario autenticado
    this.perfil = await this.auth.miPerfil();
  }

  async generarProyecto() {
    if (this.proyectoForm.invalid) {
      await this.showAlert('Error', 'Debes completar todos los campos.');
      return;
    }

    try {
      const { error } = await supabase
        .from('proyecto')
        .insert([
          {
            id_auth: this.perfil?.id_auth, // Usuario autenticado (administrador)
            titulo: this.proyectoForm.value.titulo,
            descripcion: this.proyectoForm.value.descripcion,
            estado: 'pendiente', // 👈 Fijamos el valor directamente
          }
        ]);

      if (error) throw error;

      await this.showAlert('Éxito', 'Proyecto creado correctamente ✅');
      this.proyectoForm.reset();
    } catch (err: any) {
      await this.showAlert('Error', err.message || 'No se pudo crear el proyecto');
    }
  }

  private async showAlert(header: string, message: string) {
    const alert = await this.alertCtrl.create({
      header,
      message,
      buttons: ['OK'],
    });
    await alert.present();
  }
}
