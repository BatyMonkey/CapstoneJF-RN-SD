// src/app/home/home.page.ts
import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { FormsModule } from '@angular/forms'; // si usas ngModel
import { Router } from '@angular/router';
import { ActionSheetController } from '@ionic/angular';

@Component({
  standalone: true,
  selector: 'app-home',
  templateUrl: './home.page.html',
  styleUrls: ['./home.page.scss'],
  imports: [IonicModule, CommonModule, FormsModule], // <-- clave
})


export class HomePage {
  // tu lógica aquí
  constructor(private router: Router, private actionSheetCtrl: ActionSheetController) {}
  
  solicitudes() {
    this.router.navigate(['/solicitudes'])
  }

  certificados(){
    this.router.navigate(['/certificados'])
  }

  noticias(){
    this.router.navigate(['/noticias'])
  }

  calendario(){
    this.router.navigate(['/calendario'])
  }

  async abrirMenuUsuario() {
    const actionSheet = await this.actionSheetCtrl.create({
      header: 'Usuario',
      buttons: [
        {
          text: 'Ver perfil',
          icon: 'person-outline',
          handler: () => this.router.navigate(['/perfil'])
        },
        {
          text: 'Cerrar sesión',
          icon: 'log-out-outline',
          handler: () => this.router.navigate(['/auth/login'])
        },
        {
          text: 'Cancelar',
          role: 'cancel'
        }
      ]
    });
    await actionSheet.present();
  }
}
