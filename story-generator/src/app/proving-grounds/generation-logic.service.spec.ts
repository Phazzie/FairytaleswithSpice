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

  // This used to assert the opposite — that fairy, siren, and djinn share one
  // pool — which is how the fallthrough survived: the panel showed a bank of
  // fae authors for two creatures the API generates from `SIREN_STYLES` and
  // `DJINN_STYLES`, and the suite called that the expected result.
  it('gives every creature its own author bank rather than borrowing another creature\'s', () => {
    const creatures: CreatureArchetype[] = [
      'vampire', 'werewolf', 'fairy', 'siren', 'djinn', 'witch', 'dragon', 'demon', 'angel', 'mermaid'
    ];

    for (const creature of creatures) {
      const ownAuthors = service.getAllAuthorStyles(creature).map(style => style.author).join('|');

      for (const other of creatures) {
        if (other === creature) {
          continue;
        }

        expect(service.getAllAuthorStyles(other).map(style => style.author).join('|'))
          .withContext(`${other} should not reuse the ${creature} bank`)
          .not.toEqual(ownAuthors);
      }
    }
  });

  // Named rather than checked by shape: a bank borrowed from a neighbour is
  // still a non-empty, creature-shaped list, so only the contents catch it.
  // Named for the same reason the siren and djinn banks are named below. These
  // two were the last banks still carrying the panel's own authors: six of the
  // twelve werewolf voices and three of the twelve fae ones were names the API
  // has never generated from — and `Nalini Singh` appeared twice in the same
  // werewolf bank. Every creature borrows werewolf or fae for its blend voice
  // except siren, so a preview of almost any creature could name an author the
  // server could not have picked.
  it('reads the werewolf and fae banks the API generates those creatures from', () => {
    expect(service.getAllAuthorStyles('werewolf').map(style => style.author))
      .toEqual([
        'Patricia Briggs', 'Ilona Andrews', 'Nalini Singh', 'Kelley Armstrong',
        'Jennifer Ashley', 'Carrie Ann Ryan', 'Shelly Laurenston', 'Suzanne Wright',
        'Faith Hunter', 'Keri Arthur', 'Rachel Vincent', 'Chloe Neill'
      ]);
    expect(service.getAllAuthorStyles('fairy').map(style => style.author))
      .toEqual([
        'Holly Black', 'Sarah J. Maas', 'Melissa Marr', 'Grace Draven',
        'Julie Kagawa', 'Karen Marie Moning', 'Elise Kova', 'Jennifer Estep',
        'Cassandra Clare', 'Sylvia Mercedes', 'Roshani Chokshi', 'Laura Thalassa'
      ]);
  });

  // The property that keeps a three-voice draw three distinct voices. It holds
  // across the API's banks today, and it is not a coincidence worth relying on
  // silently: while the panel carried its own werewolf and fae lists, `Kresley
  // Cole` and `Laurell K. Hamilton` sat in both the vampire and werewolf banks,
  // so a vampire preview could draw the same author twice — reducing the variety
  // the third voice exists for, and feeding two identical keys to a template
  // that tracked by author name.
  it('never lets a creature draw the same author from both of its banks', () => {
    const creatures: CreatureArchetype[] = [
      'vampire', 'werewolf', 'fairy', 'siren', 'djinn', 'witch', 'dragon', 'demon', 'angel', 'mermaid'
    ];

    for (const creature of creatures) {
      const primary = service.getAllAuthorStyles(creature).map(style => style.author);
      const secondary = service.getSecondaryAuthorStyles(creature).map(style => style.author);

      expect(new Set(primary).size).withContext(`${creature} primary bank`).toBe(primary.length);
      expect(primary.filter(author => secondary.includes(author)))
        .withContext(`${creature} draws these from both banks`)
        .toEqual([]);
    }
  });

  it('reads the siren and djinn banks the API generates those creatures from', () => {
    expect(service.getAllAuthorStyles('siren').map(style => style.author))
      .toEqual(['Drowning-Song Gothic', 'Salt-Debt Bargainer', 'Storm-Voice Romance', 'Harbour-Watch Longing']);
    expect(service.getAllAuthorStyles('djinn').map(style => style.author))
      .toEqual(['Three-Wish Jurisprudence', 'Lamp-Bound Devotion', 'Smokeless-Fire Epic', 'Brass-Seal Bargain']);
  });

  it('selectRandomAuthors never duplicates a voice within one selection', () => {
    for (let i = 0; i < 20; i++) {
      const authors = service.selectRandomAuthors('witch');

      const uniqueNames = new Set(authors.map(author => author.author));
      expect(uniqueNames.size).toBe(authors.length);
    }
  });

  // The shape the API builds, asserted as a shape rather than as a range: the
  // previous version accepted anything from two authors up to the size of the
  // primary bank, which is exactly what the defect produced. `selectRandomAuthors`
  // drew two or three voices from the creature's own bank and never touched the
  // secondary one, so the blend voice `selectRandomAuthorStyles` puts in every
  // real prompt was missing from every preview.
  it('selectRandomAuthors draws two voices from the primary bank and one from the secondary bank', () => {
    const creatures: CreatureArchetype[] = [
      'vampire', 'werewolf', 'fairy', 'siren', 'djinn', 'witch', 'dragon', 'demon', 'angel', 'mermaid'
    ];

    for (const creature of creatures) {
      const primaryNames = new Set(service.getAllAuthorStyles(creature).map(style => style.author));
      const secondaryNames = new Set(service.getSecondaryAuthorStyles(creature).map(style => style.author));

      for (let i = 0; i < 10; i++) {
        const authors = service.selectRandomAuthors(creature);

        expect(authors.length).withContext(creature).toBe(3);
        expect(authors.slice(0, 2).every(author => primaryNames.has(author.author)))
          .withContext(`${creature} primary voices`)
          .toBeTrue();
        expect(secondaryNames.has(authors[2].author))
          .withContext(`${creature} blend voice`)
          .toBeTrue();
      }
    }
  });

  // The pairings themselves, spelled out the way `getSecondaryAuthorStyles` in
  // `api/_lib/config/authorStyles.ts` spells them. Checked by name rather than
  // by shape because a secondary bank pointing at the wrong creature is still a
  // non-empty list of other creatures' voices, and the panel would still show
  // three authors — the failure this exists to catch is a preview that names a
  // blend the run never used.
  it('pairs every creature with the two banks the API blends it with', () => {
    const expectedPairings: ReadonlyArray<readonly [CreatureArchetype, CreatureArchetype, CreatureArchetype]> = [
      ['vampire', 'werewolf', 'fairy'],
      ['werewolf', 'vampire', 'fairy'],
      ['fairy', 'vampire', 'werewolf'],
      ['siren', 'mermaid', 'fairy'],
      ['djinn', 'fairy', 'demon'],
      ['witch', 'fairy', 'vampire'],
      ['dragon', 'werewolf', 'fairy'],
      ['demon', 'vampire', 'fairy'],
      ['angel', 'fairy', 'witch'],
      ['mermaid', 'fairy', 'werewolf']
    ];

    for (const [creature, first, second] of expectedPairings) {
      expect(service.getSecondaryAuthorStyles(creature).map(style => style.author))
        .withContext(`${creature} blends ${first} and ${second}`)
        .toEqual([
          ...service.getAllAuthorStyles(first).map(style => style.author),
          ...service.getAllAuthorStyles(second).map(style => style.author)
        ]);
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
    // Both banks, because the third voice comes from the secondary one. Asserting
    // membership of the primary bank alone is how the missing blend voice went
    // unnoticed: a selection that never left the primary bank passed it.
    const drawableStyles = [
      ...service.getAllAuthorStyles('dragon'),
      ...service.getSecondaryAuthorStyles('dragon')
    ];

    expect(logic.selectedAuthors.length).toBe(3);
    for (const author of logic.selectedAuthors) {
      expect(drawableStyles).toContain(author);
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
