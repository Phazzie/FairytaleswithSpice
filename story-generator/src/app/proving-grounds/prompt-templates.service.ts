// Created: 2025-10-31 06:43
import { Injectable } from '@angular/core';
import { readCreatureDisplayName } from '../../../../shared/creatureVocabulary';
import { readSpiceLevelPromptLabel } from '../../../../shared/spiceLevelPromptLadder';
import {
  buildProductionSystemPrompt,
  buildProductionUserPrompt,
  formatChekhovLedger
} from '../../../../shared/productionStoryPrompt';
import {
  STORY_CHEKHOV_ELEMENTS,
  STORY_CHEKHOV_ELEMENTS_PER_STORY
} from '../../../../shared/storyPromptTables';
import { CreatureArchetype, PromptTemplate, SpicyLevel, ThemeSeed, WordBudget } from '../contracts';

export interface PromptVariables {
  creature: CreatureArchetype;
  themes: ThemeSeed[];
  spicyLevel: SpicyLevel;
  wordCount: WordBudget;
  userInput?: string;
}

/**
 * The reader's own idea, on the line and under the heading production gives it.
 *
 * The copy this page used to carry sent that text under no heading at all — a
 * bare line between the spice level and the story requirements — while every
 * story the app generates labels it `CREATIVE DIRECTION:`. The whole line is one
 * token because production drops the heading with the text when there is none,
 * and a template can only do that by replacing both together.
 */
const CREATIVE_DIRECTION_TOKEN = 'CREATIVE DIRECTION: {{USER_INPUT}}';

/**
 * The two elements this run plants, drawn when the template is filled.
 *
 * Production draws two per generation and names them in the prompt; the copy
 * this replaces had no Chekhov ledger at all, so a variant was compared against
 * a prompt that asked for no planting. Drawn at fill time rather than at
 * template time for the same reason production draws per story: a page that
 * showed the same two elements for every run would be describing one run.
 */
const CHEKHOV_LEDGER_TOKEN = '{{CHEKHOV_LEDGER}}';

@Injectable({
  providedIn: 'root'
})
export class PromptTemplatesService {

  /**
   * The system prompt this page presents as "Current Production".
   *
   * Read from `shared/productionStoryPrompt` rather than transcribed here. The
   * transcription this replaces had lost the midpoint moral dilemma, the eight
   * cliffhanger types' examples, the hook-placement and serialization-promise
   * rules, the fourth show-don't-tell example, and the whole four-thousand-character
   * enhanced voice system — so a variant measured against it was measured against
   * a prompt no story was ever generated from. See the note on that module.
   *
   * The two per-run sections are passed as nothing, which drops them: the author
   * styles are drawn per generation from the creature's bank, and the beat
   * structure per story. Proving Grounds previews both in its own panel, which
   * reads the same tables `StoryService` draws from.
   */
  private readonly productionSystemPrompt = buildProductionSystemPrompt();

  getTemplates(): PromptTemplate[] {
    return [
      {
        id: 'production',
        name: 'Current Production',
        description: 'The current production prompt used in the main app - comprehensive with all elements',
        systemPrompt: this.productionSystemPrompt,
        userPromptTemplate: this.getProductionUserPrompt(),
        category: 'production'
      },
      {
        id: 'concise',
        name: 'Concise & Focused',
        description: 'Streamlined version focusing on core elements - tests if brevity improves output',
        systemPrompt: this.getConciseSystemPrompt(),
        userPromptTemplate: this.getConciseUserPrompt(),
        category: 'experimental'
      },
      {
        id: 'emotional',
        name: 'Emotional Depth',
        description: 'Emphasizes character emotions and internal conflict over plot complexity',
        systemPrompt: this.getEmotionalSystemPrompt(),
        userPromptTemplate: this.getEmotionalUserPrompt(),
        category: 'experimental'
      },
      {
        id: 'sensory',
        name: 'Sensory Immersion',
        description: 'Maximizes multi-sensory descriptions and atmospheric world-building',
        systemPrompt: this.getSensorySystemPrompt(),
        userPromptTemplate: this.getSensoryUserPrompt(),
        category: 'experimental'
      },
      {
        id: 'dialogue',
        name: 'Dialogue-Driven',
        description: 'Focuses on distinctive character voices and dialogue-based storytelling',
        systemPrompt: this.getDialogueSystemPrompt(),
        userPromptTemplate: this.getDialogueUserPrompt(),
        category: 'experimental'
      }
    ];
  }

