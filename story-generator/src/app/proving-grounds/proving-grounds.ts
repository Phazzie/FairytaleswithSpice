// Created: 2025-10-31 06:28
import { Component, signal, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { StoryService } from '../story.service';
import { CreatureType, ThemeType, SpicyLevel, WordCount } from '../contracts';

interface PromptTemplate {
  id: string;
  name: string;
  systemPrompt: string;
  userPromptTemplate: string;
  description: string;
}

interface TestConfiguration {
  creature: CreatureType;
  themes: ThemeType[];
  spicyLevel: SpicyLevel;
  wordCount: WordCount;
  userInput: string;
  promptTemplate: PromptTemplate;
}

interface TestResult {
  id: string;
  timestamp: Date;
  configuration: TestConfiguration;
  generatedStory: string;
  generationTime: number;
  aiEvaluation?: {
    score: number;
    strengths: string[];
    weaknesses: string[];
    suggestions: string[];
    overallFeedback: string;
  };
}

@Component({
  selector: 'app-proving-grounds',
  imports: [FormsModule, CommonModule],
  templateUrl: './proving-grounds.html',
  styleUrl: './proving-grounds.css',
  standalone: true
})
export class ProvingGroundsComponent implements OnInit {
  // State signals
  isGenerating = signal(false);
  isEvaluating = signal(false);
  currentTest = signal<TestResult | null>(null);
  testHistory = signal<TestResult[]>([]);
  selectedPromptTemplate = signal<PromptTemplate | null>(null);
  comparisonMode = signal(false);
  selectedComparisons = signal<TestResult[]>([]);

  // Configuration
  creature: CreatureType = 'vampire';
  themes: ThemeType[] = ['forbidden_love', 'obsession'];
  spicyLevel: SpicyLevel = 3;
  wordCount: WordCount = 900;
  userInput = '';

  // Custom prompt editing
  customSystemPrompt = '';
  customUserPrompt = '';
  useCustomPrompts = false;

  // Available options
  creatureOptions: CreatureType[] = ['vampire', 'werewolf', 'fairy'];
  themeOptions: ThemeType[] = [
    'betrayal', 'obsession', 'power_dynamics', 'forbidden_love', 
    'revenge', 'manipulation', 'seduction', 'dark_secrets', 
    'corruption', 'dominance', 'submission', 'jealousy', 
    'temptation', 'sin', 'desire', 'passion', 'lust', 'deceit'
  ];
  spicyLevelOptions: SpicyLevel[] = [1, 2, 3, 4, 5];
  wordCountOptions: WordCount[] = [700, 900, 1200];

  // Prompt templates
  promptTemplates: PromptTemplate[] = [
    {
      id: 'current_production',
      name: 'Current Production Prompt',
      systemPrompt: 'Production system prompt from storyService.ts',
      userPromptTemplate: 'Production user prompt template',
      description: 'The current production prompt being used in the main app'
    },
    {
      id: 'experimental_concise',
      name: 'Experimental: Concise & Punchy',
      systemPrompt: 'Shorter, more direct system prompt focusing on key elements',
      userPromptTemplate: 'Streamlined user prompt',
      description: 'Tests if shorter prompts produce better, tighter stories'
    },
    {
      id: 'experimental_emotional',
      name: 'Experimental: Emotional Depth',
      systemPrompt: 'System prompt emphasizing emotional resonance and character depth',
      userPromptTemplate: 'User prompt focused on emotional journey',
      description: 'Prioritizes emotional connection over plot complexity'
    },
    {
      id: 'experimental_sensory',
      name: 'Experimental: Sensory Immersion',
      systemPrompt: 'System prompt emphasizing multi-sensory descriptions',
      userPromptTemplate: 'User prompt with sensory detail requirements',
      description: 'Tests if enhanced sensory details improve engagement'
    }
  ];

  constructor(private storyService: StoryService) {}

  ngOnInit(): void {
    // Load test history from localStorage
    this.loadTestHistory();
    // Select default template
    this.selectedPromptTemplate.set(this.promptTemplates[0]);
  }

  toggleTheme(theme: ThemeType): void {
    const index = this.themes.indexOf(theme);
    if (index > -1) {
      this.themes.splice(index, 1);
    } else {
      this.themes.push(theme);
    }
  }

  isThemeSelected(theme: ThemeType): boolean {
    return this.themes.includes(theme);
  }

  selectPromptTemplate(template: PromptTemplate): void {
    this.selectedPromptTemplate.set(template);
    if (this.useCustomPrompts) {
      this.customSystemPrompt = template.systemPrompt;
      this.customUserPrompt = template.userPromptTemplate;
    }
  }

  generateStory(): void {
    if (this.isGenerating()) return;

    this.isGenerating.set(true);
    const startTime = Date.now();

    // Call story generation service
    this.storyService.generateStory({
      creature: this.creature,
      themes: this.themes,
      spicyLevel: this.spicyLevel,
      wordCount: this.wordCount,
      userInput: this.userInput
    }).subscribe({
      next: (result) => {
        if (result.success && result.data) {
          const generationTime = Date.now() - startTime;
          
          const testResult: TestResult = {
            id: this.generateId(),
            timestamp: new Date(),
            configuration: {
              creature: this.creature,
              themes: [...this.themes],
              spicyLevel: this.spicyLevel,
              wordCount: this.wordCount,
              userInput: this.userInput,
              promptTemplate: this.selectedPromptTemplate()!
            },
            generatedStory: result.data.content,
            generationTime
          };

          this.currentTest.set(testResult);
          this.addToHistory(testResult);
        } else {
          console.error('Story generation failed:', result.error);
          alert(`Generation failed: ${result.error?.message || 'Unknown error'}`);
        }
        this.isGenerating.set(false);
      },
      error: (error) => {
        console.error('Error generating story:', error);
        alert('Failed to generate story. Check console for details.');
        this.isGenerating.set(false);
      }
    });
  }

  async evaluateStory(testResult: TestResult): Promise<void> {
    if (this.isEvaluating()) return;

    this.isEvaluating.set(true);

    try {
      // Call AI evaluation service
      const evaluation = await this.evaluateWithAI(testResult);
      
      // Update test result with evaluation
      testResult.aiEvaluation = evaluation;
      
      // Update in history
      this.updateTestInHistory(testResult);
      
      // Update current test if it's the same
      if (this.currentTest()?.id === testResult.id) {
        this.currentTest.set({...testResult});
      }
    } catch (error) {
      console.error('Error evaluating story:', error);
      alert('Failed to evaluate story. Check console for details.');
    } finally {
      this.isEvaluating.set(false);
    }
  }

  private async evaluateWithAI(testResult: TestResult): Promise<TestResult['aiEvaluation']> {
    // Use Grok AI to evaluate the story quality
    const evaluationPrompt = `Evaluate this spicy supernatural romance story on the following criteria:

STORY TO EVALUATE:
${testResult.generatedStory}

CONFIGURATION:
- Creature: ${testResult.configuration.creature}
- Themes: ${testResult.configuration.themes.join(', ')}
- Spice Level: ${testResult.configuration.spicyLevel}/5
- Target Word Count: ${testResult.configuration.wordCount}

Please provide:
1. Overall Score (0-100)
2. Strengths (3-5 bullet points)
3. Weaknesses (3-5 bullet points)
4. Specific Suggestions for Improvement (3-5 bullet points)
5. Overall Feedback (2-3 sentences)

Format your response as JSON:
{
  "score": number,
  "strengths": ["strength1", "strength2", ...],
  "weaknesses": ["weakness1", "weakness2", ...],
  "suggestions": ["suggestion1", "suggestion2", ...],
  "overallFeedback": "feedback text"
}`;

    // For now, return mock evaluation - will integrate with actual API
    // TODO: Integrate with actual Grok API for evaluation
    return {
      score: 75,
      strengths: [
        'Strong character development',
        'Good pacing and tension',
        'Effective use of sensory details'
      ],
      weaknesses: [
        'Some dialogue feels repetitive',
        'Could use more unique voice descriptors',
        'Cliffhanger could be stronger'
      ],
      suggestions: [
        'Vary dialogue patterns between characters',
        'Add more unconventional voice descriptors',
        'Increase stakes in final scene for stronger hook'
      ],
      overallFeedback: 'Solid story with good fundamentals. Character chemistry is strong but could benefit from more distinct dialogue patterns.'
    };
  }

  toggleComparison(testResult: TestResult): void {
    const selected = this.selectedComparisons();
    const index = selected.findIndex(t => t.id === testResult.id);
    
    if (index > -1) {
      selected.splice(index, 1);
    } else if (selected.length < 3) {
      selected.push(testResult);
    }
    
    this.selectedComparisons.set([...selected]);
  }

  isSelectedForComparison(testResult: TestResult): boolean {
    return this.selectedComparisons().some(t => t.id === testResult.id);
  }

  clearComparisons(): void {
    this.selectedComparisons.set([]);
  }

  exportTestResults(): void {
    const dataStr = JSON.stringify(this.testHistory(), null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    const exportFileDefaultName = `proving-grounds-results-${Date.now()}.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  }

  deleteTest(testId: string): void {
    const history = this.testHistory().filter(t => t.id !== testId);
    this.testHistory.set(history);
    this.saveTestHistory();
    
    if (this.currentTest()?.id === testId) {
      this.currentTest.set(null);
    }
  }

  private generateId(): string {
    return `test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private addToHistory(testResult: TestResult): void {
    const history = [testResult, ...this.testHistory()];
    this.testHistory.set(history);
    this.saveTestHistory();
  }

  private updateTestInHistory(testResult: TestResult): void {
    const history = this.testHistory().map(t => 
      t.id === testResult.id ? testResult : t
    );
    this.testHistory.set(history);
    this.saveTestHistory();
  }

  private saveTestHistory(): void {
    try {
      localStorage.setItem('provingGrounds_testHistory', JSON.stringify(this.testHistory()));
    } catch (error) {
      console.error('Failed to save test history:', error);
    }
  }

  private loadTestHistory(): void {
    try {
      const saved = localStorage.getItem('provingGrounds_testHistory');
      if (saved) {
        const parsed = JSON.parse(saved);
        // Convert timestamp strings back to Date objects
        const history = parsed.map((t: any) => ({
          ...t,
          timestamp: new Date(t.timestamp)
        }));
        this.testHistory.set(history);
      }
    } catch (error) {
      console.error('Failed to load test history:', error);
    }
  }
}
