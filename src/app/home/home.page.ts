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