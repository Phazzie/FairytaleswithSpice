# 🎨 Enhanced Voice Metadata Prompt - Creative & Varied Descriptions

## ✅ FORCE VARIETY & UNCONVENTIONAL VOCABULARY

```typescript
const CREATIVE_VOICE_METADATA_PROMPT = `
You are a master storyteller creating spicy fairy tales with AUDIO NARRATION in mind.

... [existing story requirements] ...

CRITICAL: VOICE METADATA FOR AUDIO NARRATION
For EACH major character, include voice characteristics in their first appearance:

FORMAT:
[CharacterName, voice: 4-word description]: "dialogue"

VOICE DESCRIPTION CREATIVITY RULES:
✅ DO: Use UNCONVENTIONAL, VIVID, SPECIFIC descriptors
✅ DO: Mix unexpected combinations for uniqueness
✅ DO: Use synesthetic descriptions (sounds like colors, textures)
✅ DO: Vary vocabulary across characters (NO REPETITION!)
❌ DON'T: Use generic words like "nice", "good", "normal"
❌ DON'T: Repeat descriptors across characters
❌ DON'T: Use only common adjectives

CREATIVE VOCABULARY EXAMPLES:

🔮 UNCONVENTIONAL TEXTURE/QUALITY:
- velvet, silk, gravel, smoke, honey, mercury, glass, steel, wine, cream
- molten, crystalline, whiskey-rough, frost-bitten, sun-warmed
- knife-sharp, butter-smooth, sandpaper-raw, silk-wrapped-steel

🎭 EMOTIONAL RESONANCE:
- haunting, intoxicating, devastating, mesmerizing, electrifying
- soul-piercing, heart-stopping, bone-chilling, blood-warming
- spine-tingling, pulse-quickening, breath-stealing

🌟 SYNESTHETIC (Cross-sensory):
- moonlight-pale, twilight-dark, starlight-bright, shadow-deep
- crimson-rich, midnight-blue, golden-warm, silver-cold
- thunder-low, whisper-soft, flame-hot, ice-cool

🎵 MUSICAL/RHYTHMIC:
- staccato, legato, crescendo, diminuendo, fortissimo, pianissimo
- rhythmic, syncopated, harmonious, dissonant, melodic, percussive

🌊 MOVEMENT/FLOW:
- cascading, rippling, crashing, flowing, stuttering, gliding
- undulating, pulsing, throbbing, trembling, vibrating

💎 PRECIOUS/RARE:
- diamond-cut, pearl-smooth, obsidian-dark, amber-warm
- jade-cool, ruby-rich, sapphire-deep, opal-shifting

⚡ POWER/INTENSITY:
- volcanic, glacial, tempestuous, serene, ferocious, gentle
- searing, scorching, blistering, freezing, numbing

🌙 MYSTICAL/OTHERWORLDLY:
- ethereal, spectral, phantasmal, celestial, infernal, arcane
- otherworldly, unearthly, supernatural, transcendent

EXAMPLE COMBINATIONS (CREATIVE):

VAMPIRE VOICES (Avoid clichés like "deep commanding seductive"):
✅ "velvet-smoke whiskey-rough hypnotic" (unique!)
✅ "midnight-silk knife-sharp intoxicating" (synesthetic!)
✅ "crystalline ancient soul-piercing ethereal" (unexpected!)
✅ "mercury-smooth devastating bone-chilling musical" (varied!)
✅ "obsidian-dark honey-slow mesmerizing volcanic" (creative!)

WEREWOLF VOICES (Avoid "rough primal powerful"):
✅ "thunder-low earth-raw moonlit ferocious" (nature-focused!)
✅ "gravel-deep forest-wild heart-pounding untamed" (visceral!)
✅ "sandpaper-rough storm-charged electrifying primal" (energetic!)
✅ "boulder-heavy wind-swift pack-resonant fierce" (unconventional!)
✅ "granite-hard rain-fresh blood-warm protective" (layered!)

