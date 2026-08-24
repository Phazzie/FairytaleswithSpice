// ==================== IMAGE GENERATION SERVICE ====================
// Implements the SEAM 5: Story → Image Generation contract
// Generates images using Grok-2-Image based on story content

import axios from 'axios';
import { randomUUID } from 'node:crypto';
import { ImageGenerationSeam, ApiResponse } from '../types/contracts.js';
import { stripStoryHtmlToText } from '../utils/storyTextBlocks';

type SupportedAspectRatio = NonNullable<ImageGenerationSeam['input']['aspectRatio']>;

interface AspectRatioSpec {
  size: string;
  width: number;
  height: number;
}

const DEFAULT_ASPECT_RATIO: SupportedAspectRatio = '16:9';

/**
 * The requested ratio decides three things at once: the size asked of the
 * provider, and the `width`/`height` the response reports. They were three
 * separate lookups, each with its own `|| '1792x1024'`-style fallback, so an
 * unsupported ratio was silently served as 16:9 while the response still
 * echoed the ratio the caller asked for — a payload that says `21:9` above
 * `1792x1024`. One table means a ratio is either supported everywhere or
 * rejected, and `SUPPORTED_ASPECT_RATIOS` cannot drift from what the lookups
 * actually handle.
 */
const ASPECT_RATIO_SPECS: Record<SupportedAspectRatio, AspectRatioSpec> = {
  '1:1': { size: '1024x1024', width: 1024, height: 1024 },
  '16:9': { size: '1792x1024', width: 1792, height: 1024 },
  '9:16': { size: '1024x1792', width: 1024, height: 1792 },
  '4:3': { size: '1536x1152', width: 1536, height: 1152 }
};

const SUPPORTED_ASPECT_RATIOS = Object.keys(ASPECT_RATIO_SPECS) as SupportedAspectRatio[];
const SUPPORTED_STYLES: ImageGenerationSeam['input']['style'][] = [
  'artistic',
  'photorealistic',
  'fantasy',
  'dark',
  'romantic'
];

/**
 * Read the image URL out of a provider response, or refuse the response.
 *
 * `response.data.data[0].url` was read straight through. The provider can
 * answer with an entry that carries no `url` — a `b64_json` payload, or an
 * entry a content filter emptied — and reading a missing property yields
 * `undefined` rather than throwing, so the service reported `success: true`
 * with `imageUrl: undefined` beside a real `imageId` and `width`/`height`. The
 * contract types that field as a string, so every caller treats the response as
 * an image it can display; the failure surfaced as a broken `<img>` instead of
 * the error the request actually produced. Refusing here puts it back inside
 * `callGrokImageAI`'s catch, which answers `IMAGE_GENERATION_FAILED`.
 */
export function readGeneratedImageUrl(responseData: unknown): string {
  const entries = (responseData as { data?: unknown })?.data;
  const url = Array.isArray(entries) ? (entries[0] as { url?: unknown })?.url : undefined;

  if (typeof url !== 'string' || url.trim().length === 0) {
    throw new Error('Image provider returned no image URL');
  }

  return url.trim();
}

export class ImageService {
  private grokApiKey: string | undefined;
  private grokApiUrl: string;

