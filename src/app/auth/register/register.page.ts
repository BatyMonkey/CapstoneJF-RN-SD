// src/app/auth/register/register.page.ts
import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { AuthService } from '../auth.service';

@Component({
<<<<<<< HEAD
  standalone: true,
=======
>>>>>>> master
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

  constructor(private auth: AuthService, private router: Router) {}

  async register() {
    this.loading = true;
    this.errorMsg = '';
    try {
      await this.auth.signUp(this.email, this.password, this.nombre);
      // tras registrarse, redirige a login (o directo a /home si prefieres)
      this.router.navigateByUrl('/auth/login', { replaceUrl: true });
    } catch (e: any) {
      this.errorMsg = e?.message ?? 'Error al registrar la cuenta';
    } finally {
      this.loading = false;
    }
  }
}
