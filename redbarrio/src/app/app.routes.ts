import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: 'home',
    loadComponent: () => import('./home/home.page').then((m) => m.HomePage),
  },
  {
    path: '',
    redirectTo: 'home',
    pathMatch: 'full',
  },
  {
    path: 'actividades',
    loadComponent: () => import('./admin/actividades/actividades.page').then( m => m.ActividadesPage)
  },
  {
    path: 'actividades',
    loadComponent: () => import('./admin/actividades/actividades.page').then( m => m.ActividadesPage)
  },
  {
    path: 'proyectos',
    loadComponent: () => import('./admin/proyectos/proyectos.page').then( m => m.ProyectosPage)
  },
  {
    path: 'auditoria',
    loadComponent: () => import('./admin/auditoria/auditoria.page').then( m => m.AuditoriaPage)
    path: 'auditoria',
    loadComponent: () => import('./admin/auditoria/auditoria.page').then( m => m.AuditoriaPage)
  },

];
