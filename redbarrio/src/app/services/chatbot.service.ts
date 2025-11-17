// src/app/services/chatbot.service.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface ChatbotPayload {
  user_id: string;
  community_id: number | string;
  message: string;
  thread_id?: string;
  perfil?: any;
  pending_action?: string | null;
  history?: Array<{ from: string; text: string }>; // 👈 NUEVO
}

export interface ChatbotResponse {
  reply: string;
  command?: string;
  payload?: any;
  next_action?: string;
}

@Injectable({ providedIn: 'root' })
export class ChatbotService {
  // 👇 tu webhook real
  private apiUrl =
    'https://joaquinfuentessp3101.app.n8n.cloud/webhook/redbarrio/chatbot';

  constructor(private http: HttpClient) {}

  sendMessage(payload: ChatbotPayload): Observable<ChatbotResponse> {
    return this.http.post<ChatbotResponse>(this.apiUrl, payload);
  }
}
