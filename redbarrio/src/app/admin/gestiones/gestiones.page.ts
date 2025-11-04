import { Component } from '@angular/core';
import { IonicModule } from '@ionic/angular';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

@Component({
  standalone: true,
  selector: 'app-gestiones',
  templateUrl: './gestiones.page.html',
  styleUrls: ['./gestiones.page.scss'],
  imports: [IonicModule, CommonModule, RouterModule],
})
export class GestionesPage {
  constructor() {}

  /** Se ejecuta cuando se vuelve a esta vista, incluso con gesto Android */
  ionViewDidEnter() {
    setTimeout(() => this.resetButtonsVisualState(), 80);
  }

  private resetButtonsVisualState() {
    const buttons = document.querySelectorAll('ion-button');

    buttons.forEach((btn) => {
      // 🔹 Limpieza externa
      btn.classList.remove('ion-focused', 'ion-activated');
      btn.removeAttribute('aria-pressed');

      // 🔹 Limpieza interna dentro del Shadow DOM
      const shadow = (btn as any).shadowRoot;
      if (shadow) {
        const native = shadow.querySelector('.button-native') as HTMLElement;
        if (native) {
          // Quita clases de activación visual (el "levantamiento")
          native.classList.remove('ion-focused', 'ion-activated');
          native.style.transform = 'none';
          native.style.boxShadow = 'none';
        }
      }
    });

    // Forzamos un pequeño repintado global para garantizar que desaparezca
    document.body.style.transform = 'scale(1)';
    requestAnimationFrame(() => (document.body.style.transform = ''));
  }
}
