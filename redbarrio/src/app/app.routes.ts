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
  },  {
<<<<<<< HEAD
    path: 'actividades',
    loadComponent: () => import('./admin/actividades/actividades.page').then( m => m.ActividadesPage)
=======
    path: 'gestiones',
    loadComponent: () => import('./admin/gestiones/gestiones.page').then( m => m.GestionesPage)
>>>>>>> 5699daa8d4845ec29d946ce30953e5f41de8a020
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
  },

];
