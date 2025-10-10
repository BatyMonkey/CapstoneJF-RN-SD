import { Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';

type OcrResultShape = {
  raw: string;
  rut?: string | null;
  primerNombre?: string | null;
  segundoNombre?: string | null;
  primerApellido?: string | null;
  segundoApellido?: string | null;
  fechaNacimiento?: string | null; // YYYY-MM-DD
  sexo?: 'M' | 'F' | null;
};

@Injectable({ providedIn: 'root' })
export class OcrMlkitService {
  async recognizeSmart(fileUrl: string): Promise<OcrResultShape> {
    const raw = await this.readText(fileUrl);
    const parsed = this.parseCedula(raw);
    return { raw, ...parsed };
  }

  /** Lee texto con ML Kit. En web devuelve vacío para no romper. */
  private async readText(fileUrl: string): Promise<string> {
    if (Capacitor.getPlatform() === 'web') return '';

    // Importa el plugin solo en nativo
    const { Ocr } = await import('@jcesarmobile/capacitor-ocr');
    const { results } = await Ocr.process({ image: fileUrl }); // array de líneas
    const lines = (results || []).map((r: any) => r.text).filter(Boolean);
    return lines.join('\n').trim();
  }

  /** Parser para cédula chilena (RUN, APELLIDOS, NOMBRES, F.NAC, SEXO). */
  private parseCedula(raw: string) {
    const text = (raw || '')
      .replace(/[^\S\r\n]+/g, ' ')
      .replace(/\s+\n/g, '\n')
      .replace(/\n{2,}/g, '\n')
      .trim();

    const rut = this.extractRun(text);

    const apellidosRaw = this.extractBetween(text, /APELLIDOS?/i, [
      /NOMBRES?/i, /NACIONALIDAD/i, /SEXO/i, /F\.?\s*NAC/i, /FECHA/i, /DOCUMENTO/i, /DOMICILIO/i
    ]);
    const nombresRaw = this.extractBetween(text, /NOMBRES?/i, [
      /APELLIDOS?/i, /NACIONALIDAD/i, /SEXO/i, /F\.?\s*NAC/i, /FECHA/i, /DOCUMENTO/i, /DOMICILIO/i
    ]);

    const { primerApellido, segundoApellido } = this.splitApellidos(apellidosRaw);
    const { primerNombre, segundoNombre }   = this.splitNombres(nombresRaw);

    const fechaNacimiento = this.extractFechaNacimiento(text);
    const sexo = this.extractSexo(text);

    return {
      rut,
      primerNombre: primerNombre || null,
      segundoNombre: segundoNombre || null,
      primerApellido: primerApellido || null,
      segundoApellido: segundoApellido || null,
      fechaNacimiento: fechaNacimiento || null,
      sexo: sexo || null,
    };
  }

  /** RUN limpio: dígitos + '-' + DV (sin puntos ni espacios). */
  private extractRun(text: string): string | null {
    const runLineRegex = /RUN[^0-9Kk]*([\d\. ]{6,}\s*[-–—]?\s*[0-9Kk])/i;
    const anyRutRegex  = /\b(\d{1,3}(?:[.\s]?\d{3}){1,2}|\d{7,8})\s*[-–—]?\s*([0-9Kk])\b/;

    let m = text.match(runLineRegex);
    if (!m) m = text.match(anyRutRegex);
    if (!m) return null;

    const onlyRut = m[1] || (m[0] ?? '');
    const compact = onlyRut.replace(/\s|\./g, '').toUpperCase().replace(/–|—/g, '-');

    const partes = compact.match(/^(\d+)-?([0-9K])$/i);
    if (!partes) return null;

    const cuerpo = partes[1];
    const dv     = partes[2].toUpperCase();
    const normalizado = `${cuerpo}-${dv}`;
    return this.validaRutDV(normalizado) ? normalizado : null;
  }

  private extractBetween(text: string, startRe: RegExp, endRes: RegExp[]): string {
    const startMatch = text.match(startRe);
    if (!startMatch) return '';
    const startIdx = text.indexOf(startMatch[0]) + startMatch[0].length;
    const sub = text.slice(startIdx);

    let best = sub.length;
    for (const re of endRes) {
      const i = sub.search(re);
      if (i !== -1 && i < best) best = i;
    }
    const slice = sub.slice(0, best)
      .replace(/\n/g, ' ')
      .replace(/[,:;]/g, ' ')
      .replace(/\s{2,}/g, ' ')
      .trim();

    return slice
      .replace(/^APELLIDOS?\s+/i, '')
      .replace(/^NOMBRES?\s+/i, '')
      .toUpperCase();
  }

  private splitApellidos(apellidosRaw: string) {
    const toks = apellidosRaw.split(/\s+/).filter(Boolean);
    let primerApellido = '', segundoApellido = '';
    if (toks.length >= 2) [primerApellido, segundoApellido] = [toks[0], toks[1]];
    else if (toks.length === 1) primerApellido = toks[0];
    return { primerApellido: this.cap(primerApellido), segundoApellido: this.cap(segundoApellido) };
  }

  private splitNombres(nombresRaw: string) {
    const toks = nombresRaw.split(/\s+/).filter(Boolean);
    let primerNombre = '', segundoNombre = '';
    if (toks.length >= 2) [primerNombre, segundoNombre] = [toks[0], toks[1]];
    else if (toks.length === 1) primerNombre = toks[0];
    return { primerNombre: this.cap(primerNombre), segundoNombre: this.cap(segundoNombre) };
  }

  // ========== F.NAC ==========
  private extractFechaNacimiento(text: string): string | null {
    const bloque = this.extractBetween(
      text,
      /(F\.?\s*NAC\.?|FECHA\s+DE\s+NACIMIENTO|NACIMIENTO)/i,
      [/SEXO/i, /NACIONALIDAD/i, /DOCUMENTO/i, /NUMERO/i, /APELLIDOS?/i, /NOMBRES?/i, /DOMICILIO/i]
    );
    const cand = bloque || text;

    // "10 SEP 1998"
    const reMesEsp = /\b(\d{1,2})\s+([A-ZÁÉÍÓÚÑ]{3,})\s+(\d{4})\b/i;
    const m1 = cand.match(reMesEsp);
    if (m1) {
      const d = this.pad2(+m1[1]);
      const m = this.monthEsToNum(m1[2]);
      const y = m1[3];
      if (m) return `${y}-${m}-${d}`;
    }
    // "10/09/1998" o "10-09-1998"
    const m2 = cand.match(/\b(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})\b/);
    if (m2) {
      const d = this.pad2(+m2[1]);
      const m = this.pad2(+m2[2]);
      const y = m2[3];
      return `${y}-${m}-${d}`;
    }
    return null;
    }

  // ========== SEXO ==========
  private extractSexo(text: string): 'M' | 'F' | null {
    const bloque = this.extractBetween(
      text, /SEXO/i,
      [/NACIONALIDAD/i, /F\.?\s*NAC/i, /FECHA/i, /DOCUMENTO/i, /NUMERO/i, /APELLIDOS?/i, /NOMBRES?/i, /DOMICILIO/i]
    ).toUpperCase();
    if (!bloque) return null;

    if (/\bF(EMENINO)?\b/i.test(bloque)) return 'F';
    if (/\bM(ASCULINO)?\b/i.test(bloque)) return 'M';

    const m = bloque.match(/[MF]\b/);
    return m ? (m[0] as 'M'|'F') : null;
  }

  // ===== Utils =====
  private cap(s: string) { return s ? s.toLowerCase().replace(/(^|\s)([a-záéíóúñ])/g, (_,sp,ch)=> sp + ch.toUpperCase()) : s; }
  private pad2(n: number) { return String(n).padStart(2, '0'); }
  private monthEsToNum(token: string): string | null {
    const t = token.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
    const map: Record<string,string> = {
      ENE:'01', ENERO:'01', FEB:'02', FEBRERO:'02', MAR:'03', MARZO:'03', ABR:'04', ABRIL:'04',
      MAY:'05', MAYO:'05', JUN:'06', JUNIO:'06', JUL:'07', JULIO:'07', AGO:'08', AGOSTO:'08',
      SEP:'09', SET:'09', SEPT:'09', SEPTIEMBRE:'09', OCT:'10', OCTUBRE:'10', NOV:'11', NOVIEMBRE:'11',
      DIC:'12', DICIEMBRE:'12'
    };
    return map[t] || null;
  }

  private normalizaRut(v: string) { return (v || '').replace(/\./g, '').replace(/-/g, '').toUpperCase(); }
  private validaRutDV(rut: string): boolean {
    const v = this.normalizaRut(rut);
    if (v.length < 2) return false;
    const cuerpo = v.slice(0, -1);
    const dv = v.slice(-1);
    if (!/^\d+$/.test(cuerpo)) return false;
    let suma = 0, multiplo = 2;
    for (let i = cuerpo.length - 1; i >= 0; i--) {
      suma += parseInt(cuerpo[i], 10) * multiplo;
      multiplo = multiplo === 7 ? 2 : multiplo + 1;
    }
    const resto = 11 - (suma % 11);
    const dvCalc = (resto === 11) ? '0' : (resto === 10) ? 'K' : String(resto);
    return dv.toUpperCase() === dvCalc;
  }
}
