import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { FormsModule } from '@angular/forms';

@Component({
  // Se establece como componente independiente (standalone)
  standalone: true,
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
  // Importamos los módulos necesarios directamente
  imports: [IonicModule, CommonModule, FormsModule], 
})
export class HomePage {
  // Agrega aquí las propiedades y la lógica de tu componente, como el constructor o ngOnInit
}
