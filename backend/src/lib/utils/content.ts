import { SpicyLevel } from '@fairytales-with-spice/contracts';

export const countWords = (content: string): number => {
  return content.replace(/<[^>]*>/g, '').split(/\s+/).filter(word => word.length > 0).length;
};

export const detectCliffhanger = (content: string): boolean => {
  const cliffhangerWords = ['suddenly', 'but then', 'just as', 'what happened next', 'to be continued'];
  const lowerContent = content.toLowerCase();
  return cliffhangerWords.some(word => lowerContent.includes(word));
};

export const extractThemesFromContent = (content: string): any[] => {
  // Simple theme extraction - in real implementation, this would be more sophisticated
  return ['romance', 'dark'];
};

export const extractSpicyLevelFromContent = (content: string): SpicyLevel => {
  // Simple spicy level extraction - in real implementation, this would analyze content
  // For now, return a default value that matches the SpicyLevel type
  return 4 as SpicyLevel;
};