  getTemplate(id: string): PromptTemplate | undefined {
    return this.getTemplates().find(t => t.id === id);
  }

  fillTemplate(template: PromptTemplate, variables: PromptVariables): { system: string; user: string } {
    return {
      system: template.systemPrompt,
      user: this.fillUserTemplate(template.userPromptTemplate, variables)
    };
  }

  fillUserTemplate(userPromptTemplate: string, variables: PromptVariables): string {
    const creatureName = this.getCreatureDisplayName(variables.creature);
    const themesText = variables.themes.map(theme => theme.label).join(', ');
    const spicyLabel = this.getSpicyLabel(variables.spicyLevel);

    const creativeDirection = variables.userInput?.trim() ?? '';

    return userPromptTemplate
      // Before `{{USER_INPUT}}`, because this token contains it: an absent idea
      // takes the `CREATIVE DIRECTION:` heading with it, as production does.
      .replaceAll(CREATIVE_DIRECTION_TOKEN, creativeDirection ? `CREATIVE DIRECTION: ${creativeDirection}` : '')
      .replaceAll(CHEKHOV_LEDGER_TOKEN, formatChekhovLedger(this.drawChekhovElements()))
      .replaceAll('{{WORD_COUNT}}', variables.wordCount.toString())
      .replaceAll('{{CREATURE}}', creatureName)
      .replaceAll('{{THEMES}}', themesText)
      .replaceAll('{{SPICY_LEVEL}}', variables.spicyLevel.toString())
      .replaceAll('{{SPICY_LABEL}}', spicyLabel)
      .replaceAll('{{USER_INPUT}}', variables.userInput || '');
  }

  /**
   * Draw the elements this run plants, from the same table the generator draws
   * from — Fisher-Yates over a copy, as `StoryService.generateChekovElements`
   * does, so every pair is as likely as every other.
   */
  private drawChekhovElements(): readonly string[] {
    const shuffled = [...STORY_CHEKHOV_ELEMENTS];
    for (let index = shuffled.length - 1; index > 0; index -= 1) {
      const swapWith = Math.floor(Math.random() * (index + 1));
      [shuffled[index], shuffled[swapWith]] = [shuffled[swapWith], shuffled[index]];
    }
    return shuffled.slice(0, STORY_CHEKHOV_ELEMENTS_PER_STORY);
  }

  /**
   * The user prompt this page presents as "Current Production".
   *
   * Its whole claim is that it is what the app sends, so a variant tested
   * against it is tested against the real thing. It was a transcription, and
   * the transcription had been repaired in place twice — once for the pacing
   * block, which named 700, 900, and 1200 words while the picker offers 600,
   * 900, 1200, and 1500, and once for the spice ladder.
   *
   * It is now read from `shared/productionStoryPrompt` with this page's tokens
   * in the caller-specific slots, which is what ends the repairs. What the
   * transcription was still missing: the Chekhov ledger, the two story
   * requirements naming the author-style bank and the beat structure, the voice
   * metadata reminder, the `[Character, emotion]` formatting line, the closing
   * instruction to pay the planted elements off at the midpoint, and the
   * `CREATIVE DIRECTION:` heading over the reader's own idea.
   */
  private getProductionUserPrompt(): string {
    return buildProductionUserPrompt({
      wordCount: '{{WORD_COUNT}}',
      creature: '{{CREATURE}}',
      themes: '{{THEMES}}',
      spicyLabel: '{{SPICY_LABEL}}',
      spicyLevel: '{{SPICY_LEVEL}}',
      creativeDirectionLine: CREATIVE_DIRECTION_TOKEN,
      storyLabContextLine: '',
      chekhovLedger: CHEKHOV_LEDGER_TOKEN
    });
  }

  private getConciseSystemPrompt(): string {
    return `You are a supernatural romance writer creating audio-optimized stories.

KEY RULES:
- Show, don't tell (avoid "felt", "was", "suddenly")
- Distinct character voices
- Build tension through obstacles
- Respect spice levels
- End with cliffhanger

AUDIO FORMAT:
[Character Name]: "dialogue"
[Narrator]: descriptions
[Character Name, voice: 4-word-description]: "dialogue" (first appearance only)

Use HTML: <h3>, <p>, <em>`;
  }

