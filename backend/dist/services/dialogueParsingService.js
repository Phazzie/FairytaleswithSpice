"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DialogueParsingService = void 0;
class DialogueParsingService {
    /**
     * Parse story content into dialogue segments with character identification
     */
    parseDialogue(htmlContent, creatureType) {
        const segments = [];
        // Clean HTML and split into paragraphs
        const paragraphs = this.extractParagraphs(htmlContent);
        let segmentIndex = 0;
        for (let i = 0; i < paragraphs.length; i++) {
            const paragraph = paragraphs[i];
            // Check if paragraph contains dialogue (quotes)
            if (this.containsDialogue(paragraph)) {
                // Split paragraph into dialogue and non-dialogue parts
                const parts = this.splitDialogueFromNarration(paragraph);
                for (const part of parts) {
                    if (part.content.trim()) {
                        const segment = {
                            id: this.generateSegmentId(),
                            type: part.isDialogue ? 'dialogue' : 'narration',
                            content: part.content.trim(),
                            originalIndex: segmentIndex++
                        };
                        if (part.isDialogue) {
                            segment.characterName = this.extractCharacterName(part.content, paragraphs, i);
                            segment.characterType = this.mapCharacterToVoice(segment.characterName, creatureType);
                            segment.emotionalContext = this.extractEmotionalContext(part.content, paragraph);
                        }
                        else {
                            segment.characterType = 'narrator';
                            segment.emotionalContext = this.extractEmotionalContext(part.content, paragraph);
                        }
                        segments.push(segment);
                    }
                }
            }
            else {
                // Pure narration
                const segment = {
                    id: this.generateSegmentId(),
                    type: 'narration',
                    content: this.cleanText(paragraph),
                    characterType: 'narrator',
                    emotionalContext: this.extractEmotionalContext(paragraph, paragraph),
                    originalIndex: segmentIndex++
                };
                segments.push(segment);
            }
        }
        return segments;
    }
    /**
     * Map character names to voice types based on creature type and gender cues
     */
    mapCharacterToVoice(characterName, creatureType) {
        if (!characterName) {
            return 'narrator';
        }
        const lowerName = characterName.toLowerCase();
        // Determine gender from name patterns
        const isFemale = this.isFeminineName(lowerName);
        const gender = isFemale ? 'female' : 'male';
        // Map based on creature type and name patterns
        if (creatureType) {
            // Main character is likely the creature type
            if (this.isMainCharacter(lowerName)) {
                return `${creatureType}-${gender}`;
            }
        }
        // Check for supernatural indicators in name or context
        if (this.isVampireName(lowerName)) {
            return `vampire-${gender}`;
        }
        if (this.isWerewolfName(lowerName)) {
            return `werewolf-${gender}`;
        }
        if (this.isFairyName(lowerName)) {
            return `fairy-${gender}`;
        }
        // Default to human
        return `human-${gender}`;
    }
    /**
     * Extract emotional context from dialogue and surrounding narration
     */
    extractEmotionalContext(content, fullContext) {
        const lowerContent = content.toLowerCase();
        const lowerContext = fullContext.toLowerCase();
        // Check for emotional keywords and context
        if (this.matchesPattern(lowerContent, ['whisper', 'breathed', 'murmur']) ||
            this.matchesPattern(lowerContext, ['seductive', 'sultry', 'velvet'])) {
            return 'seductive';
        }
        if (this.matchesPattern(lowerContent, ['gasped', 'moaned', 'cried']) ||
            this.matchesPattern(lowerContext, ['passion', 'desire', 'burning'])) {
            return 'passionate';
        }
        if (this.matchesPattern(lowerContent, ['mystery', 'secret', 'hidden']) ||
            this.matchesPattern(lowerContext, ['shadow', 'darkness', 'enigma'])) {
            return 'mysterious';
        }
        if (this.matchesPattern(lowerContent, ['gentle', 'soft', 'tender']) ||
            this.matchesPattern(lowerContext, ['love', 'care', 'warmth'])) {
            return 'tender';
        }
        if (this.matchesPattern(lowerContent, ['intense', 'fierce', 'powerful']) ||
            this.matchesPattern(lowerContext, ['strength', 'force', 'overwhelming'])) {
            return 'intense';
        }
        if (this.matchesPattern(lowerContent, ['desperate', 'pleading', 'begging']) ||
            this.matchesPattern(lowerContext, ['desperation', 'urgent', 'need'])) {
            return 'desperate';
        }
        if (this.matchesPattern(lowerContent, ['afraid', 'terrified', 'feared']) ||
            this.matchesPattern(lowerContext, ['terror', 'horror', 'dread'])) {
            return 'fearful';
        }
        return 'neutral';
    }
    /**
     * Extract paragraphs from HTML content
     */
    extractParagraphs(htmlContent) {
        // Remove HTML tags except for emphasis tags
        let cleanContent = htmlContent
            .replace(/<h[1-6][^>]*>/gi, '\n\n')
            .replace(/<\/h[1-6]>/gi, '\n\n')
            .replace(/<p[^>]*>/gi, '')
            .replace(/<\/p>/gi, '\n\n')
            .replace(/<br[^>]*>/gi, '\n')
            .replace(/<hr[^>]*>/gi, '\n---\n');
        // Split by double newlines and filter empty paragraphs
        return cleanContent
            .split(/\n\s*\n/)
            .map(p => p.trim())
            .filter(p => p.length > 0);
    }
    /**
     * Check if paragraph contains dialogue
     */
    containsDialogue(paragraph) {
        return /[""].+?[""]/.test(paragraph) || /"[^"]*"/.test(paragraph);
    }
    /**
     * Split paragraph into dialogue and narration parts
     */
    splitDialogueFromNarration(paragraph) {
        const parts = [];
        // Enhanced regex to handle various quote patterns
        const dialogueRegex = /(["""])([^"""]*?)\1/g;
        let lastIndex = 0;
        let match;
        while ((match = dialogueRegex.exec(paragraph)) !== null) {
            // Add narration before dialogue
            if (match.index > lastIndex) {
                const narration = paragraph.substring(lastIndex, match.index).trim();
                if (narration) {
                    parts.push({ content: narration, isDialogue: false });
                }
            }
            // Add dialogue
            parts.push({ content: match[2], isDialogue: true });
            lastIndex = dialogueRegex.lastIndex;
        }
        // Add remaining narration
        if (lastIndex < paragraph.length) {
            const remaining = paragraph.substring(lastIndex).trim();
            if (remaining) {
                parts.push({ content: remaining, isDialogue: false });
            }
        }
        // If no dialogue found, treat entire paragraph as narration
        if (parts.length === 0) {
            parts.push({ content: paragraph, isDialogue: false });
        }
        return parts;
    }
    /**
     * Extract character name from dialogue context
     */
    extractCharacterName(dialogue, allParagraphs, currentIndex) {
        // Look for name indicators in current and nearby paragraphs
        const context = [
            allParagraphs[currentIndex - 1] || '',
            allParagraphs[currentIndex] || '',
            allParagraphs[currentIndex + 1] || ''
        ].join(' ');
        // Common name patterns in romantic fiction
        const namePatterns = [
            /(?:Lady|Lord|Prince|Princess|Duke|Duchess|Sir|Miss|Mrs?\.)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/g,
            /\b([A-Z][a-z]{2,})\s+(?:whispered|said|breathed|murmured|gasped|replied|answered)/g,
            /(?:he|she)\s+whispered[^.]*?"([^"]*?)"/g
        ];
        for (const pattern of namePatterns) {
            const matches = context.matchAll(pattern);
            for (const match of matches) {
                if (match[1] && match[1].length > 2) {
                    return match[1];
                }
            }
        }
        // Extract common fantasy names
        const fantasyNames = context.match(/\b(Arabella|Valdric|Seraphina|Dante|Isabella|Lucian|Morgana|Adrian|Evangeline)\b/gi);
        if (fantasyNames && fantasyNames.length > 0) {
            return fantasyNames[0];
        }
        return undefined;
    }
    /**
     * Check if name follows feminine patterns
     */
    isFeminineName(name) {
        const feminineEndings = ['a', 'ia', 'ina', 'elle', 'ette', 'ine', 'ara', 'ora'];
        const feminineNames = ['lady', 'miss', 'mrs', 'duchess', 'princess', 'arabella', 'seraphina', 'isabella', 'morgana', 'evangeline'];
        return feminineEndings.some(ending => name.endsWith(ending)) ||
            feminineNames.some(femName => name.includes(femName));
    }
    /**
     * Check if character is likely the main character
     */
    isMainCharacter(name) {
        const mainCharacterIndicators = ['lady', 'prince', 'princess', 'lord', 'duke', 'duchess'];
        return mainCharacterIndicators.some(indicator => name.includes(indicator));
    }
    /**
     * Check if name suggests vampire character
     */
    isVampireName(name) {
        const vampireIndicators = ['valdric', 'lucian', 'dante', 'adrian', 'vampire', 'dark', 'blood'];
        return vampireIndicators.some(indicator => name.includes(indicator));
    }
    /**
     * Check if name suggests werewolf character
     */
    isWerewolfName(name) {
        const werewolfIndicators = ['wolf', 'lunar', 'moon', 'beast', 'wild', 'hunter'];
        return werewolfIndicators.some(indicator => name.includes(indicator));
    }
    /**
     * Check if name suggests fairy character
     */
    isFairyName(name) {
        const fairyIndicators = ['seraphina', 'evangeline', 'fairy', 'fae', 'sylph', 'sprite', 'ethereal'];
        return fairyIndicators.some(indicator => name.includes(indicator));
    }
    /**
     * Check if text matches any of the given patterns
     */
    matchesPattern(text, patterns) {
        return patterns.some(pattern => text.includes(pattern));
    }
    /**
     * Clean text for TTS processing
     */
    cleanText(text) {
        return text
            .replace(/<[^>]*>/g, '') // Remove remaining HTML tags
            .replace(/\s+/g, ' ') // Normalize whitespace
            .trim();
    }
    /**
     * Generate unique segment ID
     */
    generateSegmentId() {
        return `seg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
}
exports.DialogueParsingService = DialogueParsingService;
