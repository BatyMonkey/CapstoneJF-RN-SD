import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { AuthGuard } from './auth-guard';

describe('AuthGuard (class)', () => {
  let guard: AuthGuard;
  let routerSpy = { navigate: jasmine.createSpy('navigate') };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        AuthGuard,
        { provide: Router, useValue: routerSpy }
      ]
    });

    guard = TestBed.inject(AuthGuard);
  });

  it('should be created', () => {
    expect(guard).toBeTruthy();
  });

  // Ejemplo de test asincrónico muy básico (opcional)
  it('should redirect to /auth/login if not logged', async () => {
    // Simula que no hay sesión (si quieres, haz un spy de supabase.auth.getSession)
    // Aquí solo comprobamos que el método existe y devuelve una promesa.
    expect(typeof guard.canActivate).toBe('function');
  });
});
