#!/usr/bin/env tsx
// Created: 2026-06-21 20:57 UTC

import { StoryService } from '../api/_lib/services/storyService';
import type { StoryGenerationSeam } from '../api/_lib/types/contracts';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

const service = new StoryService() as unknown as {
  formatThemeContext(input: StoryGenerationSeam['input']): string;
  formatStoryLabContext(input: StoryGenerationSeam['input']): string;
};

const longLabel = 'L'.repeat(120);
const longDescription = 'D'.repeat(360);
const input = {
  creature: 'siren',
  themes: ['forbidden_love'],
  spicyLevel: 3,
  wordCount: 900,
  userInput: 'A guarded reef court romance.',
  generationContext: {
    source: 'story_lab',
    logline: 'A'.repeat(500),
    tone: 'dark_romance',
    protagonistName: 'Mira',
    antagonistName: 'Lord Brine',
    worldDetails: 'W'.repeat(500),
    narrativeDirectives: 'N'.repeat(500),
    heatContract: {
      adultOnlyConfirmed: true,
      tensionMode: 'dangerous_proximity',
      intimacyBoundary: 'fade_to_black',
      noGoContent: 'X'.repeat(500)
    },
    themeSeeds: [
      null,
      { label: longLabel, description: longDescription },
      { label: '', description: 'missing label' },
      { label: 'Missing description' },
      ...Array.from({ length: 8 }, (_item, index) => ({
        label: `Theme ${index}`,
        description: `Description ${index}`
      }))
    ]
  }
} as unknown as StoryGenerationSeam['input'];

const themeContext = service.formatThemeContext(input);
assert(themeContext.includes('L'.repeat(80)), 'theme labels should be preserved up to the cap');
assert(!themeContext.includes('L'.repeat(81)), 'theme labels should be capped at 80 characters');
assert(themeContext.includes('D'.repeat(280)), 'theme descriptions should be preserved up to the cap');
assert(!themeContext.includes('D'.repeat(281)), 'theme descriptions should be capped at 280 characters');
assert(!themeContext.includes('missing label'), 'invalid theme seed entries should be skipped');
assert(themeContext.split(';').length === 5, 'theme seed output should be capped to five entries');

const storyLabContext = service.formatStoryLabContext(input);
assert(storyLabContext.includes('A'.repeat(320)), 'Story Lab logline should be preserved up to the context cap');
assert(!storyLabContext.includes('A'.repeat(321)), 'Story Lab logline should be capped');
assert(!storyLabContext.includes('W'.repeat(321)), 'world details should be capped');
assert(!storyLabContext.includes('N'.repeat(321)), 'narrative directives should be capped');
assert(storyLabContext.includes('X'.repeat(320)), 'no-go content should be preserved up to the context cap');
assert(!storyLabContext.includes('X'.repeat(321)), 'no-go content should be capped at the context cap');
assert(!storyLabContext.includes('undefined'), 'malformed prompt context should not render undefined');

console.log('Story service prompt guard tests passed');
