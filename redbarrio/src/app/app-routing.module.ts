// src/app/app-routing.module.ts
import { NgModule } from '@angular/core';
import { PreloadAllModules, RouterModule, Routes } from '@angular/router';
import { AuthGuard } from './core/auth-guard';

const routes: Routes = [
  { path: '', redirectTo: 'auth/login', pathMatch: 'full' },

  {
    path: 'auth/login',
    loadComponent: () =>
      import('./auth/login/login.page').then((c) => c.LoginPage),
  },
  {
    path: 'auth/register',
    loadComponent: () =>
      import('./auth/register/register.page').then((c) => c.RegisterPage), // 👈 Debe existir EXACTAMENTE este export
  },
  {
    path: 'solicitar',
    canActivate: [AuthGuard],
    loadComponent: () =>
      import('./certificados/solicitar/solicitar.page').then(
        (c) => c.SolicitarCertificadoPage
      ),
  },
  {
    path: 'pago-retorno',
    loadComponent: () =>
      import('./pago-retorno/pago-retorno.page').then((m) => m.PagoRetornoPage),
  },
  {
    path: 'noticias/crear',
    loadComponent: () =>
      import('./crear-noticia/crear-noticia.page').then(
        (m) => m.CrearNoticiaPage
      ),
  },
  {
    path: 'noticias/:id',
    loadComponent: () =>
      import('./detalle-noticia/detalle-noticia.page').then(
        (m) => m.DetalleNoticiaPage
      ),
  },
  {
    path: 'votacion/:id',
    canActivate: [AuthGuard],
    loadComponent: () =>
      import('./votaciones/votacion.page').then((m) => m.VotacionPage),
  },
  {
    path: 'votaciones',
    loadComponent: () =>
      import('./votaciones-list/votaciones-list.page').then(
        (m) => m.VotacionesListPage
      ),
  },
  {
    path: 'solicitud',
    loadComponent: () =>
      import('./solicitud/solicitud.page').then((m) => m.SolicitudPage),
  },
  {
    path: 'perfil', // o /cuenta
    // Agrega el AuthGuard para proteger el perfil
    canActivate: [AuthGuard],
    loadComponent: () =>
      import('./perfil/perfil.page').then((m) => m.PerfilPage),
  },
  {
    path: 'generar/proyecto',
    canActivate: [AuthGuard],
    data: { roles: ['administrador'] }, // solo permite a usuario de tipo "administrador"
    loadComponent: () =>
      import(
        './generar/proyecto/generar-proyecto/generar-proyecto.component'
      ).then((m) => m.GenerarProyectoComponent),
  },
  {
    path: 'espacios',
    loadComponent: () =>
      import('./espacios/espacios.page').then((m) => m.EspaciosPage),
  },
  {
    path: 'espacio/crear',
    canActivate: [AuthGuard],
    loadComponent: () =>
      import('./espacios/crear-espacios/crear-espacio.page').then(
        (m) => m.CrearEspacioPage
      ),
  },
  {
    path: 'espacios/:id',
    loadComponent: () =>
      import('./espacios/detalle-espacio/detalle-espacio.page').then(
        (m) => m.DetalleEspacioPage
      ),
  },
  {
    path: 'generar/votacion',
    canActivate: [AuthGuard],
    data: { roles: ['administrador'] },
    loadComponent: () =>
      import('./generar-votacion/generar-votacion.page').then(
        (m) => m.GenerarVotacionPage
      ),
  },
  {
    path: 'auth/recuperar-contrasena',
    loadComponent: () =>
      import('./auth/update-password/update-password.page').then(
        (m) => m.UpdatePasswordPage
      ),
  },
  {
    path: 'admin/solicitudes',
    canActivate: [AuthGuard],
    data: { roles: ['administrador'] },
    loadComponent: () =>
      import('./admin/solicitudes/solicitudes.page').then(
        (m) => m.SolicitudesPage
      ),
  },
  {
    path: 'inscripcion',
    children: [
      {
        path: 'proyectos',
        loadComponent: () =>
          import('./inscripcion/proyectos/proyectos.page').then(
            (m) => m.ProyectosPage
          ),
      },
      {
        path: 'inscripcion-proyecto/:id',
        loadComponent: () =>
          import(
            './inscripcion/inscripcion-proyecto/inscripcion-proyecto.component'
          ).then((m) => m.InscripcionProyectoComponent),
      },
    ],
  },
<<<<<<< Updated upstream
=======
  {
    path: 'admin/gestiones',
    loadComponent: () =>
      import('./admin/gestiones/gestiones.page').then((m) => m.GestionesPage),
  },

  {
    path: 'admin/solicitudes',
    canActivate: [AuthGuard],
    data: { roles: ['administrador'] },
    loadComponent: () =>
      import('./admin/solicitudes/solicitudes.page').then(
        (m) => m.SolicitudesPage
      ),
  },

>>>>>>> Stashed changes
  {
    path: 'home',
    canActivate: [AuthGuard],
    loadComponent: () => import('./home/home.page').then((m) => m.HomePage),
  },

  { path: '**', redirectTo: 'auth/login' },
];

@NgModule({
  imports: [
    RouterModule.forRoot(routes, { preloadingStrategy: PreloadAllModules }),
  ],
  exports: [RouterModule],
})
export class AppRoutingModule {}
