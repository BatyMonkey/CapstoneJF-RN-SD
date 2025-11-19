// src/main.ts
import { bootstrapApplication } from '@angular/platform-browser';
import { importProvidersFrom } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { IonicModule, IonicRouteStrategy } from '@ionic/angular';
import { AppRoutingModule } from './app/app-routing.module';
import { AppComponent } from './app/app.component';
import {
  HttpClientModule,
  provideHttpClient,
  withInterceptorsFromDi,
} from '@angular/common/http';

import { RouteReuseStrategy } from '@angular/router';

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
  chevronBackOutline,
  calendarOutline,
  clipboardOutline,
  imageOutline,
  helpCircleOutline,
  newspaperOutline,
  paperPlaneOutline,
  closeOutline,
  micOutline,
  stopCircleOutline,
} from 'ionicons/icons';

// registra iconos que usas en footer + home + chatbot
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

  // extras que usas en distintas pantallas
  'chevron-back-outline': chevronBackOutline,
  'calendar-outline': calendarOutline,
  'clipboard-outline': clipboardOutline,
  'image-outline': imageOutline,
  'help-circle-outline': helpCircleOutline,
  'newspaper-outline': newspaperOutline,
  'paper-plane-outline': paperPlaneOutline,
  'close-outline': closeOutline,

  // 🎤 chatbot: nota de voz
  'mic-outline': micOutline,
  'stop-circle-outline': stopCircleOutline,
});

bootstrapApplication(AppComponent, {
  providers: [
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
