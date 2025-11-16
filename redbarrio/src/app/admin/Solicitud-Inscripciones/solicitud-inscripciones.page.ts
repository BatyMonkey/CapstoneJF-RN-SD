import { Component, OnInit } from '@angular/core';
import { IonicModule } from '@ionic/angular';
import { CommonModule, DatePipe, NgClass } from '@angular/common';
import { SupabaseService } from 'src/app/services/supabase.service';

// ======================== INTERFACES ========================
interface ActividadRef {
  id_actividad: string;
  titulo: string;
}

interface ProyectoRef {
  id_proyecto: string;
  titulo: string;
}

interface ActividadRow {
  id_inscripcion: string;
  id_auth: string;
  estado: string;
  comentario: string;
  fecha: string;
  actividad: ActividadRef | ActividadRef[] | null;
}

interface ProyectoRow {
  id_postulacion: string;
  id_auth: string;
  estado: string;
  descripcion: string;
  fecha: string;
  proyecto: ProyectoRef | ProyectoRef[] | null;
}

interface UsuarioRow {
  id_auth: string;
  nombre: string;
  correo: string | null;
  rut: string | null;
  url_foto_perfil: string | null;
}

interface ItemUnico {
  tipo: "actividad" | "proyecto";
  idRegistro: string;
  estado: string;
  fecha: string;
  motivo: string;
  titulo: string;

  vecinoNombre: string;
  vecinoCorreo: string | null;
  vecinoRut: string | null;
  vecinoFoto: string | null;
}

@Component({
  selector: 'app-solicitud-inscripciones',
  standalone: true,
  imports: [IonicModule, CommonModule, NgClass, DatePipe],
  templateUrl: './solicitud-inscripciones.page.html',
  styleUrls: ['./solicitud-inscripciones.page.scss'],
})
export class SolicitudInscripcionesPage implements OnInit {

    cambiarFiltroTipo(tipo: "todos" | "actividades" | "proyectos") {
    this.filtroTipo = tipo;
    this.aplicarFiltro();
  }

  cambiarFiltroEstado(estado: "todos" | "pendiente" | "Aceptado" | "Rechazado") {
    this.filtroEstado = estado;
    this.aplicarFiltro();
  }


  subtitulo = "Gestión de Inscripciones";

  solicitudes: ItemUnico[] = [];
  solicitudesFiltradas: ItemUnico[] = [];

  filtroTipo: "todos" | "actividades" | "proyectos" = "todos";
  filtroEstado: "todos" | "pendiente" | "Aceptado" | "Rechazado" = "todos";

  totalProyectos = 0;
  totalActividades = 0;

  isLoading = false;

  constructor(private supabase: SupabaseService) {}

  ngOnInit() {
    this.cargarDatos();
  }

  // Normalizadores
  normalizarActividad(a: any): ActividadRef | null {
    if (!a) return null;
    return Array.isArray(a) ? (a[0] ?? null) : a;
  }

  normalizarProyecto(p: any): ProyectoRef | null {
    if (!p) return null;
    return Array.isArray(p) ? (p[0] ?? null) : p;
  }

  // ======================== CARGA COMPLETA ========================
  async cargarDatos() {
    this.isLoading = true;

    try {
      // 1) Cargar usuarios
      const { data: usuarios } = await this.supabase.client
        .from("usuario")
        .select("id_auth,nombre,correo,rut,url_foto_perfil");

      const mapaUsuarios = new Map<string, UsuarioRow>();
      (usuarios || []).forEach(u => mapaUsuarios.set(u.id_auth, u));

      // 2) Actividades
      const { data: actData } = await this.supabase.client
        .from("actividad_inscripcion")
        .select(`
          id_inscripcion,
          id_auth,
          estado,
          comentario,
          fecha,
          actividad:actividad(id_actividad,titulo)
        `);

      const actividadesFormateadas: ItemUnico[] = (actData || []).map((row: ActividadRow) => {
        const ref = this.normalizarActividad(row.actividad);
        const usr = mapaUsuarios.get(row.id_auth);

        return {
          tipo: "actividad",
          idRegistro: row.id_inscripcion,
          estado: row.estado,
          fecha: row.fecha,
          motivo: row.comentario,
          titulo: ref?.titulo ?? "Actividad sin título",

          vecinoNombre: usr?.nombre ?? "Vecino",
          vecinoCorreo: usr?.correo ?? null,
          vecinoRut: usr?.rut ?? null,
          vecinoFoto: usr?.url_foto_perfil ?? null,
        };
      });

      // 3) Proyectos
      const { data: proyData } = await this.supabase.client
        .from("proyecto_postulacion")
        .select(`
          id_postulacion,
          id_auth,
          estado,
          descripcion,
          fecha,
          proyecto:proyecto(id_proyecto,titulo)
        `);

      const proyectosFormateados: ItemUnico[] = (proyData || []).map((row: ProyectoRow) => {
        const ref = this.normalizarProyecto(row.proyecto);
        const usr = mapaUsuarios.get(row.id_auth);

        return {
          tipo: "proyecto",
          idRegistro: row.id_postulacion,
          estado: row.estado,
          fecha: row.fecha,
          motivo: row.descripcion,
          titulo: ref?.titulo ?? "Proyecto sin título",

          vecinoNombre: usr?.nombre ?? "Vecino",
          vecinoCorreo: usr?.correo ?? null,
          vecinoRut: usr?.rut ?? null,
          vecinoFoto: usr?.url_foto_perfil ?? null,
        };
      });

      this.solicitudes = [...actividadesFormateadas, ...proyectosFormateados];

      this.totalActividades = actividadesFormateadas.length;
      this.totalProyectos = proyectosFormateados.length;

      this.aplicarFiltro();

    } catch (e) {
      console.error("ERROR CARGA", e);
    }

    this.isLoading = false;
  }

  // ======================== FILTROS ========================
  aplicarFiltro() {
    let lista = [...this.solicitudes];

    if (this.filtroTipo !== "todos") {
      lista = lista.filter(s =>
        this.filtroTipo === "actividades" ? s.tipo === "actividad" : s.tipo === "proyecto"
      );
    }

    if (this.filtroEstado !== "todos") {
      lista = lista.filter(s => s.estado === this.filtroEstado);
    }

    this.solicitudesFiltradas = lista;
  }

  // ======================== UPDATE ESTADO ========================
  cambiarEstado(item: ItemUnico, estado: string) {
    this.actualizarEstado(item, estado);
  }

  async actualizarEstado(item: ItemUnico, nuevoEstado: string) {
    const tabla = item.tipo === "actividad"
      ? "actividad_inscripcion"
      : "proyecto_postulacion";

    const columna = item.tipo === "actividad"
      ? "id_inscripcion"
      : "id_postulacion";

    const { error } = await this.supabase.client
      .from(tabla)
      .update({ estado: nuevoEstado })
      .eq(columna, item.idRegistro);

    if (!error) this.cargarDatos();
  }

  goBack() {
    history.back();
  }

  getFotoPerfil(path: string | null) {
    if (!path) return "assets/default-avatar.png";
    return path;
  }

  onAvatarError(e: any) {
    e.target.src = "assets/default-avatar.png";
  }
}
