// ==================== IMAGE GENERATION SERVICE ====================
// Implements the SEAM 5: Story → Image Generation contract
// Generates images using Grok-2-Image based on story content

import axios from 'axios';
import { randomUUID } from 'node:crypto';
import { ImageGenerationSeam, ApiResponse, CreatureType } from '../types/contracts.js';
import { stripStoryHtmlToText } from '../../../shared/storyTextBlocks';
import { capAtWordBoundary } from '../utils/textExcerpt';
import { logApiError, logError } from '../utils/logger';
import { toLoggableStoryId } from '../utils/loggableRequestParameters';
import { IMAGE_GENERATION_LIMITS } from '../../../shared/storyBlueprintLimits';

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

/**
 * The longest scene description handed to the image model, in code points.
 *
 * Unchanged from the `substring(0, 200)` it replaces — the cap is not what was
 * wrong with it.
 */
export const IMAGE_SCENE_DESCRIPTION_MAX_LENGTH = 200;

/**
 * One sentence: a run of text up to and including whatever ends it, or the
 * trailing run a story that stops mid-sentence leaves behind.
 *
 * Both branches are linear — the engine can only take `[^.!?]` for the run and
 * `[.!?]` for the terminator, so there is nothing to backtrack over on a long
 * paragraph that ends without punctuation.
 */
const SCENE_SENTENCE_PATTERN = /[^.!?]+[.!?]+|[^.!?]+$/g;

/** How many opening sentences describe the scene, as it always was. */
const SCENE_SENTENCE_COUNT = 3;

/**
 * Describe the opening of a story for the image model.
 *
 * The story arrives as the generator's HTML. Deleting the tags on their own
 * welds the words they separated — `door.</p><p>Blood` becomes `door.Blood` —
 * and leaves `&amp;` and `&quot;` sitting in the prose as literal entity text,
 * so the scene handed to the image model is neither what a reader sees nor
 * valid English. `stripStoryHtmlToText` puts a paragraph break where the markup
 * put one and decodes the entities the generator writes, which is the same
 * rendering the cliffhanger and continuity scanners read.
 *
 * What was left after that was the sentence reading itself, and it got both
 * halves wrong:
 *
 * - **`split('.')` is not a sentence split.** `?` and `!` end a sentence too,
 *   and this app writes dialogue-heavy openings — the sibling story-quality scan
 *   splits on `/[.!?]+/` for exactly that reason. A chapter that opens on three
 *   questions has no period anywhere near its start, so "the first three
 *   sentences" was the whole chapter, and the only thing that stopped it was the
 *   200-character cut below. Rejoining with `'.'` then made it worse: the
 *   terminator each piece actually ended on was replaced by a period, so
 *   `"Where is she?"` reached the model as `"Where is she."`, and the final
 *   sentence lost its punctuation entirely.
 * - **`substring(0, 200)` counts UTF-16 code units.** A cut between the halves
 *   of a surrogate pair leaves a lone surrogate — the failure `chunkByCodePoint`
 *   in the export service and `capUtf8Bytes` in the download filename both
 *   iterate code points to avoid — and a cut anywhere else lands mid-word, so
 *   the prompt ended on a fragment. Capping at a code-point boundary and then
 *   backing up to the last space keeps whole characters and whole words.
 *
 * Exported so the text actually sent to the provider can be asserted on
 * directly, the way `readGeneratedImageUrl` above is; reaching it through
 * `generateImage` needs a configured provider and would prove nothing about the
 * prompt either way.
 */
