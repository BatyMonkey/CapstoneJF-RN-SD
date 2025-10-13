import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PagoRetornoPage } from './pago-retorno.page';

describe('PagoRetornoPage', () => {
  let component: PagoRetornoPage;
  let fixture: ComponentFixture<PagoRetornoPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(PagoRetornoPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
