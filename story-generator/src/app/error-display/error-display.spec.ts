import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ErrorDisplay } from './error-display';

describe('ErrorDisplay', () => {
  let component: ErrorDisplay;
  let fixture: ComponentFixture<ErrorDisplay>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ErrorDisplay]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ErrorDisplay);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
