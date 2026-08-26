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

/**
 * How many voices a generation draws from each bank, as
 * `selectRandomAuthorStyles` in `api/_lib/config/authorStyles.ts` draws them.
 * Named rather than inlined so the two slices below read as the API's shape
 * rather than as two unrelated magic numbers.
 */
const PRIMARY_AUTHOR_COUNT = 2;
const SECONDARY_AUTHOR_COUNT = 1;

/**
 * Which two banks each creature's blend voice is drawn from, as
 * `getSecondaryAuthorStyles` in `api/_lib/config/authorStyles.ts` pairs them.
 *
 * A table rather than a switch, because the pairings are a table: four of the ten
 * creatures share a pair with another one — `vampire` and `dragon` both borrow
 * werewolf and fae, `werewolf` and `demon` both borrow vampire and fae — so a
 * switch states two of its arms twice and a reader has to compare bodies to see
 * that they agree. Here each creature is one line naming the banks by the same
 * names `getAllAuthorStyles` answers to, and the repetition is visible instead of
 * duplicated.
 */
const SECONDARY_AUTHOR_BANKS: Record<CreatureArchetype, readonly [CreatureArchetype, CreatureArchetype]> = {
  vampire: ['werewolf', 'fairy'],
  werewolf: ['vampire', 'fairy'],
  fairy: ['vampire', 'werewolf'],
  siren: ['mermaid', 'fairy'],
  djinn: ['fairy', 'demon'],
  witch: ['fairy', 'vampire'],
  dragon: ['werewolf', 'fairy'],
  demon: ['vampire', 'fairy'],
  angel: ['fairy', 'witch'],
  mermaid: ['fairy', 'werewolf']
};

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

  private readonly fairyStyles: AuthorStyle[] = [
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

  /**
   * Ported from the API's `SIREN_STYLES`, which is the bank a siren story is
   * actually generated from. See `getAllAuthorStyles` below for what reading
   * the fairy bank instead was doing to this panel.
   */
  private readonly sirenStyles: AuthorStyle[] = [
    {
      author: 'Drowning-Song Gothic',
      voiceSample: 'She sang one note and the helmsman turned the wheel toward the rocks, smiling the whole way, certain he had chosen it himself.',
      trait: 'Siren song as consent stolen politely, and the guilt that follows it'
    },
    {
      author: 'Salt-Debt Bargainer',
      voiceSample: '"You called me across four hundred miles of black water," she said. "Debts like that are not settled in coin, sailor."',
      trait: 'Siren bargains, owed favours, and payment demanded at the worst hour'
    },
    {
      author: 'Storm-Voice Romance',
      voiceSample: 'Her voice cracked the squall open like an egg, and for one impossible breath the sea held still to listen to her.',
      trait: 'Weather-bending siren power set against unguarded tenderness'
    },
    {
      author: 'Harbour-Watch Longing',
      voiceSample: 'Every night he left a lamp burning on the pier, and every night she surfaced just past its light, unwilling to be saved and unwilling to leave.',
      trait: 'Shoreline distance, a siren who will not come in, and a lover who will not go home'
    }
  ];

  /** Ported from the API's `DJINN_STYLES`, for the same reason. */
  private readonly djinnStyles: AuthorStyle[] = [
    {
      author: 'Three-Wish Jurisprudence',
      voiceSample: '"Say it precisely," the djinn warned, delighted. "I am bound to give you exactly what you asked for, and nothing has ever hurt a mortal more."',
      trait: 'Wish law read aloud like a contract, granted with ruinous precision'
    },
    {
      author: 'Lamp-Bound Devotion',
      voiceSample: 'Four hundred years of masters, and she was the first to ask what he wanted before she asked for anything at all.',
      trait: 'Servitude, ownership, and the terror of being wished free'
    },
    {
      author: 'Smokeless-Fire Epic',
      voiceSample: 'He unfolded out of the brazier in a column of smokeless fire, and the desert night went to glass beneath him.',
      trait: 'Elemental djinn grandeur, desert magic, and courts older than scripture'
    },
    {
      author: 'Brass-Seal Bargain',
      voiceSample: '"One wish left," she said, turning the brass seal over in her palm. "Spend it on me and you stay a slave. Spend it on you and I stay alone."',
      trait: 'Bargains where the only winning move costs the romance itself'
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

  /**
   * The author bank a creature's prompt is built from.
   *
   * The point of this panel is to show which authors the API will be asked to
   * write like, so the answer has to be the API's answer. `siren` and `djinn`
   * fell through to `fairyStyles`, and the API has had its own `SIREN_STYLES`
   * and `DJINN_STYLES` since that same fallthrough was fixed in
   * `api/_lib/config/authorStyles.ts` — so for two of the ten creatures this
   * screen reported a bank of twelve fae authors (Sarah J. Maas, Holly Black,
   * Julie Kagawa) for a story the server generated from four sea or wish
   * voices. A prompt-comparison tool that shows a prompt the run did not use is
   * worse than one that shows nothing, because the reader has no way to tell.
   *
   * The `default` stays for a creature that reaches here from outside
   * `CreatureArchetype`; with every archetype now named it is unreachable from
   * the type.
   */
  getAllAuthorStyles(creature: CreatureArchetype): AuthorStyle[] {
    switch (creature) {
      case 'vampire':
        return this.vampireStyles;
      case 'werewolf':
        return this.werewolfStyles;
      case 'fairy':
        return this.fairyStyles;
      case 'siren':
        return this.sirenStyles;
      case 'djinn':
        return this.djinnStyles;
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

  /**
   * The second bank a creature's prompt draws its blend voice from.
   *
   * Ported from `getSecondaryAuthorStyles` in `api/_lib/config/authorStyles.ts`,
   * which is where the API decides it — see `selectRandomAuthors` below for what
   * leaving it out was doing to this panel. The pairings are the API's, not a
   * reconstruction: each creature borrows the two banks named there, in that
   * order, so the pool a voice is drawn from is the same pool on both sides.
   *
   * The lookup answers `[]` for a creature that reaches here from outside
   * `CreatureArchetype`, which is what the `default` of `getAllAuthorStyles`
   * does and is unreachable from the type for the same reason.
   */
  getSecondaryAuthorStyles(creature: CreatureArchetype): AuthorStyle[] {
    const pairing = SECONDARY_AUTHOR_BANKS[creature];

    return pairing ? pairing.flatMap(bank => this.getAllAuthorStyles(bank)) : [];
  }

  getAllBeatStructures(): BeatStructure[] {
    return this.beatStructures;
  }

  getAllChekovElements(): string[] {
    return this.chekovElements;
  }

  /**
   * The author styles a generation would actually be prompted with.
   *
   * `selectRandomAuthorStyles` in `api/_lib/config/authorStyles.ts` takes two
   * voices from the creature's own bank and one from a *second* bank belonging
   * to other creatures — a werewolf story is written by two werewolf voices and
   * one vampire or fae one, and that third voice is the whole reason the API
   * keeps a `getSecondaryAuthorStyles` table at all. This panel drew two or
   * three, all from the primary bank, so it disagreed with the run twice over:
   * the blend voice never appeared in the preview for any creature, and a
   * three-author preview named three primary voices where the API had used two.
   *
   * The count is what makes the second half wrong rather than merely incomplete.
   * `2 + randomInt(2)` is a coin flip between two and three, so the panel that
   * happened to roll three showed a prompt with one more same-creature voice
   * than the generator ever builds. The API's shape is fixed — two plus one, in
   * that order — so there is nothing to randomise here beyond which voices are
   * drawn.
   *
   * `Math.min` still guards each slice, because a bank shorter than the slice it
   * is asked for should hand back what it has rather than a padded list; the
   * shipped banks are all at least four deep, so this is about the next one
   * added rather than about any creature today.
   */
  selectRandomAuthors(creature: CreatureArchetype): AuthorStyle[] {
    const primaryStyles = this.getAllAuthorStyles(creature);
    const secondaryStyles = this.getSecondaryAuthorStyles(creature);

    return [
      ...this.shuffle(primaryStyles).slice(0, Math.min(PRIMARY_AUTHOR_COUNT, primaryStyles.length)),
      ...this.shuffle(secondaryStyles).slice(0, Math.min(SECONDARY_AUTHOR_COUNT, secondaryStyles.length))
    ];
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
