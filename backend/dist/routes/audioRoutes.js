"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.audioRoutes = void 0;
const express_1 = __importDefault(require("express"));
const audioService_1 = require("../services/audioService");
const router = express_1.default.Router();
exports.audioRoutes = router;
const audioService = new audioService_1.AudioService();
// POST /api/convert-audio
router.post('/convert-audio', async (req, res) => {
    try {
        const input = req.body;
        // Validate required fields
        if (!input.storyId || !input.content) {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'INVALID_INPUT',
                    message: 'Missing required fields: storyId, content'
                }
            });
        }
        // Validate content length (ElevenLabs has limits)
        const cleanContent = input.content.replace(/<[^>]*>/g, '');
        if (cleanContent.length > 5000) {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'UNSUPPORTED_CONTENT',
                    message: 'Story content too long for audio conversion (max 5000 characters)',
                    unsupportedElements: ['excessive_length']
                }
            });
        }
        const result = await audioService.convertToAudio(input);
        res.json(result);
    }
    catch (error) {
        console.error('Audio conversion route error:', error);
        res.status(500).json({
            success: false,
            error: {
                code: 'INTERNAL_ERROR',
                message: 'Audio conversion failed'
            }
        });
    }
});