export function buildSceneDescriptionFromStory(content: string): string {
  const sentences = stripStoryHtmlToText(content).match(SCENE_SENTENCE_PATTERN) ?? [];
  const opening = sentences.slice(0, SCENE_SENTENCE_COUNT).join('').trim();

  return capAtWordBoundary(opening, IMAGE_SCENE_DESCRIPTION_MAX_LENGTH);
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
  async generateImage(
    input: ImageGenerationSeam['input'],
    requestId?: string
  ): Promise<ApiResponse<ImageGenerationSeam['output']>> {
    const startTime = Date.now();
    // Once, at the top, so the envelope, this method's failure line, and the
    // provider line one method below all name the same request. See
    // `resolveRequestId`.
    const correlationId = this.resolveRequestId(requestId);

    try {
      // Validate input
      const validationError = this.validateImageInput(input);
      if (validationError) {
        return {
          success: false,
          error: validationError,
          metadata: {
            requestId: correlationId,
            processingTime: Date.now() - startTime
          }
        };
      }

      // Generate image using Grok-2-Image
      const imageUrl = await this.callGrokImageAI(input, correlationId);

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
          requestId: correlationId,
          processingTime: Date.now() - startTime
        }
      };

    } catch (error: any) {
      // Through the logger rather than `console.error(..., error)`, which is
      // what this was and what every other paid service on this surface stopped
      // doing. `console.error` formats an object with `util.inspect`, so an
      // error carrying an HTTP client's request config prints that config —
      // including `config.headers.Authorization`, which on this path is
      // `Bearer ${XAI_API_KEY}` — straight into the deployment log. The axios
      // error is caught and replaced one method below today, so what reaches
      // here is currently the plain `Error` that replaced it; that is a
      // property of the call below rather than of this line, and it is the kind
      // of property a later change silently removes. `logError` names the
      // fields it keeps and runs them through `redactSensitiveLogData`, so the
      // guarantee belongs to the log call instead of to whatever happens to be
      // thrown at it.
      //
      // It is also what puts the failure in the shared recent-log buffer with
      // the story it failed on identified. `StoryService` has logged its own
      // failures this way since the logger was written; this service and the
      // evaluate route were the two places still writing to the console.
      //
      // The story id goes through the same allow-list the route's own log lines
      // put it through: it is caller text, and an id that is not id-shaped is
      // reduced rather than printed.
      logError('Image generation failed', error, {
        requestId: correlationId,
        endpoint: '/api/image/generate',
        method: 'POST'
      }, { storyId: toLoggableStoryId(input.storyId) });
      return {
        success: false,
        error: {
          code: 'IMAGE_GENERATION_FAILED',
          message: error.message || 'Failed to generate image'
        },
        metadata: {
          requestId: correlationId,
          processingTime: Date.now() - startTime
        }
      };
    }
  }

  private async callGrokImageAI(input: ImageGenerationSeam['input'], requestId: string): Promise<string> {
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
      // `logApiError` is the reading `XaiTextClient` gives the text half of the
      // same provider: it keeps the status and the response body under
      // `apiResponse`, where `redactSensitiveLogData` reduces the keys that
      // must not be printed. Writing `error.response?.data` to the console
      // instead put the provider's answer into the log unredacted and with
      // nothing identifying the request it belonged to — this route's own
      // handler logs a `requestId` on every other line it writes, and the one
      // line describing why the image failed had none.
      logApiError('Grok Image API', error, {
        requestId,
        endpoint: '/api/image/generate',
        method: 'POST'
      });
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

  /** See `buildSceneDescriptionFromStory` for how the opening is read. */
  private extractSceneFromStory(content: string, creature: string): string {
    return `A scene featuring a ${creature}: ${buildSceneDescriptionFromStory(content)}`;
  }

  /**
   * Describe the creature the reader chose, for the image model.
   *
   * `CreatureType` has named ten archetypes since the Story Lab blueprint was
   * introduced, and this map covered the first three. The other seven fell to
   * the `supernatural being` fallback, so the one setting that most decides what
   * an image looks like was dropped from the prompt for a siren, djinn, witch,
   * dragon, demon, angel, or mermaid — seven of the ten choices the form offers,
   * every one of them illustrated as an unspecified creature. The sibling
   * `mapThemeToVisualElement` covers all eighteen themes, which is what makes
   * this a gap rather than a decision.
   *
   * The fallback stays for a creature that reaches here from somewhere other
   * than the contract; it is no longer the answer for most of the contract.
   */
  private getCreatureContext(creature: string): string {
    const contexts: Record<CreatureType, string> = {
      vampire: 'gothic vampire with pale skin, dark eyes, elegant period clothing',
      werewolf: 'powerful werewolf with fierce eyes, muscular build, wild hair',
      fairy: 'ethereal fairy with delicate wings, magical aura, nature elements',
      siren: 'alluring siren with sea-dark hair, luminous eyes, spray and moonlit water',
      djinn: 'imperious djinn wreathed in smoke and ember light, gold ornament, desert night',
      witch: 'self-possessed witch with candlelight and herbs, worn grimoire, sigils in the air',
      dragon: 'immense dragon with iridescent scales, slit-pupilled eyes, hoard-gold and heat haze',
      demon: 'infernal demon with dark horns, ember-lit eyes, scorched shadow and ruin',
      angel: 'severe angel with vast feathered wings, halo light, marble and gold',
      mermaid: 'mermaid with an iridescent scaled tail, drifting hair, deep water and coral light'
    };
    return contexts[creature as CreatureType] || 'supernatural being';
  }

  /**
   * Describe the themes the reader chose, for the image model.
   *
   * The table below was keyed on `ThemeType` — the eighteen classic themes —
   * and the only client this route has does not send those. `app.ts` builds
   * its picker from `availableThemes`, twelve Story Lab `ThemeSeed`s, and
   * passes `theme.id` straight through to `/api/image/generate`. Five of the
   * twelve happen to spell a classic theme; the other seven —
   * `court_intrigue`, `blood_oaths`, `slow_burn`, `enemies_to_lovers`,
   * `magical_bargain`, `secret_identity`, and `forced_proximity` — matched
   * nothing and fell to the `mysterious elements` fallback. So a reader who
   * chose "Enemies to Lovers" and "Forced Proximity" had both of them reach
   * the image model as `Visual elements: mysterious elements, mysterious
   * elements`, and every image the app can produce from those seven looked the
   * same as every other.
   *
   * The seam types `themes` as `string[]` rather than as a closed set, so both
   * vocabularies are legitimate input here and both are answered. The classic
   * entries stay for a caller that sends them; the seed ids are added beside
   * them, worded from the same seed descriptions the story prompt is built
   * from, so the picture and the prose are asked for the same thing.
   */
  private mapThemeToVisualElement(theme: string): string {
    const visualMap: Record<string, string> = {
      // Story Lab theme seeds, as `app.ts` offers them.
      court_intrigue: 'candlelit halls and watching courtiers',
      blood_oaths: 'cut palms and binding sigils',
      slow_burn: 'held distance and charged glances',
      enemies_to_lovers: 'drawn weapons lowered mid-reach',
      magical_bargain: 'outstretched hands and glowing terms',
      secret_identity: 'half-shadowed faces and shed disguises',
      forced_proximity: 'a narrow room and no way past each other',
      // Classic `ThemeType` values, for a caller that sends those instead.
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
    // `imagePrompt` is optional and, when it is sent, it *replaces* the scene
    // description — so it is the text that reaches `grok-2-image` verbatim, and
    // it was the one field on this route that nothing measured. See
    // `IMAGE_GENERATION_LIMITS` for why the number is what it is. The type check
    // comes first for the reason the `themes` one above does: the field is
    // whatever JSON the caller wrote, and `buildImagePrompt` treats any truthy
    // value as a prompt, so a number or an object reached the provider request
    // as `[object Object]` rather than as the caller error it is.
    // Read as `unknown` because the contract types it as a string and the wire
    // does not: the checks below are about the values the type says cannot
    // arrive, which is the only reason they are worth writing.
    const imagePrompt: unknown = input.imagePrompt;
    if (imagePrompt !== undefined && imagePrompt !== null) {
      if (typeof imagePrompt !== 'string') {
        return { code: 'INVALID_INPUT', message: 'imagePrompt must be a string when provided' };
      }
      if (imagePrompt.length > IMAGE_GENERATION_LIMITS.maxImagePromptLength) {
        return {
          code: 'INVALID_INPUT',
          message: `imagePrompt must be ${IMAGE_GENERATION_LIMITS.maxImagePromptLength} characters or fewer`
        };
      }
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

  /**
   * The id this generation is known by, in the envelope and in the log alike.
   *
   * It used to be `img-req-${randomUUID()}`, minted here and written into
   * `metadata.requestId` — an id that exists in exactly one place, the response
   * body, and appears in no log line anywhere. The two log calls on this
   * service's failure paths carried no `requestId` at all, which is the very
   * thing the comment beside the one below names as the defect it was written
   * to fix: "this route's own handler logs a `requestId` on every other line it
   * writes, and the one line describing why the image failed had none". Moving
   * those calls onto the logger did not give them one, because the service had
   * no id to give: the route's correlation id stopped at the route.
   *
   * `beginPostRoute` reads `X-Request-ID` or mints one, echoes it back as a
   * header, and stamps it into every line the handler writes; taking it here
   * makes the envelope, the header, the handler's lines, this method's failure
   * line, and the provider's own error line all name the same request. Minting
   * one is kept for a caller that has none, so the field is never empty.
   */
  private resolveRequestId(requestId?: string): string {
    return requestId && requestId.trim() ? requestId.trim() : `img-req-${randomUUID()}`;
  }

  private generateImageId(): string {
    return `img-${randomUUID()}`;
  }
}
