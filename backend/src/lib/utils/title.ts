import { StoryGenerationSeam, ChapterContinuationSeam } from '@fairytales-with-spice/contracts';

export const generateTitle = (input: StoryGenerationSeam['input']): string => {
  const creatureName = (input.creature.charAt(0).toUpperCase() + input.creature.slice(1));
  return `The ${creatureName}'s Forbidden Passion`;
};

export const generateChapterTitle = (input: ChapterContinuationSeam['input']): string => {
  return 'The Deeper Shadows';
};
