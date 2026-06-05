// Created: 2025-10-12 00:00 UTC
// Ported from PR #67 into the Vercel-oriented api/_lib tree.

import { randomInt } from 'node:crypto';
import type { CreatureType } from '../types/contracts';

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
    voiceSample: 'Ancient hunger stirred in the depths of his dark eyes, a predator recognizing prey-or perhaps something far more dangerous.',
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
    voiceSample: 'Eleven thousand years of existence, and nothing-nothing-had prepared him for the way she looked at him like he might still be worth saving.',
    trait: 'Dark-Hunter mythology with tortured immortal warriors'
  },
  {
    author: 'Gena Showalter',
    voiceSample: '"Oh, you want to play?" Her grin was pure mischief. "Lords of the Underworld Rule #1: Never challenge what you can\'t handle."',
    trait: 'Playful banter masking Lords of the Underworld intensity'
  },
  {
    author: 'L.J. Smith',
    voiceSample: 'The triangle between them crackled with impossible tension-human, vampire, and the question of who would claim her heart first.',
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
    voiceSample: 'His wolf pressed against his skin, demanding he claim what was his, mark her, make her understand she belonged to the pack-to him.',
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
    voiceSample: 'The mating bond snapped into place like fate clicking its final lock, and suddenly "mine" wasn\'t just a word-it was a destiny.',
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
    voiceSample: 'Territory. Dominance. Pride. The werecat politics translated perfectly to werewolf pack law-fight for your place or lose everything.',
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
    voiceSample: 'Shadowhunter meets Seelie Court, and the lines between ally and enemy blur like glamour in moonlight-forbidden and intoxicating.',
    trait: 'Shadowhunter fae crossover with Seelie/Unseelie courts and forbidden romance'
  },
  {
    author: 'Sylvia Mercedes',
    voiceSample: 'Bride of the Shadow King-the bargain was simple: her life for her kingdom. What she didn\'t expect was wanting to stay in the darkness.',
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

export const WITCH_STYLES: AuthorStyle[] = [
  {
    author: 'Coven Hearth Gothic',
    voiceSample: '"Every spell has a price," she said, pressing the candle flame flat with one wet fingertip. "Tell me what you are willing to burn."',
    trait: 'Witchcraft intimacy built from bargains, hearth magic, and dangerous domestic ritual'
  },
  {
    author: 'Grimoire Noir',
    voiceSample: 'Ink crawled across the page before her lover could lie, each black letter blooming like a bruise under moonlight.',
    trait: 'Spellbook mystery where secrets become physical evidence'
  },
  {
    author: 'Familiar-Bond Romance',
    voiceSample: 'The cat hissed at him first. Sensible creature. Then the warding circle opened anyway, which meant her heart had betrayed them both.',
    trait: 'Witch familiars, protective wards, and reluctant trust turning into heat'
  },
  {
    author: 'Kitchen-Sink Enchantment',
    voiceSample: 'Rosemary, iron, grave dirt, honey. She measured each ingredient by instinct, saving the last spoonful of sweetness for revenge.',
    trait: 'Tactile spellcraft grounded in herbs, thresholds, kitchens, and revenge'
  }
];

export const DRAGON_STYLES: AuthorStyle[] = [
  {
    author: 'Hoard-Bound Majesty',
    voiceSample: '"I do not collect gold because it shines," he murmured. "I collect what kingdoms are foolish enough to worship."',
    trait: 'Dragon pride, treasure psychology, and courtly dominance'
  },
  {
    author: 'Scale-and-Silk Romance',
    voiceSample: 'Heat rolled from him in waves, but his claws touched her sleeve with impossible care, as if silk could bruise.',
    trait: 'Massive power restrained by precise tenderness'
  },
  {
    author: 'Sky-Tyrant Epic',
    voiceSample: 'When his wings opened, every candle in the palace bent sideways. Even the throne seemed to remember fear.',
    trait: 'Aerial grandeur, ancient territorial claims, and throne-room stakes'
  },
  {
    author: 'Molten Devotion',
    voiceSample: '"Name the enemy," he said, smoke curling between his teeth, "and I will make the mountain forget they were born."',
    trait: 'Volcanic protectiveness and obsessive loyalty'
  }
];

export const DEMON_STYLES: AuthorStyle[] = [
  {
    author: 'Velvet Contract Horror',
    voiceSample: '"Read the last clause," he said softly. "The one your pulse keeps trying to skip."',
    trait: 'Demon contracts, loopholes, temptation, and elegant dread'
  },
  {
    author: 'Infernal Ballroom',
    voiceSample: 'Hell did not smell like sulfur. It smelled like champagne, hot skin, and the moment before a vow became a chain.',
    trait: 'Decadent demon society with manners sharper than knives'
  },
  {
    author: 'Temptation Advocate',
    voiceSample: '"I never make anyone fall," he whispered. "I only ask why they keep standing where it hurts."',
    trait: 'Psychological seduction that exposes denied desire'
  },
  {
    author: 'Ash-Crowned Redemption',
    voiceSample: 'The halo scar around his throat glowed whenever he told the truth, which made his silence more intimate than any confession.',
    trait: 'Fallen monsters, redemption pressure, and sacred-profane tension'
  }
];

export const ANGEL_STYLES: AuthorStyle[] = [
  {
    author: 'Cathedral Longing',
    voiceSample: 'His wings cast shadows across the altar, but it was the hunger in his lowered eyes that made the chapel feel forbidden.',
    trait: 'Angel grace strained by desire, duty, and sacred architecture'
  },
  {
    author: 'Fallen-Star Romance',
    voiceSample: '"I was made for obedience," he said, touching the rain on her cheek. "Then you taught me weather."',
    trait: 'Celestial innocence breaking into chosen rebellion'
  },
  {
    author: 'Judgment Court Gothic',
    voiceSample: 'The choir stopped singing when she entered, and every feather in the room turned its pale eye toward her crime.',
    trait: 'Heavenly courts, judgment, ritual law, and forbidden advocacy'
  },
  {
    author: 'Mercy-as-Temptation',
    voiceSample: 'He could have condemned her with a word. Instead he knelt, offered his sword hilt-first, and ruined them both.',
    trait: 'Mercy, sacrifice, and intimate moral catastrophe'
  }
];

export const MERMAID_STYLES: AuthorStyle[] = [
  {
    author: 'Pearl-Dagger Court',
    voiceSample: "The reef court smiled with too many teeth, each pearl in the queen's crown harvested from a drowned promise.",
    trait: 'Mermaid court intrigue, ocean law, and beautiful cruelty'
  },
  {
    author: 'Tide-Pull Romance',
    voiceSample: 'Every retreat of the wave dragged her farther from him; every return put salt on his lips like a vow.',
    trait: 'Rhythmic longing shaped by tides, distance, and return'
  },
  {
    author: 'Shipwreck Gothic',
    voiceSample: 'The wreck still sang at low tide, ribs of black wood humming with the names of sailors who had loved badly.',
    trait: 'Haunted coasts, wrecks, curses, and drowned secrets'
  },
  {
    author: 'Brine-Bound Bargain',
    voiceSample: '"Give me your voice for one moon," she said, "and I will teach your heart how to breathe underwater."',
    trait: 'Voice bargains, salt magic, and amphibious intimacy'
  }
];

const AUTHOR_STYLE_MAP: Record<CreatureType, AuthorStyle[]> = {
  vampire: VAMPIRE_STYLES,
  werewolf: WEREWOLF_STYLES,
  fairy: FAIRY_STYLES,
  siren: FAIRY_STYLES,
  djinn: FAIRY_STYLES,
  witch: WITCH_STYLES,
  dragon: DRAGON_STYLES,
  demon: DEMON_STYLES,
  angel: ANGEL_STYLES,
  mermaid: MERMAID_STYLES
};

function getSecondaryAuthorStyles(creature: CreatureType): AuthorStyle[] {
  switch (creature) {
    case 'werewolf':
      return [...VAMPIRE_STYLES, ...FAIRY_STYLES];
    case 'fairy':
    case 'siren':
    case 'djinn':
      return [...VAMPIRE_STYLES, ...WEREWOLF_STYLES];
    case 'witch':
      return [...FAIRY_STYLES, ...VAMPIRE_STYLES];
    case 'dragon':
      return [...WEREWOLF_STYLES, ...FAIRY_STYLES];
    case 'demon':
      return [...VAMPIRE_STYLES, ...FAIRY_STYLES];
    case 'angel':
      return [...FAIRY_STYLES, ...WITCH_STYLES];
    case 'mermaid':
      return [...FAIRY_STYLES, ...WEREWOLF_STYLES];
    case 'vampire':
      return [...WEREWOLF_STYLES, ...FAIRY_STYLES];
  }
}

export function getAuthorStylesForCreature(creature: CreatureType): AuthorStyle[] {
  return AUTHOR_STYLE_MAP[creature];
}

export function selectRandomAuthorStyles(creature: CreatureType): AuthorStyle[] {
  const fisherYatesShuffle = <T>(array: T[]): T[] => {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = randomInt(i + 1);
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  };

  const primaryStyles = getAuthorStylesForCreature(creature);
  const otherStyles = getSecondaryAuthorStyles(creature);

  return [
    ...fisherYatesShuffle(primaryStyles).slice(0, 2),
    ...fisherYatesShuffle(otherStyles).slice(0, 1)
  ];
}
