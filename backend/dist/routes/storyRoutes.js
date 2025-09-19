"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.storyRoutes = void 0;
const express_1 = __importDefault(require("express"));
const storyService_1 = require("../services/storyService");
const router = express_1.default.Router();
exports.storyRoutes = router;
const storyService = new storyService_1.StoryService();
// POST /api/generate-story
router.post('/generate-story', async (req, res) => {
    try {
        const input = req.body;
        // Validate required fields
        if (!input.creature || !input.themes || typeof input.spicyLevel !== 'number' || !input.wordCount) {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'INVALID_INPUT',
                    message: 'Missing required fields: creature, themes, spicyLevel, wordCount'
                }
            });
        }
        const result = await storyService.generateStory(input);
        res.json(result);
    }
    catch (error) {
        console.error('Story generation route error:', error);
        res.status(500).json({
            success: false,
            error: {
                code: 'INTERNAL_ERROR',
                message: 'Story generation failed'
            }
        });
    }
});
// POST /api/continue-story
router.post('/continue-story', async (req, res) => {
    try {
        const input = req.body;
        // Validate required fields
        if (!input.storyId || typeof input.currentChapterCount !== 'number' || !input.existingContent) {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'INVALID_INPUT',
                    message: 'Missing required fields: storyId, currentChapterCount, existingContent'
                }
            });
        }
        const result = await storyService.continueStory(input);
        res.json(result);
    }
    catch (error) {
        console.error('Chapter continuation route error:', error);
        res.status(500).json({
            success: false,
            error: {
                code: 'INTERNAL_ERROR',
                message: 'Chapter continuation failed'
            }
        });
    }
});
