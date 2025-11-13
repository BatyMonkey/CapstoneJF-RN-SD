// src/app/components/chatbot.component.ts
import { Component, OnInit, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';

import { ChatbotService } from '../services/chatbot.service';
import { AuthService, Perfil } from '../auth/auth.service';
import { supabase } from '../core/supabase.client';
import {
  fetchBaseTemplateBytes,
  getMyUserData,
  fillCertificate,
  createCertRecord,
  uploadPdfForRecord,
} from '../core/certificado';
import { environment } from 'src/environments/environment';

interface ChatMessage { from: 'user' | 'bot'; text: string; at: Date; }
interface ChatbotResponse {
  reply: string; command?: string; payload?: any; ask_again?: boolean;
  next_action?: string; intent?: string; summary?: string;
}
interface Noticia {
  id: number; titulo: string; url_foto: string[] | null;
  nombre_autor: string | null; fecha_creacion: string; parrafos: string[] | null;
}

@Component({
  selector: 'app-chatbot',
  standalone: true,
  imports: [CommonModule, FormsModule, IonicModule],
  templateUrl: './chatbot.component.html',
  styleUrls: ['./chatbot.component.scss'],
})
export class ChatbotComponent implements OnInit {
  @Input() startOpen = false;
  visible = false;
  openChat() { this.visible = true; }
  closeChat() { this.visible = false; }
  

  messages: ChatMessage[] = [];
  inputText = '';
  loading = false;

  perfil: Perfil | null = null;
  displayName: string | null = null;
  userId = 'anon';
  communityId: number | string = 0;
  pendingAction: string | null = null;

  private lastVotesCache: any[] = [];
  private lastSpacesCache: any[] = [];
  private lastNewsCache: Noticia[] = [];
  private lastProjectsOnlyCache: any[] = [];
  private lastActivitiesOnlyCache: any[] = [];
  private lastScopeForPostulacion: 'proyectos' | 'actividades' | 'ambos' | null = null;

  private suppressHeuristicsOnce = false;
  private suppressHeuristicsPostOnce = false;
  private suppressHeuristicsListOnce = false;

  private lastUserText = '';
  private certWebhookUrl = (environment as any).N8N_WEBHOOK_URL || '';
  private openaiKeyForN8N: string = (environment as any).OPENAI_KEY_FOR_N8N || '';

  // ====== logger ======
  private dbg(...args: any[]) { console.log('[Chatbot]', ...args); }
  private printSample(tag: string, rows: any[]) {
    if (!rows?.length) { this.dbg(tag, '0 rows'); return; }
    const first = rows[0];
    const preview: any = {};
    Object.keys(first).slice(0, 12).forEach(k => preview[k] = first[k]);
    this.dbg(`${tag} sample[0]:`, preview);
  }

  constructor(private chatbot: ChatbotService, private auth: AuthService) {}

  async ngOnInit() {
    if (this.startOpen) this.visible = true;
    await this.cargarPerfil();

    this.messages = [
      { from: 'bot', text: `Hola ${this.displayName || 'vecino/a'} 👋 soy el asistente de RedBarrio. ¿Qué necesitas?`, at: new Date() },
      { from: 'bot', text: `Puedo ayudarte con <b>certificados</b>, <b>votaciones</b>, <b>noticias</b>, <b>proyectos</b>, <b>actividades</b>, <b>espacios</b> y tus datos.`, at: new Date() },
    ];

    try {
      const { data: { user } } = await supabase.auth.getUser();
      this.dbg('auth.getUser():', user?.id ? { id: user.id, email: (user as any)?.email } : 'ANON');
    } catch (e) {
      this.dbg('auth.getUser() error:', e);
    }
  }

  private async cargarPerfil() {
    try {
      const p = (await this.auth.miPerfil()) as any;
      if (p) {
        this.perfil = p;
        this.userId = p.id_auth || p.user_id || p.id_usuario || 'anon';
        this.displayName = p.nombre || p.primer_nombre || p.full_name || 'vecino/a';
        this.dbg('perfil miPerfil():', { userId: this.userId, displayName: this.displayName });
        return;
      }
      const q = this.auth.getUsuarioForzado?.() as any;
      if (q) {
        this.perfil = q;
        this.userId = q.id_auth || q.user_id || q.id_usuario || 'anon';
        this.displayName = q.nombre || q.primer_nombre || q.full_name || 'vecino/a';
        this.dbg('perfil getUsuarioForzado():', { userId: this.userId, displayName: this.displayName });
        return;
      }
      this.perfil = null; this.userId = 'anon'; this.displayName = 'vecino/a';
      this.dbg('sin perfil (anon)');
    } catch (e) {
      this.perfil = null; this.userId = 'anon'; this.displayName = 'vecino/a';
      this.dbg('cargarPerfil() error:', e);
    }
  }

  // ===== Quick buttons =====
  clickQuick(kind: 'faq' | 'cert' | 'votacion' | 'noticias') {
    if (kind === 'faq') {
      this.pushBot('Puedes pedirme: ver noticias, ver proyectos, ver actividades, ver votaciones, ver espacios, o sacar certificado 👌');
      return;
    }
    if (kind === 'cert') {
      const text = 'Quiero un certificado de residencia';
      this.pushUser(text);
      this.sendTextToBot(text);
      return;
    }
    if (kind === 'votacion') {
      const text = '¿Qué votaciones hay activas?';
      this.pushUser(text);
      this.sendTextToBot(text);
      return;
    }
    if (kind === 'noticias') {
      const text = 'ver noticias';
      this.pushUser(text);
      this.sendTextToBot(text);
      return;
    }
  }

  // ===== Input =====
    // ===== Input =====
  send() {
    const text = this.inputText.trim();
    if (!text) return;

    this.lastUserText = text;
    this.pushUser(text);

    const low = text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();

    // ===== atajos directos (listados desde la app, sin pasar por n8n) =====

    // Noticias
    if (
      low.includes('ver noticias') ||
      low === 'noticias' ||
      low.includes('ultimas noticias') ||
      low.includes('últimas noticias')
    ) {
      this.inputText = '';
      this.listarNoticiasDesdeChat();
      return;
    }

    // Espacios
    if (
      low.includes('ver espacios') ||
      low.includes('espacios disponibles') ||
      low.includes('espacios comunitarios')
    ) {
      this.inputText = '';
      this.listarEspaciosDesdeChat();
      return;
    }

    // Actividades
    if (
      (low.includes('ver actividades') && !low.includes('proyectos')) ||
      low === 'actividades'
    ) {
      this.inputText = '';
      this.listarProyectosOActividadesDesdeChat('actividades');
      return;
    }

    // Votaciones activas
    const askActiveVotes =
      low.includes('votaciones activas') ||
      low.includes('ver votaciones') ||
      low.includes('hay votaciones') ||
      low.includes('votaciones disponibles') ||
      (low.includes('votar') && low.includes('activa'));

    if (askActiveVotes) {
      this.inputText = '';
      // texto similar al de n8n
      this.pushBot('Estas son las votaciones activas (te muestro un resumen):');
      this.listarVotacionesDesdeChat();
      return;
    }

    // ===== manejos locales por ordinal (resumen y mensaje) =====
    const handledResumen = this.tryLocalOrdinalActions(text);
    const handledPost   = this.tryLocalPostulacionActions(text);

    this.inputText = '';

    // Si no era resumen/mensaje por número, lo mandamos a n8n (certificados, FAQ, etc.)
    if (!handledResumen && !handledPost) {
      this.sendTextToBot(text);
    }
  }


  private tryLocalOrdinalActions(text: string): boolean {
    const t = text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
    let m = t.match(/\bresumen(?:\s+de\s+la|\s+de|\s+)\s*(\d+)\b/);
    if (!m) m = t.match(/\bdetalle(?:\s+de\s+la|\s+de|\s+)\s*(\d+)\b/);
    if (m?.[1]) {
      const ord = Number(m[1]);
      if (Number.isFinite(ord) && ord > 0) {
        this.dbg('resumen/detalle ordinal (local):', ord);
        this.resumirNoticiaPorOrdinal(ord);
        return true;
      }
    }
    return false;
  }

  private tryLocalPostulacionActions(text: string): boolean {
    const t = text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
    const m = t.match(/\b(mensaje|postulacion|postulación)\s*(?:de|para)?\s*(?:la\s*)?(\d+)\b/);
    if (m?.[2]) {
      const ord = Number(m[2]);
      let hintScope: 'proyecto' | 'actividad' | undefined = undefined;
      if (t.includes('proyecto')) hintScope = 'proyecto';
      if (t.includes('actividad')) hintScope = 'actividad';
      this.dbg('postulación ordinal (local):', { ord, hintScope });
      this.sugerirPostulacionPorOrdinal(ord, hintScope);
      return true;
    }
    return false;
  }

  // ===== IA =====
  private sendTextToBot(text: string) {
    this.loading = true;
    const body = {
      user_id: this.userId,
      community_id: this.communityId,
      message: text,
      thread_id: `chat-${this.communityId}-${this.userId}`,
      perfil: this.perfil,
      pending_action: this.pendingAction,
    };

    this.dbg('-> sendMessage body:', body);

    this.chatbot.sendMessage(body).subscribe({
      next: (res: ChatbotResponse) => {
        this.loading = false;
        this.dbg('<- IA response:', res);

        const replyText = res.reply || 'No pude responder 😅';
        this.pushBot(replyText);

        // guardar próxima acción (para certificados, etc.)
        this.pendingAction = res.next_action ?? null;

        // comandos especiales (listar, resumen ordinal, postulación ordinal, certificado…)
        if (this.handleByCommand(res)) return;

        // heurísticas solo si no hubo comando
        this.handleByReplyHeuristics(replyText);
      },
      error: (e) => {
        this.dbg('sendMessage error:', e);
        this.pushBot('Ocurrió un error hablando con el asistente.');
        this.loading = false;
      },
    });
  }

  private handleByCommand(res: ChatbotResponse): boolean {
    switch (res.command) {
      case 'GENERAR_CERTIFICADO_RESIDENCIA':
        this.dbg('cmd: GENERAR_CERTIFICADO_RESIDENCIA');
        this.suppressHeuristicsOnce = true;
        this.emitirCertificadoDesdeChat(); return true;
      case 'LISTAR_VOTACIONES_ACTIVAS':
        this.dbg('cmd: LISTAR_VOTACIONES_ACTIVAS');
        this.suppressHeuristicsListOnce = true; this.listarVotacionesDesdeChat(); return true;
      case 'LISTAR_ESPACIOS':
        this.dbg('cmd: LISTAR_ESPACIOS');
        this.suppressHeuristicsListOnce = true; this.listarEspaciosDesdeChat(); return true;
      case 'LISTAR_NOTICIAS':
        this.dbg('cmd: LISTAR_NOTICIAS');
        this.suppressHeuristicsListOnce = true; this.listarNoticiasDesdeChat(); return true;
      case 'LISTAR_PROYECTOS':
        this.dbg('cmd: LISTAR_PROYECTOS');
        this.suppressHeuristicsListOnce = true; this.lastScopeForPostulacion = 'proyectos';
        this.listarProyectosOActividadesDesdeChat('proyectos'); return true;
      case 'LISTAR_ACTIVIDADES':
        this.dbg('cmd: LISTAR_ACTIVIDADES');
        this.suppressHeuristicsListOnce = true; this.lastScopeForPostulacion = 'actividades';
        this.listarProyectosOActividadesDesdeChat('actividades'); return true;
      case 'LISTAR_PROYECTOS_Y_ACTIVIDADES':
        this.dbg('cmd: LISTAR_PROYECTOS_Y_ACTIVIDADES');
        this.suppressHeuristicsListOnce = true; this.lastScopeForPostulacion = 'ambos';
        this.listarProyectosOActividadesDesdeChat('ambos'); return true;
      case 'RESUMIR_NOTICIA_ORDINAL': {
        const ord = Number(res?.payload?.ord ?? 0);
        this.dbg('cmd: RESUMIR_NOTICIA_ORDINAL', ord);
        this.suppressHeuristicsOnce = true; this.resumirNoticiaPorOrdinal(ord); return true;
      }
      case 'SUGERIR_POSTULACION_ORDINAL': {
        const ord = Number(res?.payload?.ord ?? 0);
        const scope = res?.payload?.scope as ('proyecto' | 'actividad' | undefined);
        this.dbg('cmd: SUGERIR_POSTULACION_ORDINAL', { ord, scope });
        this.suppressHeuristicsPostOnce = true; this.sugerirPostulacionPorOrdinal(ord, scope); return true;
      }
    }
    return false;
  }

  private handleByReplyHeuristics(replyText: string) {
    if (this.suppressHeuristicsListOnce) { this.dbg('heurística list suprimida'); this.suppressHeuristicsListOnce = false; return; }
    if (this.suppressHeuristicsOnce) { this.dbg('heurística resumen suprimida'); this.suppressHeuristicsOnce = false; return; }
    if (this.suppressHeuristicsPostOnce) { this.dbg('heurística postulación suprimida'); this.suppressHeuristicsPostOnce = false; return; }

    const low = replyText.toLowerCase();

    if (
      low.includes('te lo envío') || low.includes('te lo envio') ||
      low.includes('ya te lo envié') || low.includes('ya te lo envie') ||
      low.includes('enviar certificado') || low.includes('envío del certificado') ||
      (low.includes('listo') && (low.includes('envi') || low.includes('certificado')))
    ) { this.dbg('heurística → emitir certificado'); this.suppressHeuristicsOnce = true; this.emitirCertificadoDesdeChat(); return; }

    if (low.includes('últimas noticias') || (low.includes('estas son') && low.includes('noticias'))) { this.dbg('heurística → noticias'); this.suppressHeuristicsListOnce = true; this.listarNoticiasDesdeChat(); return; }
    if (low.includes('proyectos más recientes') || (low.includes('estos son') && low.includes('proyectos')) || low.includes('solo proyectos')) { this.dbg('heurística → proyectos'); this.suppressHeuristicsListOnce = true; this.listarProyectosOActividadesDesdeChat('proyectos'); return; }
    if (low.includes('actividades más recientes') || (low.includes('estas son') && low.includes('actividades')) || low.includes('solo actividades')) { this.dbg('heurística → actividades'); this.suppressHeuristicsListOnce = true; this.listarProyectosOActividadesDesdeChat('actividades'); return; }
    if (low.includes('proyectos y actividades') || low.includes('proyectos/actividades')) { this.dbg('heurística → ambos'); this.suppressHeuristicsListOnce = true; this.listarProyectosOActividadesDesdeChat('ambos'); return; }
    if (low.includes('votaciones activas') || (low.includes('estas son') && low.includes('votaciones'))) { this.dbg('heurística → votaciones'); this.suppressHeuristicsListOnce = true; this.listarVotacionesDesdeChat(); return; }
    if (low.includes('espacios disponibles') || (low.includes('estos son') && low.includes('espacios'))) { this.dbg('heurística → espacios'); this.suppressHeuristicsListOnce = true; this.listarEspaciosDesdeChat(); return; }

    let m = low.match(/\bresumen(?:\s+de\s+la|\s+de|\s+)\s*(\d+)\b/) || low.match(/\bdetalle(?:\s+de\s+la|\s+de|\s+)\s*(\d+)\b/);
    if (!m && this.lastUserText) {
      const u = this.lastUserText.toLowerCase();
      m = u.match(/\bresumen(?:\s+de\s+la|\s+de|\s+)\s*(\d+)\b/) || u.match(/\bdetalle(?:\s+de\s+la|\s+de|\s+)\s*(\d+)\b/);
    }
    if (m?.[1]) { const ord = Number(m[1]); if (Number.isFinite(ord) && ord > 0) { this.dbg('heurística → resumen ordinal', ord); this.suppressHeuristicsOnce = true; this.resumirNoticiaPorOrdinal(ord); return; } }

    let pm = low.match(/\b(mensaje|postulacion|postulación).*(?:#|n[°º]?\s*|de\s+la\s+|de\s+|para\s+la\s+|para\s+)?\s*(\d+)\b/);
    if (!pm && this.lastUserText) {
      const u = this.lastUserText.toLowerCase();
      pm = u.match(/\b(mensaje|postulacion|postulación).*(?:#|n[°º]?\s*|de\s+la\s+|de\s+|para\s+la\s+|para\s+)?\s*(\d+)\b/);
    }
    if (pm?.[2]) { const ord = Number(pm[2]); if (Number.isFinite(ord) && ord > 0) { this.dbg('heurística → postulación ordinal', ord); this.suppressHeuristicsPostOnce = true; this.sugerirPostulacionPorOrdinal(ord, undefined); return; } }
  }

  // ===== Helpers SELECT y orden =====
  private async trySelect(tableNames: string[], select = '*') {
    for (const name of tableNames) {
      this.dbg('trySelect →', name, 'select:', select);
      const { data, error } = await supabase.from(name).select(select);
      if (error) {
        this.dbg('trySelect error', { table: name, error });
      } else {
        this.dbg('trySelect ok', { table: name, count: data?.length ?? 0 });
        if (data && data.length) return data;
      }
    }
    return [];
  }
  private sortByKnownDates(rows: any[], keys: string[]) {
    return [...rows].sort((a, b) => {
      const fa = keys.map(k => a?.[k]).find(Boolean);
      const fb = keys.map(k => b?.[k]).find(Boolean);
      const da = fa ? new Date(fa).getTime() : 0;
      const db = fb ? new Date(fb).getTime() : 0;
      return db - da;
    });
  }

  // ===== Certificado =====
  private async emitirCertificadoDesdeChat() {
    if (!this.certWebhookUrl) { this.pushBot('No tengo configurado el webhook de certificados en la app 😅'); return; }
    try {
      const who = await getMyUserData().catch(() => null as any);
      const { data: { user } = { user: null } } = await supabase.auth.getUser().catch(() => ({ data: { user: null } } as any));

      const correoDestino =
        (who && (who.correo || who.email)) ||
        (this.perfil && (this.perfil as any).correo) ||
        (this.perfil && (this.perfil as any).email) ||
        (user && user.email) || '';

      if (!correoDestino) { this.pushBot('No encontré tu correo registrado 😅. Ve a “Mi perfil” y guárdalo primero.'); return; }

      this.pushBot('Ok, lo estoy generando… ⏳');

      const baseMeta = { ...(who || {}), destino_presentacion: '', fecha_emision: new Date().toISOString(), render: 'pdf-lib' };
      const { id } = await createCertRecord(baseMeta);

      const baseBytes = await fetchBaseTemplateBytes();
      const rawVars = this.buildVarsFromWho(who); (rawVars as any).folio = String(id);
      const vars = this.sanitizeVars(rawVars);
      const blob = await fillCertificate(baseBytes, vars);
      const { pdf_url } = await uploadPdfForRecord(id, blob);

      const res = await fetch(this.certWebhookUrl, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: correoDestino, subject: 'Certificado emitido', pdf_url, filename: `certificado-${id}.pdf` }),
      });

      if (!res.ok) { this.pushBot('No pude enviar el certificado 😅 (n8n respondió error).'); return; }
      this.pushBot('Listo ✅ ya te lo envié por correo.');
    } catch (err: any) {
      this.pushBot(err?.message || 'Hubo un error al generar el certificado 😅');
    }
  }

  // ===== Votaciones =====
  private async listarVotacionesDesdeChat() {
    try {
      let items = await this.trySelect(['votaciones', 'votacion'], '*');
      this.dbg('votaciones len:', items?.length ?? 0);
      this.printSample('votaciones', items);
      items = (items || []).filter((v: any) => (v.estado || '').toLowerCase() === 'activa');
      items = this.sortByKnownDates(items, ['fecha_fin', 'actualizado_en', 'creado_en']);
      this.lastVotesCache = items;

      if (!items.length) { this.pushBot('No hay votaciones activas en este momento.'); return; }

      const lines = items.slice(0, 5).map((v: any, i: number) => {
        const fin = v.fecha_fin ? new Date(v.fecha_fin).toLocaleString() : '—';
        return `${i + 1}. <b>${v.titulo || 'Sin título'}</b> (hasta ${fin})`;
      });
      this.pushBot(`👉<br>${lines.join('<br>')}<br><i>Di, por ejemplo: “abrir votación 1”.</i>`);
    } catch (e) { this.dbg('listarVotacionesDesdeChat error:', e); this.pushBot('No pude listar las votaciones 😅'); }
  }

  // ===== Espacios =====
  private async listarEspaciosDesdeChat() {
    try {
      this.dbg('listarEspaciosDesdeChat → inicio');
      let items = await this.trySelect(['espacio', 'espacios'], '*');
      this.dbg('espacios len (antes de ordenar):', items?.length ?? 0);
      this.printSample('espacios', items);

      items = this.sortByKnownDates(items, ['actualizado_en', 'creado_en']);
      this.lastSpacesCache = items;

      if (!items.length) { this.pushBot('No hay espacios registrados aún.'); return; }

      const lines = items.slice(0, 6).map((e: any, i: number) => {
        const cap = e.capacidad ? ` • Capacidad: ${e.capacidad}` : '';
        const dir = e.direccion_completa ? ` • ${e.direccion_completa}` : '';
        return `${i + 1}. <b>${e.nombre || 'Sin nombre'}</b>${cap}${dir}`;
      });
      this.pushBot(`🏢<br>${lines.join('<br>')}<br><i>Para reservar, ve a “Arrendar espacio”.</i>`);
    } catch (e) { this.dbg('listarEspaciosDesdeChat error:', e); this.pushBot('No pude listar los espacios 😅'); }
  }

  // ===== Proyectos / Actividades =====
  private async listarProyectosOActividadesDesdeChat(scope: 'proyectos' | 'actividades' | 'ambos') {
    try {
      this.dbg('listarProyectosOActividadesDesdeChat → scope:', scope);
      this.lastScopeForPostulacion = scope;

      if (scope === 'proyectos') {
        let items = await this.trySelect(['proyecto', 'proyectos'], '*');
        this.dbg('proyectos len:', items?.length ?? 0);
        this.printSample('proyectos', items);

        items = this.sortByKnownDates(items, ['fecha_creacion', 'actualizado_en']);
        this.lastProjectsOnlyCache = items;

        if (!items.length) { this.pushBot('No hay proyectos publicados todavía.'); return; }

        const lines = items.slice(0, 8).map((p: any, i: number) =>
          `${i + 1}. <b>${p.titulo || p.nombre || 'Sin título'}</b> — proyecto`
        );
        this.pushBot(`📌 Proyectos:<br>${lines.join('<br>')}<br><i>Di “mensaje de la 1/2/3…” para que la IA redacte tu postulación.</i>`);
        return;
      }

      if (scope === 'actividades') {
        let items = await this.trySelect(['actividad', 'actividades'], '*');
        this.dbg('actividades len:', items?.length ?? 0);
        this.printSample('actividades', items);

        items = this.sortByKnownDates(items, ['creado_en', 'fecha_inicio', 'actualizado_en']);
        this.lastActivitiesOnlyCache = items;

        if (!items.length) { this.pushBot('No hay actividades publicadas todavía.'); return; }

        const lines = items.slice(0, 8).map((a: any, i: number) =>
          `${i + 1}. <b>${a.titulo || a.nombre || 'Sin título'}</b> — actividad`
        );
        this.pushBot(`🗓️ Actividades:<br>${lines.join('<br>')}<br><i>Di “mensaje de la 1/2/3…” para que la IA redacte tu postulación.</i>`);
        return;
      }

      // ambos
      const proy = await this.trySelect(['proyecto', 'proyectos'], '*');
      const act  = await this.trySelect(['actividad', 'actividades'], '*');
      this.dbg('ambos → proy len:', proy?.length ?? 0, 'act len:', act?.length ?? 0);
      this.printSample('ambos-proyectos', proy || []);
      this.printSample('ambos-actividades', act || []);

      const proyectos = (proy || []).map((p: any) => ({
        ...p,
        tipo: 'proyecto',
        fecha: p.fecha_creacion || p.actualizado_en || new Date().toISOString(),
      }));
      const actividades = (act || []).map((a: any) => ({
        ...a,
        tipo: 'actividad',
        fecha: a.creado_en || a.fecha_inicio || a.actualizado_en || new Date().toISOString(),
      }));

      this.lastProjectsOnlyCache = proyectos;
      this.lastActivitiesOnlyCache = actividades;

      const elementos = [...proyectos, ...actividades].sort(
        (a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime()
      );

      if (!elementos.length) { this.pushBot('No hay proyectos ni actividades publicados todavía.'); return; }

      const lines = elementos.slice(0, 8).map((e: any, i: number) =>
        `${i + 1}. <b>${e.titulo || e.nombre || 'Sin título'}</b> — ${e.tipo}`
      );
      this.pushBot(`📋 Proyectos y Actividades:<br>${lines.join('<br>')}<br><i>Di “mensaje de la 1/2/3…” para que la IA redacte tu postulación.</i>`);
    } catch (e) { this.dbg('listarProyectosOActividadesDesdeChat error:', e); this.pushBot('No pude listar los proyectos/actividades 😅'); }
  }

  // ===== Noticias (IA resumida, usando menú y cache) =====
  private async listarNoticiasDesdeChat() {
    try {
      const { data, error } = await supabase
        .from('noticias')
        .select('id, titulo, url_foto, nombre_autor, fecha_creacion, parrafos');

      if (error) this.dbg('noticias error:', error);
      this.dbg('noticias len:', data?.length ?? 0);
      this.printSample('noticias', data || []);

      const list = (data ?? []) as Noticia[];
      this.lastNewsCache = list;

      if (!list.length) { this.pushBot('No hay noticias publicadas por ahora.'); return; }

      const lines = list.slice(0, 5).map((n, i) => {
        const fecha = n.fecha_creacion ? new Date(n.fecha_creacion).toLocaleDateString() : '';
        return `${i + 1}. <b>${n.titulo || 'Sin título'}</b> ${fecha ? `(${fecha})` : ''}`;
      });
      this.pushBot(`📰 Últimas noticias:<br>${lines.join('<br>')}<br><i>Pide “resumen de la 1” o “detalle de la 2”.</i>`);
    } catch (e) { this.dbg('listarNoticiasDesdeChat error:', e); this.pushBot('No pude listar las noticias 😅'); }
  }

  private async resumirNoticiaPorOrdinal(ord: number) {
    const idx = ord - 1;
    if (idx < 0 || idx >= this.lastNewsCache.length) {
      this.pushBot('No ubico esa posición en la lista. Pide “ver noticias” primero 😉');
      return;
    }

    const n = this.lastNewsCache[idx];
    const titulo = n.titulo || 'Sin título';
    const texto = (n.parrafos || []).join('\n\n').trim();

    if (!texto) {
      this.pushBot('No tengo el contenido completo de esa noticia 😅. Vuelve a intentar más tarde.');
      return;
    }

    this.pushBot(`📰 Preparando resumen de <b>${titulo}</b>…`);

    const payload = {
      user_id: this.userId,
      community_id: this.communityId,
      thread_id: `chat-${this.communityId}-${this.userId}`,
      message: '[RESUMIR_NOTICIA]',
      perfil: this.perfil,
      news_doc: { id: n.id, titulo, texto },
      openai_key: this.openaiKeyForN8N || '',
    };

    this.chatbot.sendMessage(payload).subscribe({
      next: (res: ChatbotResponse) => {
        this.dbg('resumen noticia IA response:', res);
        const full = (res.summary || res.reply || '').trim();
        const html = full ? full.replace(/\n/g, '<br>') : 'No pude generar el resumen 😅';

        this.pushBot(`<b>${titulo}</b><br>${html}`);
        this.suppressHeuristicsOnce = true;
      },
      error: (err) => {
        this.dbg('resumen IA error:', err);
        this.pushBot('No pude generar el resumen 😅');
      },
    });
  }

  // ===== Postulación (IA usando ítem del menú) =====
  private sugerirPostulacionPorOrdinal(ord: number, hintScope?: 'proyecto' | 'actividad') {
    const scope = this.lastScopeForPostulacion || 'ambos';
    const idx = ord - 1;
    let item: any | null = null;
    let tipo: 'proyecto' | 'actividad' = 'proyecto';

    if (hintScope === 'proyecto') {
      if (idx >= 0 && idx < this.lastProjectsOnlyCache.length) {
        item = this.lastProjectsOnlyCache[idx];
        tipo = 'proyecto';
      }
    } else if (hintScope === 'actividad') {
      if (idx >= 0 && idx < this.lastActivitiesOnlyCache.length) {
        item = this.lastActivitiesOnlyCache[idx];
        tipo = 'actividad';
      }
    } else {
      if (scope === 'proyectos' && idx < this.lastProjectsOnlyCache.length) {
        item = this.lastProjectsOnlyCache[idx];
        tipo = 'proyecto';
      } else if (scope === 'actividades' && idx < this.lastActivitiesOnlyCache.length) {
        item = this.lastActivitiesOnlyCache[idx];
        tipo = 'actividad';
      } else if (idx < this.lastProjectsOnlyCache.length) {
        item = this.lastProjectsOnlyCache[idx];
        tipo = 'proyecto';
      } else if (idx < this.lastActivitiesOnlyCache.length) {
        item = this.lastActivitiesOnlyCache[idx];
        tipo = 'actividad';
      }
    }

    if (!item) {
      this.pushBot('No ubico esa posición. Pide “ver proyectos” o “ver actividades” primero 😉');
      return;
    }

    const post_doc = {
      tipo,
      titulo: item.titulo || item.nombre || (tipo === 'proyecto' ? 'Proyecto' : 'Actividad'),
      descripcion: item.descripcion || item.detalle || '',
      requisitos: item.requisitos || item.req || '',
      fecha:
        (tipo === 'proyecto'
          ? (item.fecha_creacion || item.actualizado_en)
          : (item.fecha_inicio || item.creado_en || item.actualizado_en)
        ) || '',
      organizador: item.organizador || item.creado_por || 'la organización',
      cupos_total: item.cupos_total || item.cupos || null,
      estado: item.estado || null,
      id: item.id_proyecto || item.id_actividad || item.id,
    };

    this.dbg('sugerirPostulacionPorOrdinal post_doc:', post_doc);

    const placeholder = `Preparando mensaje de postulación para el ítem #${ord}…`;
    this.pushBot(placeholder);

    const payload = {
      user_id: this.userId,
      community_id: this.communityId,
      thread_id: `chat-${this.communityId}-${this.userId}`,
      message: '[POSTULACION_IA]',
      perfil: this.perfil,
      post_doc,
      openai_key: this.openaiKeyForN8N || '',
    };

    this.chatbot.sendMessage(payload).subscribe({
      next: (res: ChatbotResponse) => {
        this.dbg('postulación IA response:', res);

        const full = (res.summary || res.reply || '').trim();
        if (full) {
          const html = full.replace(/\n/g, '<br>');
          this.pushBot(html);
        } else {
          this.pushBot('No pude generar el mensaje de postulación 😅');
        }

        this.suppressHeuristicsPostOnce = true;
      },
      error: (err) => {
        this.dbg('postulación IA error:', err);
        this.pushBot('No pude generar el mensaje de postulación 😅');
      },
    });
  }

  // ===== helpers varios =====
  private buildVarsFromWho(who: any) {
    const now = new Date();
    const nombre =
      this.nombreCompleto(who?.primer_nombre, who?.segundo_nombre, who?.primer_apellido, who?.segundo_apellido) ||
      who?.full_name || who?.nombre || '';
    return {
      nombre_completo: nombre,
      rut: this.normalizaRut(who?.rut || who?.run || ''),
      direccion: who?.direccion || who?.address || '',
      destino_presentacion: '',
      dia_emision: now.getDate(),
      mes_emision: this.monthNameEs(now.getMonth()),
      anio_emision: now.getFullYear(),
    };
  }
  private sanitizeStr(s: any): string {
    const v = s == null ? '' : String(s);
    let out = v.normalize('NFC'); out = out.replace(/\p{M}/gu, ''); out = out.replace(/[\u200B-\u200D\uFEFF]/g, ''); return out;
  }
  private sanitizeVars<T extends Record<string, any>>(o: T): T {
    const out: any = {}; for (const k of Object.keys(o)) out[k] = typeof o[k] === 'string' ? this.sanitizeStr(o[k]) : o[k]; return out as T;
  }
  private nombreCompleto(pn?: string|null, sn?: string|null, pa?: string|null, sa?: string|null) {
    return [pn, sn, pa, sa].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
  }
  private monthNameEs(m: number) { return ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'][m]; }
  private normalizaRut(rut: string) {
    if (!rut) return rut; const clean = rut.replace(/[^0-9kK]/g, '').toUpperCase(); if (clean.length < 2) return rut;
    const dv = clean.slice(-1); const num = clean.slice(0, -1); let out = ''; let i = 0;
    for (let j = num.length - 1; j >= 0; j--) { out = num[j] + out; i++; if (i === 3 && j > 0) { out = '.' + out; i = 0; } }
    return `${out}-${dv}`;
  }
  private pushBot(text: string) { this.messages.push({ from: 'bot', text, at: new Date() }); }
  private pushUser(text: string) { this.messages.push({ from: 'user', text, at: new Date() }); }
}
