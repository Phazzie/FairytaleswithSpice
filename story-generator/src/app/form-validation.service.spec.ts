import { TestBed } from '@angular/core/testing';
import { FormValidationService } from './form-validation.service';
import { StoryGenerationSeam } from './contracts';

function createBlueprint(overrides: Partial<StoryGenerationSeam['input']> = {}): StoryGenerationSeam['input'] {
  return {
    creature: 'vampire',
    themes: [{ id: 'forbidden_love', label: 'Forbidden Love', description: 'A dangerous bond.' }],
    logline: 'A vampire diplomat bargains with the rival she cannot afford to want.',
    spicyLevel: 3,
    tone: 'dark_romance',
    desiredWordBudget: 900,
    chapterBatchSize: 2,
    ...overrides
  };
}

describe('FormValidationService', () => {
  let service: FormValidationService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(FormValidationService);
  });

  it('accepts a complete Story Lab blueprint', () => {
    const errors = service.validateBlueprint(createBlueprint());

    expect(service.isValid(errors)).toBeTrue();
    expect(service.getFirstError(errors)).toBeNull();
  });

  it('requires a logline and at least one theme', () => {
    const errors = service.validateBlueprint(createBlueprint({ logline: '   ', themes: [] }));

    expect(service.isValid(errors)).toBeFalse();
    expect(errors.logline).toContain('logline');
    expect(errors.themes).toContain('thematic seed');
  });

  it('rejects unsupported batch and word-count values', () => {
    const errors = service.validateBlueprint(createBlueprint({
      chapterBatchSize: 4 as StoryGenerationSeam['input']['chapterBatchSize'],
      desiredWordBudget: 500 as StoryGenerationSeam['input']['desiredWordBudget']
    }));

    expect(errors.chapterBatchSize).toContain('1, 2, or 3');
    expect(errors.desiredWordBudget).toContain('word budget');
  });
});