FAIRY VOICES (Avoid "light ethereal musical"):
✅ "starlight-tinkling dewdrop-delicate mischievous quicksilver" (magical!)
✅ "windchime-bright petal-soft playful iridescent" (whimsical!)
✅ "crystal-clear butterfly-light teasing sunbeam-warm" (nature!)
✅ "moonbeam-soft gossamer-thin enchanting bell-pure" (ethereal!)
✅ "frost-kiss nectar-sweet laughing aurora-bright" (surprising!)

HUMAN VOICES (Avoid "warm natural genuine"):
✅ "autumn-rich coffee-warm strength-touched hopeful" (grounded!)
✅ "sunrise-bright ocean-deep resilient flame-touched" (vivid!)
✅ "earth-steady rain-soft fierce-gentle determined" (complex!)
✅ "amber-warm steel-core velvet-wrapped defiant" (contradictory!)
✅ "honey-gold granite-strong tender-fierce authentic" (multifaceted!)

ELDERLY CHARACTERS:
✅ "time-weathered oak-strong wisdom-deep starlit" (dignified!)
✅ "century-worn silk-soft knowing ancient-young" (paradoxical!)
✅ "parchment-dry wine-rich story-laden eternal" (literary!)

YOUNG CHARACTERS:
✅ "wildfire-bright quicksilver-fast fearless untested" (energetic!)
✅ "spring-fresh lightning-quick eager dawn-new" (youthful!)
✅ "spark-bright quickening adventurous sun-young" (vibrant!)

VILLAINOUS CHARACTERS:
✅ "viper-smooth poison-sweet razor-edged darkness-wrapped" (dangerous!)
✅ "ice-sharp shadow-deep cruel-beautiful merciless" (chilling!)
✅ "scorpion-soft death-whisper calculated predatory" (menacing!)

HEROIC CHARACTERS:
✅ "flame-bright steel-true hope-ringing unwavering" (inspiring!)
✅ "dawn-strong sword-sharp justice-clear fearless" (noble!)
✅ "lion-bold sun-warm protective thunder-resonant" (powerful!)

VARIETY ENFORCEMENT:
- Generate 3-5 major characters per story
- EACH must have COMPLETELY DIFFERENT descriptors
- NO WORD should appear twice across all character voices
- Mix at least 2 different category types per character (texture + emotion, musical + mystical, etc.)
- Prioritize SURPRISING combinations over expected ones

ANTI-PATTERNS TO AVOID:
❌ "deep commanding seductive ancient" (boring!)
❌ "soft gentle kind sweet" (generic!)
❌ "dark mysterious powerful strong" (cliché!)
❌ "light happy cheerful bright" (predictable!)

CREATIVE CONSTRAINTS:
1. At least ONE synesthetic word per character (sight/sound/touch crossover)
2. At least ONE unexpected word per character (surprising choice)
3. At least ONE texture/material word per character (velvet, steel, honey, etc.)
4. At least ONE emotional/atmospheric word per character (haunting, playful, etc.)

EXAMPLE STORY OUTPUT WITH VARIETY:

<h3>Chapter 1: The Gathering Storm</h3>

<p>[Narrator]: Three immortals converged in the moonlit clearing.</p>

<p>[Lord Damien Blackthorn, voice: velvet-smoke whiskey-rough hypnotic]: "The prophecy unfolds at last."</p>

<p>[Princess Lyra Moonshadow, voice: starlight-tinkling dewdrop-delicate mischievous]: "You summoned me, vampire? How... intriguing."</p>

<p>[Alpha Thorne Ironwood, voice: thunder-low earth-raw moonlit ferocious]: "Both of you in my territory. Explain. Now."</p>

<p>[Sorceress Morgana, voice: mercury-smooth devastating bone-chilling musical]: "I'm the one who brought you together, darlings."</p>

<p>[Young Knight Cassian, voice: wildfire-bright quicksilver-fast fearless untested]: "I won't let you harm innocent people!"</p>

NOTICE: 
- 5 characters = 20 descriptors total
- ZERO repeated words
- Mix of textures (velvet, mercury, starlight)
- Mix of emotions (hypnotic, mischievous, devastating)
- Mix of synesthetic (velvet-smoke, starlight-tinkling, wildfire-bright)
- Mix of unexpected (whiskey-rough, dewdrop-delicate, quicksilver-fast)

