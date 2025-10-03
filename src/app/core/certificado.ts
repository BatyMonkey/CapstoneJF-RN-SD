// src/app/core/certificate-fill.service.ts
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { supabase } from '../core/supabase.client';

const BUCKET_PLANTILLAS = 'plantillas'; // cambia a 'plantilas' si lo nombraste sin "n"
const PLANTILLA_PATH = 'cert_base.pdf';
const BUCKET_CERTS = 'certificados';

export async function getCurrentUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  const uid = data.session?.user?.id;
  if (!uid) throw new Error('No hay sesión activa.');
  return uid;
}

// 1) Descargar bytes del PDF base desde Storage (público)
export async function fetchBaseTemplateBytes(): Promise<Uint8Array> {
  const { data } = supabase.storage.from(BUCKET_PLANTILLAS).getPublicUrl(PLANTILLA_PATH);
  const resp = await fetch(data.publicUrl);
  if (!resp.ok) throw new Error('No se pudo descargar la plantilla');
  const buf = await resp.arrayBuffer();
  return new Uint8Array(buf);
}

// 2) Obtener datos de negocio del usuario desde TU tabla "usuario"
export async function getMyUserData(): Promise<{ full_name: string; run: string; address: string; }> {
  const uid = await getCurrentUserId();
  const { data, error } = await supabase
    .from('usuario')
    .select('nombre, rut, direccion')
    .eq('user_id', uid)
    .single();
  if (error) throw error;
  return {
    full_name: data?.nombre ?? '',
    run: data?.rut ?? '',
    address: data?.direccion ?? '',
  };
}

// 3) Rellenar la plantilla escribiendo texto sobre el PDF
export async function fillCertificate(baseBytes: Uint8Array, payload: {
  full_name: string; run: string; address: string; placeAndDate?: string;
}): Promise<Blob> {
  const pdfDoc = await PDFDocument.load(baseBytes);
  const page = pdfDoc.getPage(0);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

  // Coordenadas aprox (A4 ~ 595x842 pt). Ajusta si lo ves corrido.
  const x = 165;
  const fs = 12;
  page.drawText(payload.full_name || '', { x, y: 595, size: fs, font, color: rgb(0,0,0) });
  page.drawText(payload.run || '',        { x, y: 558, size: fs, font, color: rgb(0,0,0) });
  page.drawText(payload.address || '',    { x, y: 520, size: fs, font, color: rgb(0,0,0) });

  if (payload.placeAndDate) {
    page.drawText(payload.placeAndDate,   { x, y: 294, size: fs, font, color: rgb(0,0,0) });
  }

  const bytes: Uint8Array = await pdfDoc.save();

  // Crear un ArrayBuffer "puro" y copiar dentro
  const ab = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(ab).set(bytes);

  return new Blob([ab], { type: 'application/pdf' });

}

// 4) Subir el PDF emitido y registrar en BD
export async function uploadAndRegister(blob: Blob, meta: any): Promise<{ id: number; pdf_url: string; }> {
  const uid = await getCurrentUserId();

  // Crear registro para obtener el ID
  const { data: created, error: insErr } = await supabase
    .from('certificados')
    .insert({ user_id: uid, issue_meta: meta })
    .select()
    .single();
  if (insErr) throw insErr;

  const path = `${uid}/${created.id}.pdf`; // certificados/{uid}/{cert_id}.pdf
  const { error: upErr } = await supabase
    .storage
    .from(BUCKET_CERTS)
    .upload(path, blob, { upsert: true, contentType: 'application/pdf' });
  if (upErr) throw upErr;

  const { data: pub } = supabase.storage.from(BUCKET_CERTS).getPublicUrl(path);

  const { error: updErr } = await supabase
    .from('certificados')
    .update({ pdf_url: pub.publicUrl })
    .eq('id', created.id);
  if (updErr) throw updErr;

  return { id: created.id, pdf_url: pub.publicUrl };
}

// 5) Descargar localmente
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// 6) Abrir cliente de correo con el enlace del PDF
export function openEmailClient(to: string, subject: string, pdfUrl: string) {
  const body = encodeURIComponent(`Estimado/a,\n\nAdjunto enlace a su certificado:\n${pdfUrl}\n\nSaludos.`);
  window.location.href = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${body}`;
}