  private getConciseUserPrompt(): string {
    return `Write {{WORD_COUNT}} words: {{CREATURE}} story with {{THEMES}}.
Spice Level {{SPICY_LEVEL}}/5.
{{USER_INPUT}}

Requirements:
- Compelling characters with secrets
- Tension through conflict
- Strong cliffhanger ending
- Audio-first writing`;
  }

  private getEmotionalSystemPrompt(): string {
    return `You are a character-focused romance writer specializing in emotional depth.

PRIORITIES:
1. Internal conflict and emotional vulnerability
2. Character growth through relationship dynamics
3. Emotional stakes > plot complexity
4. Consent and authentic chemistry
5. Psychological realism in attraction

Show emotions through:
- Physical reactions (racing heart, trembling hands)
- Behavioral changes (voice breaks, averted eyes)
- Internal struggle made external
- Subtext in dialogue

AUDIO FORMAT: [Name]: "dialogue" and [Narrator]: descriptions
Use HTML: <h3>, <p>, <em>`;
  }

  private getEmotionalUserPrompt(): string {
    return `{{WORD_COUNT}} words: {{CREATURE}} navigating {{THEMES}}.
Spice Level {{SPICY_LEVEL}}/5.
{{USER_INPUT}}

Focus on:
- Deep emotional connection between characters
- Internal conflicts as important as external ones
- Character vulnerability and authenticity
- Psychological complexity in relationships

End with emotional cliffhanger that leaves readers invested in the characters' journey.`;
  }

  private getSensorySystemPrompt(): string {
    return `You are a sensory immersion specialist for audio romance.

SENSORY REQUIREMENTS:
- Engage ALL five senses in every scene
- Synesthetic descriptions (sounds like colors, textures like emotions)
- Atmospheric world-building through detail
- Environmental storytelling

SENSORY TECHNIQUES:
- Sight: Lighting, shadow, movement, color
- Sound: Ambient noise, tone, rhythm, silence
- Touch: Temperature, texture, pressure, pain
- Taste: Flavor, anticipation, memory
- Smell: Scent memory, pheromones, environment

Layer 2-3 senses per paragraph. Make the world feel alive and present.

AUDIO FORMAT: [Name]: "dialogue" and [Narrator]: descriptions`;
  }

  private getSensoryUserPrompt(): string {
    return `{{WORD_COUNT}} words: {{CREATURE}} story with {{THEMES}}.
Spice Level {{SPICY_LEVEL}}/5.
{{USER_INPUT}}

Maximize sensory immersion:
- Multi-sensory scene descriptions
- Environment as character
- Atmospheric tension building
- Physical world grounds emotional moments

Create a visceral, immersive reading experience.`;
  }

  private getDialogueSystemPrompt(): string {
    return `You are a dialogue specialist creating distinct character voices.

VOICE DIFFERENTIATION:
- Unique speech patterns per character
- Sentence length variation
- Vocabulary choices
- Emotional tells in dialogue
- Subtext and what's unsaid

DIALOGUE TECHNIQUES:
- Power dynamics in conversation
- Interruptions and overlaps
- Silences that speak volumes
- Cultural/class markers in speech
- Humor vs. seriousness

Keep narrative lean - let dialogue carry character and plot.

AUDIO FORMAT: [Name]: "dialogue" with [Narrator]: minimal transitions`;
  }

  private getDialogueUserPrompt(): string {
    return `{{WORD_COUNT}} words: {{CREATURE}} story with {{THEMES}}.
Spice Level {{SPICY_LEVEL}}/5.
{{USER_INPUT}}

Dialogue-driven storytelling:
- Distinctive voice for each character
- Dialogue reveals character and advances plot
- Subtext and tension in conversation
- Minimal narrative exposition

Let characters drive the story through their interactions.`;
  }

  /**
   * Both slots this page fills are now read from the same modules the
   * production prompt reads them from, so the preview names the protagonist and
   * the spice level the way the run would.
   *
   * `getSpicyLabel` here used to hold five labels of its own, none of which
   * `StoryService` has ever sent; see `shared/spiceLevelPromptLadder` for what
   * they were and what a comparison run against them was measuring.
   */
  private getCreatureDisplayName(creature: CreatureArchetype): string {
    return readCreatureDisplayName(creature);
  }

  private getSpicyLabel(level: SpicyLevel): string {
    return readSpiceLevelPromptLabel(level);
  }
}
