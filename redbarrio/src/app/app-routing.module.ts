// src/app/app-routing.module.ts
import { NgModule } from '@angular/core';
import { PreloadAllModules, RouterModule, Routes } from '@angular/router';
import { AuthGuard } from './core/auth-guard';

const routes: Routes = [
  { path: '', redirectTo: 'auth/login', pathMatch: 'full' },

  // ===== Auth =====
  {
    path: 'auth/login',
    loadComponent: () =>
      import('./auth/login/login.page').then((c) => c.LoginPage),
  },
  {
    path: 'auth/register',
    loadComponent: () =>
      import('./auth/register/register.page').then((c) => c.RegisterPage),
  },

  // 🔁 Callback para Supabase (web/dev). Debe existir el componente.
  {
    path: 'auth/callback',
    loadComponent: () =>
      import('./auth/auth-callback/auth-callback.page').then(
        (m) => m.AuthCallbackPage
      ),
  },

  // ✅ Ruta ASCII para el form de nueva contraseña
  {
    path: 'auth/recuperar-contrasena',
    loadComponent: () =>
      import('./auth/update-password/update-password.page').then(
        (m) => m.UpdatePasswordPage
      ),
  },
  // 🔀 Redirect si quedó algún link con "ñ"
  {
    path: 'auth/recuperar-contraseña',
    redirectTo: 'auth/recuperar-contrasena',
    pathMatch: 'full',
  },

  // ===== Pagos / Retorno Webpay =====
  {
    path: 'pago-retorno',
    loadComponent: () =>
      import('./pago-retorno/pago-retorno.page').then((m) => m.PagoRetornoPage),
  },
  {
    path: 'noticias',
    loadComponent: () =>
      import('./noticias/noticias.page').then((m) => m.NoticiasPage),
  },

  // ===== Noticias =====
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

  // ===== Votaciones =====
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

  // ===== Certificados / Solicitudes =====
  {
    path: 'solicitar',
    canActivate: [AuthGuard],
    loadComponent: () =>
      import('./certificados/solicitar/solicitar.page').then(
        (c) => c.SolicitarCertificadoPage
      ),
  },
  {
    path: 'solicitud',
    loadComponent: () =>
      import('./solicitud/solicitud.page').then((m) => m.SolicitudPage),
  },

  // ===== Perfil =====
  {
    path: 'perfil',
    canActivate: [AuthGuard],
    loadComponent: () =>
      import('./perfil/perfil.page').then((m) => m.PerfilPage),
  },

  // ===== Generar (admin/vecino donde aplique) =====
  {
    path: 'generar/proyecto',
    canActivate: [AuthGuard],
    data: { roles: ['administrador', 'vecino'] },
    loadComponent: () =>
      import(
        './generar/proyecto/generar-proyecto/generar-proyecto.component'
      ).then((m) => m.GenerarProyectoComponent),
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

  // ===== Dashboard / Espacios =====
  {
    path: 'dashboard',
    loadComponent: () =>
      import('./dashboard/dashboard.component').then(
        (m) => m.DashboardComponent
      ),
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

  // ===== Inscripción =====
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

  // ===== Admin =====
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
    path: 'admin/actividades',
    canActivate: [AuthGuard],
    data: { roles: ['administrador'] },
    loadComponent: () =>
      import('./admin/actividades/actividades.page').then(
        (m) => m.ActividadesPage
      ),
  },
  {
    path: 'admin/proyectos',
    canActivate: [AuthGuard],
    data: { roles: ['administrador'] },
    loadComponent: () =>
      import('./admin/proyectos/proyectos.page').then((m) => m.ProyectosPage),
  },
  {
    path: 'admin/gestiones',
    loadComponent: () =>
      import('./admin/gestiones/gestiones.page').then((m) => m.GestionesPage),
  },
  {
    path: 'admin/auditoria',
    canActivate: [AuthGuard],
    data: { roles: ['administrador'] },
    loadComponent: () =>
      import('./admin/auditoria/auditoria.page').then((m) => m.AuditoriaPage),
  },

  // ===== Home (protegido) =====
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
    path: 'admin/actividades',
    loadComponent: () =>
      import('./admin/actividades/actividades.page').then(
        (m) => m.ActividadesPage
      ),
  },
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
  {
    path: 'admin/actividades',
    canActivate: [AuthGuard],
    data: { roles: ['administrador'] },
    loadComponent: () =>
      import('./admin/actividades/actividades.page').then(
        (m) => m.ActividadesPage
      ),
  },
  {
    path: 'admin/proyectos',
    canActivate: [AuthGuard],
    data: { roles: ['administrador'] },
    loadComponent: () =>
      import('./admin/proyectos/proyectos.page').then((m) => m.ProyectosPage),
  },
  {
    path: 'admin/auditoria',
    canActivate: [AuthGuard],
    data: { roles: ['administrador'] },
    loadComponent: () =>
      import('./admin/auditoria/auditoria.page').then((m) => m.AuditoriaPage),
  },
  {
    path: 'admin/noticias',
    canActivate: [AuthGuard],
    data: { roles: ['administrador'] },
    loadComponent: () =>
      import('./admin/noticias/noticias.page').then((m) => m.NoticiasPage),
  },

  {
    path: 'home',
    canActivate: [AuthGuard],
    loadComponent: () => import('./home/home.page').then((m) => m.HomePage),
  },

  // ===== Fallback =====
  { path: '**', redirectTo: 'auth/login' },
];

@NgModule({
  imports: [
    RouterModule.forRoot(routes, { preloadingStrategy: PreloadAllModules }),
  ],
  exports: [RouterModule],
})
export class AppRoutingModule {}
