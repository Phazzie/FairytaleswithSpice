#!/usr/bin/env tsx
// Created: 2026-06-08 07:22 EDT

import type {
  CloudLibrarySyncState,
  CloudStoryProjectList,
  CloudStoryProjectSaveReceipt,
  StoryLabProfilePreferences,
  StoryLabUserProfile
} from '../story-generator/src/app/contracts';
import { createDefaultStoryLabProfilePreferences } from '../api/_lib/story-lab/profile/profileDefaults';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

const preferences: StoryLabProfilePreferences = {
  defaultHeatContract: {
    adultOnlyConfirmed: true,
    tensionMode: 'slow_burn',
    intimacyBoundary: 'closed_door',
    noGoContent: 'No humiliation.'
  },
  favoriteCreatures: ['vampire', 'witch'],
  favoriteTones: ['dark_romance', 'mystery'],
  contentBoundaries: 'Keep the danger emotional, not graphic.',
  librarySort: 'updated_desc'
};

const profile: StoryLabUserProfile = {
  userId: 'user-owner',
  displayName: 'Avery',
  preferences,
  createdAt: '2026-06-08T07:22:00.000Z',
  updatedAt: '2026-06-08T07:22:00.000Z'
};

const syncedState: CloudLibrarySyncState = {
  mode: 'cloud_synced',
  lastSyncedAt: '2026-06-08T07:22:00.000Z'
};

const projectList: CloudStoryProjectList = {
  ownerUserId: profile.userId,
  storageMode: 'cloud_postgres',
  projects: [
    {
      projectId: 'project-1',
      storyId: 'story-1',
      title: 'The Moonlit Library',
      synopsis: 'A vampire librarian finds a hidden oath.',
      chapterCount: 2,
      acceptedMemoryCardCount: 1,
      createdAt: '2026-06-08T07:10:00.000Z',
      updatedAt: '2026-06-08T07:22:00.000Z'
    }
  ]
};

const saveReceipt: CloudStoryProjectSaveReceipt = {
  projectId: 'project-1',
  storyId: 'story-1',
  savedAt: '2026-06-08T07:22:00.000Z',
  syncState: syncedState
};
const defaultPreferences = createDefaultStoryLabProfilePreferences();

assert(profile.preferences.defaultHeatContract.adultOnlyConfirmed, 'profile should carry a default Heat Contract');
assert(profile.preferences.favoriteCreatures.includes('witch'), 'profile should carry favorite creature preferences');
assert(projectList.ownerUserId === profile.userId, 'cloud list should carry the owner user id');
assert(projectList.projects[0]?.chapterCount === 2, 'cloud list items should summarize chapter count');
assert(projectList.projects[0]?.acceptedMemoryCardCount === 1, 'cloud list items should summarize accepted memory card count without card text');
assert(saveReceipt.syncState.mode === 'cloud_synced', 'save receipt should report cloud sync state');
assert(defaultPreferences.librarySort === 'updated_desc', 'default profile preferences should use updated-first library sort');
assert(defaultPreferences.defaultHeatContract.adultOnlyConfirmed === false, 'default profile preferences should not pre-confirm adult-only content');

console.log('Story Lab profile and cloud library contract tests passed');
