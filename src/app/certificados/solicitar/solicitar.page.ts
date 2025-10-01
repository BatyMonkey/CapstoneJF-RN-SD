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
  openEmailClient
} from '../../core/certificado'; // ← si tu archivo se llama "certificate-fill.service.ts", usa: '../core/certificate-fill.service'

@Component({
  selector: 'app-solicitar-certificado',
  imports: [CommonModule, FormsModule, IonicModule, DatePipe],
  templateUrl: './solicitar.page.html',
  styleUrls: ['./solicitar.page.scss'],
})
export class SolicitarCertificadoPage implements OnInit {
  loading = false;
  emailDestino = '';
  placeAndDate = '';
  certificados: any[] = [];

  async ngOnInit() {
    await this.cargarHistorial();
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
      const saved = await uploadAndRegister(blob, meta);

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
      const saved = await uploadAndRegister(blob, meta);

      openEmailClient(this.emailDestino, 'Certificado emitido', saved.pdf_url);
      await this.cargarHistorial();
    } catch (e: any) {
      console.error(e);
      alert(e?.message ?? 'Error al emitir.');
    } finally {
      this.loading = false;
    }
  }
}

