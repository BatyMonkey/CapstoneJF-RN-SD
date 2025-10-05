import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule, AlertController } from '@ionic/angular';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { supabase } from '../../core/supabase.client';
import { AuthService } from '../../auth/auth.service';

@Component({
  selector: 'app-inscripcion-proyecto',
  standalone: true,
  templateUrl: './inscripcion-proyecto.component.html',
  styleUrls: ['./inscripcion-proyecto.component.scss'],
  imports: [CommonModule, IonicModule, ReactiveFormsModule],
})
export class InscripcionProyectoComponent implements OnInit {
  proyectos: any[] = [];
  inscripcionForm!: FormGroup;
  perfil: any;

  constructor(
    private fb: FormBuilder,
    private alertCtrl: AlertController,
    private auth: AuthService
  ) {}

  ngOnInit() {
    this.inscripcionForm = this.fb.group({
      id_proyecto: ['', Validators.required],
      descripcion: ['', [Validators.required, Validators.minLength(10)]],
    });
  }

  // 👇 este hook se ejecuta automáticamente al entrar en la vista
  async ionViewWillEnter() {
    this.perfil = await this.auth.miPerfil();
    console.log('Perfil actual:', this.perfil);

    await this.cargarProyectos();
  }

  async cargarProyectos() {
    const { data, error } = await supabase
      .from('proyecto')
      .select('id_proyecto, titulo, descripcion, estado');

    if (error) {
      console.error('Error al cargar proyectos:', error);
      return;
    }

    console.log('Proyectos obtenidos desde Supabase:', data);
    this.proyectos = data || [];
  }

  async enviarPostulacion() {
    if (this.inscripcionForm.invalid) {
      await this.showAlert('Error', 'Debes seleccionar un proyecto y escribir una descripción.');
      return;
    }

    try {
      const { error } = await supabase
        .from('proyecto_postulacion')
        .insert([
          {
            id_proyecto: this.inscripcionForm.value.id_proyecto,
            id_auth: this.perfil.id_auth,
            descripcion: this.inscripcionForm.value.descripcion,
            estado: 'pendiente',
          },
        ]);

      if (error) throw error;

      await this.showAlert('Éxito', 'Tu postulación ha sido enviada correctamente ✅');
      this.inscripcionForm.reset();
    } catch (err: any) {
      await this.showAlert('Error', err.message || 'No se pudo enviar la postulación');
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
