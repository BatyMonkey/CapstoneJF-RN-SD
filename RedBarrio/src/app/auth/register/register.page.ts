// src/app/auth/register/register.page.ts
import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { supabase } from '../../core/supabase.client'; // ← ajusta la ruta si difiere

@Component({
  standalone: true,
  selector: 'app-register',
  templateUrl: './register.page.html',
  styleUrls: ['./register.page.scss'],
  imports: [IonicModule, CommonModule, FormsModule],
})
export class RegisterPage {
  nombre = '';
  email = '';
  password = '';
  loading = false;
  errorMsg = '';

  constructor(private router: Router) {}

  async register() {
    this.loading = true;
    this.errorMsg = '';
    try {
      // 1) Crear usuario de Auth
      const { data, error } = await supabase.auth.signUp({
        email: this.email,
        password: this.password,
        options: {
          data: { full_name: this.nombre }, // metadata opcional
        },
      });
      if (error) throw error;

      const authId = data.user?.id; // <- UUID del usuario en auth.users
      if (!authId) throw new Error('No se obtuvo el ID de usuario de Supabase.');

      // Si tu proyecto exige confirmación por email, no tendrás sesión aquí.
      // En ese caso, intenta iniciar sesión para obtener el JWT y poder insertar.
      let hasSession = !!data.session;

      if (!hasSession) {
        // Intentar login inmediato (si confirmación está desactivada funcionará;
        // si está activada, fallará hasta que confirme el correo).
        const { data: loginData, error: loginErr } = await supabase.auth.signInWithPassword({
          email: this.email,
          password: this.password,
        });
        if (loginErr) {
          // No hay sesión => no podrás insertar por RLS. Redirige a login y crea el registro en el primer login (Opción 2).
          // También puedes mostrar un mensaje claro.
          this.router.navigateByUrl('/auth/login', { replaceUrl: true });
          return;
        }
        hasSession = !!loginData.session;
      }

      // 2) Insertar fila en public.usuario
      // ADAPTA los nombres de columnas a tu tabla: user_id, id_auth, nombre, correo...
      const { error: insErr } = await supabase.from('usuario').insert({
        user_id: authId,         // <- usa la columna que pusiste NOT NULL
        id_auth: authId,         // si la tienes
        nombre: this.nombre,
        correo: this.email,
        creado_en: new Date().toISOString(), // si existe la columna
      });
      if (insErr) throw insErr;

      // 3) Redirigir
      this.router.navigateByUrl('/auth/login', { replaceUrl: true });
    } catch (e: any) {
      this.errorMsg = e?.message ?? 'Error al registrar la cuenta';
    } finally {
      this.loading = false;
    }
  }
}

