// src/app/crear-noticia/crear-noticia.page.ts

import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormArray, FormControl } from '@angular/forms'; 
import { Router, RouterModule } from '@angular/router';

// Vuelve la inicialización directa del cliente
import { createClient, SupabaseClient, User } from '@supabase/supabase-js'; 
import { environment } from 'src/environments/environment';

import { IonicModule } from '@ionic/angular';

// Constantes de límites
const IMAGES_BUCKET = 'noticias-bucket'; 
const MAX_PARRAFOS = 6;
const MAX_IMAGENES = 5;

@Component({
  selector: 'app-crear-noticia',
  templateUrl: './crear-noticia.page.html',
  styleUrls: ['./crear-noticia.page.scss'],
  standalone: true,
  imports: [CommonModule, IonicModule, RouterModule, ReactiveFormsModule],
})
export class CrearNoticiaPage implements OnInit {
  public supabase: SupabaseClient;

  noticiaForm!: FormGroup;
  estaGuardando = false;

  usuarioAutenticado: User | null = null;
  nombreAutor: string | null = null;

  // Array para manejar 5 posibles selecciones de archivos (inicializado con nulls)
  archivosSeleccionados: (File | null)[] = new Array(MAX_IMAGENES).fill(null);
  estaSubiendoImagen = false;

  MAX_PARRAFOS = MAX_PARRAFOS;
  MAX_IMAGENES = MAX_IMAGENES;

  constructor(private fb: FormBuilder, private router: Router) {
    // Inicialización directa del cliente (versión funcional)
    this.supabase = createClient(
      environment.supabaseUrl,
      environment.supabaseAnonKey
    );
  }

  // --- GETTERS TIPADOS PARA EL HTML ---
  get parrafosFormArray(): FormArray<FormControl<string | null>> {
    // Obtiene el FormArray de párrafos
    return this.noticiaForm.get('parrafos') as FormArray<
      FormControl<string | null>
    >;
  }

  get parrafoControls(): FormControl<string | null>[] {
    // Obtiene los controles individuales
    return this.parrafosFormArray.controls;
  }

  // ------------------------------------

  async ngOnInit() {
    this.noticiaForm = this.fb.group({
      titulo: ['', [Validators.required, Validators.maxLength(100)]],
      parrafos: this.fb.array([]), // Array dinámico para los párrafos
    });

    // Inicializa el formulario con el párrafo obligatorio
    this.agregarParrafo(true);
    this.noticiaForm.reset();

    // Obtener el usuario y el nombre del autor
    await this.inicializarUsuarioYAutor();
  }

  // --- Helpers para Párrafos ---

  crearParrafoControl(esObligatorio: boolean = false): FormControl {
    const validators = esObligatorio ? [Validators.required] : [];
    // Inicializa el control con null
    return new FormControl<string | null>(null, validators) as FormControl;
  }

  agregarParrafo(esObligatorio: boolean = false) {
    if (this.parrafosFormArray.length < MAX_PARRAFOS) {
      this.parrafosFormArray.push(this.crearParrafoControl(esObligatorio));
    }
  }

  quitarParrafo(index: number) {
    // Debe haber al menos un párrafo (el obligatorio)
    if (this.parrafosFormArray.length > 1) {
      this.parrafosFormArray.removeAt(index);

      // Si el elemento eliminado era el primero, el nuevo índice 0 debe ser obligatorio
      if (index === 0 && this.parrafosFormArray.length > 0) {
        this.parrafosFormArray.at(0).setValidators([Validators.required]);
        this.parrafosFormArray.at(0).updateValueAndValidity();
      }
    }
  }

  // --- Lógica de Usuario ---

