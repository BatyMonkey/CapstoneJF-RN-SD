import { Component, OnInit } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { IonicModule } from '@ionic/angular';
import { SupabaseService } from 'src/app/services/supabase.service';

@Component({
  standalone: true,
  selector: 'app-auditoria',
  templateUrl: './auditoria.page.html',
  styleUrls: ['./auditoria.page.scss'],
  imports: [IonicModule, CommonModule, FormsModule, RouterLink],
})
export class AuditoriaPage implements OnInit {
  subtitulo = 'Historial de acciones y cambios';

  loading = false;
  registros: any[] = [];

  filtroTabla: string = 'todas';

  /** ===========================================================
   *  FILTROS (ya sin pagos, certificados, eventos ni espacios)
   * =========================================================== */
  opcionesFiltro = [
    { value: 'todas', label: 'Todas las acciones' },
    { value: 'noticias', label: 'Noticias' },
    { value: 'votaciones', label: 'Votaciones' },
    { value: 'proyecto', label: 'Proyectos' },
    { value: 'actividad', label: 'Actividades' },
    { value: 'reserva', label: 'Reservas' },
  ];

  constructor(
    private supabaseService: SupabaseService,
    private location: Location
  ) {}

  ngOnInit() {
    this.cargarAuditoria();
  }

  goBack() {
    this.location.back();
  }

  /** ===========================================================
   * CARGAR AUDITORÍA
   * =========================================================== */
  async cargarAuditoria(event?: any) {
    this.loading = true;

    const { data: auditoria, error } = await this.supabaseService
      .from('auditoria')
      .select('*')
      .order('fecha', { ascending: false });

    if (event) event?.target?.complete();

    if (error || !auditoria) {
      console.error('❌ Error auditoría:', error);
      this.registros = [];
      this.loading = false;
      return;
    }

    // === Obtener fotos de usuario ===
    const ids = auditoria.map((r: any) => r.id_auth);

    const { data: users } = await this.supabaseService
      .from('usuario')
      .select('id_auth, url_foto_perfil')
      .in('id_auth', ids);

    const userMap = new Map(
      (users ?? []).map((u: any) => [u.id_auth, u.url_foto_perfil])
    );

    // === Mapear registros ===
    this.registros = auditoria.map((r: any) => {
      let detalle = r.detalle;

      // Parsear JSON si viene como string
      if (typeof detalle === 'string') {
        try {
          detalle = JSON.parse(detalle);
        } catch {}
      }

      return {
        ...r,
        detalle,
        fecha: r.fecha ? new Date(r.fecha) : null,
        url_foto_perfil: userMap.get(r.id_auth) ?? null,
      };
    });

    // === Reconstruir votaciones ===
    await this.enrichResultadosVotaciones();

    this.loading = false;
  }

  /** ===========================================================
   * RECONSTRUIR VOTACIONES (GANADOR, RESULTADOS, TOTAL)
   * =========================================================== */
  private async enrichResultadosVotaciones() {
    const votRegs = this.registros.filter((r) => r.tabla === 'votaciones');

    for (const reg of votRegs) {
      try {
        await this.cargarResultadosVotacionParaRegistro(reg);
      } catch (e) {
        console.warn('⚠ Error reconstruyendo votación:', e);
      }
    }
  }

  private async cargarResultadosVotacionParaRegistro(registro: any) {
    const detalle = registro.detalle;
    if (!detalle || !detalle.titulo) return;

    // === Buscar votación ===
    const { data: votRows } = await this.supabaseService
      .from('votaciones')
      .select('id, titulo, creado_en')
      .eq('titulo', detalle.titulo)
      .order('creado_en', { ascending: false })
      .limit(1);

    if (!votRows || votRows.length === 0) return;

    const votacion = votRows[0];

    // === Obtener opciones con conteo ===
    const { data: opciones } = await this.supabaseService
      .from('opciones_votacion_conteo')
      .select('titulo, total_votos')
      .eq('votacion_id', votacion.id);

    // Caso sin opciones
    if (!opciones || opciones.length === 0) {
      registro.detalle = {
        ...detalle,
        resultados: [],
        total_votantes: 0,
        ganador: 'Empate',
      };
      return;
    }

    // === Calcular totales ===
    const total = opciones.reduce((sum, o) => sum + (o.total_votos ?? 0), 0);

    const resultados = opciones.map((o) => ({
      opcion: o.titulo,
      votos: o.total_votos,
      porcentaje:
        total === 0 ? 0 : Math.round((o.total_votos / total) * 1000) / 10,
    }));

    const ganador = this.calcularGanadorConEmpate(resultados);

    registro.detalle = {
      ...detalle,
      resultados,
      total_votantes: total,
      ganador,
    };
  }

  /** ===========================================================
   * DETECTAR EMPATE
   * =========================================================== */
  private calcularGanadorConEmpate(resultados: any[]): string {
    if (!resultados || resultados.length === 0) return 'Empate';

    // Todas las opciones con cero votos
    if (resultados.every((r) => r.votos === 0)) return 'Empate';

    const max = Math.max(...resultados.map((r) => r.votos));
    const top = resultados.filter((r) => r.votos === max);

    return top.length > 1 ? 'Empate' : top[0].opcion;
  }

  /** ===========================================================
   * HELPERS
   * =========================================================== */
  normalizeKey(key: string): string {
    if (!key) return '';
    return key.replace(/_/g, ' ');
  }

  isArray(v: any) {
    return Array.isArray(v);
  }

  isObject(v: any) {
    return typeof v === 'object' && v !== null && !Array.isArray(v);
  }

  isFecha(v: any) {
    return typeof v === 'string' && v.includes('T');
  }

  /** Iconos por tabla */
  getIconoTabla(tabla: string) {
    const t = tabla?.toLowerCase() || '';
    if (t.includes('vot')) return 'checkmark-done-outline';
    if (t.includes('noti')) return 'newspaper-outline';
    if (t.includes('proy')) return 'cube-outline';
    if (t.includes('res')) return 'calendar-outline';
    return 'document-text-outline';
  }

  /** Foto perfil */
  getFotoPerfil(path: string | null): string {
    const fb = 'assets/default_avatar.png';
    if (!path) return fb;
    if (path.startsWith('http')) return path;
    const { data } = this.supabaseService.client.storage
      .from('perfiles-bucket')
      .getPublicUrl(path);
    return data?.publicUrl || fb;
  }

  onAvatarError(e: any) {
    const fb = 'assets/default_avatar.png';
    if (!e.target.src.includes(fb)) e.target.src = fb;
  }

  /** Filtro */
  get registrosFiltrados() {
    if (this.filtroTabla === 'todas') return this.registros;
    return this.registros.filter((r) => r.tabla === this.filtroTabla);
  }

  /** Ordenar campos detalle */
  orderedDetalleKeys(obj: any): string[] {
    if (!obj) return [];

    const preferred = [
      'titulo',
      'descripcion',
      'fecha_inicio',
      'fecha_fin',
      'ganador',
      'resultados',
      'total_votantes',
    ];

    return [
      ...preferred.filter((k) => obj[k] !== undefined),
      ...Object.keys(obj).filter((k) => !preferred.includes(k)),
    ];
  }
}
