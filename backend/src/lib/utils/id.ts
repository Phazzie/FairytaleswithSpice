export const generateStoryId = (): string => {
  return `story_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

export const generateChapterId = (): string => {
  return `chapter_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

export const generateRequestId = (): string => {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};
