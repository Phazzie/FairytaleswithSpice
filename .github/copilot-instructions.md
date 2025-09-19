# Copilot Instructions

## DEVELOPMENT METHODOLOGY: Seam-Driven Development

This methodology prevents the common problem where apps work 70% but fail during integration, specifically adapted for the **Fairytales with Spice** AI story generation platform.

### CORE PRINCIPLES:
1. **SEAMS FIRST**: Identify all data boundaries before writing code. A "seam" is anywhere data crosses from one component to another (UI→API, API→Database, etc.)

2. **UI-FIRST**: Build complete working user interface with mock data first. This reveals all the seams I actually need.

3. **CONTRACTS DEFINE EVERYTHING**: Every seam gets an explicit TypeScript interface defining exact inputs, outputs, and errors before any implementation.

4. **REGENERATE DON'T DEBUG**: If integration fails, fix the contract and regenerate code. Never manually debug generated code.

5. **ONE COMPLETE THING AT A TIME**: Build one fully working feature before adding the next. Each increment should be complete and shippable.

### PROJECT-SPECIFIC CONTEXT:
This is a **spicy fairy tale story generator** with these key domain concepts:
- **Creatures**: `'vampire' | 'werewolf' | 'fairy'`
- **Themes**: `'romance' | 'adventure' | 'mystery' | 'comedy' | 'dark'`
- **Spicy Levels**: `1 | 2 | 3 | 4 | 5` (content intensity rating)
- **Story Processing**: Generation → Chapter Continuation → Audio Conversion → Export

### ESTABLISHED SEAMS:
The project already implements these proven seam contracts:

1. **User Input → Story Generator**: Form data to AI-generated story content
2. **Story → Chapter Continuation**: Existing story to additional chapters
3. **Story Text → Audio Converter**: HTML content to TTS audio files
4. **Story Data → Save/Export**: Story content to various download formats

### WORKFLOW:
1. Build UI with mocks using existing `contracts.ts` types
2. Extract seams from UI interactions following established patterns
3. Define TypeScript contracts matching existing seam interfaces
4. Generate backend services conforming to contract specifications
5. Replace mocks with real API calls (Grok AI, ElevenLabs)

### ALWAYS:
- Reference existing contracts in `story-generator/src/app/contracts.ts` and `backend/src/types/contracts.ts`
- Use established type definitions (`CreatureType`, `ThemeType`, `SpicyLevel`, etc.)
- Follow the `ApiResponse<T>` pattern for all API responses
- Implement mock fallbacks for development without API keys
- Ask me to define contracts before implementing new seams
- Focus on making integration impossible to break

### NEVER:
- Start with database design
- Build backend before UI
- Skip contract definitions
- Suggest debugging generated code
- Create new types that conflict with existing domain types
- Ignore the spicy content rating system