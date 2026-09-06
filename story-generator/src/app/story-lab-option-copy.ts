import { CREATURE_ARCHETYPES, readCreatureDisplayName } from '../../../shared/creatureVocabulary';
import {
  CreatureArchetype,
  HEAT_INTIMACY_BOUNDARIES,
  HEAT_TENSION_MODES,
  HeatIntimacyBoundary,
  HeatTensionMode,
  NARRATIVE_TONES,
  NarrativeTone
} from './contracts';

/**
 * The picker copy shared between the story-creation form (`app.ts`) and the
 * Story Lab profile panel, which lets a signed-in user set their favorite
 * creatures/tones and default heat contract.
 *
 * This is split out of `app.ts` rather than declared a second time in the
 * profile panel — see the doc comment that used to sit above these arrays in
 * `app.ts` for what a second hand-written copy of a vocabulary picker costs
 * once the vocabulary itself changes.
 */

export type CreatureOption = {
  id: CreatureArchetype;
  label: string;
  description: string;
};

export type HeatContractOption<T extends string> = {
  id: T;
  label: string;
  description: string;
};

export type ChoiceOption<TId extends string | number> = {
  id: TId;
  label: string;
};

const CREATURE_DESCRIPTIONS: Record<CreatureArchetype, string> = {
  vampire: 'Immortal desire, old secrets, dangerous elegance.',
  werewolf: 'Pack bonds, moonlit hunger, protective intensity.',
  fairy: 'Fae bargains, beautiful traps, glittering menace.',
  siren: 'Songs, saltwater vows, temptation with teeth.',
  djinn: 'Wishes, bargains, heat shimmer magic.',
  witch: 'Spellwork, grimoires, familiar old power.',
  dragon: 'Treasure, pride, scale-deep obsession.',
  demon: 'Temptation, contracts, wicked devotion.',
  angel: 'Forbidden grace, falling, sacred desire.',
  mermaid: 'Tides, curses, pearl-lit longing.'
};

const HEAT_TENSION_COPY: Record<HeatTensionMode, { label: string; description: string }> = {
  slow_burn: { label: 'Slow burn', description: 'Longing, restraint, charged pauses.' },
  dangerous_proximity: { label: 'Danger close', description: 'Threat, protection, forced proximity.' },
  playful_banter: { label: 'Banter', description: 'Teasing, challenge, mischief.' },
  devotional_longing: { label: 'Devotion', description: 'Reverence, sacrifice, tenderness.' }
};

const HEAT_BOUNDARY_COPY: Record<HeatIntimacyBoundary, { label: string; description: string }> = {
  fade_to_black: { label: 'Fade to black', description: 'Build heat, close the door early.' },
  closed_door: { label: 'Closed door', description: 'Romance stays implied off-page.' },
  literary_on_page: { label: 'Literary on-page', description: 'Consensual heat with polished language.' }
};

const NARRATIVE_TONE_LABELS: Record<NarrativeTone, string> = {
  romance: 'Romance',
  dark_romance: 'Dark Romance',
  mystery: 'Mystery',
  adventure: 'Adventure',
  comedy: 'Comedy',
  tragedy: 'Tragedy'
};

export const creatureOptions: CreatureOption[] = CREATURE_ARCHETYPES.map(id => ({
  id,
  label: readCreatureDisplayName(id),
  description: CREATURE_DESCRIPTIONS[id]
}));

export const toneOptions: ChoiceOption<NarrativeTone>[] = NARRATIVE_TONES.map(id => ({
  id,
  label: NARRATIVE_TONE_LABELS[id]
}));

export const heatTensionOptions: HeatContractOption<HeatTensionMode>[] = HEAT_TENSION_MODES.map(id => ({
  id,
  ...HEAT_TENSION_COPY[id]
}));

export const heatBoundaryOptions: HeatContractOption<HeatIntimacyBoundary>[] = HEAT_INTIMACY_BOUNDARIES.map(id => ({
  id,
  ...HEAT_BOUNDARY_COPY[id]
}));
