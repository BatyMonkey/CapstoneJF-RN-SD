import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { RouteReuseStrategy } from '@angular/router';
import { IonicModule, IonicRouteStrategy } from '@ionic/angular';
import { Chart, ArcElement, Tooltip, Legend, Title, DoughnutController } from 'chart.js';
import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';

// ✅ Registrar los elementos necesarios de Chart.js para los gráficos tipo doughnut
Chart.register(ArcElement, Tooltip, Legend, Title, DoughnutController);

@NgModule({
  // ⛔️ No declares componentes standalone
  declarations: [],
  imports: [
    BrowserModule,
    IonicModule.forRoot(),
    AppRoutingModule,
    AppComponent, // ✅ importa el root standalone
  ],
  providers: [{ provide: RouteReuseStrategy, useClass: IonicRouteStrategy }],
  bootstrap: [AppComponent], // ✅ bootstrapea el standalone
})
export class AppModule {}
