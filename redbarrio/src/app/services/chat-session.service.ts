// src/app/services/chat-session.service.ts
import { Injectable } from '@angular/core';
import { Perfil } from '../auth/auth.service';

export interface ChatMessage {
  from: 'user' | 'bot';
  text: string;
  at: Date;
}

const STORAGE_KEY = 'rb_chat_session_v1';

interface ChatSessionState {
  messages: { from: 'user' | 'bot'; text: string; at: string }[];
  perfil: Perfil | null;
}

@Injectable({ providedIn: 'root' })
export class ChatSessionService {
  private messages: ChatMessage[] = [];
  private perfil: Perfil | null = null;

  constructor() {
    // intenta cargar desde sessionStorage
    if (typeof sessionStorage !== 'undefined') {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (raw) {
        try {
          const parsed = JSON.parse(raw) as ChatSessionState;
          this.messages =
            parsed.messages?.map((m) => ({
              ...m,
              at: new Date(m.at),
            })) ?? [];
          this.perfil = parsed.perfil ?? null;
        } catch {
          // si falla, empezamos vacíos
          this.messages = [];
          this.perfil = null;
        }
      }
    }
  }

  private persist() {
    if (typeof sessionStorage === 'undefined') return;
    const payload: ChatSessionState = {
      messages: this.messages.map((m) => ({
        from: m.from,
        text: m.text,
        at: m.at.toISOString(),
      })),
      perfil: this.perfil,
    };
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  }

  ensureInit(defaultName?: string) {
    if (this.messages.length === 0) {
      this.messages.push({
        from: 'bot',
        text: defaultName
          ? `Hola ${defaultName} 👋 ¿en qué puedo ayudarte?`
          : 'Hola 👋 soy el asistente de RedBarrio. ¿Qué necesitas?',
        at: new Date(),
      });
      this.persist();
    }
  }

  setPerfil(p: Perfil | null) {
    this.perfil = p;
    this.persist();
  }

  getPerfil() {
    return this.perfil;
  }

  getMessages(): ChatMessage[] {
    return this.messages.map((m) => ({ ...m }));
  }

  addMessage(msg: ChatMessage) {
    this.messages.push(msg);
    this.persist();
  }

  clear() {
    this.messages = [];
    this.perfil = null;
    this.persist();
  }
}
