// Created: 2025-10-12
/**
 * Author Style Configuration for Story Generation
 * 
 * Extracted from storyService.ts to follow KISS and DRY principles
 * Contains voice samples and writing traits for different supernatural creature types
 */

export interface AuthorStyle {
  author: string;
  voiceSample: string;
  trait: string;
}

export const VAMPIRE_STYLES: AuthorStyle[] = [
  {
    author: 'Jeaniene Frost',
    voiceSample: '"You know what I like about you?" His smile was all sharp edges. "Absolutely nothing. That\'s what makes you interesting."',
    trait: 'Razor-sharp wit that cuts before you feel the blade'
  },
  {
    author: 'J.R. Ward',
    voiceSample: 'The male\'s voice was rough as granite. "Touch her again, and I\'ll show you what eternity really means."',
    trait: 'Brooding protectiveness bordering on obsession'
  },
  {
    author: 'Christine Feehan',
    voiceSample: 'Ancient hunger stirred in the depths of his dark eyes, a predator recognizing prey—or perhaps something far more dangerous.',
    trait: 'Gothic atmosphere thick enough to taste'
  },
  {
    author: 'Anne Rice',
    voiceSample: '"Do you know what it means to love something for centuries? To watch it change, to watch it die, to watch it become something you no longer recognize?"',
    trait: 'Philosophical torment wrapped in beauty'
  },
  {
    author: 'Kresley Cole',
    voiceSample: 'She was chaos in a cocktail dress, and he\'d never wanted to be destroyed so badly in his immortal life.',
    trait: 'Wild, reckless passion defying all logic'
  },
  {
    author: 'Charlaine Harris',
    voiceSample: '"Sugar, in the South, we don\'t hide our fangs behind pretty words. We smile real sweet and strike when you least expect it."',
    trait: 'Southern charm masking vampire politics and cozy mystery'
  },
  {
    author: 'Sherrilyn Kenyon',
    voiceSample: 'Eleven thousand years of existence, and nothing—nothing—had prepared him for the way she looked at him like he might still be worth saving.',
    trait: 'Dark-Hunter mythology with tortured immortal warriors'
  },
  {
    author: 'Gena Showalter',
    voiceSample: '"Oh, you want to play?" Her grin was pure mischief. "Lords of the Underworld Rule #1: Never challenge what you can\'t handle."',
    trait: 'Playful banter masking Lords of the Underworld intensity'
  },
  {
    author: 'L.J. Smith',
    voiceSample: 'The triangle between them crackled with impossible tension—human, vampire, and the question of who would claim her heart first.',
    trait: 'Teen angst meets vampire romance with love triangle mastery'
  },
  {
    author: 'Kim Harrison',
    voiceSample: '"I\'m a bounty hunter who dates a vampire and pisses off ancient demons before breakfast. What could possibly go wrong?"',
    trait: 'Urban fantasy vampire world-building with sassy protagonist'
  },
  {
    author: 'Laurell K. Hamilton',
    voiceSample: 'Power and blood and dark eroticism wound between them like a living thing, necromancy and vampirism dancing on the edge of corruption.',
    trait: 'Dark eroticism blending vampire power dynamics with necromancy'
  },
  {
    author: 'Richelle Mead',
    voiceSample: 'Dhampir guardian or forbidden vampire lover? The academy taught her to stake first and ask questions never. But he made her want to break every rule.',
    trait: 'Vampire academy vibes with forbidden romance and dhampir tension'
  }
];

