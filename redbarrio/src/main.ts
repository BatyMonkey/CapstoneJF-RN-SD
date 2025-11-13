// src/main.ts
import { bootstrapApplication } from '@angular/platform-browser';
import { importProvidersFrom } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { IonicModule, IonicRouteStrategy } from '@ionic/angular';
import { AppRoutingModule } from './app/app-routing.module';
import { AppComponent } from './app/app.component';
import { HttpClientModule, provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';

import { RouteReuseStrategy } from '@angular/router'; // ⬅️ importa esto

import { addIcons } from 'ionicons';
import {
  homeOutline,
  chatbubbleOutline,
  personCircleOutline,
  checkboxOutline,
  documentTextOutline,
  callOutline,
  checkmarkDoneOutline,
  businessOutline,
  barChartOutline,
  bulbOutline,
  megaphoneOutline,
  peopleOutline,
  timeOutline,
  checkmarkCircleOutline,
  sparklesOutline, 
} from 'ionicons/icons';

// registra iconos que usas en footer + home
addIcons({
  'home-outline': homeOutline,
  'chatbubble-outline': chatbubbleOutline,
  'person-circle-outline': personCircleOutline,
  'checkbox-outline': checkboxOutline,
  'document-text-outline': documentTextOutline,
  'call-outline': callOutline,
  'checkmark-done-outline': checkmarkDoneOutline,
  'business-outline': businessOutline,
  'bar-chart-outline': barChartOutline,
  'bulb-outline': bulbOutline,
  'megaphone-outline': megaphoneOutline,
  'people-outline': peopleOutline,
  'time-outline': timeOutline,
  'checkmark-circle-outline': checkmarkCircleOutline,
  'sparkles-outline': sparklesOutline, 
});

bootstrapApplication(AppComponent, {
  providers: [
    // ⬇️ MUY IMPORTANTE en standalone:
    { provide: RouteReuseStrategy, useClass: IonicRouteStrategy },

    importProvidersFrom(
      BrowserModule,
      IonicModule.forRoot(),
      AppRoutingModule,
      HttpClientModule,
    ),
    provideHttpClient(withInterceptorsFromDi()),
  ],
}).catch((err) => console.error(err));