  async inicializarUsuarioYAutor() {
    // Usamos el cliente para obtener el usuario
    const {
      data: { user },
    } = await this.supabase.auth.getUser();
    this.usuarioAutenticado = user;

    if (!user) {
      // Redirige al login si no hay usuario (aunque el router ya lo haría)
      this.router.navigate(['/login']);
      return;
    }

    try {
      // Asume que la tabla 'usuario' tiene la columna 'user_id' para el enlace
      const { data: perfil, error } = await this.supabase
        .from('usuario')
        .select('nombre')
        .eq('user_id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      this.nombreAutor = perfil?.nombre || 'Autor Desconocido';
    } catch (err) {
      this.nombreAutor = 'Autor Desconocido';
    }
  }

  // --- Manejo de Múltiples Archivos ---

  onFileSelected(event: any, index: number) {
    const file: File = event.target.files[0];
    if (file) {
      this.archivosSeleccionados[index] = file;
    } else {
      this.archivosSeleccionados[index] = null;
    }
  }

  // --- Subida de Múltiples Imágenes ---

  async subirImagenes(): Promise<string[] | null> {
    const user = this.usuarioAutenticado;
    if (!user) return null;

    this.estaSubiendoImagen = true;
    const urls: string[] = [];

    // Validar que la primera imagen (índice 0) sea obligatoria
    if (!this.archivosSeleccionados[0]) {
      alert('La primera imagen es obligatoria.');
      this.estaSubiendoImagen = false;
      return null;
    }

    try {
      for (let i = 0; i < MAX_IMAGENES; i++) {
        const file = this.archivosSeleccionados[i];

        if (file) {
          // Crea una ruta única para el archivo
          const filePath = `${
            user.id
          }/noticias/${Date.now()}_${i}_${file.name.replace(/ /g, '_')}`;

          const { error } = await this.supabase.storage
            .from(IMAGES_BUCKET)
            .upload(filePath, file);

          if (error) throw error;

          const { data: publicUrlData } = this.supabase.storage
            .from(IMAGES_BUCKET)
            .getPublicUrl(filePath);

          urls.push(publicUrlData.publicUrl);
        }
      }
      this.estaSubiendoImagen = false;
      return urls;
    } catch (error) {
      this.estaSubiendoImagen = false;
      console.error('Error subiendo imágenes:', error);
      alert('Error subiendo las imágenes. Intenta de nuevo.');
      return null;
    }
  }

  // --- Lógica Final de Creación de Noticia ---

  async crearNoticia() {
    this.noticiaForm.markAllAsTouched();

    // Verificaciones antes de guardar
    if (
      this.parrafosFormArray.invalid ||
      this.noticiaForm.invalid ||
      this.estaGuardando ||
      this.estaSubiendoImagen ||
      !this.usuarioAutenticado
    ) {
      alert(
        'Por favor, completa el título y el primer párrafo antes de continuar.'
      );
      return;
    }

    this.estaGuardando = true;

    // 1. Subir todas las imágenes seleccionadas (valida que la primera exista)
    const urlsFotos = await this.subirImagenes();
    if (urlsFotos === null) {
      this.estaGuardando = false;
      return;
    }

    // 2. Extraer los textos de los párrafos (filtrando los vacíos)
    const parrafos = this.parrafosFormArray.controls
      .map((control) => control.value as string)
      .filter((text) => text && text.trim().length > 0);

    // 3. Preparar los datos
    const nuevaNoticia = {
      titulo: this.noticiaForm.value.titulo,
      parrafos: parrafos, // Array de strings

      url_foto: urlsFotos, // Array de URLs

      nombre_autor: this.nombreAutor,
      fecha_creacion: new Date().toISOString(),
      user_id: this.usuarioAutenticado.id,
    };

    // 4. Insertar en la base de datos
    try {
      // Necesitas castear a 'any' o definir una interfaz DB para evitar errores de tipo si usas typescript estricto con Supabase
      const { error } = await this.supabase
        .from('noticias')
        .insert(nuevaNoticia as any);

      if (error) {
        console.error('Error al guardar noticia en Supabase:', error);
        alert('Hubo un error al crear la noticia. Detalle: ' + error.message);
      } else {
        alert('Noticia creada con éxito!');

        this.noticiaForm.reset();
        this.parrafosFormArray.clear();
        this.agregarParrafo(true);
        this.archivosSeleccionados = new Array(MAX_IMAGENES).fill(null);

        // 🚀 CORRECCIÓN: Usamos navigateByUrl con replaceUrl: true
        // para una navegación más limpia que fuerza la actualización del destino.
        this.router.navigateByUrl('/home', { replaceUrl: true });
      }
    } catch (err) {
      console.error('Error inesperado:', err);
      alert('Ocurrió un error inesperado.');
    } finally {
      this.estaGuardando = false;
    }
  }
}