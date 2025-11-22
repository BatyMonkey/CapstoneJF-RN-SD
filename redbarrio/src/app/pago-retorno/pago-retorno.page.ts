import { Component, OnInit, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  IonicModule,
  AlertController,
  Platform,
  ToastController,
} from '@ionic/angular';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { SupabaseService } from 'src/app/services/supabase.service';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

// íconos
import { addIcons } from 'ionicons';
import {
  chevronBackOutline,
  checkmarkCircleOutline,
  closeCircleOutline,
  downloadOutline,
} from 'ionicons/icons';

// jsPDF para generar el comprobante
import { jsPDF } from 'jspdf';

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

  // guardamos el token para usarlo en el webhook
  private tokenWs: string | null = null;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private alertCtrl: AlertController,
    private supabaseService: SupabaseService,
    private platform: Platform,
    private toastCtrl: ToastController
  ) {
    // registrar iconos usados en la página
    addIcons({
      chevronBackOutline,
      checkmarkCircleOutline,
      closeCircleOutline,
      downloadOutline,
    });
  }

  async ngOnInit() {
    console.log('[PagoRetorno] init');
    await this.confirmarPago();
  }

  goBack() {
    this.router.navigate(['/home']);
  }

  /** 🧩 Helper: intenta obtener token_ws de varias formas (Angular + location + hash) */
  private extraerTokenWs(): string | null {
    // 1) Angular query params (web normal / dev / navegación interna)
    let token_ws = this.route.snapshot.queryParamMap.get('token_ws');
    console.log('[PagoRetorno] token_ws via ActivatedRoute =', token_ws);

    // 2) URL completa (por si viene como /pago-retorno?token_ws=... sin hash)
    if (!token_ws && typeof window !== 'undefined') {
      try {
        const urlObj = new URL(window.location.href);
        const fromSearch = urlObj.searchParams.get('token_ws');
        if (fromSearch) {
          token_ws = fromSearch;
          console.log(
            '[PagoRetorno] token_ws via window.location.search =',
            token_ws
          );
        }
      } catch (e) {
        console.warn('[PagoRetorno] Error parseando window.location.href:', e);
      }
    }

    // 3) HASH: típico en Capacitor → http://localhost/#/pago-retorno?token_ws=...
    if (!token_ws && typeof window !== 'undefined') {
      const hash = window.location.hash || '';
      console.log('[PagoRetorno] window.location.hash =', hash);

      if (hash.includes('token_ws=')) {
        const qIndex = hash.indexOf('?');
        if (qIndex !== -1) {
          const qs = hash.substring(qIndex + 1); // "token_ws=....&otro=..."
          const params = new URLSearchParams(qs);
          const fromHash = params.get('token_ws');
          if (fromHash) {
            token_ws = fromHash;
            console.log(
              '[PagoRetorno] token_ws via hash (#/pago-retorno?...) =',
              token_ws
            );
          }
        }
      }
    }

    return token_ws;
  }

  /** 🔄 Confirmar pago al volver de Transbank */
  private async confirmarPago() {
    const token_ws = this.extraerTokenWs();
    this.tokenWs = token_ws;
    console.log('[PagoRetorno] token_ws final =', token_ws);

    if (!token_ws) {
      this.mensaje = '⚠️ No se encontró el token del pago.';
      this.loading = false;

      const alert = await this.alertCtrl.create({
        header: 'Error con el pago',
        message:
          'No se pudo recuperar la información del pago al volver desde Transbank.',
        buttons: ['OK'],
      });
      await alert.present();
      return;
    }

    try {
      const { data, error } =
        await this.supabaseService.client.functions.invoke(
          'transbank-confirm',
          {
            body: { token_ws },
          }
        );

      this.loading = false;

      if (error) {
        console.error('Error Supabase (función transbank-confirm):', error);
        this.mensaje = '❌ Error al confirmar el pago.';

        const alert = await this.alertCtrl.create({
          header: 'Error con el pago',
          message:
            'Ocurrió un problema al confirmar el pago con el servidor. Intenta nuevamente.',
          buttons: ['OK'],
        });
        await alert.present();
        return;
      }

      console.log('[PagoRetorno] respuesta función:', data);

      // Estos vienen (si tu edge los envía). Los dejamos como valor "inicial"
      const numeroOrdenFn = data?.buy_order ?? null;
      const fechaHoraFn = data?.transaction_date ?? null;

      if (data?.status === 'AUTHORIZED') {
        this.mensaje = '✅ Pago realizado con éxito.';
        this.detalles = {
          estado: 'Pagado',
          codigoAutorizacion: data.authorization_code,
          tipoPago: data.payment_type_code,
          monto: data.amount,
          numeroOrden: numeroOrdenFn, // se ajusta luego con la info de Supabase
          fechaHora: fechaHoraFn, // se ajusta luego con created_at
          concepto: data.concepto ?? 'Pago realizado en RedBarrio',
          tarjeta: data.card_detail?.card_number ?? null,
        };

        // 🔎 Buscar la orden en Supabase por token_ws
        try {
          const { data: ordenRows, error: ordenErr } =
            await this.supabaseService
              .from('orden_pago')
              .select('id_orden, id_auth, created_at, tbk_order_id')
              .eq('token_ws', token_ws)
              .order('id_orden', { ascending: false })
              .limit(1);

          console.log('[PagoRetorno] última orden select:', ordenRows || null);

          if (ordenErr) {
            console.error(
              '[PagoRetorno] error al obtener orden_pago:',
              ordenErr
            );
          } else if (ordenRows && ordenRows.length > 0) {
            const ord = ordenRows[0];

            // guardamos id_orden e id_auth para storage / webhook
            this.detalles.id_orden = ord.id_orden;
            this.detalles.id_auth = ord.id_auth;

            // === Número de orden "real" ===
            const numeroOrdenFinal =
              (ord as any).tbk_order_id ?? // lo que guardó la función
              this.detalles.numeroOrden ?? // lo que vino de Transbank
              (ord.id_orden ? `RB-${ord.id_orden}` : null); // fallback

            if (numeroOrdenFinal) {
              this.detalles.numeroOrden = numeroOrdenFinal;
            }

            // === Fecha/hora exacta desde created_at ===
            if (ord.created_at) {
              const fecha = new Date(ord.created_at);
              this.detalles.fechaHora = fecha.toLocaleString('es-CL', {
                dateStyle: 'short',
                timeStyle: 'short',
              });
            }
          } else {
            console.warn(
              '[PagoRetorno] no se encontró orden_pago para este token_ws'
            );
          }
        } catch (e) {
          console.error('[PagoRetorno] Exception select orden_pago:', e);
        }

        // ⬆️ Una vez que tenemos detalles + id_orden + id_auth, subimos boleta y disparamos webhook
        try {
          await this.subirBoletaYWebhook();
        } catch (e) {
          console.error(
            '[PagoRetorno] Error en subirBoletaYWebhook (no bloquea la UI):',
            e
          );
        }
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
      console.error('Error general en confirmarPago:', err);
      this.loading = false;
      this.mensaje = '⚠️ Error inesperado al confirmar el pago.';

      const alert = await this.alertCtrl.create({
        header: 'Error con el pago',
        message:
          'Ocurrió un error inesperado al confirmar el pago. Por favor, inténtalo otra vez.',
        buttons: ['OK'],
      });
      await alert.present();
    }
  }

  /** 🧾 Crea el PDF (sin subirlo) y devuelve doc + nombre de archivo */
  private crearPdf(): { doc: jsPDF; nombreArchivo: string } {
    if (!this.detalles) {
      throw new Error('No hay detalles de pago para generar el PDF');
    }

    const doc = new jsPDF('p', 'mm', 'a4');

    const estado = this.detalles.estado ?? '—';
    const monto = this.detalles.monto ?? 0;
    const numeroOrden = this.detalles.numeroOrden ?? '—';
    const fechaHora = this.detalles.fechaHora ?? '—';
    const concepto = this.detalles.concepto ?? 'Pago realizado en RedBarrio';
    const tipoPago = this.detalles.tipoPago ?? '—';
    const tarjeta = this.detalles.tarjeta ?? '**** **** **** 4532';
    const codAut = this.detalles.codigoAutorizacion ?? '—';

    // HEADER coloreado
    doc.setFillColor(6, 182, 212); // #06b6d4
    doc.rect(0, 0, 210, 30, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.text('RedBarrio', 14, 18);
    doc.setFontSize(11);
    doc.text('Comprobante de Pago', 14, 25);

    let y = 42;

    // Título
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(15);
    doc.text('Boleta electrónica', 14, y);
    y += 8;

    // Estado
    doc.setFontSize(12);
    const estadoTexto =
      estado === 'Pagado'
        ? 'Pago procesado exitosamente'
        : 'Pago no autorizado / rechazado';
    doc.text(`Estado: ${estado} - ${estadoTexto}`, 14, y);
    y += 10;

    // Helper para pares etiqueta/valor
    const drawField = (label: string, value: string | number) => {
      doc.setFontSize(10);
      doc.setTextColor(100, 116, 139); // gris label
      doc.text(label, 14, y);
      doc.setTextColor(15, 23, 42); // texto principal
      doc.setFontSize(12);
      doc.text(String(value), 14, y + 5);
      y += 12;
    };

    drawField('Número de orden', numeroOrden);
    drawField('Fecha y hora', fechaHora);
    drawField('Concepto', concepto);

    // Monto destacado
    doc.setFillColor(250, 204, 21); // amarillo
    doc.roundedRect(12, y, 90, 18, 3, 3, 'F');
    doc.setTextColor(15, 23, 42);
    doc.setFontSize(10);
    doc.text('Monto total', 16, y + 6);
    doc.setFontSize(14);
    doc.text(`$${Number(monto).toLocaleString('es-CL')}`, 16, y + 13);
    y += 26;

    drawField('Tipo de pago', tipoPago);
    drawField('Tarjeta', tarjeta);
    drawField('Código de autorización', codAut);

    y += 4;
    doc.setFontSize(9);
    doc.setTextColor(107, 114, 128);
    doc.text('Junta de Vecinos - RedBarrio', 14, y);
    y += 5;
    doc.text('Este es un comprobante válido de tu transacción.', 14, y);

    const nombreArchivo =
      numeroOrden && numeroOrden !== '—'
        ? `boleta-redbarrio-${numeroOrden}.pdf`
        : 'boleta-redbarrio.pdf';

    return { doc, nombreArchivo };
  }

  /** ☁️ Subir PDF a boletas_reservas, guardar URL en orden_pago y disparar webhook n8n */
  private async subirBoletaYWebhook() {
    if (!this.detalles) {
      console.warn('[PagoRetorno] subirBoletaYWebhook sin detalles');
      return;
    }

    const id_auth = this.detalles.id_auth;
    const id_orden = this.detalles.id_orden;
    const monto = this.detalles.monto;
    const concepto = this.detalles.concepto;

    console.log('[PagoRetorno] subirBoletaYWebhook()', {
      id_auth,
      id_orden,
      monto,
      concepto,
    });

    const { doc } = this.crearPdf();
    const pdfBytes = doc.output('arraybuffer');

    // ruta: boletas_reservas/<id_auth>/<id_orden>.pdf
    const fileNameStorage = `${id_orden ?? 'boleta'}.pdf`;
    const pdfPath = `${id_auth ?? 'sin-id'}/${fileNameStorage}`;

    const pdfFile = new File([pdfBytes], fileNameStorage, {
      type: 'application/pdf',
    });

    console.log('[PagoRetorno] subiendo boleta a Storage en', pdfPath);

    const { data: upData, error: upErr } =
      await this.supabaseService.client.storage
        .from('boletas_reservas')
        .upload(pdfPath, pdfFile, { upsert: true });

    if (upErr) {
      console.error('[PagoRetorno] Error al subir boleta a Storage:', upErr);
      throw upErr;
    }

    console.log('[PagoRetorno] subida OK:', upData);

    // === Obtener URL pública ===
    const { data: pub } = this.supabaseService.client.storage
      .from('boletas_reservas')
      .getPublicUrl(pdfPath);

    const publicUrl = pub.publicUrl;
    console.log('[PagoRetorno] URL pública PDF:', publicUrl);

    // === 💾 Guardar URL en la tabla orden_pago ===
    try {
      if (id_orden) {
        const { data: updData, error: updErr } = await this.supabaseService
          .from('orden_pago')
          .update({ url_boleta: publicUrl })
          .eq('id_orden', id_orden);

        if (updErr) {
          console.error(
            '[PagoRetorno] Error al actualizar url_boleta en orden_pago:',
            updErr
          );
        } else {
          console.log(
            '[PagoRetorno] url_boleta actualizada en orden_pago:',
            updData
          );
        }
      } else {
        console.warn(
          '[PagoRetorno] No hay id_orden, no se puede actualizar url_boleta'
        );
      }
    } catch (e) {
      console.error(
        '[PagoRetorno] Exception actualizando url_boleta en orden_pago:',
        e
      );
    }

    // ========= llamar webhook n8n =========
    try {
      const webhookBody = {
        token_ws: this.tokenWs,
        id_auth,
        id_orden,
        monto,
        concepto,
        pdf_url: publicUrl,
      };

      console.log('[PagoRetorno] llamando webhook n8n...', webhookBody);

      const resp = await fetch(
        'https://joaquinfuentessp3101.app.n8n.cloud/webhook/redbarrio/boleta-pagada',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(webhookBody),
        }
      );

      const text = await resp.text();
      console.log('[PagoRetorno] respuesta webhook n8n:', resp.status, text);
    } catch (err) {
      console.error('[PagoRetorno] Error al llamar webhook n8n:', err);
    }
  }

  /** 📥 Botón: genera PDF, lo guarda en una carpeta visible y luego permite compartirlo */
  async descargarBoleta() {
    if (!this.detalles) return;

    let fileUri: string | null = null;

    try {
      const { doc, nombreArchivo } = this.crearPdf();

      // === Web / PC ===
      if (!this.platform.is('hybrid')) {
        doc.save(nombreArchivo);
        return;
      }

      // === App móvil (Capacitor) ===
      const dataUri = doc.output('datauristring'); // "data:application/pdf;base64,AAAA..."
      const base64 = dataUri.split(',')[1];

      const fileName = nombreArchivo.endsWith('.pdf')
        ? nombreArchivo
        : `${nombreArchivo}.pdf`;

      // ANDROID → guardar en /Download para que se vea en "Descargas"
      if (this.platform.is('android')) {
        // Aseguramos carpeta Download
        try {
          await Filesystem.mkdir({
            directory: Directory.ExternalStorage,
            path: 'Download',
            recursive: true,
          });
        } catch (e) {
          // si ya existe, ignoramos el error
          console.log('mkdir Download (ignorable):', e);
        }

        const writeResult = await Filesystem.writeFile({
          path: `Download/${fileName}`,
          data: base64,
          directory: Directory.ExternalStorage,
        });

        fileUri = writeResult.uri;
        console.log('PDF guardado en (Android/ExternalStorage):', fileUri);

        await this.mostrarToast('Boleta guardada en Descargas.', 'success');
      } else {
        // iOS u otras plataformas híbridas → Documents de la app
        const writeResult = await Filesystem.writeFile({
          path: fileName,
          data: base64,
          directory: Directory.Documents,
        });

        fileUri = writeResult.uri;
        console.log('PDF guardado en (Documents):', fileUri);

        await this.mostrarToast(
          'Boleta guardada en documentos de la aplicación.',
          'success'
        );
      }
    } catch (e) {
      console.error('Error generando/guardando PDF:', e);
      const alert = await this.alertCtrl.create({
        header: 'Error',
        message: 'No se pudo generar el comprobante en PDF.',
        buttons: ['OK'],
      });
      await alert.present();
      return;
    }

    // 2) COMPARTIR / ABRIR PDF (SI SE GENERÓ BIEN)
    if (!fileUri) return;

    try {
      await Share.share({
        title: 'Boleta en PDF',
        text: 'Te envío tu boleta en formato PDF.',
        url: fileUri,
        dialogTitle: 'Compartir boleta',
      });
    } catch (e: any) {
      const msg = (e?.message || e?.toString() || '').toLowerCase();

      if (msg.includes('cancel') || msg.includes('dismiss')) {
        console.log('Usuario canceló el compartir:', e);
        return;
      }

      console.error('Error al compartir el PDF:', e);
      const alert = await this.alertCtrl.create({
        header: 'Error',
        message:
          'El comprobante se generó, pero ocurrió un problema al compartirlo.',
        buttons: ['OK'],
      });
      await alert.present();
    }
  }

  private async mostrarToast(
    message: string,
    color: 'success' | 'danger' | 'warning' = 'success'
  ) {
    const toast = await this.toastCtrl.create({
      message,
      duration: 2500,
      position: 'top',
      mode: 'ios',
      color,
    });
    await toast.present();
  }
}
