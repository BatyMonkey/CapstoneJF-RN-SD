// src/app/app.module.ts

import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { RouteReuseStrategy } from '@angular/router';
// 🚨 Importar las nuevas funciones de configuración
import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http'; 
// Ya no necesitamos importar HttpClientModule

import { IonicModule, IonicRouteStrategy } from '@ionic/angular';

import { AppComponent } from './app.component';
import { AppRoutingModule } from './app-routing.module';

@NgModule({
  //declarations: [AppComponent],
  imports: [
    BrowserModule, 
    IonicModule.forRoot(), 
    AppRoutingModule,
  ],
  providers: [
    { provide: RouteReuseStrategy, useClass: IonicRouteStrategy },
    
    provideHttpClient(withInterceptorsFromDi()), 
  ],
  bootstrap: [AppComponent],
})
export class AppModule {}