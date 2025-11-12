import { Component, OnInit, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule, AlertController } from '@ionic/angular';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://sovnabbbubapqxziubuh.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNvdm5hYmJidWJhcHF4eml1YnVoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg3NTY0NzcsImV4cCI6MjA3NDMzMjQ3N30.eQoxa8NkXwHwpSM03bB2gEJj9EZ0FxK3-nY3SJe5iiE';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

@Component({
  selector: 'app-pago-retorno',
  standalone: true,
  imports: [CommonModule, IonicModule, RouterModule],
  templateUrl: './pago-retorno.page.html',
  styleUrls: ['./pago-retorno.page.scss'],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class PagoRetornoPage implements OnInit {
  mensaje: string = 'Procesando pago...';
  detalles: any = null;
  loading = true;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private alertCtrl: AlertController
  ) {}

  async ngOnInit() {
    await this.confirmarPago();
  }

  /** 🔄 Confirmar pago al volver de Transbank */
  async confirmarPago() {
    const token_ws = this.route.snapshot.queryParamMap.get('token_ws');
    if (!token_ws) {
      this.mensaje = '⚠️ No se encontró el token del pago.';
      this.loading = false;
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke('transbank-confirm', {
        body: { token_ws },
      });

      this.loading = false;

      if (error) {
        console.error('Error Supabase:', error);
        this.mensaje = '❌ Error al confirmar el pago.';
        return;
      }

      if (data?.status === 'AUTHORIZED') {
        this.mensaje = '✅ Pago realizado con éxito.';
        this.detalles = {
          estado: 'Pagado',
          codigoAutorizacion: data.authorization_code,
          tipoPago: data.payment_type_code,
          monto: data.amount,
        };
      } else {
        this.mensaje = '❌ El pago fue rechazado o no autorizado.';
        this.detalles = {
          estado: 'Rechazado',
          codigoAutorizacion: data?.authorization_code ?? 'N/A',
          tipoPago: data?.payment_type_code ?? 'N/A',
          monto: data?.amount ?? 0,
        };
      }

      const alert = await this.alertCtrl.create({
        header: 'Resultado del Pago',
        message: this.mensaje,
        buttons: [
          {
            text: 'Volver al inicio',
            handler: () => this.router.navigate(['/home']),
          },
        ],
      });

      await alert.present();
    } catch (err) {
      console.error('Error general:', err);
      this.loading = false;
      this.mensaje = '⚠️ Error inesperado al confirmar el pago.';
    }
  }
}
