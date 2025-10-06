import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';

import { InscripcionProyectoComponent } from './inscripcion-proyecto.component';

describe('InscripcionProyectoComponent', () => {
  let component: InscripcionProyectoComponent;
  let fixture: ComponentFixture<InscripcionProyectoComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      imports: [InscripcionProyectoComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(InscripcionProyectoComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }));

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
