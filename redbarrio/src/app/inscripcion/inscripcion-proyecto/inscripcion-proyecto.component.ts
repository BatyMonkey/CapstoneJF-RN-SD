// src/app/inscripcion/inscripcion-proyecto/inscripcion-proyecto.component.ts
import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import {
  IonicModule,
  AlertController,
  LoadingController,
} from '@ionic/angular';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { SupabaseService } from 'src/app/services/supabase.service';
import { AuthService, Perfil } from 'src/app/auth/auth.service';

// 👇 IMPORTS PARA ICONOS
import { addIcons } from 'ionicons';
import {
  chevronBackOutline,
  calendarOutline,
  clipboardOutline,
  imageOutline,
} from 'ionicons/icons';

@Component({
  standalone: true,
  selector: 'app-inscripcion-proyecto',
  templateUrl: './inscripcion-proyecto.component.html',
  styleUrls: ['./inscripcion-proyecto.component.scss'],
  imports: [CommonModule, IonicModule, ReactiveFormsModule],
})
export class InscripcionProyectoComponent implements OnInit {
  perfil: Perfil | null = null;
  idProyecto: string | null = null;
  idActividad: string | null = null;
  isActividad: boolean = false;

  proyecto: any = null;
  cuposRestantes: number = 0;
  sinCupos: boolean = false;
  yaInscrito: boolean = false;
  isSubmitting: boolean = false;
  inscripcionForm!: FormGroup;

  constructor(
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private router: Router,
    private auth: AuthService,
    private alertCtrl: AlertController,
    private loadingCtrl: LoadingController,
    private supabaseService: SupabaseService
  ) {
    // 👇 REGISTRO LOCAL DE LOS ÍCONOS QUE USAS EN ESTE COMPONENTE
    addIcons({
      chevronBackOutline,
      calendarOutline,
      clipboardOutline,
      imageOutline,
    });
  }

  async ngOnInit() {
    await this.validarSesion();

    this.inscripcionForm = this.fb.group({
      descripcion: ['', [Validators.maxLength(250)]],
    });

    this.route.params.subscribe(async (params) => {
      const id = params['id'];
      if (!id) {
        console.warn('⚠️ Sin parámetro ID en la ruta');
        return;
      }

      this.idProyecto = id;
      this.idActividad = id;

      await this.cargarDatos();
    });
  }

  async validarSesion() {
    try {
      const ses = await this.auth.waitForActiveSession();
      const userId = ses?.user?.id;
      if (!userId) {
        console.warn('⚠️ No se encontró usuario autenticado.');
        return;
      }

      let perfil = await this.auth.miPerfil();
      if (!perfil) {
        const localPerfil = localStorage.getItem('rb_usuario_activo');
        if (localPerfil) perfil = JSON.parse(localPerfil);
      }

      if (perfil) this.perfil = perfil;
      console.log('✅ Sesión activa con UID:', userId);
    } catch (error) {
      console.error('Error validando sesión:', error);
    }
  }

  async cargarDatos() {
    const loading = await this.loadingCtrl.create({
      message: 'Cargando información...',
      spinner: 'crescent',
    });
    await loading.present();

    try {
      const { data: actividad } = await this.supabaseService.client
        .from('actividad')
        .select('*')
        .eq('id_actividad', this.idActividad)
        .maybeSingle();

      if (actividad) {
        this.proyecto = actividad;
        this.isActividad = true;
        await this.verificarEstadoActividad();
        console.log('✅ Actividad cargada:', actividad);
      } else {
        const { data: proyecto } = await this.supabaseService.client
          .from('proyecto')
          .select('*')
          .eq('id_proyecto', this.idProyecto)
          .maybeSingle();

        this.proyecto = proyecto;
        this.isActividad = false;
        console.log('✅ Proyecto cargado:', proyecto);
      }
    } catch (err) {
      console.error('Error al cargar datos:', err);
      await this.mostrarAlerta('Error', 'No se pudo cargar la información.');
    } finally {
      loading.dismiss();
    }
  }

  async verificarEstadoActividad() {
    if (!this.idActividad || !this.perfil) return;

    const { count } = await this.supabaseService.client
      .from('actividad_inscripcion')
      .select('*', { count: 'exact', head: true })
      .eq('id_actividad', this.idActividad);

    const { data: inscripcionExistente } = await this.supabaseService.client
      .from('actividad_inscripcion')
      .select('id_actividad')
      .eq('id_actividad', this.idActividad)
      .eq('id_auth', this.perfil.id_auth)
      .maybeSingle();

    this.yaInscrito = !!inscripcionExistente;
    this.cuposRestantes = (this.proyecto?.cupos_total || 0) - (count || 0);
    this.sinCupos = this.cuposRestantes <= 0;
  }

  async enviarPostulacion() {
    this.isSubmitting = true;

    const loading = await this.loadingCtrl.create({
      message: 'Enviando...',
      spinner: 'crescent',
    });
    await loading.present();

    try {
      // 🔸 Asegurar sesión activa
      const ses = await this.auth.waitForActiveSession();
      const userId = ses?.user?.id;
      if (!userId) throw new Error('No hay usuario autenticado.');

      // 🔸 Comentario/descripcion
      const comentario = this.inscripcionForm.value.descripcion?.trim() || null;
      const now = new Date().toISOString();

      if (this.isActividad && this.idActividad) {
        const { error } = await this.supabaseService.client
          .from('actividad_inscripcion')
          .insert([
            {
              id_actividad: this.idActividad,
              id_auth: userId,
              estado: 'pendiente',
              comentario: comentario ?? null,
              fecha: now,
            },
          ]);
        if (error) throw error;

        // 🧾 Registrar auditoría para inscripción en actividad
        await this.supabaseService.registrarAuditoria(
          'enviar inscripción a actividad',
          'actividad_inscripcion',
          {
            id_actividad: this.idActividad,
            comentario: comentario,
            estado: 'pendiente',
            fecha: now,
          }
        );
      } else if (this.idProyecto) {
        const { error } = await this.supabaseService.client
          .from('proyecto_postulacion')
          .insert([
            {
              id_proyecto: this.idProyecto,
              id_auth: userId,
              descripcion: comentario ?? null,
              estado: 'pendiente',
              fecha: now,
              actualizado_en: now,
            },
          ]);
        if (error) throw error;

        // 🧾 Registrar auditoría para postulación en proyecto
        await this.supabaseService.registrarAuditoria(
          'enviar postulación a proyecto',
          'proyecto_postulacion',
          {
            id_proyecto: this.idProyecto,
            descripcion: comentario,
            estado: 'pendiente',
            fecha: now,
          }
        );
      }

      await this.mostrarAlerta(
        'Éxito',
        'Tu inscripción se ha enviado correctamente.'
      );
      this.router.navigate(['/inscripcion/proyectos']);
    } catch (err: any) {
      console.error('Error al enviar inscripción (raw):', err);
      const detail =
        err?.message ||
        err?.error_description ||
        err?.hint ||
        (typeof err === 'object' ? JSON.stringify(err) : String(err));

      await this.mostrarAlerta(
        'Error',
        `No se pudo enviar la inscripción.\n\n${detail}`
      );
    } finally {
      this.isSubmitting = false;
      loading.dismiss();
    }
  }

  // ✅ Alerta genérica
  async mostrarAlerta(header: string, message: string) {
    const alert = await this.alertCtrl.create({
      header,
      message,
      buttons: ['Aceptar'],
    });
    await alert.present();
  }

  // ✅ Botón volver del header tipo RedBarrio
  goBack() {
    this.router.navigate(['/home']);
  }
}
