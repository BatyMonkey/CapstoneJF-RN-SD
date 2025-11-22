import { Component, OnInit } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  IonicModule,
  AlertController,
  ToastController,
  NavController,
} from '@ionic/angular';

import { SupabaseService } from 'src/app/services/supabase.service';

import {
  fetchBaseTemplateBytes,
  getMyUserData,
  fillCertificate,
  createCertRecord,
  uploadPdfForRecord,
  downloadBlob,
} from '../../core/certificado';

import { environment } from 'src/environments/environment';
import { Share } from '@capacitor/share';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Capacitor } from '@capacitor/core';

/*  🔥 IMPORTS NUEVOS PARA ICONOS  */
import { addIcons } from 'ionicons';
import {
  downloadOutline,
  mailOutline,
  documentTextOutline,
  bulbOutline,
  homeOutline,
  checkmarkCircleOutline,
  chevronBackOutline,
} from 'ionicons/icons';

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

  // === NUEVAS VARIABLES PARA EL TEMPLATE DEL MOCKUP ===
  ultimaFecha: Date | null = null;
  fechaValidez: Date | null = null;

  // 🔄 Estado de envío por email
  enviandoEmail = false;

  constructor(
    private supabaseService: SupabaseService,
    private alertCtrl: AlertController,
    private toastCtrl: ToastController,
    private navCtrl: NavController
  ) {
    /* ========================================
       🔥 REGISTRO DE ICONOS IONICONS
       ======================================== */
    addIcons({
      downloadOutline,
      mailOutline,
      documentTextOutline,
      bulbOutline,
      homeOutline,
      checkmarkCircleOutline,
      chevronBackOutline,
    });
  }

  async ngOnInit() {
    await this.prefillUserInfo();
    await this.cargarHistorial();
  }

  // 🔙 Volver desde el header hero
  goBack() {
    if (window.history.length > 1) {
      this.navCtrl.back();
    } else {
      this.navCtrl.navigateRoot('/home');
    }
  }

  // ============================================================
  // 🔹 Construcción de datos personales
  // ============================================================
  private nombreCompleto(
    pn?: string | null,
    sn?: string | null,
    pa?: string | null,
    sa?: string | null
  ) {
    return [pn, sn, pa, sa]
      .filter(Boolean)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private monthNameEs(m: number) {
    return [
      'enero',
      'febrero',
      'marzo',
      'abril',
      'mayo',
      'junio',
      'julio',
      'agosto',
      'septiembre',
      'octubre',
      'noviembre',
      'diciembre',
    ][m];
  }

  private normalizaRut(rut: string) {
    if (!rut) return rut;
    const clean = rut.replace(/[^0-9kK]/g, '').toUpperCase();
    if (clean.length < 2) return rut;
    const dv = clean.slice(-1);
    const num = clean.slice(0, -1);
    let out = '';
    let i = 0;
    for (let j = num.length - 1; j >= 0; j--) {
      out = num[j] + out;
      i++;
      if (i === 3 && j > 0) {
        out = '.' + out;
        i = 0;
      }
    }
    return `${out}-${dv}`;
  }

  // ============================================================
  // 🔹 Cargar nombre + correo desde metadata del usuario
  // ============================================================
  private async prefillUserInfo() {
    try {
      const {
        data: { user },
      } = await this.supabaseService.auth.getUser();

      if (user) {
        if (user.email) this.emailDestino = user.email;

        const meta = user.user_metadata ?? {};
        const metaName = meta['full_name'] || meta['name'] || null;
        if (metaName) this.displayName = metaName;
      }

      const who = await getMyUserData().catch(() => null as any);

      if (!this.emailDestino && who?.correo) this.emailDestino = who.correo;

      if (!this.displayName && (who?.full_name || who?.nombre)) {
        this.displayName = who.full_name || who.nombre;
      }
    } catch {
      /* silent */
    }
  }

  // ============================================================
  // 🔹 Llamada a N8N para enviar correo
  // ============================================================
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

  // ============================================================
  // 🔹 Cargar historial + calcular fechas mockup
  // ============================================================
  async cargarHistorial() {
    const { data: session } = await this.supabaseService.auth.getSession();
    const uid = session?.session?.user?.id;

    if (!uid) return;

    const { data, error } = await this.supabaseService
      .from('certificados')
      .select('*')
      .eq('user_id', uid)
      .order('created_at', { ascending: false });

    if (!error && data) {
      this.certificados = data;

      if (this.certificados.length > 0) {
        const created = new Date(this.certificados[0].created_at);
        this.ultimaFecha = created;

        const validez = new Date(created);
        validez.setMonth(validez.getMonth() + 2);
        this.fechaValidez = validez;
      }
    }
  }

  // ============================================================
  // 🔹 Variables dinámicas para el PDF
  // ============================================================
  private buildVars(who: any) {
    const now = new Date();

    const nombre =
      this.nombreCompleto(
        who?.primer_nombre,
        who?.segundo_nombre,
        who?.primer_apellido,
        who?.segundo_apellido
      ) ||
      who?.full_name ||
      who?.nombre ||
      '';

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

  private sanitizeStr(s: any): string {
    const v = s == null ? '' : String(s);
    let out = v.normalize('NFC');
    out = out.replace(/\p{M}/gu, '');
    out = out.replace(/[\u200B-\u200D\uFEFF]/g, '');
    return out;
  }

  private sanitizeVars<T extends Record<string, any>>(o: T): T {
    const out: any = {};
    for (const k of Object.keys(o)) {
      const val = o[k];
      out[k] = typeof val === 'string' ? this.sanitizeStr(val) : val;
    }
    return out as T;
  }

  // ============================================================
  // 🔹 Helper: Blob -> base64 (para Filesystem en móvil)
  // ============================================================
  private blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const dataUrl = reader.result as string;
        const base64 = dataUrl.split(',')[1]; // quitamos "data:...;base64,"
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  // ============================================================
  // 🔹 Helper: asegurar carpeta 'certificados' en Documents (fallback)
  // ============================================================
  private async ensureCertDirDocuments() {
    try {
      await Filesystem.mkdir({
        path: 'certificados',
        directory: Directory.Documents,
        recursive: true,
      });
    } catch (e: any) {
      const msg = e?.message || '';
      if (
        msg.includes('EXISTS') ||
        msg.includes('AlreadyExists') ||
        msg.includes('EEXIST')
      ) {
        return;
      }
      console.warn('No se pudo crear el directorio certificados:', e);
    }
  }

  // ============================================================
  // 🔹 Emitir + Descargar (PC: descarga, móvil: guardar + compartir)
  // ============================================================
  async emitirDescargar() {
    try {
      this.loading = true;

      const who = await getMyUserData();

      const baseMeta = {
        ...who,
        destino_presentacion: this.placeAndDate || '',
        fecha_emision: new Date().toISOString(),
        render: 'pdf-lib',
      };

      const { id } = await createCertRecord(baseMeta);
      const baseBytes = await fetchBaseTemplateBytes();

      const vars = this.sanitizeVars({
        ...this.buildVars(who),
        folio: String(id),
      });

      const blob = await fillCertificate(baseBytes, vars);

      const platform = Capacitor.getPlatform();

      if (platform === 'web') {
        // 👉 Navegador (PC): descarga clásica
        downloadBlob(blob, `certificado-${id}.pdf`);
      } else {
        // 👉 App móvil (Android/iOS): guardar archivo en carpeta visible + compartir

        const base64Data = await this.blobToBase64(blob);
        const fileName = `certificado-${id}-${Date.now()}.pdf`;

        let fileUri: string | null = null;

        if (platform === 'android') {
          // ANDROID → guardar en /Download para que se vea en "Descargas"
          try {
            await Filesystem.mkdir({
              directory: Directory.ExternalStorage,
              path: 'Download',
              recursive: true,
            });
          } catch (e: any) {
            console.log('mkdir Download (ignorable):', e);
          }

          const fileResult = await Filesystem.writeFile({
            path: `Download/${fileName}`,
            data: base64Data,
            directory: Directory.ExternalStorage,
          });

          fileUri = fileResult.uri;
          console.log(
            'Certificado guardado en (Android/ExternalStorage):',
            fileUri
          );

          await this.mostrarToast(
            'Certificado guardado en la carpeta Descargas.',
            'success'
          );
        } else {
          // iOS u otras plataformas híbridas → Documents de la app
          await this.ensureCertDirDocuments();

          const fileResult = await Filesystem.writeFile({
            path: `certificados/${fileName}`,
            data: base64Data,
            directory: Directory.Documents,
          });

          fileUri = fileResult.uri;
          console.log('Certificado guardado en (Documents):', fileUri);

          await this.mostrarToast(
            'Certificado guardado en documentos de la aplicación.',
            'success'
          );
        }

        // Compartir (opcional) si tenemos URI
        if (fileUri) {
          try {
            await Share.share({
              title: 'Certificado',
              text: 'Se ha generado tu certificado.',
              url: fileUri,
              dialogTitle: 'Compartir certificado',
            });
          } catch (shareError) {
            console.warn(
              'Compartir certificado cancelado o fallido:',
              shareError
            );
            // No rompemos el flujo: el archivo ya está guardado
          }
        }
      }

      await this.cargarHistorial();
    } catch (e: any) {
      console.error(e);
      await this.mostrarToast(
        e?.message ?? 'No se pudo emitir el certificado.',
        'danger'
      );
    } finally {
      this.loading = false;
    }
  }

  // ============================================================
  // 🔹 Emitir + Enviar Email (con loading + alerta)
  // ============================================================
  async emitirEnviar() {
    if (!this.emailDestino) {
      await this.mostrarToast('Ingresa un correo destino.', 'warning');
      return;
    }

    this.enviandoEmail = true;
    this.loading = true;

    try {
      const who = await getMyUserData();

      const baseMeta = {
        ...who,
        destino_presentacion: this.placeAndDate || '',
        fecha_emision: new Date().toISOString(),
        render: 'pdf-lib',
      };

      const { id } = await createCertRecord(baseMeta);

      const baseBytes = await fetchBaseTemplateBytes();
      const vars = this.sanitizeVars({
        ...this.buildVars(who),
        folio: String(id),
      });

      const blob = await fillCertificate(baseBytes, vars);

      const { pdf_url } = await uploadPdfForRecord(id, blob);

      await this.callN8nWebhook({
        to: this.emailDestino,
        subject: 'Certificado emitido',
        pdf_url,
        filename: `certificado-${id}.pdf`,
      });

      await this.cargarHistorial();

      const msg =
        `Tu certificado fue enviado a ${this.emailDestino}. ` +
        `Revisa tu bandeja de entrada y la carpeta de spam.`;

      const okAlert = await this.alertCtrl.create({
        header: 'Correo enviado',
        message: msg,
        buttons: [
          {
            text: 'OK',
            role: 'confirm',
          },
        ],
      });

      await okAlert.present();
    } catch (e: any) {
      console.error(e);
      await this.mostrarToast(
        e?.message ?? 'No se pudo enviar el certificado por correo.',
        'danger'
      );
    } finally {
      this.enviandoEmail = false;
      this.loading = false;
    }
  }

  // ============================================================
  // 🔹 Utilidades de UI
  // ============================================================
  private async mostrarToast(
    message: string,
    color: 'success' | 'danger' | 'warning'
  ) {
    const toast = await this.toastCtrl.create({
      message,
      duration: 3000,
      position: 'bottom', // 👈 estilo iOS: abajo
      color,
      mode: 'ios', // 👈 fuerza el modo iOS
      cssClass: 'rb-toast-ios',
    });
    await toast.present();
  }
}
