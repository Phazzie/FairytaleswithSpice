import { TestBed } from '@angular/core/testing';
import { FormValidationService } from './form-validation.service';
import { StoryGenerationSeam } from './contracts';
import { STORY_BLUEPRINT_LIMITS } from '../../../shared/storyBlueprintLimits';

function createBlueprint(overrides: Partial<StoryGenerationSeam['input']> = {}): StoryGenerationSeam['input'] {
  return {
    creature: 'vampire',
    themes: [{ id: 'forbidden_love', label: 'Forbidden Love', description: 'A dangerous bond.' }],
    logline: 'A vampire diplomat bargains with the rival she cannot afford to want.',
    spicyLevel: 3,
    tone: 'dark_romance',
    desiredWordBudget: 900,
    chapterBatchSize: 2,
    heatContract: {
      adultOnlyConfirmed: true,
      tensionMode: 'slow_burn',
      intimacyBoundary: 'fade_to_black',
      noGoContent: ''
    },
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

  it('requires the Heat Contract adult-reader confirmation', () => {
    const errors = service.validateBlueprint(createBlueprint({
      heatContract: {
        adultOnlyConfirmed: false,
        tensionMode: 'slow_burn',
        intimacyBoundary: 'fade_to_black',
        noGoContent: ''
      }
    }));

    expect(errors.heatContract).toContain('adult readers');
  });

  it('limits Heat Contract no-go content length', () => {
    const errors = service.validateBlueprint(createBlueprint({
      heatContract: {
        adultOnlyConfirmed: true,
        tensionMode: 'slow_burn',
        intimacyBoundary: 'fade_to_black',
        noGoContent: 'x'.repeat(service.maxNoGoContentLength + 1)
      }
    }));

    expect(errors.heatContractNoGoContent).toContain('no-go content');
  });

  it('rejects unsupported Heat Contract tension mode', () => {
    const errors = service.validateBlueprint(createBlueprint({
      heatContract: {
        adultOnlyConfirmed: true,
        tensionMode: 'unsupported_mode' as StoryGenerationSeam['input']['heatContract']['tensionMode'],
        intimacyBoundary: 'fade_to_black',
        noGoContent: ''
      }
    }));

    expect(errors.heatContract).toContain('supported Heat Contract settings');
  });

  // The three free-text caps the blueprint parser measures after trimming. A
  // value that is exactly the cap once trimmed is one the route accepts, so
  // refusing it here is the form disagreeing with the API about a blueprint that
  // is fine — the failure the shared limits module exists to prevent.
  it('accepts free text that only exceeds a cap through surrounding whitespace', () => {
    const errors = service.validateBlueprint(createBlueprint({
      logline: `${'l'.repeat(service.maxLoglineLength)}\n`,
      worldDetails: `  ${'w'.repeat(service.maxWorldDetailsLength)}  `,
      narrativeDirectives: `${'d'.repeat(service.maxNarrativeDirectivesLength)}\n\n`
    }));

    expect(service.isValid(errors)).withContext(service.getFirstError(errors) ?? '').toBeTrue();
  });

  it('still rejects free text past a cap once the surrounding whitespace is gone', () => {
    const errors = service.validateBlueprint(createBlueprint({
      logline: ` ${'l'.repeat(service.maxLoglineLength + 1)} `,
      worldDetails: ` ${'w'.repeat(service.maxWorldDetailsLength + 1)} `,
      narrativeDirectives: ` ${'d'.repeat(service.maxNarrativeDirectivesLength + 1)} `
    }));

    expect(errors.logline).toContain('logline');
    expect(errors.worldDetails).toContain('world details');
    expect(errors.narrativeDirectives).toContain('narrative directives');
  });

  // The two blueprint fields the form had no cap and no error slot for, while
  // `parseStoryLabBlueprint` refused them with `400 INVALID_BLUEPRINT`. The
  // defect this kills is the round trip: a name pasted past the cap generating a
  // paid request that can only come back refused, naming a field by its wire
  // name, on inputs that never said there was a limit.
  it('measures the two character-name fields the route caps', () => {
    const errors = service.validateBlueprint(createBlueprint({
      protagonistName: 'p'.repeat(service.maxCharacterNameLength + 1),
      antagonistName: 'a'.repeat(service.maxCharacterNameLength + 1)
    }));

    expect(service.isValid(errors)).toBeFalse();
    expect(errors.protagonistName).toContain('main character');
    expect(errors.antagonistName).toContain('love interest');
  });

  it('reads the character-name cap from the shared blueprint limits', () => {
    expect(service.maxCharacterNameLength).toBe(STORY_BLUEPRINT_LIMITS.maxCharacterNameLength);
  });

  // The parser reads both names through a helper that trims before it measures,
  // so a name whose surrounding whitespace is what pushes it over is one the
  // route accepts. Refusing it here would be the drift running the wrong way.
  it('accepts a character name that only exceeds the cap through surrounding whitespace', () => {
    const errors = service.validateBlueprint(createBlueprint({
      protagonistName: `  ${'p'.repeat(service.maxCharacterNameLength)}  `,
      antagonistName: `\n${'a'.repeat(service.maxCharacterNameLength)}\n`
    }));

    expect(service.isValid(errors)).withContext(service.getFirstError(errors) ?? '').toBeTrue();
  });

  it('rejects unsupported Heat Contract intimacy boundary', () => {
    const errors = service.validateBlueprint(createBlueprint({
      heatContract: {
        adultOnlyConfirmed: true,
        tensionMode: 'slow_burn',
        intimacyBoundary: 'unsupported_boundary' as StoryGenerationSeam['input']['heatContract']['intimacyBoundary'],
        noGoContent: ''
      }
    }));

    expect(errors.heatContract).toContain('supported Heat Contract settings');
  });
});
