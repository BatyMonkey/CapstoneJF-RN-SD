import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { SolicitarCertificadoPage } from './solicitar.page';

const routes: Routes = [
  { path: '', component: SolicitarCertificadoPage }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class SolicitarPageRoutingModule {}
