// src/app/certificados/solicitar.page.ts
import { Component, OnInit } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';

import { supabase } from '../../core/supabase.client';
import {
  fetchBaseTemplateBytes,
  getMyUserData,
  fillCertificate,
  uploadAndRegister,
  downloadBlob,
} from '../../core/certificado';
import { environment } from 'src/environments/environment';

@Component({
  selector: 'app-solicitar-certificado',
  standalone: true,
  imports: [CommonModule, FormsModule, IonicModule, DatePipe],
  templateUrl: './solicitar.page.html',
  styleUrls: ['./solicitar.page.scss'],
})
export class SolicitarCertificadoPage implements OnInit {
  loading = false;
  emailDestino = '';           // <- se autocompleta en ngOnInit
  placeAndDate = '';
  certificados: any[] = [];

  async ngOnInit() {
    await this.prefillEmail();   // 👈 nuevo
    await this.cargarHistorial();
  }

  /** Prellenar el email con el correo del usuario autenticado */
  private async prefillEmail() {
    try {
      // 1) intenta desde auth.users
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.email) {
        this.emailDestino = user.email;
        return;
      }

      // 2) como fallback, toma el correo desde tu tabla de perfil (si la manejas)
      const who = await getMyUserData().catch(() => null as any);
      if (who?.correo) this.emailDestino = who.correo;
    } catch (_) {
      // ignora, el usuario siempre podrá editar manualmente el campo
    }
  }

  private async callN8nWebhook(payload: {
    to: string;
    pdf_url: string;
    filename?: string;
    subject?: string;
  }) {
    const url = environment.N8N_WEBHOOK_URL;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json().catch(() => ({}));
  }

  async cargarHistorial() {
    const { data: session } = await supabase.auth.getSession();
    const uid = session?.session?.user?.id;
    if (!uid) return;

    const { data, error } = await supabase
      .from('certificados')
      .select('*')
      .eq('user_id', uid)
      .order('created_at', { ascending: false });

    if (!error && data) this.certificados = data;
  }

  async emitirDescargar() {
    try {
      this.loading = true;

      const [baseBytes, who] = await Promise.all([
        fetchBaseTemplateBytes(),
        getMyUserData()
      ]);

      const blob = await fillCertificate(baseBytes, {
        full_name: who.full_name,
        run: who.run,
        address: who.address,
        placeAndDate: this.placeAndDate || ''
      });

      const meta = { ...who, placeAndDate: this.placeAndDate || '' };
      const saved = await uploadAndRegister(blob, meta); // { id, pdf_url, ... }

      downloadBlob(blob, `certificado-${saved.id}.pdf`);
      await this.cargarHistorial();
    } catch (e: any) {
      console.error(e);
      alert(e?.message ?? 'Error al emitir.');
    } finally {
      this.loading = false;
    }
  }

  async emitirEnviar() {
    try {
      if (!this.emailDestino) {
        alert('Ingresa un correo destino.');
        return;
      }
      this.loading = true;

      const [baseBytes, who] = await Promise.all([
        fetchBaseTemplateBytes(),
        getMyUserData()
      ]);

      const blob = await fillCertificate(baseBytes, {
        full_name: who.full_name,
        run: who.run,
        address: who.address,
        placeAndDate: this.placeAndDate || ''
      });

      const meta = { ...who, placeAndDate: this.placeAndDate || '' };
      const saved = await uploadAndRegister(blob, meta); // ← debe devolver { id, pdf_url }

      await this.callN8nWebhook({
        to: this.emailDestino,                       // 👈 usa el email prellenado
        subject: 'Certificado emitido',
        pdf_url: saved.pdf_url,
        filename: `certificado-${saved.id}.pdf`
      });

      alert('Correo enviado correctamente ✅');
      await this.cargarHistorial();
    } catch (e: any) {
      console.error(e);
      alert(e?.message ?? 'Error al emitir.');
    } finally {
      this.loading = false;
    }
  }
}


