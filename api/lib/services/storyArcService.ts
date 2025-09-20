import {
  StoryArcSeam,
  StoryArc,
  Chapter,
  Character,
  WorldState,
  CharacterGrowth,
  CliffhangerType,
  ApiResponse,
  SpicyLevel,
  ThemeType
} from '../types/contracts';

export class StoryArcService {
  private storyArcs: Map<string, StoryArc> = new Map();

  constructor() {}

  async manageStoryArc(input: StoryArcSeam['input']): Promise<ApiResponse<StoryArcSeam['output']>> {
    const startTime = Date.now();

    try {
      let storyArc: StoryArc;

      switch (input.operation) {
        case 'create':
          storyArc = await this.createStoryArc(input);
          break;
        case 'update':
          storyArc = await this.updateStoryArc(input);
          break;
        case 'get':
          storyArc = await this.getStoryArc(input.storyId);
          break;
        case 'delete':
          await this.deleteStoryArc(input.storyId);
          return {
            success: true,
            data: {
              storyArc: {} as StoryArc,
              totalChapters: 0,
              canContinue: false,
              nextSuggestedActions: ['Story arc deleted'],
              characterDevelopmentSummary: {},
              plotThreads: []
            },
            metadata: {
              requestId: this.generateRequestId(),
              processingTime: Date.now() - startTime
            }
          };
        default:
          throw new Error(`Invalid operation: ${input.operation}`);
      }

      const analysis = this.analyzeStoryArc(storyArc);

      const output: StoryArcSeam['output'] = {
        storyArc,
        totalChapters: storyArc.chapters.length,
        canContinue: analysis.canContinue,
        nextSuggestedActions: analysis.suggestedActions,
        characterDevelopmentSummary: analysis.characterSummary,
        plotThreads: analysis.plotThreads
      };

      return {
        success: true,
        data: output,
        metadata: {
          requestId: this.generateRequestId(),
          processingTime: Date.now() - startTime
        }
      };

    } catch (error: any) {
      console.error('Story arc management error:', error);

      let errorCode = 'ARC_MANAGEMENT_FAILED';
      if (error.message.includes('not found')) {
        errorCode = 'ARC_NOT_FOUND';
      }

      return {
        success: false,
        error: {
          code: errorCode,
          message: error.message,
          details: error.stack
        },
        metadata: {
          requestId: this.generateRequestId(),
          processingTime: Date.now() - startTime
        }
      };
    }
  }

  private async createStoryArc(input: StoryArcSeam['input']): Promise<StoryArc> {
    if (!input.arcData) {
      throw new Error('Arc data is required for creation');
    }

    const storyArc: StoryArc = {
      arcId: this.generateArcId(),
      userId: input.arcData.userId,
      title: input.arcData.title || 'Untitled Story Arc',
      chapters: [],
      characters: [],
      worldState: input.arcData.worldState || this.createDefaultWorldState(),
      currentSpiceLevel: input.arcData.currentSpiceLevel || 3,
      totalWordCount: 0,
      totalAudioDuration: 0,
      createdAt: new Date(),
      lastUpdatedAt: new Date()
    };

    this.storyArcs.set(storyArc.arcId, storyArc);
    return storyArc;
  }

  private async updateStoryArc(input: StoryArcSeam['input']): Promise<StoryArc> {
    const existingArc = this.storyArcs.get(input.storyId);
    if (!existingArc) {
      throw new Error(`Story arc not found: ${input.storyId}`);
    }

    // Update arc data if provided
    if (input.arcData) {
      Object.assign(existingArc, {
        ...input.arcData,
        lastUpdatedAt: new Date()
      });
    }

    // Add new chapter if provided
    if (input.chapterData) {
      const chapter: Chapter = {
        chapterId: input.chapterData.chapterId || this.generateChapterId(),
        chapterNumber: input.chapterData.chapterNumber || existingArc.chapters.length + 1,
        title: input.chapterData.title || `Chapter ${existingArc.chapters.length + 1}`,
        content: input.chapterData.content || '',
        wordCount: input.chapterData.wordCount || 0,
        audioUrl: input.chapterData.audioUrl,
        audioDuration: input.chapterData.audioDuration,
        cliffhangerType: input.chapterData.cliffhangerType || 'plot_twist',
        characterDevelopments: input.chapterData.characterDevelopments || [],
        generatedAt: new Date()
      };

      existingArc.chapters.push(chapter);
      existingArc.totalWordCount += chapter.wordCount;
      existingArc.totalAudioDuration += chapter.audioDuration || 0;
    }

    this.storyArcs.set(input.storyId, existingArc);
    return existingArc;
  }

  private async getStoryArc(storyId: string): Promise<StoryArc> {
    const storyArc = this.storyArcs.get(storyId);
    if (!storyArc) {
      throw new Error(`Story arc not found: ${storyId}`);
    }
    return storyArc;
  }

  private async deleteStoryArc(storyId: string): Promise<void> {
    if (!this.storyArcs.has(storyId)) {
      throw new Error(`Story arc not found: ${storyId}`);
    }
    this.storyArcs.delete(storyId);
  }

  private analyzeStoryArc(storyArc: StoryArc): {
    canContinue: boolean;
    suggestedActions: string[];
    characterSummary: Record<string, string>;
    plotThreads: string[];
  } {
    const maxChapters = 50; // Reasonable limit for story arcs
    const canContinue = storyArc.chapters.length < maxChapters;

    const suggestedActions: string[] = [];
    if (canContinue) {
      suggestedActions.push('Generate next chapter');
      if (storyArc.chapters.length > 2) {
        suggestedActions.push('Create audiobook compilation');
      }
      if (storyArc.chapters.length > 5) {
        suggestedActions.push('Export complete story');
      }
    } else {
      suggestedActions.push('Story arc complete - export or start new arc');
    }

    const characterSummary: Record<string, string> = {};
    storyArc.characters.forEach(character => {
      const latestDevelopment = character.development[character.development.length - 1];
      characterSummary[character.name] = latestDevelopment?.development || character.description;
    });

    const plotThreads = this.extractPlotThreads(storyArc);

    return {
      canContinue,
      suggestedActions,
      characterSummary,
      plotThreads
    };
  }

  private extractPlotThreads(storyArc: StoryArc): string[] {
    // Analyze chapters to identify ongoing plot threads
    const threads: string[] = [];
    
    if (storyArc.chapters.length > 0) {
      threads.push('Main romantic storyline');
    }
    
    if (storyArc.chapters.some(c => c.cliffhangerType === 'mystery')) {
      threads.push('Mystery elements');
    }
    
    if (storyArc.chapters.some(c => c.cliffhangerType === 'danger')) {
      threads.push('Danger/conflict thread');
    }
    
    return threads;
  }

  private createDefaultWorldState(): WorldState {
    return {
      location: 'Victorian London',
      timeOfDay: 'Evening',
      atmosphere: 'Mysterious and romantic',
      importantEvents: [],
      availableLocations: ['London streets', 'Noble estates', 'Hidden chambers']
    };
  }

  private generateArcId(): string {
    return `arc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateChapterId(): string {
    return `chapter_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}