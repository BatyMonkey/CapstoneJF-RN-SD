import { Component, OnInit } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';

import { supabase } from '../../core/supabase.client';
import {
  fetchBaseTemplateBytes,
  getMyUserData,
  fillCertificate,
  createCertRecord,
  uploadPdfForRecord,
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
  emailDestino = '';
  placeAndDate = '';
  certificados: any[] = [];
  displayName: string | null = null;

  async ngOnInit() {
    await this.prefillUserInfo();
    await this.cargarHistorial();
  }

  private nombreCompleto(pn?: string|null, sn?: string|null, pa?: string|null, sa?: string|null) {
    return [pn, sn, pa, sa].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
  }
  private monthNameEs(m: number) {
    return ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'][m];
  }
  private normalizaRut(rut: string) {
    if (!rut) return rut;
    const clean = rut.replace(/[^0-9kK]/g, '').toUpperCase();
    if (clean.length < 2) return rut;
    const dv = clean.slice(-1);
    const num = clean.slice(0, -1);
    let out = ''; let i = 0;
    for (let j = num.length - 1; j >= 0; j--) {
      out = num[j] + out; i++;
      if (i === 3 && j > 0) { out = '.' + out; i = 0; }
    }
    return `${out}-${dv}`;
  }

  private async prefillUserInfo() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        if (user.email) this.emailDestino = user.email;
        const meta = (user.user_metadata ?? {}) as Record<string, any>;
        const metaName = meta['full_name'] || meta['name'] || null;
        if (metaName) this.displayName = metaName;
      }
      const who = await getMyUserData().catch(() => null as any);
      if (!this.emailDestino && who?.correo) this.emailDestino = who.correo;
      if (!this.displayName && (who?.full_name || who?.nombre)) {
        this.displayName = who.full_name || who.nombre;
      }
    } catch {/* silent */}
  }

  private async callN8nWebhook(payload: {
    to: string; pdf_url: string; filename?: string; subject?: string;
  }) {
    const url = environment.N8N_WEBHOOK_URL;
    const res = await fetch(url, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
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

  private buildVars(who: any) {
    const now = new Date();
    const nombre =
      this.nombreCompleto(
        who?.primer_nombre, who?.segundo_nombre,
        who?.primer_apellido, who?.segundo_apellido
      ) || (who?.full_name || who?.nombre || '');

    return {
      nombre_completo: nombre,
      rut: this.normalizaRut(who?.rut || who?.run || ''),
      direccion: who?.direccion || who?.address || '',
      destino_presentacion: this.placeAndDate || '',
      dia_emision: now.getDate(),
      mes_emision: this.monthNameEs(now.getMonth()),
      anio_emision: now.getFullYear(),
    };
  }

  /* ===== Helpers de sanitización (no alteran tu flujo) ===== */
  private sanitizeStr(s: any): string {
    const v = (s == null) ? '' : String(s);
    let out = v.normalize('NFC');             // fusiona base+diacrítico
    out = out.replace(/\p{M}/gu, '');         // elimina marcas combinantes (incluye U+0307)
    out = out.replace(/[\u200B-\u200D\uFEFF]/g, ''); // invisibles
    return out;
  }
  private sanitizeVars<T extends Record<string, any>>(o: T): T {
    const out: any = {};
    for (const k of Object.keys(o)) {
      const val = o[k];
      out[k] = (typeof val === 'string') ? this.sanitizeStr(val) : val;
    }
    return out as T;
  }

  /* ========== DESCARGAR ========== */
  async emitirDescargar() {
    try {
      this.loading = true;

      const who = await getMyUserData();
      const baseMeta = {
        ...who,
        destino_presentacion: this.placeAndDate || '',
        fecha_emision: new Date().toISOString(),
        render: 'pdf-lib'
      };

      // 1) PRE-CREAR registro para obtener el ID real
      const { id } = await createCertRecord(baseMeta);

      // 2) Generar PDF con el ID impreso como “Original N°”
      const baseBytes = await fetchBaseTemplateBytes();
      const vars = this.sanitizeVars({ ...this.buildVars(who), folio: String(id) });
      const blob = await fillCertificate(baseBytes, vars);

      // 3) Subir y actualizar URL
      const { pdf_url } = await uploadPdfForRecord(id, blob);

      // 4) Descargar localmente y refrescar historial
      downloadBlob(blob, `certificado-${id}.pdf`);
      await this.cargarHistorial();
    } catch (e: any) {
      console.error(e);
      alert(e?.message ?? 'Error al emitir.');
    } finally {
      this.loading = false;
    }
  }

  /* ========== ENVIAR POR CORREO ========== */
  async emitirEnviar() {
    try {
      if (!this.emailDestino) {
        alert('Ingresa un correo destino.');
        return;
      }
      this.loading = true;

      const who = await getMyUserData();
      const baseMeta = {
        ...who,
        destino_presentacion: this.placeAndDate || '',
        fecha_emision: new Date().toISOString(),
        render: 'pdf-lib'
      };

      const { id } = await createCertRecord(baseMeta);

      const baseBytes = await fetchBaseTemplateBytes();
      const vars = this.sanitizeVars({ ...this.buildVars(who), folio: String(id) });
      const blob = await fillCertificate(baseBytes, vars);

      const { pdf_url } = await uploadPdfForRecord(id, blob);

      await this.callN8nWebhook({
        to: this.emailDestino,
        subject: 'Certificado emitido',
        pdf_url,
        filename: `certificado-${id}.pdf`
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

