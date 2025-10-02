// src/app/auth/login/login.page.ts
import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { AuthService } from '../auth.service';

@Component({
  standalone: true,
  selector: 'app-login',
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
  imports: [IonicModule, CommonModule, FormsModule],
})
export class LoginPage {
  email = '';
  password = '';
  loading = false;
  errorMsg = '';

  constructor(private auth: AuthService, private router: Router) {}

  async login() {
    this.loading = true;
    this.errorMsg = '';
    try {
      await this.auth.signIn(this.email, this.password);
      this.router.navigateByUrl('/home', { replaceUrl: true }); // o '/tabs' si usas tabs
    } catch (e: any) {
      this.errorMsg = e?.message ?? 'Error al iniciar sesión';
    } finally {
      this.loading = false;
    }
  }
}
