// Created: 2025-10-31 06:28
import { Component, signal, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { StoryService } from '../story.service';
import { CreatureType, ThemeType, SpicyLevel, WordCount } from '../contracts';
import { PromptTemplatesService, PromptTemplate } from './prompt-templates.service';
import { PromptEvaluationService } from './prompt-evaluation.service';
import { GenerationLogicService, GenerationLogic, AuthorStyle, BeatStructure } from './generation-logic.service';

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

  // Generation logic viewing and editing
  showGenerationLogic = false;
  currentGenerationLogic = signal<GenerationLogic | null>(null);
  allAuthorStyles: AuthorStyle[] = [];
  allBeatStructures: BeatStructure[] = [];
  allChekovElements: string[] = [];
  
  // Selected logic for custom control
  selectedAuthorIndices: number[] = [];
  selectedBeatIndex: number = 0;
  selectedChekovIndices: number[] = [];

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
  promptTemplates: PromptTemplate[] = [];

  constructor(
    private storyService: StoryService,
    private promptTemplatesService: PromptTemplatesService,
    private evaluationService: PromptEvaluationService,
    private sanitizer: DomSanitizer,
    private generationLogicService: GenerationLogicService
  ) {}

  ngOnInit(): void {
    // Load templates from service
    this.promptTemplates = this.promptTemplatesService.getTemplates();
    
    // Load test history from localStorage
    this.loadTestHistory();
    
    // Select default template
    if (this.promptTemplates.length > 0) {
      this.selectedPromptTemplate.set(this.promptTemplates[0]);
    }

    // Load generation logic data
    this.loadGenerationLogicData();
  }

  private loadGenerationLogicData(): void {
    this.allBeatStructures = this.generationLogicService.getAllBeatStructures();
    this.allChekovElements = this.generationLogicService.getAllChekovElements();
    this.updateAuthorStylesForCreature();
  }

  private updateAuthorStylesForCreature(): void {
    this.allAuthorStyles = this.generationLogicService.getAllAuthorStyles(this.creature);
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

  getFilledPrompts(): { system: string; user: string } | null {
    const template = this.selectedPromptTemplate();
    if (!template) return null;

    return this.promptTemplatesService.fillTemplate(template, {
      creature: this.creature,
      themes: this.themes,
      spicyLevel: this.spicyLevel,
      wordCount: this.wordCount,
      userInput: this.userInput
    });
  }

  viewPrompts(): void {
    const prompts = this.getFilledPrompts();
    if (!prompts) return;

    const message = `SYSTEM PROMPT:\n\n${prompts.system}\n\n${'='.repeat(80)}\n\nUSER PROMPT:\n\n${prompts.user}`;
    
    // Create a modal or alert with the prompts
    alert(message);
  }

  sanitizeHtml(html: string): SafeHtml {
    // We trust the AI-generated HTML content but still mark it as safe for Angular
    // The content is story text with basic HTML formatting tags only
    return this.sanitizer.bypassSecurityTrustHtml(html);
  }

  generateRandomLogic(): void {
    const logic = this.generationLogicService.generateRandomLogic(this.creature);
    this.currentGenerationLogic.set(logic);
    this.showGenerationLogic = true;
  }

  viewGenerationLogic(): void {
    if (!this.currentGenerationLogic()) {
      this.generateRandomLogic();
    } else {
      this.showGenerationLogic = !this.showGenerationLogic;
    }
  }

  regenerateLogic(): void {
    this.generateRandomLogic();
  }

  toggleAuthorSelection(index: number): void {
    const idx = this.selectedAuthorIndices.indexOf(index);
    if (idx > -1) {
      this.selectedAuthorIndices.splice(idx, 1);
    } else if (this.selectedAuthorIndices.length < 3) {
      this.selectedAuthorIndices.push(index);
    }
  }

  isAuthorSelected(index: number): boolean {
    return this.selectedAuthorIndices.includes(index);
  }

  toggleChekovSelection(index: number): void {
    const idx = this.selectedChekovIndices.indexOf(index);
    if (idx > -1) {
      this.selectedChekovIndices.splice(idx, 1);
    } else if (this.selectedChekovIndices.length < 2) {
      this.selectedChekovIndices.push(index);
    }
  }

  isChekovSelected(index: number): boolean {
    return this.selectedChekovIndices.includes(index);
  }

  applyCustomLogic(): void {
    // Apply manually selected logic
    const selectedAuthors = this.selectedAuthorIndices.map(i => this.allAuthorStyles[i]);
    const selectedBeat = this.allBeatStructures[this.selectedBeatIndex];
    const selectedChekov = this.selectedChekovIndices.map(i => ({
      description: this.allChekovElements[i]
    }));

    this.currentGenerationLogic.set({
      selectedAuthors,
      selectedBeatStructure: selectedBeat,
      chekovElements: selectedChekov
    });
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
    // Use the evaluation service to evaluate story quality
    return await this.evaluationService.evaluateStory({
      storyContent: testResult.generatedStory,
      configuration: {
        creature: testResult.configuration.creature,
        themes: testResult.configuration.themes,
        spicyLevel: testResult.configuration.spicyLevel,
        wordCount: testResult.configuration.wordCount
      }
    });
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
    return `test_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
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