Now generate your ${wordCount}-word story with MAXIMUM VOICE VARIETY...
`;
```

---

## 🎯 KEY IMPROVEMENTS FOR VARIETY:

### 1. **VOCABULARY CATEGORIES** (100+ unique words)
- Textures: velvet, silk, gravel, smoke, honey, mercury, glass, steel, wine, cream, frost, ember, shadow, light
- Emotions: haunting, intoxicating, devastating, mesmerizing, electrifying, soul-piercing
- Synesthetic: moonlight-pale, twilight-dark, crimson-rich, midnight-blue, thunder-low
- Musical: staccato, crescendo, harmonious, dissonant, rhythmic
- Mystical: ethereal, spectral, celestial, infernal, arcane, otherworldly

### 2. **ANTI-REPETITION RULES**
```typescript
VARIETY ENFORCEMENT:
- Each character gets UNIQUE descriptors
- NO WORD appears twice in same story
- Mix 2+ categories per character (texture + emotion, musical + mystical)
- Prioritize SURPRISING combinations
```

### 3. **CREATIVE CONSTRAINTS**
```typescript
Each voice must have:
✅ One synesthetic word (cross-sensory)
✅ One texture/material word
✅ One emotional/atmospheric word
✅ One unexpected/surprising word
```

---

## 🌟 EXAMPLE OUTPUTS (All Different!)

**Story 1 - Vampire Romance:**
- Lord Damien: "velvet-smoke whiskey-rough hypnotic"
- Princess Elena: "autumn-rich steel-core velvet-wrapped defiant"
- Alpha Marcus: "thunder-low earth-raw moonlit ferocious"

**Story 2 - Vampire Romance (DIFFERENT WORDS!):**
- Count Vladimir: "midnight-silk knife-sharp intoxicating"
- Lady Isabella: "rose-gold flame-touched fierce-gentle determined"
- Beta Konstantin: "granite-hard rain-fresh blood-warm protective"

**Story 3 - Fairy Mystery:**
- Titania: "starlight-tinkling dewdrop-delicate mischievous quicksilver"
- Oberon: "windchime-bright oak-strong playful iridescent"
- Puck: "frost-kiss nectar-sweet laughing aurora-bright"

Notice: **ZERO repeated words across all examples!**

---

## 📝 PARSING ENHANCEMENT

```typescript
class VoiceMetadataParser {
  private usedDescriptors = new Set<string>();
  
  /**
   * Validate variety - ensure no repeated words across characters
   */
  validateVoiceVariety(characterVoices: Map<string, ExtractedCharacterVoice>): boolean {
    const allWords = new Set<string>();
    let hasRepeats = false;
    
    for (const [name, voice] of characterVoices) {
      const words = voice.voiceDescription.toLowerCase().split(/[\s-]+/);
      
      for (const word of words) {
        if (allWords.has(word)) {
          console.warn(`⚠️ Repeated descriptor detected: "${word}" in ${name}'s voice`);
          hasRepeats = true;
        }
        allWords.add(word);
      }
    }
    
    if (hasRepeats) {
      console.log('💡 Consider regenerating story for more voice variety');
    }
    
    return !hasRepeats;
  }
  
  /**
   * Rate creativity of voice descriptions
   */
  rateCreativity(voiceDescription: string): number {
    const words = voiceDescription.toLowerCase().split(/[\s-]+/);
    let score = 0;
    
    // Bonus for uncommon words
    const uncommonWords = ['velvet', 'mercury', 'obsidian', 'crystalline', 'ethereal', 
                           'staccato', 'syncopated', 'phantasmal', 'tempestuous'];
    score += words.filter(w => uncommonWords.includes(w)).length * 2;
    
    // Bonus for compound words (synesthetic)
    const compoundWords = words.filter(w => w.includes('-'));
    score += compoundWords.length * 3;
    
    // Penalty for common/boring words
    const boringWords = ['nice', 'good', 'bad', 'normal', 'regular', 'simple'];
    score -= words.filter(w => boringWords.includes(w)).length * 5;
    
    return score;
  }
}
```

---

This enhanced prompt will push Grok to be **wildly creative** with voice descriptions!
