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
import { ReservasService } from 'src/app/services/reservas.service'; // 🆕 IMPORT

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
    private supabaseService: SupabaseService,
    private reservasService: ReservasService, // 🆕 INYECTADO
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
      const espacioId = Number(formData.id_espacio);

      // 🆕 Reutilizar servicio compartido
      const resultado = await this.reservasService.crearReservaConPago({
        idAuth: idUsuario,
        idEspacio: espacioId,
        eventoTitulo: formData.evento_titulo,
        eventoDescripcion: formData.evento_descripcion,
        eventoInicio: formData.evento_inicio,
        eventoFin: formData.evento_fin,
      });

      const { url, token } = resultado.transbank;

      // ✅ Abrir simulador de pago en el navegador interno (mismo comportamiento que antes)
      await Browser.open({
        url: `${url}?token_ws=${token}`,
        presentationStyle: 'fullscreen',
      });

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
