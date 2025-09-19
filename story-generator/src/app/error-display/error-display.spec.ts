import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ErrorDisplayComponent } from './error-display';
import { ErrorLoggingService } from '../error-logging';

describe('ErrorDisplayComponent', () => {
  let component: ErrorDisplayComponent;
  let fixture: ComponentFixture<ErrorDisplayComponent>;
  let errorLoggingService: ErrorLoggingService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ErrorDisplayComponent],
      providers: [ErrorLoggingService]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ErrorDisplayComponent);
    component = fixture.componentInstance;
    errorLoggingService = TestBed.inject(ErrorLoggingService);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should display errors when errors exist', () => {
    // Initially no errors
    expect(component.hasErrors()).toBe(false);
    
    // Add an error
    errorLoggingService.logError(new Error('Test error'), 'Test Context', 'error');
    fixture.detectChanges();
    
    // Should now have errors
    expect(component.hasErrors()).toBe(true);
    expect(component.errors.length).toBe(1);
  });

  it('should clear errors when clear button is clicked', () => {
    // Add an error
    errorLoggingService.logError(new Error('Test error'), 'Test Context', 'error');
    fixture.detectChanges();
    
    expect(component.hasErrors()).toBe(true);
    
    // Clear errors
    component.clearErrors();
    fixture.detectChanges();
    
    expect(component.hasErrors()).toBe(false);
  });

  it('should toggle expanded state', () => {
    expect(component.isExpanded).toBe(false);
    
    component.toggleExpanded();
    expect(component.isExpanded).toBe(true);
    
    component.toggleExpanded();
    expect(component.isExpanded).toBe(false);
  });
});
