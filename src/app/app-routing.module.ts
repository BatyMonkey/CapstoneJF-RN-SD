// src/app/app-routing.module.ts
import { NgModule } from '@angular/core';
import { PreloadAllModules, RouterModule, Routes } from '@angular/router';
import { AuthGuard } from './core/auth-guard'; // ajusta si tu guard está en otro path

const routes: Routes = [
  { path: '', redirectTo: 'auth/login', pathMatch: 'full' },

  {
    path: 'solicitar',
    // canActivate: [AuthGuard], // opcional
    loadComponent: () =>
      import('./certificados/solicitar/solicitar.page')  // << ruta correcta
        .then(m => m.SolicitarCertificadoPage),
  },

  {
    path: 'auth/login',
    loadComponent: () =>
      import('./auth/login/login.page').then(m => m.LoginPage),
  },
  {
    path: 'auth/register',
    loadComponent: () =>
      import('./auth/register/register.page').then(m => m.RegisterPage),
  },

  {
    path: 'home',
    canActivate: [AuthGuard],
    loadComponent: () =>
      import('./home/home.page').then(m => m.HomePage),
  },
<<<<<<< HEAD

=======
  {
  path: 'noticias',
  loadComponent: () => import('./noticias/noticias.page').then(m => m.NoticiasPage),
  },
  {
  path: 'noticias/:id', // La variable ':id' es crucial
  loadComponent: () => import('./detalle-noticia/detalle-noticia.page').then(m => m.DetalleNoticiaPage)
},
  //TODAS LAS RUTAS DEBEN IR SOBRE ESTE
>>>>>>> master
  { path: '**', redirectTo: 'auth/login' },
];

@NgModule({
  imports: [RouterModule.forRoot(routes, { preloadingStrategy: PreloadAllModules })],
  exports: [RouterModule],
})
<<<<<<< HEAD
export class AppRoutingModule {}



=======
export class AppRoutingModule {}
>>>>>>> master
