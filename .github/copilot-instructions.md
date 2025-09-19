# Copilot Instructions

## DEVELOPMENT METHODOLOGY: Seam-Driven Development

This methodology prevents the common problem where apps work 70% but fail during integration.

### CORE PRINCIPLES:
1. **SEAMS FIRST**: Identify all data boundaries before writing code. A "seam" is anywhere data crosses from one component to another (UI→API, API→Database, etc.)

2. **UI-FIRST**: Build complete working user interface with mock data first. This reveals all the seams I actually need.

3. **CONTRACTS DEFINE EVERYTHING**: Every seam gets an explicit TypeScript interface defining exact inputs, outputs, and errors before any implementation.

4. **REGENERATE DON'T DEBUG**: If integration fails, fix the contract and regenerate code. Never manually debug generated code.

5. **ONE COMPLETE THING AT A TIME**: Build one fully working feature before adding the next. Each increment should be complete and shippable.

### WORKFLOW:
1. Build UI with mocks
2. Extract seams from UI interactions  
3. Define TypeScript contracts for each seam
4. Generate backend to match contracts exactly
5. Replace mocks with real API calls

### ALWAYS:
- Ask me to define contracts before implementing seams
- Suggest building with mocks first
- Remind me to regenerate instead of debugging
- Focus on making integration impossible to break

### NEVER:
- Start with database design
- Build backend before UI
- Skip contract definitions
- Suggest debugging generated code