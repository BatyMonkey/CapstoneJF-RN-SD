<<<<<<< HEAD
// src/app/home/home.page.ts
import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { FormsModule } from '@angular/forms'; // si usas ngModel

@Component({
  standalone: true,
  selector: 'app-home',
  templateUrl: './home.page.html',
  styleUrls: ['./home.page.scss'],
  imports: [IonicModule, CommonModule, FormsModule], // <-- clave
})
export class HomePage {
  // tu lógica aquí
}
=======
import { Component, OnInit } from '@angular/core';

// Asegúrate de importar el IonicModule aquí
import { IonicModule } from '@ionic/angular'; 
// También es buena práctica importar las directivas comunes
import { CommonModule } from '@angular/common'; 
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
  standalone: true,
  imports: [
    IonicModule, // <-- ¡ESTO ES LO CRUCIAL!
    CommonModule,
    FormsModule
    // Añade cualquier otro componente standalone o módulo que necesites
  ] 
})
export class HomePage{
  // ...
}
>>>>>>> master
