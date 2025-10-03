import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';

import { GenerarProyectoComponent } from './generar-proyecto.component';

describe('GenerarProyectoComponent', () => {
  let component: GenerarProyectoComponent;
  let fixture: ComponentFixture<GenerarProyectoComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      imports: [GenerarProyectoComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(GenerarProyectoComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }));

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