export const WEREWOLF_STYLES: AuthorStyle[] = [
  {
    author: 'Patricia Briggs',
    voiceSample: '"Pack means family. And family means I\'ll tear apart anyone who threatens what\'s mine."',
    trait: 'Grounded pragmatism with fierce loyalty'
  },
  {
    author: 'Ilona Andrews',
    voiceSample: '"Great. Magical politics, ancient curses, and now this. Tuesday just keeps getting better."',
    trait: 'Urban grit balanced with unexpected humor'
  },
  {
    author: 'Nalini Singh',
    voiceSample: 'His wolf pressed against his skin, demanding he claim what was his, mark her, make her understand she belonged to the pack—to him.',
    trait: 'Primal sensuality overwhelming rational thought'
  },
  {
    author: 'Kelley Armstrong',
    voiceSample: 'The change rippled through her bones like electricity, wild and barely contained, a storm waiting to break.',
    trait: 'Suspenseful tension building like a storm'
  },
  {
    author: 'Jennifer Ashley',
    voiceSample: '"The pack protects its own. Always. Even when \'its own\' is too stubborn to ask for help."',
    trait: 'Found family bonds stronger than blood'
  },
  {
    author: 'Carrie Ann Ryan',
    voiceSample: 'The mating bond snapped into place like fate clicking its final lock, and suddenly "mine" wasn\'t just a word—it was a destiny.',
    trait: 'Fated mates with pack loyalty and emotional werewolf bonds'
  },
  {
    author: 'Shelly Laurenston',
    voiceSample: '"Did you just challenge me to an alpha battle in the middle of brunch? Honey, I haven\'t even had my coffee yet."',
    trait: 'Comedic werewolf chaos with irreverent alpha battles'
  },
  {
    author: 'Suzanne Wright',
    voiceSample: 'Possessive didn\'t begin to cover it. His wolf wanted to wrap around her, claim her, make sure every shifter within a hundred miles knew she was his.',
    trait: 'Possessive alpha wolves with pack mentality and steamy romance'
  },
  {
    author: 'Faith Hunter',
    voiceSample: 'The skinwalker magic crawled across her skin, werewolf and vampire scents mixing in the humid Southern night like a supernatural storm brewing.',
    trait: 'Southern Gothic werewolves with vampire-werewolf tension and skinwalker magic'
  },
  {
    author: 'Keri Arthur',
    voiceSample: 'Werewolf detective, vampire lover, and a murder case that smelled like death and dark magic. Just another night in the Riley Jenson universe.',
    trait: 'Werewolf detective noir with Riley Jenson vibes and hybrid powers'
  },
  {
    author: 'Rachel Vincent',
    voiceSample: 'Territory. Dominance. Pride. The werecat politics translated perfectly to werewolf pack law—fight for your place or lose everything.',
    trait: 'Werecats/shifter politics crossover with territorial dominance and family saga'
  },
  {
    author: 'Chloe Neill',
    voiceSample: '"Chicago werewolf packs play by different rules. Less howling at the moon, more political maneuvering with a side of violence."',
    trait: 'Chicago werewolf packs with urban fantasy setting and political intrigue'
  }
];

