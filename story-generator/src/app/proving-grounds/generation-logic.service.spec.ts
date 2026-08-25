import { TestBed } from '@angular/core/testing';
import { CreatureArchetype } from '../contracts';
import { GenerationLogicService } from './generation-logic.service';

describe('GenerationLogicService', () => {
  let service: GenerationLogicService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(GenerationLogicService);
  });

  it('getAllAuthorStyles returns non-empty, creature-specific lists for every supported creature', () => {
    const creatures: CreatureArchetype[] = [
      'vampire', 'werewolf', 'fairy', 'siren', 'djinn', 'witch', 'dragon', 'demon', 'angel', 'mermaid'
    ];

    for (const creature of creatures) {
      const styles = service.getAllAuthorStyles(creature);
      expect(styles.length).withContext(creature).toBeGreaterThan(0);
      for (const style of styles) {
        expect(style.author.trim().length).withContext(`${creature} author name`).toBeGreaterThan(0);
        expect(style.trait.trim().length).withContext(`${creature} trait`).toBeGreaterThan(0);
      }
    }
  });

  it('fairy, siren, and djinn share the same fairy-styles pool', () => {
    const fairyStyles = service.getAllAuthorStyles('fairy');
    const sirenStyles = service.getAllAuthorStyles('siren');
    const djinnStyles = service.getAllAuthorStyles('djinn');

    expect(sirenStyles).toEqual(fairyStyles);
    expect(djinnStyles).toEqual(fairyStyles);
  });

  it('selectRandomAuthors never returns more authors than exist for the creature, and never duplicates one', () => {
    for (let i = 0; i < 20; i++) {
      const authors = service.selectRandomAuthors('witch');
      expect(authors.length).toBeGreaterThanOrEqual(2);
      expect(authors.length).toBeLessThanOrEqual(service.getAllAuthorStyles('witch').length);

      const uniqueNames = new Set(authors.map(author => author.author));
      expect(uniqueNames.size).toBe(authors.length);
    }
  });

  it('selectRandomBeatStructure always returns one of the known beat structures', () => {
    const knownNames = new Set(service.getAllBeatStructures().map(beat => beat.name));

    for (let i = 0; i < 20; i++) {
      expect(knownNames.has(service.selectRandomBeatStructure().name)).toBeTrue();
    }
  });

  it('selectRandomChekovElements returns exactly two distinct elements from the known pool', () => {
    const knownElements = new Set(service.getAllChekovElements());

    for (let i = 0; i < 10; i++) {
      const elements = service.selectRandomChekovElements();
      expect(elements.length).toBe(2);
      expect(elements[0].description).not.toBe(elements[1].description);
      for (const element of elements) {
        expect(knownElements.has(element.description)).toBeTrue();
      }
    }
  });

  it('generateRandomLogic assembles authors, a beat structure, and Chekov elements for the requested creature', () => {
    const logic = service.generateRandomLogic('dragon');

    expect(logic.selectedAuthors.length).toBeGreaterThan(0);
    for (const author of logic.selectedAuthors) {
      expect(service.getAllAuthorStyles('dragon')).toContain(author);
    }
    expect(logic.selectedBeatStructure).toBeTruthy();
    expect(logic.chekovElements.length).toBe(2);
  });

  it('summarizeLogic renders the author styles, beat structure, and Chekov elements as readable text', () => {
    const logic = service.generateRandomLogic('demon');

    const summary = service.summarizeLogic(logic);

    expect(summary).toContain('Author styles:');
    expect(summary).toContain(logic.selectedAuthors[0].author);
    expect(summary).toContain(`Beat structure: ${logic.selectedBeatStructure.name}`);
    expect(summary).toContain('Chekov elements:');
    expect(summary).toContain(logic.chekovElements[0].description);
  });

  it('summarizeLogic reports "none selected" when there are no author styles', () => {
    const summary = service.summarizeLogic({
      selectedAuthors: [],
      selectedBeatStructure: service.getAllBeatStructures()[0],
      chekovElements: []
    });

    expect(summary).toContain('Author styles: none selected.');
  });
});
