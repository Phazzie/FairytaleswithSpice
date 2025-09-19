"use strict";
// ==================== SEAM-DRIVEN DEVELOPMENT CONTRACTS ====================
// These contracts are derived directly from UI interactions and data flows
// Each seam represents a boundary where data crosses between components
Object.defineProperty(exports, "__esModule", { value: true });
exports.VALIDATION_RULES = void 0;
// ==================== VALIDATION RULES ====================
exports.VALIDATION_RULES = {
    userInput: {
        maxLength: 1000,
        allowedHtml: false
    },
    themes: {
        maxCount: 5,
        allowedValues: ['romance', 'adventure', 'mystery', 'comedy', 'dark']
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
};
