// ==================== IMAGE GENERATION SERVICE ====================
// Implements the SEAM 5: Story → Image Generation contract
// Generates images using Grok-2-Image based on story content

import axios from 'axios';
import { ImageGenerationSeam, ApiResponse } from '../types/contracts.js';

export class ImageService {
  private grokApiKey: string | undefined;
  private grokApiUrl: string;

  constructor() {
    this.grokApiKey = process.env.XAI_API_KEY;
    this.grokApiUrl = 'https://api.x.ai/v1/images/generations';
  }

  /**
   * Generates an image based on story content using Grok-2-Image
   */
  async generateImage(input: ImageGenerationSeam['input']): Promise<ApiResponse<ImageGenerationSeam['output']>> {
    const startTime = Date.now();

    try {
      // Validate input
      const validationError = this.validateImageInput(input);
      if (validationError) {
        return {
          success: false,
          error: validationError,
          metadata: {
            requestId: this.generateRequestId(),
            processingTime: Date.now() - startTime
          }
        };
      }

      // Generate image using Grok-2-Image
      const imageUrl = await this.callGrokImageAI(input);

      // Create response
      const output: ImageGenerationSeam['output'] = {
        imageId: this.generateImageId(),
        storyId: input.storyId,
        imageUrl: imageUrl,
        prompt: this.buildImagePrompt(input),
        style: input.style,
        aspectRatio: input.aspectRatio || '16:9',
        width: this.getAspectRatioDimensions(input.aspectRatio || '16:9').width,
        height: this.getAspectRatioDimensions(input.aspectRatio || '16:9').height,
        fileSize: 0, // Will be populated when we know the actual file
        generatedAt: new Date()
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
      console.error('Image generation error:', error);
      return {
        success: false,
        error: {
          code: 'IMAGE_GENERATION_FAILED',
          message: error.message || 'Failed to generate image'
        },
        metadata: {
          requestId: this.generateRequestId(),
          processingTime: Date.now() - startTime
        }
      };
    }
  }

  private async callGrokImageAI(input: ImageGenerationSeam['input']): Promise<string> {
    if (!this.grokApiKey) {
      // Return mock image URL if no API key
      return this.generateMockImageUrl(input);
    }

    const prompt = this.buildImagePrompt(input);

    try {
      const response = await axios.post(this.grokApiUrl, {
        model: 'grok-2-image',
        prompt: prompt,
        n: 1, // Generate 1 image
        size: this.mapAspectRatioToSize(input.aspectRatio || '16:9'),
        response_format: 'url',
        style: this.mapStyleToGrokStyle(input.style)
      }, {
        headers: {
          'Authorization': `Bearer ${this.grokApiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 60000 // 60 second timeout for image generation
      });

      return response.data.data[0].url;

    } catch (error: any) {
      console.error('Grok Image API error:', error.response?.data || error.message);
      throw new Error('AI image service temporarily unavailable');
    }
  }

  private buildImagePrompt(input: ImageGenerationSeam['input']): string {
    // Use custom prompt if provided, otherwise extract scene from story
    if (input.imagePrompt) {
      return this.enhancePromptWithStyle(input.imagePrompt, input);
    }

    // Extract key scene elements from story content
    const sceneDescription = this.extractSceneFromStory(input.content, input.creature);
    return this.enhancePromptWithStyle(sceneDescription, input);
  }

  private enhancePromptWithStyle(basePrompt: string, input: ImageGenerationSeam['input']): string {
    const creatureContext = this.getCreatureContext(input.creature);
    const themeElements = input.themes.map(theme => this.mapThemeToVisualElement(theme)).join(', ');
    const styleModifier = this.getStyleModifier(input.style);

    return `${basePrompt}. ${creatureContext}. Visual elements: ${themeElements}. ${styleModifier}. High quality, detailed, atmospheric lighting.`;
  }

  private extractSceneFromStory(content: string, creature: string): string {
    // Simple extraction - look for the first paragraph with descriptive content
    const cleanContent = content.replace(/<[^>]*>/g, ''); // Remove HTML tags
    const sentences = cleanContent.split('.').slice(0, 3); // First few sentences
    const sceneDescription = sentences.join('.').substring(0, 200);
    
    return `A scene featuring a ${creature}: ${sceneDescription}`;
  }

  private getCreatureContext(creature: string): string {
    const contexts = {
      vampire: 'gothic vampire with pale skin, dark eyes, elegant period clothing',
      werewolf: 'powerful werewolf with fierce eyes, muscular build, wild hair',
      fairy: 'ethereal fairy with delicate wings, magical aura, nature elements'
    };
    return contexts[creature as keyof typeof contexts] || 'supernatural being';
  }

  private mapThemeToVisualElement(theme: string): string {
    const visualMap: Record<string, string> = {
      betrayal: 'shadows and daggers',
      obsession: 'intense gazes and mirrors',
      power_dynamics: 'thrones and chains',
      forbidden_love: 'roses and thorns',
      revenge: 'fire and darkness',
      manipulation: 'puppet strings and masks',
      seduction: 'silk and candlelight',
      dark_secrets: 'locked doors and keys',
      corruption: 'wilting flowers and decay',
      dominance: 'crowns and submission poses',
      submission: 'kneeling figures and restraints',
      jealousy: 'green eyes and broken hearts',
      temptation: 'apples and serpents',
      sin: 'fallen angels and shadows',
      desire: 'reaching hands and longing looks',
      passion: 'fire and embraces',
      lust: 'revealing clothing and desire',
      deceit: 'masks and false smiles'
    };
    return visualMap[theme] || 'mysterious elements';
  }

  private getStyleModifier(style: string): string {
    const styleMap = {
      artistic: 'painted in an artistic, impressionistic style',
      photorealistic: 'hyper-realistic, photographic quality',
      fantasy: 'fantastical, magical realism with vibrant colors',
      dark: 'dark, moody, gothic atmosphere with deep shadows',
      romantic: 'romantic, soft lighting, dreamy atmosphere'
    };
    return styleMap[style as keyof typeof styleMap] || 'artistic style';
  }

  private mapStyleToGrokStyle(style: string): string {
    // Map our internal style to Grok's style parameters
    const grokStyleMap = {
      artistic: 'vivid',
      photorealistic: 'natural',
      fantasy: 'vivid',
      dark: 'natural',
      romantic: 'vivid'
    };
    return grokStyleMap[style as keyof typeof grokStyleMap] || 'natural';
  }

  private mapAspectRatioToSize(aspectRatio: string): string {
    const sizeMap = {
      '1:1': '1024x1024',
      '16:9': '1792x1024',
      '9:16': '1024x1792',
      '4:3': '1536x1152'
    };
    return sizeMap[aspectRatio as keyof typeof sizeMap] || '1792x1024';
  }

  private getAspectRatioDimensions(aspectRatio: string): { width: number; height: number } {
    const dimensionsMap = {
      '1:1': { width: 1024, height: 1024 },
      '16:9': { width: 1792, height: 1024 },
      '9:16': { width: 1024, height: 1792 },
      '4:3': { width: 1536, height: 1152 }
    };
    return dimensionsMap[aspectRatio as keyof typeof dimensionsMap] || { width: 1792, height: 1024 };
  }

  private generateMockImageUrl(input: ImageGenerationSeam['input']): string {
    // Generate a realistic mock image URL for development
    const dimensions = this.getAspectRatioDimensions(input.aspectRatio || '16:9');
    const mockId = Math.random().toString(36).substring(2, 15);
    return `https://picsum.photos/${dimensions.width}/${dimensions.height}?random=${mockId}`;
  }

  private validateImageInput(input: ImageGenerationSeam['input']): { code: string; message: string } | null {
    if (!input.storyId) {
      return { code: 'INVALID_INPUT', message: 'Story ID is required' };
    }
    if (!input.content || input.content.length < 10) {
      return { code: 'INVALID_INPUT', message: 'Story content is required and must be substantial' };
    }
    if (!input.style || !['artistic', 'photorealistic', 'fantasy', 'dark', 'romantic'].includes(input.style)) {
      return { code: 'UNSUPPORTED_STYLE', message: 'Invalid image style provided' };
    }
    return null;
  }

  private generateRequestId(): string {
    return `img-req-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }

  private generateImageId(): string {
    return `img-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }
}