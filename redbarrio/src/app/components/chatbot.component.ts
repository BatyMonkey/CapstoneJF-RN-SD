import { Component, OnInit, Input } from '@angular/core';
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

interface ChatMessage {
  from: 'user' | 'bot';
  text: string;
  at: Date;
}

interface ChatbotResponse {
  reply: string;
  command?: string;
  payload?: any;
  ask_again?: boolean;
  next_action?: string;
  intent?: string;
  summary?: string;
}

interface Noticia {
  id: number;
  titulo: string;
  url_foto: string[] | null;
  nombre_autor: string | null;
  fecha_creacion: string;
  parrafos: string[] | null;
}

@Component({
  selector: 'app-chatbot',
  standalone: true,
  imports: [CommonModule, FormsModule, IonicModule],
  templateUrl: './chatbot.component.html',
  styleUrls: ['./chatbot.component.scss'],
})
export class ChatbotComponent implements OnInit {
  // ====== FIX: estado de visibilidad requerido por tu HTML ======
  @Input() startOpen = false;
  visible = false; // ← usado en *ngIf del HTML
  openChat() {
    this.visible = true;
  } // ← para el botón flotante
  closeChat() {
    this.visible = false;
  } // ← para el botón "Cerrar"

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

  // Noticias
  private lastNewsCache: Noticia[] = [];

  // Proyectos / Actividades
  private lastProjectsOnlyCache: any[] = [];
  private lastActivitiesOnlyCache: any[] = [];
  private lastScopeForPostulacion:
    | 'proyectos'
    | 'actividades'
    | 'ambos'
    | null = null;

  // Cortafuegos de heurísticas
  private suppressHeuristicsOnce = false; // resumen noticia
  private suppressHeuristicsPostOnce = false; // mensaje de postulación
  private suppressHeuristicsListOnce = false; // evita doble listado (noticias/proyectos/actividades)

  private lastUserText = '';
  private certWebhookUrl = (environment as any).N8N_WEBHOOK_URL || '';
  private openaiKeyForN8N: string =
    (environment as any).OPENAI_KEY_FOR_N8N || '';

  constructor(private chatbot: ChatbotService, private auth: AuthService) {
    console.log('🧩 ChatbotComponent constructor ejecutado');

    // 👇 ESTE DEBE IR AQUÍ, NO EN ngOnInit()
    window.addEventListener('toggle-chatbot', () => {
      this.visible = !this.visible;
      console.log('🤖 Chatbot Toggled → visible =', this.visible);
    });
  }

  async ngOnInit() {
    console.log('🚀 ChatbotComponent → ngOnInit ejecutado');
    console.log('startOpen (recibido desde Home) =', this.startOpen);

    // ======================================================
    // 🛑 Escucha el evento global para abrir/cerrar chatbot
    // ======================================================

    // ======================================================
    // Lógica existente (NO se toca)
    // ======================================================
    if (this.startOpen) {
      this.visible = true;
      console.log('✅ visible = true (desde ngOnInit)');
    } else {
      console.log('❌ startOpen es FALSE, no se mostrará el chat');
    }

    await this.cargarPerfil();
    console.log('🟢 Perfil cargado, visible =', this.visible);

    // ====== FIX: abrir si viene desde input ======
    if (this.startOpen) this.visible = true;

    await this.cargarPerfil();

    this.messages = [
      {
        from: 'bot',
        text: `Hola ${
          this.displayName || 'vecino/a'
        } 👋 soy el asistente de RedBarrio. ¿Qué necesitas?`,
        at: new Date(),
      },
      {
        from: 'bot',
        text: `Puedo ayudarte solo con cosas de <b>RedBarrio</b> (certificados, votaciones, noticias, <b>proyectos</b>, <b>actividades</b>, espacios y datos de tu cuenta).`,
        at: new Date(),
      },
    ];
  }

