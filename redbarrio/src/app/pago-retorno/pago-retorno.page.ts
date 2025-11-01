import { Component, OnInit, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule, AlertController } from '@ionic/angular';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { SupabaseService } from 'src/app/services/supabase.service'; // 👈 importa tu servicio

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
    private alertCtrl: AlertController,
    private supabaseService: SupabaseService // 👈 usa el servicio global
  ) {}

  async ngOnInit() {
    // ✅ Usa la instancia global del servicio
    const { data, error } = await this.supabaseService
      .from('pagos')
      .select('*');

    if (error) {
      console.error('Error al obtener pagos:', error);
    } else {
      console.log('Pagos obtenidos:', data);
    }
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
      const { data, error } = await this.supabaseService.client.functions.invoke(
        'transbank-confirm',
        {
          body: { token_ws },
        }
      );

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
