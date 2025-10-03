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
      import('./auth/register/register.page').then(c => c.RegisterPage), 
  },
  {
    path: 'solicitar',
    loadComponent: () =>
      import('./certificados/solicitar/solicitar.page').then(c => c.SolicitarCertificadoPage),
  },
  
  // ----------------------------------------------------
  // INICIO DE LA CORRECCIÓN DE RUTAS DE NOTICIAS
  // ----------------------------------------------------
  
  // 1. RUTA ESPECÍFICA PARA CREAR (Debe ir primero para que no sea confundida con un ID)
  {
    path: 'noticias/crear',
    loadComponent: () => import('./crear-noticia/crear-noticia.page').then(m => m.CrearNoticiaPage)
  },

  // 2. RUTA PRINCIPAL (LISTA)
  {
    path: 'noticias',
    loadComponent: () => import('./noticias/noticias.page').then(m => m.NoticiasPage)
  },

  // 3. RUTA GENÉRICA (DETALLE) - Debe ir al final
  {
    path: 'noticias/:id',
    loadComponent: () => import('./detalle-noticia/detalle-noticia.page').then(m => m.DetalleNoticiaPage)
  },

  // ----------------------------------------------------
  // FIN DE LA CORRECCIÓN DE RUTAS
  // ----------------------------------------------------

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