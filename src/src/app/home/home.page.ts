import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { IonicModule, MenuController } from '@ionic/angular';
import { CommonModule } from '@angular/common';
import { AuthService } from '../auth/auth.service';

@Component({
  selector: 'app-home',
  standalone: true,
  templateUrl: './home.page.html',
  styleUrls: ['./home.page.scss'],
  imports: [IonicModule, CommonModule],
})
export class HomePage {
  constructor(
    private router: Router,
    private menu: MenuController,
    private auth: AuthService
  ) {}

  async go(path: string) {
    await this.router.navigate(['/', path]);
    await this.menu.close('main-menu'); // <-- Cierra el menú global
  }

  async goVotacion() {
    // Reemplaza 'VOTACION-DEMOSTRACION' por un id real de tu BD
    await this.router.navigate(['/votacion', 'VOTACION-DEMOSTRACION']);
    await this.menu.close('main-menu');
  }

  async salir() {
    try {
      await this.auth.signOut();
    } finally {
      await this.menu.close('main-menu');
      await this.router.navigateByUrl('/login', { replaceUrl: true });
    }
  }
}
