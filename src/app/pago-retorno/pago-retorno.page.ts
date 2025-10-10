import { Component, OnInit, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { ActivatedRoute } from '@angular/router';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://sovnabbbubapqxziubuh.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNvdm5hYmJidWJhcHF4eml1YnVoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg3NTY0NzcsImV4cCI6MjA3NDMzMjQ3N30.eQoxa8NkXwHwpSM03bB2gEJj9EZ0FxK3-nY3SJe5iiE';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

@Component({
  selector: 'app-pago-retorno',
  standalone: true,
  imports: [CommonModule, IonicModule],
  templateUrl: './pago-retorno.page.html',
  styleUrls: ['./pago-retorno.page.scss'],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class PagoRetornoPage implements OnInit {
  mensaje: string = 'Procesando pago...';
  loading = true;

  constructor(private route: ActivatedRoute) {}

  async ngOnInit() {
    await this.confirmarPago();
  }

  async confirmarPago() {
    const token = this.route.snapshot.queryParamMap.get('token_ws');
    if (!token) {
      this.mensaje = 'Token no encontrado.';
      this.loading = false;
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke('transbank-confirm', {
        body: { token },
      });

      this.loading = false;

      if (error) {
        console.error('Error en Supabase:', error);
        this.mensaje = '❌ Error al confirmar el pago.';
        return;
      }

      if (data?.status === 'AUTHORIZED' && data?.response_code === 0) {
        this.mensaje = '✅ Pago autorizado correctamente.';
      } else {
        this.mensaje = '❌ Pago rechazado o no autorizado.';
      }
    } catch (err) {
      console.error('Error general:', err);
      this.loading = false;
      this.mensaje = '⚠️ Error inesperado al confirmar el pago.';
    }
  }
}
