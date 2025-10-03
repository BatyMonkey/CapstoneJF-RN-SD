// src/app/solicitud/solicitud.page.ts
import { Component } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { IonicModule, AlertController } from '@ionic/angular';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { supabase } from '../core/supabase.client';
import { AuthService } from '../auth/auth.service';

@Component({
  standalone: true,
  selector: 'app-solicitud',
  templateUrl: './solicitud.page.html',
  styleUrls: ['./solicitud.page.scss'],
  imports: [IonicModule, CommonModule, ReactiveFormsModule],
})
export class SolicitudPage {
  solicitudForm: FormGroup;
  submitting = false;

  constructor(
    private fb: FormBuilder,
    private auth: AuthService,
    private alertCtrl: AlertController
  ) {
    this.solicitudForm = this.fb.group({
      // Por ahora solo usaremos "reserva"
      tipo: ['reserva', Validators.required],
      descripcion: [''],

      // Datos de espacio (requeridos para reserva)
      espacio_nombre: ['', Validators.required],
      espacio_tipo: ['', Validators.required],
      espacio_capacidad: [null, [Validators.required, Validators.min(1)]],

      // Datos de evento (requeridos para reserva)
      evento_titulo: ['', Validators.required],
      evento_descripcion: [''],
      evento_inicio: ['', Validators.required], // ISO string desde ion-datetime
      evento_fin: ['', Validators.required],    // ISO string desde ion-datetime
    });
  }

  // 🚀 Enviar solicitud (Reserva de espacio/terreno)
  async enviarSolicitud() {
    // Solo permitimos "reserva" en esta versión
    if (this.solicitudForm.get('tipo')?.value !== 'reserva') {
      await this.mostrarAlerta('Información', 'Por ahora solo está habilitada la opción "Reserva de espacio/terreno".');
      return;
    }

    if (this.solicitudForm.invalid) {
      await this.mostrarAlerta('Formulario incompleto', 'Debes llenar todos los campos obligatorios.');
      return;
    }

    const {
      espacio_nombre,
      espacio_tipo,
      espacio_capacidad,
      evento_titulo,
      evento_descripcion,
      evento_inicio,
      evento_fin,
    } = this.solicitudForm.value;

    // Validación simple de rango de fechas
    if (evento_inicio && evento_fin && new Date(evento_fin) < new Date(evento_inicio)) {
      await this.mostrarAlerta('Fechas inválidas', 'La fecha de término debe ser posterior a la de inicio.');
      return;
    }

    this.submitting = true;

    try {
      // 🆔 UID directo de auth (auth.users.id)
      const uid = await this.auth.miUID();
      if (!uid) {
        await this.mostrarAlerta('Sesión', 'Debes iniciar sesión para registrar una reserva.');
        return;
      }

      // 1) Crear ESPACIO
      const { data: esp, error: eEsp } = await supabase
        .from('espacio')
        .insert({
          nombre: espacio_nombre,
          tipo: espacio_tipo,
          capacidad: Number(espacio_capacidad),
        })
        .select('id_espacio')
        .single();

      if (eEsp) throw eEsp;

      // 2) Crear EVENTO
      const { data: eve, error: eEve } = await supabase
        .from('evento')
        .insert({
          titulo: evento_titulo,
          descripcion: evento_descripcion,
          fecha_inicio: evento_inicio, // ISO string ok para timestamptz
          fecha_fin: evento_fin,
        })
        .select('id_evento')
        .single();

      if (eEve) throw eEve;

      // 3) Crear RESERVA (usando auth.users.id)
      const { error: eRes } = await supabase
        .from('reserva')
        .insert({
          id_auth: uid,                // 👈 FK a auth.users.id
          id_espacio: esp.id_espacio,
          id_evento: eve.id_evento,
          fecha: new Date().toISOString(),
        });

      if (eRes) throw eRes;

      await this.mostrarAlerta('Éxito', 'Tu reserva fue registrada correctamente ✅');

      // Reiniciar solo para reserva
      this.solicitudForm.reset({
        tipo: 'reserva',
        descripcion: '',
        espacio_nombre: '',
        espacio_tipo: '',
        espacio_capacidad: null,
        evento_titulo: '',
        evento_descripcion: '',
        evento_inicio: '',
        evento_fin: '',
      });
    } catch (err: any) {
      console.error('❌ Error al crear la reserva:', err);
      const msg =
        err?.message ??
        (typeof err === 'string' ? err : 'Hubo un error al registrar tu reserva.');
      await this.mostrarAlerta('Error', msg);
    } finally {
      this.submitting = false;
    }
  }

  // Helper para mostrar alertas
  async mostrarAlerta(header: string, message: string) {
    const alert = await this.alertCtrl.create({
      header,
      message,
      buttons: ['OK'],
    });
    await alert.present();
  }
}
