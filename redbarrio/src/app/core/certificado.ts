import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { SupabaseService } from 'src/app/services/supabase.service';

// Instancia global reutilizable del servicio
const supabaseService = new SupabaseService();

const BUCKET_PLANTILLAS = 'plantillas';
const PLANTILLA_PATH = 'Certificado_Residencia_Puente_Alto_Limpio.pdf';
const BUCKET_CERTS = 'certificados';

/* ==================== AUTH ==================== */
export async function getCurrentUserId(): Promise<string> {
  const { data, error } = await supabaseService.auth.getSession();
  if (error) throw error;
  const uid = data.session?.user?.id;
  if (!uid) throw new Error('No hay sesión activa.');
  return uid;
}

/* ==================== USUARIO ==================== */
export async function getMyUserData(): Promise<any> {
  const uid = await getCurrentUserId();
  const { data, error } = await supabaseService
    .from('usuario')
    .select(`
      primer_nombre, segundo_nombre, primer_apellido, segundo_apellido,
      nombre, rut, direccion, telefono, correo, sexo
    `)
    .eq('user_id', uid)
    .single();
  if (error) throw error;
  return data;
}

/* ========== PLANTILLA: bytes (rápido) ========== */
export async function fetchBaseTemplateBytes(): Promise<Uint8Array> {
  const dl = await supabaseService
    .storage()
    .from(BUCKET_PLANTILLAS)
    .download(PLANTILLA_PATH);

  if ((dl as any)?.data) {
    const buf = await (dl as any).data.arrayBuffer();
    return new Uint8Array(buf);
  }

  const { data } = supabaseService
    .storage()
    .from(BUCKET_PLANTILLAS)
    .getPublicUrl(PLANTILLA_PATH);

  const url = `${data.publicUrl}${data.publicUrl.includes('?') ? '&' : '?'}cb=${Date.now()}`;
  const resp = await fetch(url, { cache: 'no-store' });
  if (!resp.ok) throw new Error('No se pudo cargar la plantilla');

  const buf = await resp.arrayBuffer();
  return new Uint8Array(buf);
}

/* ========== PDF: rellenar (solo ORIGINAL) ========== */
export async function fillCertificate(
  baseBytes: Uint8Array,
  vars: {
    nombre_completo: string;
    rut: string;
    direccion: string;
    destino_presentacion: string;
    folio?: string;
    dia_emision: number | string;
    mes_emision: string;
    anio_emision: number | string;
  }
): Promise<Blob> {
  const pdfDoc = await PDFDocument.load(baseBytes);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const page = pdfDoc.getPage(0);
  const black = rgb(0, 0, 0);
  const fs = 12;

  const centerBetween = (text: string, x1: number, x2: number) =>
    x1 + (x2 - x1 - font.widthOfTextAtSize(text ?? '', fs)) / 2;

  const name = String(vars.nombre_completo ?? '');
  const rut = String(vars.rut ?? '');
  const dir = String(vars.direccion ?? '').replace(/,?\s*comuna de Puente Alto\.?/i, '');
  const dest = String(vars.destino_presentacion ?? '');

  const NAME_X1_T = 40, NAME_X2_T = 560;
  const RUT_X1_T = 60, RUT_X2_T = 250;
  const DIR_X1_T = 295, DIR_X2_T = 580;
  const DEST_X1_T = 330, DEST_X2_T = 560;

  const NAME_Y_T = 632;
  const RUT_Y_T = 613;
  const DIR_Y_T = 613;
  const DEST_Y_T = 548;

  page.drawText(name, { x: centerBetween(name, NAME_X1_T, NAME_X2_T), y: NAME_Y_T, size: fs, font, color: black });
  page.drawText(rut, { x: centerBetween(rut, RUT_X1_T, RUT_X2_T), y: RUT_Y_T, size: fs, font, color: black });
  page.drawText(dir, { x: centerBetween(dir, DIR_X1_T, DIR_X2_T), y: DIR_Y_T, size: fs, font, color: black });
  page.drawText(dest, { x: centerBetween(dest, DEST_X1_T, DEST_X2_T), y: DEST_Y_T, size: fs, font, color: black });

  const ORIG_NUM_X = 248;
  const ORIG_NUM_Y = 663;
  if (vars.folio) {
    page.drawText(String(vars.folio), {
      x: ORIG_NUM_X,
      y: ORIG_NUM_Y,
      size: fs,
      font,
      color: black,
    });
  }

  const YEAR_SHORT_X = 305;
  const YEAR_SHORT_Y = ORIG_NUM_Y;
  page.drawText('25', {
    x: YEAR_SHORT_X,
    y: YEAR_SHORT_Y,
    size: fs,
    font,
    color: black,
  });

  const DAY_X_T = 130;
  const MONTH_X_T = 200;
  const YEAR2_X_T = 325;
  const DATE_Y_T = 542;

  const diaStr = String(vars.dia_emision ?? '');
  const mesStr = String(vars.mes_emision ?? '');
  const year2Str = String(vars.anio_emision ?? '').slice(-2);

  if (diaStr) page.drawText(diaStr, { x: DAY_X_T, y: DATE_Y_T, size: fs, font, color: black });
  if (mesStr) page.drawText(mesStr, { x: MONTH_X_T, y: DATE_Y_T, size: fs, font, color: black });
  if (year2Str) page.drawText(year2Str, { x: YEAR2_X_T, y: DATE_Y_T, size: fs, font, color: black });

  const pdfBytes = await pdfDoc.save();
  return new Blob([pdfBytes], { type: 'application/pdf' });
}

/* ========== Crear registro en la tabla certificados ========== */
export async function createCertRecord(meta: any): Promise<{ id: number }> {
  const uid = await getCurrentUserId();
  const { data, error } = await supabaseService
    .from('certificados')
    .insert({ user_id: uid, issue_meta: meta })
    .select()
    .single();
  if (error) throw error;
  return { id: data.id };
}

/* ========== Subir PDF y actualizar registro existente ========== */
export async function uploadPdfForRecord(id: number, blob: Blob): Promise<{ pdf_url: string }> {
  const uid = await getCurrentUserId();
  const path = `${uid}/${id}.pdf`;

  const { error: upErr } = await supabaseService
    .storage()
    .from(BUCKET_CERTS)
    .upload(path, blob, { upsert: true, contentType: 'application/pdf' });
  if (upErr) throw upErr;

  const { data: pub } = supabaseService.storage().from(BUCKET_CERTS).getPublicUrl(path);

  const { error: updErr } = await supabaseService
    .from('certificados')
    .update({ pdf_url: pub.publicUrl })
    .eq('id', id);
  if (updErr) throw updErr;

  return { pdf_url: pub.publicUrl };
}

/* ==================== UTILIDADES ==================== */
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function openEmailClient(to: string, subject: string, pdfUrl: string) {
  const body = encodeURIComponent(`Estimado/a,\n\nAdjunto enlace a su certificado:\n${pdfUrl}\n\nSaludos.`);
  window.location.href = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${body}`;
}
