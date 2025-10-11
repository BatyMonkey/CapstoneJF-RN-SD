import { TestBed } from '@angular/core/testing';
import { NoticiasService } from './noticias'; // <-- nombre correcto del servicio

describe('NoticiasService', () => {
  let service: NoticiasService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      // providers: [NoticiasService], // opcional; no hace falta si providedIn:'root'
    });
    service = TestBed.inject(NoticiasService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
