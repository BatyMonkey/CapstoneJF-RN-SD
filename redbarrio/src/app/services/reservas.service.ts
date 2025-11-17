// src/app/services/reservas.service.ts
import { Injectable } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { environment } from 'src/environments/environment';

export interface CrearReservaParams {
  idAuth: string;
  idEspacio: number;
  eventoTitulo: string;
  eventoDescripcion: string;
  eventoInicio: string; // ISO
  eventoFin: string;    // ISO
}

export interface CrearReservaResultado {
  evento: any;
  reserva: any;
  orden: any;
  transbank: { url: string; token: string; [k: string]: any };
}

@Injectable({ providedIn: 'root' })
export class ReservasService {
  constructor(private supabaseService: SupabaseService) {}

  /**
   * Crea evento, reserva, orden de pago y llama al simulador de Transbank.
   * Reutilizable desde la página normal y desde el chatbot.
   */
  async crearReservaConPago(params: CrearReservaParams): Promise<CrearReservaResultado> {
    const { idAuth, idEspacio, eventoTitulo, eventoDescripcion, eventoInicio, eventoFin } = params;
    const client = this.supabaseService.client;
    const ahoraIso = new Date().toISOString();
    const MONTO = 1500; // mismo monto que usas hoy

    // 1️⃣ Crear evento
    const { data: eventoData, error: eventoError } = await client
      .from('evento')
      .insert([
        {
          titulo: eventoTitulo,
          descripcion: eventoDescripcion,
          fecha_inicio: eventoInicio,
          fecha_fin: eventoFin,
        },
      ])
      .select()
      .single();

    if (eventoError) throw eventoError;

    // 2️⃣ Crear reserva
    const { data: reservaData, error: reservaError } = await client
      .from('reserva')
      .insert([
        {
          id_espacio: idEspacio,
          id_evento: eventoData.id_evento,
          id_auth: idAuth,
          fecha: ahoraIso,
          creado_en: ahoraIso,
        },
      ])
      .select()
      .single();

    if (reservaError) throw reservaError;

    // 3️⃣ Crear orden de pago
    const { data: ordenData, error: ordenError } = await client
      .from('orden_pago')
      .insert([
        {
          id_auth: idAuth,
          id_evento: eventoData.id_evento,
          id_espacio: idEspacio,
          monto: MONTO,
          estado: 'pendiente',
          created_at: ahoraIso,
          updated_at: ahoraIso,
        },
      ])
      .select()
      .single();

    if (ordenError) throw ordenError;

    // 🧾 Auditoría (no hacemos fallar la reserva si esto explota)
    try {
      await this.supabaseService.registrarAuditoria(
        'enviar solicitud de reserva',
        'reserva',
        {
          evento: {
            id_evento: eventoData.id_evento,
            titulo: eventoData.titulo,
            fecha_inicio: eventoData.fecha_inicio,
            fecha_fin: eventoData.fecha_fin,
          },
          reserva: {
            id_reserva: reservaData.id_reserva,
            id_espacio: idEspacio,
            fecha: reservaData.fecha,
          },
          orden_pago: {
            id_orden: ordenData.id_orden,
            monto: ordenData.monto,
            estado: ordenData.estado,
          },
          fecha_solicitud: ahoraIso,
        }
      );
    } catch (err) {
      console.error('[ReservasService] Error registrando auditoría:', err);
    }

    // 4️⃣ Llamar a la Function de Transbank
    const response = await fetch(
      `${environment.supabaseUrl}/functions/v1/transbank-simular`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id_reserva: reservaData.id_reserva,
          monto: MONTO,
          descripcion: `Pago arriendo espacio #${idEspacio}`,
        }),
      }
    );

    if (!response.ok) {
      throw new Error('Error al iniciar simulación de pago');
    }

    const simData = await response.json();
    if (!simData.url || !simData.token) {
      throw new Error('No se recibió token o URL de Transbank.');
    }

    return {
      evento: eventoData,
      reserva: reservaData,
      orden: ordenData,
      transbank: simData,
    };
  }
}
