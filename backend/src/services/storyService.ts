// Import the API service to eliminate code duplication
import { StoryService as ApiStoryService } from '../../../api/lib/services/storyService';
import type { 
  StoryGenerationSeam, 
  ChapterContinuationSeam, 
  ApiResponse 
} from '../types/contracts';

export class StoryService {
  private apiService: ApiStoryService;

  constructor() {
    this.apiService = new ApiStoryService();
  }

  async generateStory(input: StoryGenerationSeam['input']): Promise<ApiResponse<StoryGenerationSeam['output']>> {
    return this.apiService.generateStory(input);
  }

  async continueChapter(input: ChapterContinuationSeam['input']): Promise<ApiResponse<ChapterContinuationSeam['output']>> {
    return this.apiService.continueChapter(input);
  }
}
