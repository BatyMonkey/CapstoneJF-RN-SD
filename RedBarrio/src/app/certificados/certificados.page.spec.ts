import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CertificadosPage } from './certificados.page';

describe('CertificadosPage', () => {
  let component: CertificadosPage;
  let fixture: ComponentFixture<CertificadosPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(CertificadosPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
