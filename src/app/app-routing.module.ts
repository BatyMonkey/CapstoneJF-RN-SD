import { NgModule } from '@angular/core';
import { PreloadAllModules, RouterModule, Routes } from '@angular/router';
import { AuthGuard } from './core/auth-guard'; // ajusta al path real

const routes: Routes = [
  { path: '', redirectTo: 'auth/login', pathMatch: 'full' },

  // auth (standalone)
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

  // home protegido (standalone)
  {
    path: 'home',
    canActivate: [AuthGuard],
    loadComponent: () =>
      import('./home/home.page').then(m => m.HomePage),
  },

  // si usas tabs (standalone), similar:
  // {
  //   path: 'tabs',
  //   canActivate: [AuthGuard],
  //   loadComponent: () =>
  //     import('./tabs/tabs.page').then(m => m.TabsPage),
  // },
  {
    path: 'certificados',
    loadComponent: () =>
      import('./certificados/certificados.page').then(m => m.CertificadosPage)
  },
  {
    path: 'noticias',
    loadComponent: () =>
      import('./noticias/noticias.page').then(m => m.NoticiasPage)
  },
  {
    path: 'calendario',
    loadComponent: () =>
      import('./calendario/calendario.page').then(m => m.CalendarioPage)
  },
  {
    path: 'solicitudes',
    loadComponent: () =>
      import('./solicitudes/solicitudes.page').then(m => m.SolicitudesPage)
  },
  //tinen que ir todas las rutas sobre esta, porque si no manda al login

  { path: '**', redirectTo: 'auth/login' },
];

@NgModule({
  imports: [RouterModule.forRoot(routes, { preloadingStrategy: PreloadAllModules })],
  exports: [RouterModule],
})
export class AppRoutingModule {}

