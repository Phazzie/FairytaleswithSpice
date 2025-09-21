export const VALIDATION_RULES = {
  userInput: {
    maxLength: 1000,
    allowedHtml: false
  },
  themes: {
    maxCount: 5,
    allowedValues: ['betrayal', 'obsession', 'power_dynamics', 'forbidden_love', 'revenge', 'manipulation', 'seduction', 'dark_secrets', 'corruption', 'dominance', 'submission', 'jealousy', 'temptation', 'sin', 'desire', 'passion', 'lust', 'deceit']
  },
  spicyLevel: {
    min: 1,
    max: 5
  },
  wordCount: {
    allowedValues: [700, 900, 1200]
  },
  audioSpeed: {
    min: 0.5,
    max: 1.5
  }
} as const;
