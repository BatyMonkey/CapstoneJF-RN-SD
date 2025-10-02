// src/app/app-routing.module.ts
import { NgModule } from '@angular/core';
import { PreloadAllModules, RouterModule, Routes } from '@angular/router';
import { AuthGuard } from './core/auth-guard';

const routes: Routes = [
  { path: '', redirectTo: 'auth/login', pathMatch: 'full' },

  {
    path: 'auth/login',
    loadComponent: () =>
      import('./auth/login/login.page').then(c => c.LoginPage),
  },
  {
    path: 'auth/register',
    loadComponent: () =>
      import('./auth/register/register.page').then(c => c.RegisterPage), // 👈 Debe existir EXACTAMENTE este export
  },
  {
    path: 'solicitar',
    loadComponent: () =>
      import('./certificados/solicitar/solicitar.page').then(c => c.SolicitarCertificadoPage),
  },
  {
    path: 'noticias',
    loadComponent: () =>
      import('./noticias/noticias.page').then(c => c.NoticiasPage),
  },
  {
    path: 'solicitud',
    loadComponent: () =>
      import('./solicitud/solicitud.page').then(c => c.SolicitudPage),
  },
  {
    path: 'home',
    canActivate: [AuthGuard],
    loadComponent: () =>
      import('./home/home.page').then(c => c.HomePage),
  },

  { path: '**', redirectTo: 'auth/login' },
];

@NgModule({
  imports: [RouterModule.forRoot(routes, { preloadingStrategy: PreloadAllModules })],
  exports: [RouterModule],
})
export class AppRoutingModule {}


