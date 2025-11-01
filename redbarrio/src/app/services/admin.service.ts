import { Injectable } from '@angular/core';
import { SupabaseService } from './supabase.service'; // 👈 importa tu servicio global

@Injectable({ providedIn: 'root' })
export class AdminService {
  constructor(private supabaseService: SupabaseService) {} // 👈 inyecta el servicio

  async getPendingUsers() {
    const { data, error } = await this.supabaseService
      .from('usuario')
      .select('*')
      .eq('status', 'pendiente');

    if (error) throw error;
    return data;
  }

  async updateUserStatus(userId: string, status: 'activo' | 'rechazado') {
    const { error } = await this.supabaseService
      .from('usuario')
      .update({ status })
      .eq('id_usuario', userId); // 👈 usa tu campo real (probablemente 'id_usuario')
    if (error) throw error;
  }
}
