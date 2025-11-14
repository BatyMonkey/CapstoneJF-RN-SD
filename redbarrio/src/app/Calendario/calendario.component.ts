import { Component, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { IonicModule } from '@ionic/angular';
import { CommonModule } from '@angular/common';
import { Location } from '@angular/common';

@Component({
  selector: 'app-calendario',
  standalone: true,
  imports: [IonicModule, CommonModule],
  templateUrl: './calendario.component.html',
  styleUrls: ['./calendario.component.scss'],
  schemas: [CUSTOM_ELEMENTS_SCHEMA]   
})
export class CalendarioComponent {
  constructor(private location: Location) {}

  goBack() {
    this.location.back();
  }
}
