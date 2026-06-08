// Created: 2026-06-08 07:25 EDT

import type { StoryLabProfilePreferences } from '../contracts';

export function createDefaultStoryLabProfilePreferences(): StoryLabProfilePreferences {
  return {
    defaultHeatContract: {
      adultOnlyConfirmed: false,
      tensionMode: 'slow_burn',
      intimacyBoundary: 'closed_door'
    },
    favoriteCreatures: [],
    favoriteTones: [],
    librarySort: 'updated_desc'
  };
}
