# World-Class Copilot Instructions: Seam-Driven Development for Fairytales with Spice

## 🚀 PRIMARY DIRECTIVE: ADHERE TO SEAM-DRIVEN DEVELOPMENT

Your main goal is to help me build and maintain the **Fairytales with Spice** AI story generator by strictly following the **Seam-Driven Development** methodology. This means we define explicit TypeScript contracts for all data boundaries *before* writing any implementation code.

### 📜 Core Principles
1.  **SEAMS FIRST**: Before any coding, we identify the "seams" where data is exchanged (e.g., UI to API, API to AI service).
2.  **UI-FIRST, MOCK-DRIVEN**: We build the user interface first, using mock data. This reveals the exact data contracts we need.
3.  **CONTRACTS ARE LAW**: Every seam is defined by a TypeScript interface in `contracts.ts`. This is the single source of truth.
4.  **REGENERATE, DON'T DEBUG**: If there's an integration issue, we fix the contract and regenerate the code. We do not manually debug generated code.

### 🌶️ Project-Specific Context
This is a **spicy fairy tale story generator**. Remember these key domain concepts:
-   **Creatures**: `'vampire' | 'werewolf' | 'fairy'`
-   **Themes**: `'romance' | 'adventure' | 'mystery' | 'comedy' | 'dark'`
-   **Spicy Levels**: `1 | 2 | 3 | 4 | 5`
-   **Core Process**: Story Generation → Chapter Continuation → Audio Conversion → Export

### Established Seam Contracts
These are the foundational contracts of our application. All new features should follow these patterns.
1.  `StoryGenerationSeam`
2.  `ChapterContinuationSeam`
3.  `AudioConversionSeam`
4.  `SaveExportSeam`

---

## 🛠️ YOUR WORKFLOW: HOW TO HELP ME

### Step 1: Define the Seam Contract
When I ask you to create a new feature, your first step is to define the contract in `backend/src/types/contracts.ts`.

**Example Prompt**: "Jules, I need a feature to let users rate a story."

**Your Response**:
```typescript
// In backend/src/types/contracts.ts

export interface StoryRatingSeam {
  input: {
    storyId: string;
    rating: 1 | 2 | 3 | 4 | 5;
    userId: string;
  };
  output: {
    storyId: string;
    newAverageRating: number;
    totalRatings: number;
  };
}
```

### Step 2: Create the Backend Route and Service
Next, you will create a new route in the `backend/src/routes` directory and a new service method in the corresponding service file in `backend/src/services`.

**Your Action**:
1.  **Create the route** in a file like `storyRoutes.ts`:
    ```typescript
    // In backend/src/routes/storyRoutes.ts
    router.post('/story/:storyId/rate', async (req, res, next) => {
      try {
        const service = new StoryService();
        const response = await service.rateStory(req.body);
        res.json(response);
      } catch (error) {
        next(error);
      }
    });
    ```
2.  **Implement the service method** in `storyService.ts`, starting with a mock:
    ```typescript
    // In backend/src/services/storyService.ts

    async rateStory(input: StoryRatingSeam['input']): Promise<ApiResponse<StoryRatingSeam['output']>> {
      // MOCK IMPLEMENTATION
      const output: StoryRatingSeam['output'] = {
        storyId: input.storyId,
        newAverageRating: 4.5,
        totalRatings: 100,
      };

      return {
        success: true,
        data: output,
        metadata: {
          requestId: this.generateRequestId(),
          processingTime: 10,
        },
      };
    }
    ```

### Step 3: Connect to the Frontend
Finally, you will help me create or modify the Angular service in `story-generator/src/app` to call the new endpoint.

---

## ✅ ALWAYS DO THIS

*   **Reference `contracts.ts`**: This is your bible. All types must come from here.
*   **Use the `ApiResponse<T>` wrapper**: Every single API response must use this pattern.
*   **Implement Mock Fallbacks**: If an API key is missing, the service should return mock data that conforms to the contract.
*   **Ask Me to Define Contracts First**: If I forget, remind me. "Boss, what should the contract for this look like?"
*   **Keep Frontend and Backend Contracts Identical**: The `contracts.ts` files in `story-generator` and `backend` should be perfect copies.
*   **Focus on Integration-Proof Code**: Your primary goal is to prevent integration errors by enforcing contracts.

## ❌ NEVER DO THIS

*   **Never Start with the Database**: We design from the UI inwards, not from the database outwards.
*   **Never Build the Backend Before the UI Contract is Clear**: The UI's needs define the contract.
*   **Never Skip Contract Definitions**: This is the most important rule.
*   **Never Suggest Debugging Generated Code**: If generated code is wrong, the contract or the generator is wrong. Fix that.
*   **Never Create Conflicting Types**: Do not invent new types for `CreatureType`, `ThemeType`, etc. Use the existing ones.
*   **Never Ignore the Spicy Content Rating System**: It is a core feature of the application.