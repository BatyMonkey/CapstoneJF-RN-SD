import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import {
  IonicModule,
  AlertController,
  ToastController,
  LoadingController,
} from '@ionic/angular';
import { EspaciosService } from '../services/espacios.service';
import { AuthService } from '../auth/auth.service';
import { Router } from '@angular/router';
import { environment } from 'src/environments/environment';
import { Browser } from '@capacitor/browser';
import { SupabaseService } from 'src/app/services/supabase.service';

@Component({
  selector: 'app-solicitud',
  templateUrl: './solicitud.page.html',
  styleUrls: ['./solicitud.page.scss'],
  standalone: true,
  imports: [CommonModule, IonicModule, ReactiveFormsModule],
})
export class SolicitudPage implements OnInit {
  solicitudForm: FormGroup;
  espaciosDisponibles: any[] = [];

  constructor(
    private fb: FormBuilder,
    private espaciosService: EspaciosService,
    private authService: AuthService,
    private alertCtrl: AlertController,
    private toastCtrl: ToastController,
    private loadingCtrl: LoadingController,
    private router: Router,
    private supabaseService: SupabaseService
  ) {
    this.solicitudForm = this.fb.group({
      id_espacio: ['', Validators.required],
      descripcion: [''],
      evento_titulo: ['', Validators.required],
      evento_descripcion: ['', Validators.required],
      evento_inicio: ['', Validators.required],
      evento_fin: ['', Validators.required],
    });
  }

  async ngOnInit() {
    await this.cargarEspaciosDisponibles();
  }

  /** Cargar espacios creados por el administrador */
  async cargarEspaciosDisponibles() {
    try {
      const data = await this.espaciosService.obtenerEspacios();
      this.espaciosDisponibles = data || [];
    } catch (err) {
      console.error('Error cargando espacios:', err);
      this.espaciosDisponibles = [];
    }
  }

  /** Enviar solicitud y procesar pago */
  async enviarSolicitud() {
    if (this.solicitudForm.invalid) return;

    const formData = this.solicitudForm.value;
    const session = await this.authService.session();
    const idUsuario = session?.user?.id || null;

    if (!idUsuario) {
      this.mostrarAlerta('Error', 'No se pudo obtener el usuario autenticado.');
      return;
    }

    const loading = await this.loadingCtrl.create({
      message: 'Procesando solicitud...',
      spinner: 'crescent',
    });
    await loading.present();

    try {
      // 1️⃣ Crear evento
      const { data: eventoData, error: eventoError } =
        await this.supabaseService.client
          .from('evento')
          .insert([
            {
              titulo: formData.evento_titulo,
              descripcion: formData.evento_descripcion,
              fecha_inicio: formData.evento_inicio,
              fecha_fin: formData.evento_fin,
            },
          ])
          .select()
          .single();

      if (eventoError) throw eventoError;

      // 2️⃣ Crear reserva
      const espacioId = Number(formData.id_espacio);
      const { data: reservaData, error: reservaError } =
        await this.supabaseService.client
          .from('reserva')
          .insert([
            {
              id_espacio: espacioId,
              id_evento: eventoData.id_evento,
              id_auth: idUsuario,
              fecha: new Date().toISOString(),
              creado_en: new Date().toISOString(),
            },
          ])
          .select()
          .single();

      if (reservaError) throw reservaError;

      // 3️⃣ Generar orden de pago local
      const { data: ordenData, error: ordenError } =
        await this.supabaseService.client
          .from('orden_pago')
          .insert([
            {
              id_auth: idUsuario,
              id_evento: eventoData.id_evento,
              id_espacio: espacioId,
              monto: 1500,
              estado: 'pendiente',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
          ])
          .select()
          .single();

      if (ordenError) throw ordenError;

      // 🧾 Registrar acción en auditoría
      await this.supabaseService.registrarAuditoria(
        'enviar solicitud de reserva',
        'reserva',
        {
          evento: {
            id_evento: eventoData.id_evento,
            titulo: eventoData.titulo,
            fecha_inicio: eventoData.fecha_inicio,
            fecha_fin: eventoData.fecha_fin,
          },
          reserva: {
            id_reserva: reservaData.id_reserva,
            id_espacio: espacioId,
            fecha: reservaData.fecha,
          },
          orden_pago: {
            id_orden: ordenData.id_orden,
            monto: ordenData.monto,
            estado: ordenData.estado,
          },
          fecha_solicitud: new Date().toISOString(),
        }
      );

      // 4️⃣ Simular pago Transbank
      const response = await fetch(
        `${environment.supabaseUrl}/functions/v1/transbank-simular`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id_reserva: reservaData.id_reserva,
            monto: 1500,
            descripcion: `Pago arriendo espacio #${espacioId}`,
          }),
        }
      );

      if (!response.ok) throw new Error('Error al iniciar simulación de pago');

      const simData = await response.json();

      if (simData.url && simData.token) {
        // ✅ Abrir simulador de pago en el navegador interno
        await Browser.open({
          url: `${simData.url}?token_ws=${simData.token}`,
          presentationStyle: 'fullscreen',
        });
      } else {
        throw new Error('No se recibió token o URL de Transbank.');
      }

      await loading.dismiss();
    } catch (error) {
      console.error('Error al enviar solicitud:', error);
      await loading.dismiss();
      this.mostrarAlerta(
        'Error',
        'No se pudo completar la reserva ni el pago.'
      );
    }
  }

  private async mostrarAlerta(header: string, message: string) {
    const alert = await this.alertCtrl.create({
      header,
      message,
      buttons: ['OK'],
    });
    await alert.present();
  }

  private async mostrarToast(message: string) {
    const toast = await this.toastCtrl.create({
      message,
      duration: 2500,
      color: 'success',
    });
    toast.present();
  }
}