  private async cargarPerfil() {
    try {
      const perfil = await this.auth.miPerfil();
      if (perfil) {
        this.perfil = perfil;
        const pAny = perfil as any;
        this.userId = pAny.id_auth || pAny.user_id || pAny.id_usuario || 'anon';
        this.displayName =
          pAny.nombre ||
          pAny.primer_nombre ||
          (pAny as any).full_name ||
          'vecino/a';
        console.log('[Chatbot] perfil desde auth.miPerfil():', perfil);
        return;
      }

      const perfilLocal = this.auth.getUsuarioForzado?.();
      if (perfilLocal) {
        this.perfil = perfilLocal as any;
        const pAny = perfilLocal as any;
        this.userId = pAny.id_auth || pAny.user_id || pAny.id_usuario || 'anon';
        this.displayName =
          pAny.nombre ||
          pAny.primer_nombre ||
          (pAny as any).full_name ||
          'vecino/a';
        console.log('[Chatbot] perfil desde getUsuarioForzado():', perfilLocal);
        return;
      }

      this.perfil = null;
      this.userId = 'anon';
      this.displayName = 'vecino/a';
      console.log('[Chatbot] sin perfil (anon)');
    } catch (e) {
      console.warn('[Chatbot] no pude cargar perfil:', e);
      this.perfil = null;
      this.userId = 'anon';
      this.displayName = 'vecino/a';
    }
  }

  // ====== QUICK BUTTONS ======
  clickQuick(kind: 'faq' | 'cert' | 'votacion' | 'noticias') {
    if (kind === 'faq') {
      this.pushBot(
        'Puedes preguntarme por certificados, votaciones activas, noticias, proyectos, actividades, espacios y tus datos básicos 👌'
      );
      return;
    }
    if (kind === 'cert') {
      this.pushUser('Quiero un certificado de residencia');
      this.sendTextToBot('Quiero un certificado de residencia');
      return;
    }
    if (kind === 'votacion') {
      this.pushUser('¿Qué votaciones hay activas?');
      this.sendTextToBot('¿Qué votaciones hay activas?');
      return;
    }
    if (kind === 'noticias') {
      this.pushUser('ver noticias');
      this.sendTextToBot('ver noticias');
      return;
    }
  }

  // ====== INPUT ======
  send() {
    const text = this.inputText.trim();
    if (!text) return;
    this.lastUserText = text;
    this.pushUser(text);

    // pre-intents locales
    if (this.tryLocalOrdinalActions(text)) {
      console.log(
        '[Chatbot] (pre-intent) disparé acción local por ordinal (resumen noticia)'
      );
    }
    if (this.tryLocalPostulacionActions(text)) {
      console.log(
        '[Chatbot] (pre-intent) disparé acción local por ordinal (postulación)'
      );
    }

    this.inputText = '';
    this.sendTextToBot(text);
  }

  private tryLocalOrdinalActions(text: string): boolean {
    const t = text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();
    let m = t.match(/\bresumen(?:\s+de\s+la|\s+de|\s+)\s*(\d+)\b/);
    if (!m) m = t.match(/\bdetalle(?:\s+de\s+la|\s+de|\s+)\s*(\d+)\b/);
    if (m && m[1]) {
      const ord = Number(m[1]);
      if (Number.isFinite(ord) && ord > 0) {
        console.log(
          '[Chatbot] tryLocalOrdinalActions → resumen/detalle ordinal =',
          ord
        );
        this.resumirNoticiaPorOrdinal(ord);
        return true;
      }
    }
    return false;
  }

  private tryLocalPostulacionActions(text: string): boolean {
    const t = text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();
    const m = t.match(
      /\b(mensaje|postulacion|postulación)\s*(?:de|para)?\s*(?:la\s*)?(\d+)\b/
    );
    if (m && m[2]) {
      const ord = Number(m[2]);
      let hintScope: 'proyecto' | 'actividad' | undefined = undefined;
      if (t.includes('proyecto')) hintScope = 'proyecto';
      if (t.includes('actividad')) hintScope = 'actividad';
      console.log(
        '[Chatbot] tryLocalPostulacionActions → ord=',
        ord,
        'hintScope=',
        hintScope
      );
      this.sugerirPostulacionPorOrdinal(ord, hintScope);
      return true;
    }
    return false;
  }

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

