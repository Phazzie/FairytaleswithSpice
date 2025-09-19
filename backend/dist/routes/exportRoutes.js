"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.exportRoutes = void 0;
const express_1 = __importDefault(require("express"));
const exportService_1 = require("../services/exportService");
const router = express_1.default.Router();
exports.exportRoutes = router;
const exportService = new exportService_1.ExportService();
// POST /api/save-story
router.post('/save-story', async (req, res) => {
    try {
        const input = req.body;
        // Validate required fields
        if (!input.storyId || !input.content || !input.title || !input.format) {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'INVALID_INPUT',
                    message: 'Missing required fields: storyId, content, title, format'
                }
            });
        }
        const result = await exportService.saveAndExport(input);
        res.json(result);
    }
    catch (error) {
        console.error('Export route error:', error);
        res.status(500).json({
            success: false,
            error: {
                code: 'INTERNAL_ERROR',
                message: 'Export failed'
            }
        });
    }
});