  constructor() {
    this.grokApiKey = process.env['XAI_API_KEY'];
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
      const aspectRatio = input.aspectRatio ?? DEFAULT_ASPECT_RATIO;
      const dimensions = ASPECT_RATIO_SPECS[aspectRatio];
      const output: ImageGenerationSeam['output'] = {
        imageId: this.generateImageId(),
        storyId: input.storyId,
        imageUrl: imageUrl,
        prompt: this.buildImagePrompt(input),
        style: input.style,
        aspectRatio,
        width: dimensions.width,
        height: dimensions.height,
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

      return readGeneratedImageUrl(response.data);

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

  /**
   * Describe the opening of a story for the image model.
   *
   * The story arrives as the generator's HTML. Deleting the tags on their own
   * welds the words they separated — `door.</p><p>Blood` becomes `door.Blood`
   * — and leaves `&amp;` and `&quot;` sitting in the prose as literal entity
   * text, so the scene handed to the image model is neither what a reader sees
   * nor valid English. `stripStoryHtmlToText` puts a paragraph break where the
   * markup put one and decodes the entities the generator emits, which is the
   * same rendering the cliffhanger and continuity scanners read.
   */
  private extractSceneFromStory(content: string, creature: string): string {
    const cleanContent = stripStoryHtmlToText(content);
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
    return this.resolveAspectRatioSpec(aspectRatio).size;
  }

  private getAspectRatioDimensions(aspectRatio: string): { width: number; height: number } {
    const { width, height } = this.resolveAspectRatioSpec(aspectRatio);
    return { width, height };
  }

  // Validation rejects an unsupported ratio before any of these are reached,
  // so the fallback is only here for the default when none was requested.
  private resolveAspectRatioSpec(aspectRatio: string): AspectRatioSpec {
    return ASPECT_RATIO_SPECS[aspectRatio as SupportedAspectRatio] ?? ASPECT_RATIO_SPECS[DEFAULT_ASPECT_RATIO];
  }

  private generateMockImageUrl(input: ImageGenerationSeam['input']): string {
    // Generate a realistic mock image URL for development
    const dimensions = this.getAspectRatioDimensions(input.aspectRatio || DEFAULT_ASPECT_RATIO);
    const mockId = randomUUID();
    return `https://picsum.photos/${dimensions.width}/${dimensions.height}?random=${mockId}`;
  }

  /**
   * Reject a request the service cannot honour before it reaches the prompt
   * builder.
   *
   * `themes` and `creature` used to go unchecked, and the prompt builder calls
   * `input.themes.map(...)`. A request that sent a bare string — or omitted
   * the field on a path that does not pre-check it — threw a `TypeError`
   * inside `generateImage`, which its catch block reports as
   * `IMAGE_GENERATION_FAILED`: the caller was told the image service had
   * failed, with `input.themes.map is not a function` as the user-facing
   * message. It is the request that is malformed and only the caller can fix
   * it, so the answer is `INVALID_INPUT` naming the field.
   */
  private validateImageInput(input: ImageGenerationSeam['input']): { code: string; message: string } | null {
    if (!input.storyId) {
      return { code: 'INVALID_INPUT', message: 'Story ID is required' };
    }
    if (!input.content || input.content.length < 10) {
      return { code: 'INVALID_INPUT', message: 'Story content is required and must be substantial' };
    }
    if (typeof input.creature !== 'string' || input.creature.trim().length === 0) {
      return { code: 'INVALID_INPUT', message: 'Creature is required' };
    }
    if (!Array.isArray(input.themes) || input.themes.length === 0) {
      return { code: 'INVALID_INPUT', message: 'Themes are required and must be a non-empty array' };
    }
    if (!input.themes.every(theme => typeof theme === 'string' && theme.trim().length > 0)) {
      return { code: 'INVALID_INPUT', message: 'Every theme must be a non-empty string' };
    }
    if (!input.style || !SUPPORTED_STYLES.includes(input.style)) {
      return { code: 'UNSUPPORTED_STYLE', message: 'Invalid image style provided' };
    }
    // An unsupported ratio used to fall back to 16:9 in the provider request
    // and in the dimensions, while the response echoed the ratio that was
    // asked for — so the caller was handed an image that contradicted the
    // `aspectRatio` beside it. The contract types this field as a closed set;
    // a value outside it is a caller error, not a silent substitution.
    if (input.aspectRatio !== undefined && !SUPPORTED_ASPECT_RATIOS.includes(input.aspectRatio)) {
      return {
        code: 'INVALID_INPUT',
        message: `Unsupported aspect ratio. Supported ratios: ${SUPPORTED_ASPECT_RATIOS.join(', ')}`
      };
    }
    return null;
  }

  private generateRequestId(): string {
    return `img-req-${randomUUID()}`;
  }

  private generateImageId(): string {
    return `img-${randomUUID()}`;
  }
}