    console.log('[Chatbot] -> envío al webhook de IA:', body);

    this.chatbot.sendMessage(body).subscribe({
      next: (res: ChatbotResponse) => {
        this.loading = false;
        console.log('[Chatbot] <- respuesta de IA (n8n):', res);

        const replyText = res.reply || 'No pude responder 😅';
        this.pushBot(replyText);

        if (res.next_action) {
          console.log('[Chatbot] pending_action =', res.next_action);
          this.pendingAction = res.next_action;
        } else {
          this.pendingAction = null;
        }

        const handled = this.handleByCommand(res);
        if (handled) return;

        this.handleByReplyHeuristics(replyText);
      },
      error: (err) => {
        console.error('[Chatbot] Error llamando al webhook de IA:', err);
        this.pushBot('Ocurrió un error hablando con el asistente.');
        this.loading = false;
      },
    });
  }

  private handleByCommand(res: ChatbotResponse): boolean {
    switch (res.command) {
      case 'GENERAR_CERTIFICADO_RESIDENCIA':
        console.log('[Chatbot] comando: emitir certificado');
        this.emitirCertificadoDesdeChat();
        return true;

      case 'LISTAR_VOTACIONES_ACTIVAS':
        console.log('[Chatbot] comando: listar votaciones');
        this.suppressHeuristicsListOnce = true;
        this.listarVotacionesDesdeChat();
        return true;

      case 'LISTAR_ESPACIOS':
        console.log('[Chatbot] comando: listar espacios');
        this.suppressHeuristicsListOnce = true;
        this.listarEspaciosDesdeChat();
        return true;

      case 'LISTAR_NOTICIAS':
        console.log('[Chatbot] comando: listar noticias');
        this.suppressHeuristicsListOnce = true;
        this.listarNoticiasDesdeChat();
        return true;

      case 'LISTAR_PROYECTOS':
        console.log('[Chatbot] comando: listar proyectos (solo)');
        this.suppressHeuristicsListOnce = true;
        this.listarProyectosOActividadesDesdeChat('proyectos');
        return true;

      case 'LISTAR_ACTIVIDADES':
        console.log('[Chatbot] comando: listar actividades (solo)');
        this.suppressHeuristicsListOnce = true;
        this.listarProyectosOActividadesDesdeChat('actividades');
        return true;

      case 'LISTAR_PROYECTOS_Y_ACTIVIDADES':
        console.log('[Chatbot] comando: listar proyectos + actividades');
        this.suppressHeuristicsListOnce = true;
        this.listarProyectosOActividadesDesdeChat('ambos');
        return true;

      case 'RESUMIR_NOTICIA_ORDINAL': {
        const ord = Number(res?.payload?.ord ?? 0);
        console.log('[Chatbot] comando: resumir noticia ordinal =', ord);
        this.resumirNoticiaPorOrdinal(ord);
        return true;
      }

      case 'SUGERIR_POSTULACION_ORDINAL': {
        const ord = Number(res?.payload?.ord ?? 0);
        const scope = res?.payload?.scope as
          | 'proyecto'
          | 'actividad'
          | undefined;
        console.log(
          '[Chatbot] comando: postulación ordinal =',
          ord,
          ' scope=',
          scope
        );
        this.sugerirPostulacionPorOrdinal(ord, scope);
        return true;
      }
    }
    return false;
  }

  private handleByReplyHeuristics(replyText: string) {
    if (this.suppressHeuristicsListOnce) {
      console.log('[Chatbot] heurística suprimida una vez (listado)');
      this.suppressHeuristicsListOnce = false;
      return;
    }
    if (this.suppressHeuristicsOnce) {
      console.log('[Chatbot] heurística suprimida una vez (resumen noticia)');
      this.suppressHeuristicsOnce = false;
      return;
    }
    if (this.suppressHeuristicsPostOnce) {
      console.log('[Chatbot] heurística suprimida una vez (postulación)');
      this.suppressHeuristicsPostOnce = false;
      return;
    }

    const low = replyText.toLowerCase();

    if (
      low.includes('listo ✅') ||
      low.includes('listo ') ||
      low.includes('te lo envío') ||
      low.includes('te lo envie') ||
      low.includes('ya te lo envié') ||
      low.includes('ya te lo envie')
    ) {
      console.log('[Chatbot] texto sugiere emisión → ejecutar certificado');
      this.emitirCertificadoDesdeChat();
      return;
    }

    if (
      (low.includes('estas son las últimas') && low.includes('noticias')) ||
      low.includes('últimas noticias')
    ) {
      console.log('[Chatbot][fallback] listarNoticiasDesdeChat() por reply');
      this.listarNoticiasDesdeChat();
      return;
    }

    if (
      (low.includes('estos son los') && low.includes('proyectos')) ||
      low.includes('proyectos más recientes') ||
      low.includes('solo proyectos')
    ) {
      console.log(
        '[Chatbot][fallback] listarProyectosOActividadesDesdeChat(proyectos) por reply'
      );
      this.listarProyectosOActividadesDesdeChat('proyectos');
      return;
    }
    if (
      (low.includes('estas son las') && low.includes('actividades')) ||
      low.includes('actividades más recientes') ||
      low.includes('solo actividades')
    ) {
      console.log(
        '[Chatbot][fallback] listarProyectosOActividadesDesdeChat(actividades) por reply'
      );
      this.listarProyectosOActividadesDesdeChat('actividades');
      return;
    }
    if (
      low.includes('proyectos/actividades') ||
      low.includes('proyectos y actividades')
    ) {
      console.log(
        '[Chatbot][fallback] listarProyectosOActividadesDesdeChat(ambos) por reply'
      );
      this.listarProyectosOActividadesDesdeChat('ambos');
      return;
    }

    let m = low.match(/resumen.*?(?:#|n[°º]?\s*|de\s+la\s+|de\s+)?\s*(\d+)\b/);
    if (!m)
      m = low.match(
        /preparando\s+resumen.*?(?:#|n[°º]?\s*|de\s+la\s+|de\s+)?\s*(\d+)\b/
      );
    if (!m && this.lastUserText) {
      const u = this.lastUserText.toLowerCase();
      m =
        u.match(/\bresumen(?:\s+de\s+la|\s+de|\s+)\s*(\d+)\b/) ||
        u.match(/\bdetalle(?:\s+de\s+la|\s+de|\s+)\s*(\d+)\b/);
    }
    if (m && m[1]) {
      const ord = Number(m[1]);
      if (Number.isFinite(ord) && ord > 0) {
        console.log('[Chatbot][fallback] resumen ordinal detectado =', ord);
        this.resumirNoticiaPorOrdinal(ord);
        return;
      }
    }

    let pm = low.match(
      /\b(mensaje|postulacion|postulación).*(?:#|n[°º]?\s*|de\s+la\s+|de\s+|para\s+la\s+|para\s+)?\s*(\d+)\b/
    );
    if (!pm && this.lastUserText) {
      const u = this.lastUserText.toLowerCase();
      pm = u.match(
        /\b(mensaje|postulacion|postulación).*(?:#|n[°º]?\s*|de\s+la\s+|de\s+|para\s+la\s+|para\s+)?\s*(\d+)\b/
      );
    }
    if (pm && pm[2]) {
      const ord = Number(pm[2]);
      if (Number.isFinite(ord) && ord > 0) {
        console.log('[Chatbot][fallback] postulación ordinal detectada =', ord);
        this.sugerirPostulacionPorOrdinal(ord, undefined);
        return;
      }
    }
  }

  // ====== CERTIFICADO ======
  private async emitirCertificadoDesdeChat() {
    console.log('[Chatbot] iniciar emisión de certificado desde el chat…');

    if (!this.certWebhookUrl) {
      console.warn('[Chatbot] environment.N8N_WEBHOOK_URL está vacío');
      this.pushBot(
        'No tengo configurado el webhook de certificados en la app 😅'
      );
      return;
    }

    try {
      const who = await getMyUserData().catch(() => null as any);
      console.log('[Chatbot] getMyUserData() =', who);

      const { data: { user } = { user: null } } = await supabase.auth
        .getUser()
        .catch(() => ({ data: { user: null } } as any));
      console.log('[Chatbot] supabase.auth.getUser() =', user);

      const correoDestino =
        (who && (who.correo || who.email)) ||
        (this.perfil && (this.perfil as any).correo) ||
        (this.perfil && (this.perfil as any).email) ||
        (user && user.email) ||
        '';

      console.log('[Chatbot] correoDestino detectado =', correoDestino);

      if (!correoDestino) {
        this.pushBot(
          'No encontré tu correo registrado 😅. Ve a “Mi perfil” y guárdalo primero.'
        );
        return;
      }

      this.pushBot('Ok, lo estoy generando… ⏳');

      const baseMeta = {
        ...(who || {}),
        destino_presentacion: '',
        fecha_emision: new Date().toISOString(),
        render: 'pdf-lib',
      };
      console.log('[Chatbot] createCertRecord() con meta =', baseMeta);
      const { id } = await createCertRecord(baseMeta);
      console.log('[Chatbot] createCertRecord() -> id =', id);

      const baseBytes = await fetchBaseTemplateBytes();
      console.log(
        '[Chatbot] fetchBaseTemplateBytes() OK, bytes =',
        baseBytes?.byteLength ?? '??'
      );

      const rawVars = this.buildVarsFromWho(who);
      (rawVars as any).folio = String(id);
      const vars = this.sanitizeVars(rawVars);
      console.log('[Chatbot] vars para fillCertificate (sanitizadas) =', vars);

      const blob = await fillCertificate(baseBytes, vars);
      console.log('[Chatbot] fillCertificate() OK, blob =', blob);

      const { pdf_url } = await uploadPdfForRecord(id, blob);
      console.log('[Chatbot] uploadPdfForRecord() -> pdf_url =', pdf_url);

      const bodyToN8n = {
        to: correoDestino as string,
        subject: 'Certificado emitido',
        pdf_url,
        filename: `certificado-${id}.pdf`,
      };
      console.log(
        '[Chatbot] POST -> n8n (certificado):',
        this.certWebhookUrl,
        bodyToN8n
      );

      const res = await fetch(this.certWebhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyToN8n),
      });

      const text = await res.text();
      console.log(
        '[Chatbot] respuesta HTTP de n8n (certificado) =',
        res.status,
        text
      );

      if (!res.ok) {
        this.pushBot('No pude enviar el certificado 😅 (n8n respondió error).');
        return;
      }

      this.pushBot('Listo ✅ ya te lo envié por correo.');
    } catch (err: any) {
      console.error('[Chatbot] error en emitirCertificadoDesdeChat():', err);
      this.pushBot(
        err?.message || 'Hubo un error al generar el certificado 😅'
      );
    }
  }

  // ====== LISTAR VOTACIONES ======
  private async listarVotacionesDesdeChat() {
    try {
      const { data, error } = await supabase
        .from('votaciones')
        .select('*')
        .eq('estado', 'activa')
        .order('fecha_fin', { ascending: true });

      if (error) throw error;
      const items = data || [];
      this.lastVotesCache = items;

      if (!items.length) {
        this.pushBot('No hay votaciones activas en este momento.');
        return;
      }

      const lines = items.slice(0, 5).map((v: any, i: number) => {
        const fin = v.fecha_fin ? new Date(v.fecha_fin).toLocaleString() : '—';
        return `${i + 1}. <b>${v.titulo || 'Sin título'}</b> (hasta ${fin})`;
      });

      this.pushBot(
        `👉<br>${lines.join(
          '<br>'
        )}<br><i>Di, por ejemplo: “abrir votación 1”.</i>`
      );
    } catch (e: any) {
      console.error('[Chatbot] listarVotacionesDesdeChat() error:', e);
      this.pushBot('No pude listar las votaciones 😅');
    }
  }

  // ====== LISTAR ESPACIOS ======
  private async listarEspaciosDesdeChat() {
    try {
      const { data, error } = await supabase
        .from('espacio')
        .select('*')
        .order('nombre', { ascending: true });

      if (error) throw error;

      const items = data || [];
      this.lastSpacesCache = items;

      if (!items.length) {
        this.pushBot('No hay espacios registrados aún.');
        return;
      }

      const lines = items.slice(0, 6).map((e: any, i: number) => {
        const cap = e.capacidad ? ` • Capacidad: ${e.capacidad}` : '';
        const dir = e.direccion ? ` • ${e.direccion}` : '';
        return `${i + 1}. <b>${e.nombre || 'Sin nombre'}</b>${cap}${dir}`;
      });

      this.pushBot(
        `🏢<br>${lines.join(
          '<br>'
        )}<br><i>Para reservar, ve a “Arrendar espacio”.</i>`
      );
    } catch (e: any) {
      console.error('[Chatbot] listarEspaciosDesdeChat() error:', e);
      this.pushBot('No pude listar los espacios 😅');
    }
  }

  // ====== LISTAR PROYECTOS / ACTIVIDADES ======
  private async listarProyectosOActividadesDesdeChat(
    scope: 'proyectos' | 'actividades' | 'ambos'
  ) {
    try {
      this.lastScopeForPostulacion = scope;

      if (scope === 'proyectos') {
        const { data, error } = await supabase
          .from('proyecto')
          .select('*')
          .order('fecha_creacion', { ascending: false });

        if (error) throw error;
        const items = data || [];
        this.lastProjectsOnlyCache = items;

        if (!items.length) {
          this.pushBot('No hay proyectos publicados todavía.');
          return;
        }

        const lines = items
          .slice(0, 8)
          .map(
            (p: any, i: number) =>
              `${i + 1}. <b>${
                p.titulo || p.nombre || 'Sin título'
              }</b> — proyecto`
          );

        this.pushBot(
          `📌 Proyectos:<br>${lines.join(
            '<br>'
          )}<br><i>Di “mensaje de la 1/2/3…” para sugerir tu postulación.</i>`
        );
        return;
      }

      if (scope === 'actividades') {
        const { data, error } = await supabase
          .from('actividad')
          .select('*')
          .order('creado_en', { ascending: false });

        if (error) throw error;
        const items = data || [];
        this.lastActivitiesOnlyCache = items;

        if (!items.length) {
          this.pushBot('No hay actividades publicadas todavía.');
          return;
        }

        const lines = items
          .slice(0, 8)
          .map(
            (a: any, i: number) =>
              `${i + 1}. <b>${
                a.titulo || a.nombre || 'Sin título'
              }</b> — actividad`
          );

        this.pushBot(
          `🗓️ Actividades:<br>${lines.join(
            '<br>'
          )}<br><i>Di “mensaje de la 1/2/3…” para sugerir tu postulación.</i>`
        );
        return;
      }

      const [proyRes, actRes] = await Promise.all([
        supabase.from('proyecto').select('*'),
        supabase.from('actividad').select('*'),
      ]);
      if (proyRes.error) throw proyRes.error;
      if (actRes.error) throw actRes.error;

      const proyectos = (proyRes.data || []).map((p: any) => ({
        ...p,
        tipo: 'proyecto',
        fecha: p.fecha_creacion || p.actualizado_en || new Date().toISOString(),
      }));
      const actividades = (actRes.data || []).map((a: any) => ({
        ...a,
        tipo: 'actividad',
        fecha:
          a.creado_en ||
          a.fecha_inicio ||
          a.actualizado_en ||
          new Date().toISOString(),
      }));

      this.lastProjectsOnlyCache = proyectos;
      this.lastActivitiesOnlyCache = actividades;

      const elementos = [...proyectos, ...actividades].sort(
        (a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime()
      );

      if (!elementos.length) {
        this.pushBot('No hay proyectos ni actividades publicados todavía.');
        return;
      }

      const lines = elementos
        .slice(0, 8)
        .map(
          (e: any, i: number) =>
            `${i + 1}. <b>${e.titulo || e.nombre || 'Sin título'}</b> — ${
              e.tipo
            }`
        );

      this.pushBot(
        `📋 Proyectos y Actividades:<br>${lines.join(
          '<br>'
        )}<br><i>Di “mensaje de la 1/2/3…” para sugerir tu postulación.</i>`
      );
    } catch (e: any) {
      console.error(
        '[Chatbot] listarProyectosOActividadesDesdeChat() error:',
        e
      );
      this.pushBot('No pude listar los proyectos/actividades 😅');
    }
  }

  // ====== LISTAR NOTICIAS ======
  private async listarNoticiasDesdeChat() {
    try {
      const { data, error } = await supabase
        .from('noticias')
        .select('id, titulo, url_foto, nombre_autor, fecha_creacion, parrafos')
        .order('fecha_creacion', { ascending: false });

      if (error) throw error;

      const list = (data ?? []) as Noticia[];
      this.lastNewsCache = list;

      if (!list.length) {
        this.pushBot('No hay noticias publicadas por ahora.');
        return;
      }

      const lines = list.slice(0, 5).map((n, i) => {
        const fecha = n.fecha_creacion
          ? new Date(n.fecha_creacion).toLocaleDateString()
          : '';
        return `${i + 1}. <b>${n.titulo || 'Sin título'}</b> ${
          fecha ? `(${fecha})` : ''
        }`;
      });

      this.pushBot(
        `📰 Últimas noticias:<br>${lines.join(
          '<br>'
        )}<br><i>Pide “resumen de la 1” o “detalle de la 2”.</i>`
      );
    } catch (e: any) {
      console.error('[Chatbot] listarNoticiasDesdeChat() error:', e);
      this.pushBot('No pude listar las noticias 😅');
    }
  }

  // ====== RESUMIR NOTICIA ======
  private async resumirNoticiaPorOrdinal(ord: number) {
    const idx = ord - 1;
    if (idx < 0 || idx >= this.lastNewsCache.length) {
      this.pushBot(
        'No ubico esa posición en la lista. Pide “ver noticias” primero 😉'
      );
      return;
    }
    const n = this.lastNewsCache[idx];
    await this.resumirNoticiaDesdeChat(n.id);
  }

  private async resumirNoticiaDesdeChat(id: number) {
    try {
      const { data, error } = await supabase
        .from('noticias')
        .select('id, titulo, parrafos, fecha_creacion, nombre_autor')
        .eq('id', id)
        .single();

      if (error) throw error;

      const titulo = data?.titulo || 'Sin título';
      const texto = (data?.parrafos || []).join('\n\n');

      const payload = {
        user_id: this.userId,
        community_id: this.communityId,
        thread_id: `chat-${this.communityId}-${this.userId}`,
        message: '[RESUMIR_NOTICIA]',
        perfil: this.perfil,
        news_doc: { id, titulo, texto },
        openai_key: this.openaiKeyForN8N || '',
      };

      this.chatbot.sendMessage(payload).subscribe({
        next: (res: ChatbotResponse) => {
          const summary = (res.summary || res.reply || '').trim();
          const html = summary
            ? summary.replace(/\n/g, '<br>')
            : 'No pude generar el resumen 😅';
          this.pushBot(`<b>${titulo}</b><br>${html}`);
          this.suppressHeuristicsOnce = true;
        },
        error: (err) => {
          console.error('[Chatbot] error al pedir resumen a n8n:', err);
          this.pushBot('No pude generar el resumen 😅');
        },
      });
    } catch (e: any) {
      console.error('[Chatbot] resumirNoticiaDesdeChat error:', e);
      this.pushBot('No pude leer esa noticia 😅');
    }
  }

  // ====== SUGERIR POSTULACIÓN ======
  private sugerirPostulacionPorOrdinal(
    ord: number,
    hintScope?: 'proyecto' | 'actividad'
  ) {
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
      if (scope === 'proyectos') {
        if (idx >= 0 && idx < this.lastProjectsOnlyCache.length) {
          item = this.lastProjectsOnlyCache[idx];
          tipo = 'proyecto';
        }
      } else if (scope === 'actividades') {
        if (idx >= 0 && idx < this.lastActivitiesOnlyCache.length) {
          item = this.lastActivitiesOnlyCache[idx];
          tipo = 'actividad';
        }
      } else {
        if (idx >= 0 && idx < this.lastProjectsOnlyCache.length) {
          item = this.lastProjectsOnlyCache[idx];
          tipo = 'proyecto';
        } else if (idx >= 0 && idx < this.lastActivitiesOnlyCache.length) {
          item = this.lastActivitiesOnlyCache[idx];
          tipo = 'actividad';
        }
      }
    }

    if (!item) {
      this.pushBot(
        'No ubico esa posición. Pide “ver proyectos” o “ver actividades” primero 😉'
      );
      return;
    }

    const id = item.id_proyecto || item.id_actividad;
    this.sugerirPostulacionDesdeChat(tipo, String(id));
  }

  private async sugerirPostulacionDesdeChat(
    tipo: 'proyecto' | 'actividad',
    id: string
  ) {
    try {
      let registro: any = null;

      if (tipo === 'proyecto') {
        const r1 = await supabase
          .from('proyecto')
          .select('*')
          .eq('id_proyecto', id)
          .maybeSingle();
        if (r1.data) registro = r1.data;
      } else {
        const r1 = await supabase
          .from('actividad')
          .select('*')
          .eq('id_actividad', id)
          .maybeSingle();
        if (r1.data) registro = r1.data;
      }

      if (!registro) {
        this.pushBot('No pude leer ese elemento 😅. Revisa que exista el ID.');
        return;
      }

      const titulo =
        registro.titulo ||
        registro.nombre ||
        (tipo === 'proyecto' ? 'Proyecto' : 'Actividad');
      const organizador =
        registro.organizador || registro.creado_por || 'la organización';
      const fecha =
        tipo === 'proyecto'
          ? registro.fecha_creacion || registro.actualizado_en
          : registro.fecha_inicio ||
            registro.creado_en ||
            registro.actualizado_en;

      const sugerido =
        `Hola, me interesa postular a **${titulo}**. ` +
        `Cuento con disponibilidad y motivación para aportar al equipo. ` +
        `¿Me indican por favor los próximos pasos y requisitos? ` +
        `Quedo atento/a. ¡Gracias!`;

      const infoExtra = [
        fecha ? `• Fecha: ${new Date(fecha).toLocaleDateString()}` : null,
        organizador ? `• Organiza: ${organizador}` : null,
        registro.cupos_total ? `• Cupos: ${registro.cupos_total}` : null,
        registro.estado ? `• Estado: ${registro.estado}` : null,
      ]
        .filter(Boolean)
        .join('<br>');

      const header = tipo === 'proyecto' ? '🧩 Proyecto' : '🗓️ Actividad';
      const extraHtml = infoExtra ? `<br>${infoExtra}` : '';

      this.pushBot(
        `${header}: <b>${titulo}</b>${extraHtml}<br><br>` +
          `<u>Mensaje sugerido de postulación</u>:<br>` +
          `${sugerido}`
      );

      this.suppressHeuristicsPostOnce = true;
    } catch (err) {
      console.error('[Chatbot] sugerirPostulacionDesdeChat error:', err);
      this.pushBot('No pude preparar el mensaje de postulación 😅');
    }
  }

  // ====== helpers ======
  private buildVarsFromWho(who: any) {
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
      destino_presentacion: '',
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

  private pushBot(text: string) {
    this.messages.push({ from: 'bot', text, at: new Date() });
  }

  private pushUser(text: string) {
    this.messages.push({ from: 'user', text, at: new Date() });
  }
}
