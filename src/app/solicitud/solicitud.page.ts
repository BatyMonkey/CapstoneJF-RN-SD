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
      descripcion: [''],
      espacio_nombre: ['', Validators.required],
      espacio_tipo: ['', Validators.required],
      espacio_capacidad: [null, [Validators.required, Validators.min(1)]],
      evento_titulo: ['', Validators.required],
      evento_descripcion: [''],
      evento_inicio: ['', Validators.required],
      evento_fin: ['', Validators.required],
    });
  }

  async enviarSolicitud() {
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

    if (new Date(evento_fin) < new Date(evento_inicio)) {
      await this.mostrarAlerta('Fechas inválidas', 'La fecha de término debe ser posterior a la de inicio.');
      return;
    }

    this.submitting = true;

    try {
      const uid = await this.auth.miUID();
      if (!uid) {
        await this.mostrarAlerta('Sesión', 'Debes iniciar sesión para registrar una reserva.');
        return;
      }

      // 🧱 Crear espacio
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

      // 🧱 Crear evento
      const { data: eve, error: eEve } = await supabase
        .from('evento')
        .insert({
          titulo: evento_titulo,
          descripcion: evento_descripcion,
          fecha_inicio: evento_inicio,
          fecha_fin: evento_fin,
        })
        .select('id_evento')
        .single();
      if (eEve) throw eEve;

      // 🧱 Crear orden de pago
      const monto = 1500;
      const { data: orden, error: eOrden } = await supabase
        .from('orden_pago')
        .insert({
          id_auth: uid,
          id_evento: eve.id_evento,
          id_espacio: esp.id_espacio,
          monto,
          estado: 'pendiente',
        })
        .select('id_orden')
        .single();
      if (eOrden) throw eOrden;

      // 🚀 Llamar función Supabase (Transbank Sandbox)
      const payload = {
        buyOrder: `ORD-${orden.id_orden}`,
        sessionId: uid.substring(0, 61),
        amount: monto,
      };

      console.log('🚀 Enviando payload a Transbank:', payload);

      const resp = await fetch(
        'https://sovnabbbubapqxziubuh.functions.supabase.co/transbank-simular',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }
      );

      const result = await resp.json();
      console.log('✅ Resultado Transbank:', result);

      if (!result?.token) {
        console.error('❌ Respuesta inválida:', result);
        throw new Error('Transbank no devolvió token válido.');
      }

      // 💾 Guardar token en orden
      await supabase
        .from('orden_pago')
        .update({
          token_ws: result.token,
          tbk_order_id: payload.buyOrder,
        })
        .eq('id_orden', orden.id_orden);

      // 🌐 Redirigir a interfaz de pago sandbox
      window.location.href = `${result.url}?token_ws=${result.token}`;
    } catch (err: any) {
      console.error('❌ Error al generar la solicitud con pago:', err);
      const msg = err?.message ?? 'Hubo un error al generar el pago.';
      await this.mostrarAlerta('Error', msg);
    } finally {
      this.submitting = false;
    }
  }

  async mostrarAlerta(header: string, message: string) {
    const alert = await this.alertCtrl.create({
      header,
      message,
      buttons: ['OK'],
    });
    await alert.present();
  }
}
