import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';

import { DebugPanel } from './debug-panel';

describe('DebugPanel', () => {
  let component: DebugPanel;
  let fixture: ComponentFixture<DebugPanel>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DebugPanel],
      providers: [provideHttpClient()]
    })
    .compileComponents();

    fixture = TestBed.createComponent(DebugPanel);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
