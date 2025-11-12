// src/main.ts
import { bootstrapApplication } from '@angular/platform-browser';
import { importProvidersFrom } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { IonicModule } from '@ionic/angular';
import { AppRoutingModule } from './app/app-routing.module';
import { AppComponent } from './app/app.component';
import {
  HttpClientModule,
  provideHttpClient,
  withInterceptorsFromDi,
} from '@angular/common/http';

// 👇👇 AÑADIR ESTO
import { addIcons } from 'ionicons';
import {
  chatbubblesOutline,
  close,
  paperPlaneOutline,
  sparklesOutline,
  documentTextOutline,
  helpCircleOutline,
  checkboxOutline,
  newspaperOutline,
} from 'ionicons/icons';

// registramos los íconos que usamos en el chat
addIcons({
  'chatbubbles-outline': chatbubblesOutline,
  'close': close,
  'paper-plane-outline': paperPlaneOutline,
  'sparkles-outline': sparklesOutline,
  'document-text-outline': documentTextOutline,
  'help-circle-outline': helpCircleOutline,
  'checkbox-outline': checkboxOutline,
  'newspaper-outline': newspaperOutline,
});
// 👆👆 con esto ya no te salen 404

bootstrapApplication(AppComponent, {
  providers: [
    importProvidersFrom(
      BrowserModule,
      IonicModule.forRoot(),
      AppRoutingModule,
      HttpClientModule,
    ),
    provideHttpClient(withInterceptorsFromDi()),
  ],
}).catch((err) => console.error(err));
