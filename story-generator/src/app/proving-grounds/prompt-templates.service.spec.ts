import { TestBed } from '@angular/core/testing';
import { PromptTemplatesService } from './prompt-templates.service';

describe('PromptTemplatesService', () => {
  let service: PromptTemplatesService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(PromptTemplatesService);
  });

  it('returns a fixed set of templates covering both the production and experimental categories', () => {
    const templates = service.getTemplates();

    expect(templates.length).toBe(5);
    expect(templates.filter(template => template.category === 'production').length).toBe(1);
    expect(templates.filter(template => template.category === 'experimental').length).toBe(4);

    const ids = templates.map(template => template.id);
    expect(new Set(ids).size).withContext('template ids should be unique').toBe(ids.length);
  });

  it('every template carries a non-empty system prompt and user prompt template', () => {
    for (const template of service.getTemplates()) {
      expect(template.systemPrompt.trim().length).withContext(`${template.id} systemPrompt`).toBeGreaterThan(0);
      expect(template.userPromptTemplate.trim().length).withContext(`${template.id} userPromptTemplate`).toBeGreaterThan(0);
    }
  });

  it('getTemplate looks a template up by id', () => {
    expect(service.getTemplate('production')?.name).toBe('Current Production');
    expect(service.getTemplate('does-not-exist')).toBeUndefined();
  });

  it('fillUserTemplate substitutes every placeholder with the supplied variables', () => {
    const filled = service.fillUserTemplate(
      '{{CREATURE}} | {{THEMES}} | {{SPICY_LABEL}} (Level {{SPICY_LEVEL}}) | {{WORD_COUNT}} words | {{USER_INPUT}}',
      {
        creature: 'vampire',
        themes: [
          { id: 'obsession', label: 'Obsession', description: 'Desire narrows into fixation.' },
          { id: 'betrayal', label: 'Betrayal', description: 'Trust becomes leverage.' }
        ],
        spicyLevel: 4,
        wordCount: 1200,
        userInput: 'Set it in an opera house.'
      }
    );

    expect(filled).toBe('Vampire | Obsession, Betrayal | Scorching & Explicit (Level 4) | 1200 words | Set it in an opera house.');
    expect(filled).not.toContain('{{');
  });

  it('fillUserTemplate replaces USER_INPUT with an empty string when none is supplied', () => {
    const filled = service.fillUserTemplate('Notes: {{USER_INPUT}}', {
      creature: 'witch',
      themes: [],
      spicyLevel: 1,
      wordCount: 600
    });

    expect(filled).toBe('Notes: ');
  });

  it('fillTemplate keeps the system prompt untouched and fills the user prompt template', () => {
    const template = service.getTemplate('concise')!;

    const filled = service.fillTemplate(template, {
      creature: 'dragon',
      themes: [{ id: 'revenge', label: 'Revenge', description: 'Old wounds drive present choices.' }],
      spicyLevel: 2,
      wordCount: 900,
      userInput: ''
    });

    expect(filled.system).toBe(template.systemPrompt);
    expect(filled.user).toContain('Dragon');
    expect(filled.user).toContain('Revenge');
    expect(filled.user).not.toContain('{{');
  });
});
