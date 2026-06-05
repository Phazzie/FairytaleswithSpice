// Created: 2025-10-31 07:06
import { Injectable } from '@angular/core';
import { CreatureArchetype } from '../contracts';

export interface AuthorStyle {
  author: string;
  voiceSample: string;
  trait: string;
}

export interface BeatStructure {
  name: string;
  beats: string;
  spiceIntegration: string;
  avoid: string;
}

export interface ChekovElement {
  description: string;
}

export interface GenerationLogic {
  selectedAuthors: AuthorStyle[];
  selectedBeatStructure: BeatStructure;
  chekovElements: ChekovElement[];
}

@Injectable({
  providedIn: 'root'
})
export class GenerationLogicService {
  private fallbackRandomState = (Date.now() ^ Math.floor((globalThis.performance?.now() ?? 0) * 1000)) >>> 0;

  private readonly vampireStyles: AuthorStyle[] = [
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

  private readonly werewolfStyles: AuthorStyle[] = [
    {
      author: 'Patricia Briggs',
      voiceSample: '"Pack means family. And family means I\'ll tear apart anyone who threatens what\'s mine."',
      trait: 'Loyal pack dynamics with mechanical expertise'
    },
    {
      author: 'Kelley Armstrong',
      voiceSample: 'The wolf inside her stirred, recognizing the alpha in him even as her human side refused to submit.',
      trait: 'Bitten werewolf discovering pack culture'
    },
    {
      author: 'Nalini Singh',
      voiceSample: 'His changeling leopard purred at her scent—wild forest and untamed woman, a combination that made his animal half want to chase.',
      trait: 'Psy-Changeling world with mate bonds'
    },
    {
      author: 'Ilona Andrews',
      voiceSample: '"You smell like mine," he growled, the beast in his voice making it clear this wasn\'t a request.',
      trait: 'Kate Daniels urban fantasy with shapeshifter politics'
    },
    {
      author: 'Jennifer L. Armentrout',
      voiceSample: 'The connection between them snapped into place like a rubber band pulled too tight, inevitable and impossible to ignore.',
      trait: 'New adult paranormal with fated mates'
    },
    {
      author: 'Laurell K. Hamilton',
      voiceSample: 'His beast rode too close to the surface, fur rippling beneath skin, amber bleeding into human eyes.',
      trait: 'Anita Blake\'s complex werewolf power structure'
    },
    {
      author: 'Yasmine Galenorn',
      voiceSample: 'Moon magic sang in her blood, calling to the predator that lived beneath her skin, wild and free.',
      trait: 'Sisters of the Moon goddess-touched werewolves'
    },
    {
      author: 'Kresley Cole',
      voiceSample: 'He\'d waited centuries for his mate. Now that he\'d found her, nothing—not even her terror—would keep him away.',
      trait: 'Immortals After Dark fated mates and warrior culture'
    },
    {
      author: 'Carrie Ann Ryan',
      voiceSample: 'The mating bond thrummed between them, pack magic recognizing what their human halves still denied.',
      trait: 'Redwood Pack family saga with pack bonds'
    },
    {
      author: 'Lora Leigh',
      voiceSample: 'Feline genetics mixed with human desire created something new, something the world wasn\'t ready for.',
      trait: 'Breeds series genetic manipulation themes'
    },
    {
      author: 'Nalini Singh',
      voiceSample: 'His wolf wanted to mark her, claim her, make it impossible for any other male to even look at her.',
      trait: 'Guild Hunter world alpha dominance'
    },
    {
      author: 'Shelly Laurenston',
      voiceSample: '"Honey badger don\'t care," she said, right before she proved exactly how much damage a small woman with claws could do.',
      trait: 'Pride series humor with fierce heroines'
    }
  ];

  private readonly fairyStyles: AuthorStyle[] = [
    {
      author: 'Sarah J. Maas',
      voiceSample: 'High Fae beauty masked centuries of cunning and cruelty, but his smile promised things far more dangerous than death.',
      trait: 'ACOTAR dark fae romance with mate bonds'
    },
    {
      author: 'Holly Black',
      voiceSample: 'The Folk never lie, but truth can be shaped into weapons sharper than any blade forged in their realm.',
      trait: 'Cruel Prince political intrigue and deception'
    },
    {
      author: 'Julie Kagawa',
      voiceSample: 'Summer and Winter courts circled each other like predators, and she stood in the middle, desired by both.',
      trait: 'Iron Fey world with court politics'
    },
    {
      author: 'Jennifer L. Armentrout',
      voiceSample: 'Fae glamour couldn\'t hide the wildness in his eyes, the barely leashed power that promised pleasure and pain in equal measure.',
      trait: 'Dark Elements series fae warriors'
    },
    {
      author: 'Karen Marie Moning',
      voiceSample: 'Unseelie princes played with humans like toys, but she\'d learned their games and was playing to win.',
      trait: 'Fever series dark fae mythology'
    },
    {
      author: 'Cassandra Clare',
      voiceSample: 'Seelie beauty hid seelie cruelty, and she\'d fallen for both—hook, line, and sinker.',
      trait: 'Shadowhunter world fae courts'
    },
    {
      author: 'Elise Kova',
      voiceSample: 'Wings of starlight and eyes of eternal night—he was everything the stories warned about and everything she wanted.',
      trait: 'Air Awakens elemental magic and fae romance'
    },
    {
      author: 'Roshani Chokshi',
      voiceSample: 'The bargain tasted of midnight and promises, sweet poison that would bind her to him until the stars fell.',
      trait: 'Gilded Wolves mythology-rich fae bargains'
    },
    {
      author: 'Nalini Singh',
      voiceSample: 'Guild Hunter angels might not be fae, but they shared the same terrible beauty and ageless hunger.',
      trait: 'Archangel-level power and immortal romance'
    },
    {
      author: 'Jennifer Estep',
      voiceSample: 'Black Blade Academy taught her to fight monsters. No one warned her she\'d fall for one.',
      trait: 'Academy setting with fae warrior training'
    },
    {
      author: 'Annette Marie',
      voiceSample: 'Yokai and fae shared one thing: mortals were playthings. She\'d just have to play harder.',
      trait: 'Guild Codex world with fae trickster energy'
    },
    {
      author: 'Laura Thalassa',
      voiceSample: 'The Bargainer collected debts with a smile that could charm angels and destroy mortals.',
      trait: 'Bargainer series dark fae debt collector'
    }
  ];

  private readonly witchStyles: AuthorStyle[] = [
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

  private readonly dragonStyles: AuthorStyle[] = [
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

  private readonly demonStyles: AuthorStyle[] = [
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

  private readonly angelStyles: AuthorStyle[] = [
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

  private readonly mermaidStyles: AuthorStyle[] = [
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

  private readonly beatStructures: BeatStructure[] = [
    {
      name: "TEMPTATION CASCADE",
      beats: "Forbidden Glimpse → Growing Obsession → Point of No Return → Consequences Unfold → Deeper Temptation",
      spiceIntegration: "Each beat escalates physical/emotional intimacy. Perfect for Level 3-5 stories.",
      avoid: "Repetitive seduction scenes with no emotional progression, instant capitulation without internal conflict"
    },
    {
      name: "POWER EXCHANGE",
      beats: "Challenge Issued → Resistance Tested → Control Shifts → Surrender Moment → New Dynamic",
      spiceIntegration: "Power dynamics drive intimacy. Works for all themes, spice level determines explicitness.",
      avoid: "Non-consensual power plays, one-sided dominance, no mutual respect underneath the dynamic"
    },
    {
      name: "SEDUCTION TRAP",
      beats: "Innocent Encounter → Hidden Agenda Revealed → Manipulation vs Genuine Feeling → Truth Exposed → Choice Made",
      spiceIntegration: "Seduction builds throughout. Mystery themes enhance psychological tension.",
      avoid: "Villain without nuance, manipulation without genuine feelings bleeding through, easy forgiveness"
    },
    {
      name: "RITUAL BINDING",
      beats: "Ancient Secret → Ritual Requirement → Intimate Ceremony → Magical Consequence → Eternal Bond",
      spiceIntegration: "Supernatural themes with ritual intimacy. Spice level affects ritual explicitness.",
      avoid: "Magic solves everything, no cost to the ritual, bond accepted instantly without conflict"
    },
    {
      name: "VULNERABILITY SPIRAL",
      beats: "Perfect Facade → Crack in Armor → Emotional Exposure → Intimate Healing → Transformed Identity",
      spiceIntegration: "Emotional vulnerability leads to physical intimacy. Romance themes amplify connection.",
      avoid: "Trauma magically healed by love, no lasting scars, instant emotional breakthroughs"
    },
    {
      name: "HUNT AND CLAIM",
      beats: "Predator Marks Prey → Chase Begins → Prey Fights Back → Tables Turn → Mutual Claiming",
      spiceIntegration: "Primal pursuit with escalating tension. Adventure themes add physical stakes.",
      avoid: "Prey with no agency or power, stalking romanticized without consequences, one-way claiming"
    },
    {
      name: "BARGAIN'S PRICE",
      beats: "Desperate Need → Deal Struck → Payment Due → Cost Revealed → Price Accepted",
      spiceIntegration: "Supernatural bargains with intimate payments. Dark themes heighten moral conflict.",
      avoid: "Loopholes that negate the price, convenient escapes, bargain forgotten after payment"
    },
    {
      name: "MEMORY FRACTURE",
      beats: "Lost Memory → Familiar Stranger → Fragments Return → Truth Reconstructed → Choice to Remember",
      spiceIntegration: "Past intimacy bleeding through amnesia. Mystery themes create psychological tension.",
      avoid: "Convenient amnesia, memories return all at once, no emotional fallout from truth"
    },
    {
      name: "TRANSFORMATION HUNGER",
      beats: "Change Begins → New Appetites → Mentor Appears → Appetite Satisfied → Evolution Complete",
      spiceIntegration: "Physical transformation creates new desires. Comedy themes can subvert expectations.",
      avoid: "Easy control of new form, mentor appears exactly when needed, no cost to transformation"
    },
    {
      name: "MIRROR SOULS",
      beats: "Perfect Opposite → Magnetic Pull → Resistance Breaks → Soul Recognition → Unity/Destruction",
      spiceIntegration: "Opposite personalities creating explosive chemistry. All themes supported, spice determines intensity.",
      avoid: "Opposites attract without friction, perfect compatibility solves conflict, no sacrifice required"
    },
    {
      name: "FORBIDDEN TERRITORY DANCE",
      beats: "Trespass → Discovery → Risk Escalation → Claimed Space",
      spiceIntegration: "Cross enemy lines, stolen moments in forbidden spaces. Spice level determines intimacy of encounters.",
      avoid: "Repetitive 'sneaking around' scenes, predictable guards, no real danger of discovery"
    },
    {
      name: "SACRIFICE NEGOTIATION",
      beats: "Demand → Counter-offer → Stakes Raise → Blood Price Paid",
      spiceIntegration: "What will you give up for what you desire? Supernatural costs escalate with spice level.",
      avoid: "Easy sacrifices, no real loss, immediate rewards, sacrifice undone later"
    },
    {
      name: "JEALOUSY IGNITION",
      beats: "Rival Appears → Tension Spikes → Possessive Display → Claim Solidified",
      spiceIntegration: "Third party interference, possessive claims, territorial marking. Perfect for pack/clan dynamics.",
      avoid: "Love triangle clichés, unnecessary drama, weak rival threats, toxic possessiveness"
    },
    {
      name: "TRUST SHATTERING REVEAL",
      beats: "Hint of Deception → Clues Accumulate → Revelation Hits → Rebuild Begins",
      spiceIntegration: "Secret exposed, betrayal discovered, foundation crumbles. Intimacy becomes weapon or healing.",
      avoid: "Convenient misunderstandings, easy forgiveness, no lasting consequences, immediate trust restoration"
    },
    {
      name: "PROTECTOR INSTINCT TRIGGER",
      beats: "Danger Looms → Instinct Overrides → Fierce Protection → Aftermath Intimacy",
      spiceIntegration: "Threat emerges, protective fury unleashed, vulnerable moment follows. Violence into tenderness.",
      avoid: "Damsel in distress tropes, victim with no agency, protector never vulnerable"
    },
    {
      name: "ANCIENT ENEMY RESURFACES",
      beats: "Warning Signs → Threat Materializes → Old Trauma Surfaces → Stand Together",
      spiceIntegration: "Old wounds reopened, past threatens present, united front. Shared danger forges bonds.",
      avoid: "Convenient villain timing, no backstory weight, easy defeat, enemy without real threat"
    },
    {
      name: "MATE BOND AWAKENING",
      beats: "Attraction Intensifies → Bond Manifests → Fight Connection → Surrender",
      spiceIntegration: "Supernatural connection snaps into place, resistance futile. Biology meets choice.",
      avoid: "Instant acceptance, no conflict about loss of choice, magic solves all relationship issues"
    },
    {
      name: "BLOOD OATH CONSEQUENCES",
      beats: "Oath Sworn → Consequences Revealed → Loophole Sought → Price Paid",
      spiceIntegration: "Words have power, vows bind, magic enforces promises. Spice level affects payment type.",
      avoid: "Convenient escapes, no real magical binding, oath forgotten, loophole negates consequences"
    },
    {
      name: "SANCTUARY INVASION",
      beats: "Haven Established → Warning Breach → Invasion → Defend or Flee",
      spiceIntegration: "Safe space violated, nowhere to hide, forced confrontation. Intimacy in crisis.",
      avoid: "Easy victory defending sanctuary, no lasting damage, rebuilt overnight"
    },
    {
      name: "ECLIPSE OF CONTROL",
      beats: "Control Frays → Transformation Begins → Beast Emerges → Aftermath Reckoning",
      spiceIntegration: "Monster takes over, humanity slips, beast claims dominance. Spice level affects beast's actions.",
      avoid: "No consequences from loss of control, easy regain of composure, victim unaffected or trauma ignored"
    }
  ];

  private readonly chekovElements: string[] = [
    "Cursed relic with three uses, each more dangerous than the last",
    "Sealed chamber that opens only under blood moon, contains ancestral secrets",
    "Stranger knows protagonist's real name, disappears before questioned",
    "Prophecy has dual interpretation, one path leads to salvation, other to doom",
    "Contract has hidden clause activated by first kiss/blood/betrayal",
    "Debt collects in three parts: memory, power, then firstborn/soul",
    "Weakness is also their greatest strength under specific moon phase",
    "Enemy shares same bloodline, mirror image of protagonist's dark side",
    "Ritual bonds two souls, cannot be undone except by mutual death",
    "True identity revealed only when protagonist speaks their real name aloud",
    "Mirror that shows true desires, protagonist avoids looking until crisis forces confrontation",
    "Three drop blood vial, each drop grants one wish but extracts equivalent payment",
    "Tattoo that moves, shifts location based on danger proximity, bleeds when enemy near",
    "Song that compels truth, melody hummed innocently early, later breaks through lies/glamour",
    "Key without a lock, lock reveals itself at moment of greatest need",
    "Shadow with its own will, later revealed as tether to dark realm",
    "Clock that runs backwards, counts down to unknown event, speeds up with dangerous choices",
    "Flower that blooms at death, rare plant blooms only when someone nearby will die",
    "Name that cannot be spoken, saying it thrice summons ancient being",
    "Scar that burns, old wound aches in presence of specific person, reveals hidden connection"
  ];

  getAllAuthorStyles(creature: CreatureArchetype): AuthorStyle[] {
    switch (creature) {
      case 'vampire':
        return this.vampireStyles;
      case 'werewolf':
        return this.werewolfStyles;
      case 'fairy':
      case 'siren':
      case 'djinn':
        return this.fairyStyles;
      case 'witch':
        return this.witchStyles;
      case 'dragon':
        return this.dragonStyles;
      case 'demon':
        return this.demonStyles;
      case 'angel':
        return this.angelStyles;
      case 'mermaid':
        return this.mermaidStyles;
      default:
        return [];
    }
  }

  getAllBeatStructures(): BeatStructure[] {
    return this.beatStructures;
  }

  getAllChekovElements(): string[] {
    return this.chekovElements;
  }

  // Simulate the random selection logic from storyService
  selectRandomAuthors(creature: CreatureArchetype): AuthorStyle[] {
    const styles = this.getAllAuthorStyles(creature);
    const count = Math.min(styles.length, 2 + this.randomInt(2));
    return this.shuffle(styles).slice(0, count);
  }

  selectRandomBeatStructure(): BeatStructure {
    const index = this.randomInt(this.beatStructures.length);
    return this.beatStructures[index];
  }

  selectRandomChekovElements(): ChekovElement[] {
    const shuffled = this.shuffle(this.chekovElements);
    return shuffled.slice(0, 2).map(desc => ({ description: desc }));
  }

  generateRandomLogic(creature: CreatureArchetype): GenerationLogic {
    return {
      selectedAuthors: this.selectRandomAuthors(creature),
      selectedBeatStructure: this.selectRandomBeatStructure(),
      chekovElements: this.selectRandomChekovElements()
    };
  }

  summarizeLogic(logic: GenerationLogic): string {
    const authorSummary = logic.selectedAuthors
      .map(author => `${author.author} (${author.trait})`)
      .join('; ') || 'none selected';
    const chekovSummary = logic.chekovElements
      .map(element => element.description)
      .join('; ');

    return [
      `Author styles: ${authorSummary}.`,
      `Beat structure: ${logic.selectedBeatStructure.name} - ${logic.selectedBeatStructure.beats}.`,
      `Chekov elements: ${chekovSummary}.`
    ].join('\n');
  }

  private shuffle<T>(items: readonly T[]): T[] {
    const shuffled = [...items];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = this.randomInt(i + 1);
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  private randomInt(maxExclusive: number): number {
    if (maxExclusive <= 1) {
      return 0;
    }

    if (typeof globalThis.crypto?.getRandomValues === 'function') {
      const values = new Uint32Array(1);
      globalThis.crypto.getRandomValues(values);
      return values[0] % maxExclusive;
    }

    this.fallbackRandomState = (1664525 * this.fallbackRandomState + 1013904223) >>> 0;
    return this.fallbackRandomState % maxExclusive;
  }
}