export const FAIRY_STYLES: AuthorStyle[] = [
  {
    author: 'Holly Black',
    voiceSample: '"I could give you what you desire most," she said, and her smile was sharp as winter. "The question is: what are you willing to lose for it?"',
    trait: 'Court intrigue where every smile hides daggers'
  },
  {
    author: 'Sarah J. Maas',
    voiceSample: 'Power thrummed beneath her skin like a living thing, ancient and terrible and beautiful enough to bring kingdoms to their knees.',
    trait: 'Epic romance with world-shattering consequences'
  },
  {
    author: 'Melissa Marr',
    voiceSample: 'The mortal world blurred at the edges when he looked at her, reality bending around the impossible pull of fae magic.',
    trait: 'Dangerous beauty drawing moths to flame'
  },
  {
    author: 'Grace Draven',
    voiceSample: '"In my realm, we have a saying: \'Love is the cruelest magic, for it makes even immortals mortal.\'"',
    trait: 'Slow-burn intimacy across cultural impossibilities'
  },
  {
    author: 'Julie Kagawa',
    voiceSample: 'Honor and desire warred in his expression, duty and longing locked in a battle that would determine both their fates.',
    trait: 'Hybrid honor versus desire in heart-wrenching choices'
  },
  {
    author: 'Karen Marie Moning',
    voiceSample: '"Welcome to Dublin, where the Unseelie princes play and humans are just pretty toys to break." She should run. She should definitely run.',
    trait: 'Fever series Fae with dark Unseelie princes and Dublin setting'
  },
  {
    author: 'Elise Kova',
    voiceSample: 'Air magic sang through her veins, elemental power awakening with each breath, the fairy prince watching like he knew exactly what she was becoming.',
    trait: 'Air Awakens fairy magic with elemental powers and fantasy romance'
  },
  {
    author: 'Jennifer Estep',
    voiceSample: '"Mythos Academy Rule #1: Never trust a fairy. Rule #2: Especially not one who offers to teach you assassination techniques."',
    trait: 'Mythos Academy fae with assassin protagonist and snarky tone'
  },
  {
    author: 'Cassandra Clare',
    voiceSample: 'Shadowhunter meets Seelie Court, and the lines between ally and enemy blur like glamour in moonlight—forbidden and intoxicating.',
    trait: 'Shadowhunter fae crossover with Seelie/Unseelie courts and forbidden romance'
  },
  {
    author: 'Sylvia Mercedes',
    voiceSample: 'Bride of the Shadow King—the bargain was simple: her life for her kingdom. What she didn\'t expect was wanting to stay in the darkness.',
    trait: 'Bride of the Shadow King vibes with dark fairy bargains and enemies-to-lovers'
  },
  {
    author: 'Roshani Chokshi',
    voiceSample: 'Indian mythology wove through the fairy realm like silk and starlight, lush magic painting the air in colors that had no earthly names.',
    trait: 'Indian mythology fae with lush descriptions and magical realism'
  },
  {
    author: 'Laura Thalassa',
    voiceSample: '"The Bargainer collects debts, siren. And you\'ve owed me for a very long time." His smile promised wicked payments and dangerous pleasures.',
    trait: 'Bargainer series vibes with siren fae, debts and deals'
  }
];

/**
 * Get author styles for a specific creature type
 */
export function getAuthorStylesForCreature(creature: string): AuthorStyle[] {
  switch (creature.toLowerCase()) {
    case 'vampire':
      return VAMPIRE_STYLES;
    case 'werewolf':
      return WEREWOLF_STYLES;
    case 'fairy':
      return FAIRY_STYLES;
    default:
      return VAMPIRE_STYLES; // Default fallback
  }
}

/**
 * Select random author styles: 2 from matching creature + 1 from others
 * Uses Fisher-Yates shuffle for uniform distribution
 */
export function selectRandomAuthorStyles(creature: string): AuthorStyle[] {
  const fisherYatesShuffle = <T>(array: T[]): T[] => {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  };

  let primaryStyles: AuthorStyle[] = [];
  let otherStyles: AuthorStyle[] = [];

  if (creature === 'vampire') {
    primaryStyles = VAMPIRE_STYLES;
    otherStyles = [...WEREWOLF_STYLES, ...FAIRY_STYLES];
  } else if (creature === 'werewolf') {
    primaryStyles = WEREWOLF_STYLES;
    otherStyles = [...VAMPIRE_STYLES, ...FAIRY_STYLES];
  } else if (creature === 'fairy') {
    primaryStyles = FAIRY_STYLES;
    otherStyles = [...VAMPIRE_STYLES, ...WEREWOLF_STYLES];
  } else {
    // Default to vampire for unknown creature types
    primaryStyles = VAMPIRE_STYLES;
    otherStyles = [...WEREWOLF_STYLES, ...FAIRY_STYLES];
  }

  // Select 2 from matching creature
  const shuffledPrimary = fisherYatesShuffle(primaryStyles);
  const selectedPrimary = shuffledPrimary.slice(0, 2);

  // Select 1 from different creatures  
  const shuffledOther = fisherYatesShuffle(otherStyles);
  const selectedOther = shuffledOther.slice(0, 1);

  return [...selectedPrimary, ...selectedOther];
}
