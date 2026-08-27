// Created: 2026-08-27 UTC

/**
 * The ten author voice banks the story prompt is built from, and the Proving
 * Grounds preview panel is built from.
 *
 * This is the table the note on `shared/storyPromptTables.ts` cites as the
 * reason that module exists. It lived twice: once in
 * `api/_lib/config/authorStyles.ts`, whose entries are drawn and written into
 * the system prompt as the voices a run imitates, and once again in
 * `GenerationLogicService` in the Angular tree, which shows a reader which
 * voices a run would draw. The copies drifted once already — the API grew
 * `SIREN_STYLES` and `DJINN_STYLES` and the panel's copy did not, so for two of
 * the ten creatures the panel named twelve fae authors for a story the server
 * wrote from four sea or wish voices. The beat and Chekhov tables were moved to
 * `shared/` on the strength of that evidence; this table, the one that supplied
 * it, stayed where it was.
 *
 * It had drifted again by the time it moved. Three of the twelve vampire
 * samples had their em dashes flattened to hyphens on the API side alone:
 * `prey-or perhaps`, `nothing-nothing-had prepared`, `tension-human`. A voice
 * sample is an example of an author's prose handed to the model as the thing to
 * sound like, so its punctuation is not incidental to it — the em dash is the
 * mark all three sentences are built on, and a hyphen in its place is a
 * different sentence. The reader comparing panel to prompt saw the em dash; the
 * model was shown the hyphen. The em dash is restored here, which is the only
 * content change in the move: every other cell of all sixty-four entries was
 * identical between the two copies, field for field.
 *
 * Kept in `shared/` beside `storyPromptTables` and `storyLabThemeSeeds` — the
 * other tables the API tree and the Angular tree both have to agree on — since
 * this module sits below both and can import neither.
 */

/** One author voice as the story prompt names it to the model. */
export interface AuthorVoice {
  /** The author whose prose the run is asked to sound like. */
  author: string;
  /** A sentence in that author's register, shown to the model as the example. */
  voiceSample: string;
  /** What that voice is for, in one phrase. */
  trait: string;
}

/**
 * The creatures a voice bank is kept for.
 *
 * Structurally the Angular `CreatureArchetype` and the API's `CreatureType`,
 * restated here for the reason `StoryLabThemeSeed` is restated in
 * `storyLabThemeSeeds`: this module sits below both trees and can import
 * neither. The three spellings are mutually assignable, so a creature added to
 * one and not the others fails to compile at both readers below.
 */
export type StoryVoiceCreature =
  | 'vampire'
  | 'werewolf'
  | 'fairy'
  | 'siren'
  | 'djinn'
  | 'witch'
  | 'dragon'
  | 'demon'
  | 'angel'
  | 'mermaid';

/** What separates the three cells of a row below. See `AUTHOR_VOICE_ROWS`. */
const AUTHOR_VOICE_CELL_SEPARATOR = '|';

/** How many cells a row has to have: author, voice sample, trait. */
const AUTHOR_VOICE_CELL_COUNT = 3;

/**
 * The sixty-four voices, one delimited row each, grouped by the bank they
 * belong to.
 *
 * Rows rather than object literals, for the reason `BEAT_STRUCTURE_ROWS` gives
 * at greater length: the columns are the same three every time, so this is a
 * table and reads as one — and sixty-four structurally identical object
 * literals are, to a token-based copy-paste detector, sixty-four copies of one
 * block, which is a duplication score charged to a change whose whole purpose
 * is removing a duplicate.
 *
 * The delimiter appears in no cell, and `parseAuthorVoiceRow` refuses a row
 * without exactly `AUTHOR_VOICE_CELL_COUNT` non-empty cells, so a row mistyped
 * while editing fails at import rather than reaching a prompt.
 */
const AUTHOR_VOICE_ROWS: Record<StoryVoiceCreature, readonly string[]> = {
  vampire: [
    'Jeaniene Frost|"You know what I like about you?" His smile was all sharp edges. "Absolutely nothing. That\'s what makes you interesting."|Razor-sharp wit that cuts before you feel the blade',
    'J.R. Ward|The male\'s voice was rough as granite. "Touch her again, and I\'ll show you what eternity really means."|Brooding protectiveness bordering on obsession',
    'Christine Feehan|Ancient hunger stirred in the depths of his dark eyes, a predator recognizing prey—or perhaps something far more dangerous.|Gothic atmosphere thick enough to taste',
    'Anne Rice|"Do you know what it means to love something for centuries? To watch it change, to watch it die, to watch it become something you no longer recognize?"|Philosophical torment wrapped in beauty',
    'Kresley Cole|She was chaos in a cocktail dress, and he\'d never wanted to be destroyed so badly in his immortal life.|Wild, reckless passion defying all logic',
    'Charlaine Harris|"Sugar, in the South, we don\'t hide our fangs behind pretty words. We smile real sweet and strike when you least expect it."|Southern charm masking vampire politics and cozy mystery',
    'Sherrilyn Kenyon|Eleven thousand years of existence, and nothing—nothing—had prepared him for the way she looked at him like he might still be worth saving.|Dark-Hunter mythology with tortured immortal warriors',
    'Gena Showalter|"Oh, you want to play?" Her grin was pure mischief. "Lords of the Underworld Rule #1: Never challenge what you can\'t handle."|Playful banter masking Lords of the Underworld intensity',
    'L.J. Smith|The triangle between them crackled with impossible tension—human, vampire, and the question of who would claim her heart first.|Teen angst meets vampire romance with love triangle mastery',
    'Kim Harrison|"I\'m a bounty hunter who dates a vampire and pisses off ancient demons before breakfast. What could possibly go wrong?"|Urban fantasy vampire world-building with sassy protagonist',
    'Laurell K. Hamilton|Power and blood and dark eroticism wound between them like a living thing, necromancy and vampirism dancing on the edge of corruption.|Dark eroticism blending vampire power dynamics with necromancy',
    'Richelle Mead|Dhampir guardian or forbidden vampire lover? The academy taught her to stake first and ask questions never. But he made her want to break every rule.|Vampire academy vibes with forbidden romance and dhampir tension'
  ],
  werewolf: [
    'Patricia Briggs|"Pack means family. And family means I\'ll tear apart anyone who threatens what\'s mine."|Grounded pragmatism with fierce loyalty',
    'Ilona Andrews|"Great. Magical politics, ancient curses, and now this. Tuesday just keeps getting better."|Urban grit balanced with unexpected humor',
    'Nalini Singh|His wolf pressed against his skin, demanding he claim what was his, mark her, make her understand she belonged to the pack-to him.|Primal sensuality overwhelming rational thought',
    'Kelley Armstrong|The change rippled through her bones like electricity, wild and barely contained, a storm waiting to break.|Suspenseful tension building like a storm',
    'Jennifer Ashley|"The pack protects its own. Always. Even when \'its own\' is too stubborn to ask for help."|Found family bonds stronger than blood',
    'Carrie Ann Ryan|The mating bond snapped into place like fate clicking its final lock, and suddenly "mine" wasn\'t just a word-it was a destiny.|Fated mates with pack loyalty and emotional werewolf bonds',
    'Shelly Laurenston|"Did you just challenge me to an alpha battle in the middle of brunch? Honey, I haven\'t even had my coffee yet."|Comedic werewolf chaos with irreverent alpha battles',
    'Suzanne Wright|Possessive didn\'t begin to cover it. His wolf wanted to wrap around her, claim her, make sure every shifter within a hundred miles knew she was his.|Possessive alpha wolves with pack mentality and steamy romance',
    'Faith Hunter|The skinwalker magic crawled across her skin, werewolf and vampire scents mixing in the humid Southern night like a supernatural storm brewing.|Southern Gothic werewolves with vampire-werewolf tension and skinwalker magic',
    'Keri Arthur|Werewolf detective, vampire lover, and a murder case that smelled like death and dark magic. Just another night in the Riley Jenson universe.|Werewolf detective noir with Riley Jenson vibes and hybrid powers',
    'Rachel Vincent|Territory. Dominance. Pride. The werecat politics translated perfectly to werewolf pack law-fight for your place or lose everything.|Werecats/shifter politics crossover with territorial dominance and family saga',
    'Chloe Neill|"Chicago werewolf packs play by different rules. Less howling at the moon, more political maneuvering with a side of violence."|Chicago werewolf packs with urban fantasy setting and political intrigue'
  ],
  fairy: [
    'Holly Black|"I could give you what you desire most," she said, and her smile was sharp as winter. "The question is: what are you willing to lose for it?"|Court intrigue where every smile hides daggers',
    'Sarah J. Maas|Power thrummed beneath her skin like a living thing, ancient and terrible and beautiful enough to bring kingdoms to their knees.|Epic romance with world-shattering consequences',
    'Melissa Marr|The mortal world blurred at the edges when he looked at her, reality bending around the impossible pull of fae magic.|Dangerous beauty drawing moths to flame',
    'Grace Draven|"In my realm, we have a saying: \'Love is the cruelest magic, for it makes even immortals mortal.\'"|Slow-burn intimacy across cultural impossibilities',
    'Julie Kagawa|Honor and desire warred in his expression, duty and longing locked in a battle that would determine both their fates.|Hybrid honor versus desire in heart-wrenching choices',
    'Karen Marie Moning|"Welcome to Dublin, where the Unseelie princes play and humans are just pretty toys to break." She should run. She should definitely run.|Fever series Fae with dark Unseelie princes and Dublin setting',
    'Elise Kova|Air magic sang through her veins, elemental power awakening with each breath, the fairy prince watching like he knew exactly what she was becoming.|Air Awakens fairy magic with elemental powers and fantasy romance',
    'Jennifer Estep|"Mythos Academy Rule #1: Never trust a fairy. Rule #2: Especially not one who offers to teach you assassination techniques."|Mythos Academy fae with assassin protagonist and snarky tone',
    'Cassandra Clare|Shadowhunter meets Seelie Court, and the lines between ally and enemy blur like glamour in moonlight-forbidden and intoxicating.|Shadowhunter fae crossover with Seelie/Unseelie courts and forbidden romance',
    'Sylvia Mercedes|Bride of the Shadow King-the bargain was simple: her life for her kingdom. What she didn\'t expect was wanting to stay in the darkness.|Bride of the Shadow King vibes with dark fairy bargains and enemies-to-lovers',
    'Roshani Chokshi|Indian mythology wove through the fairy realm like silk and starlight, lush magic painting the air in colors that had no earthly names.|Indian mythology fae with lush descriptions and magical realism',
    'Laura Thalassa|"The Bargainer collects debts, siren. And you\'ve owed me for a very long time." His smile promised wicked payments and dangerous pleasures.|Bargainer series vibes with siren fae, debts and deals'
  ],
  siren: [
    'Drowning-Song Gothic|She sang one note and the helmsman turned the wheel toward the rocks, smiling the whole way, certain he had chosen it himself.|Siren song as consent stolen politely, and the guilt that follows it',
    'Salt-Debt Bargainer|"You called me across four hundred miles of black water," she said. "Debts like that are not settled in coin, sailor."|Siren bargains, owed favours, and payment demanded at the worst hour',
    'Storm-Voice Romance|Her voice cracked the squall open like an egg, and for one impossible breath the sea held still to listen to her.|Weather-bending siren power set against unguarded tenderness',
    'Harbour-Watch Longing|Every night he left a lamp burning on the pier, and every night she surfaced just past its light, unwilling to be saved and unwilling to leave.|Shoreline distance, a siren who will not come in, and a lover who will not go home'
  ],
  djinn: [
    'Three-Wish Jurisprudence|"Say it precisely," the djinn warned, delighted. "I am bound to give you exactly what you asked for, and nothing has ever hurt a mortal more."|Wish law read aloud like a contract, granted with ruinous precision',
    'Lamp-Bound Devotion|Four hundred years of masters, and she was the first to ask what he wanted before she asked for anything at all.|Servitude, ownership, and the terror of being wished free',
    'Smokeless-Fire Epic|He unfolded out of the brazier in a column of smokeless fire, and the desert night went to glass beneath him.|Elemental djinn grandeur, desert magic, and courts older than scripture',
    'Brass-Seal Bargain|"One wish left," she said, turning the brass seal over in her palm. "Spend it on me and you stay a slave. Spend it on you and I stay alone."|Bargains where the only winning move costs the romance itself'
  ],
  witch: [
    'Coven Hearth Gothic|"Every spell has a price," she said, pressing the candle flame flat with one wet fingertip. "Tell me what you are willing to burn."|Witchcraft intimacy built from bargains, hearth magic, and dangerous domestic ritual',
    'Grimoire Noir|Ink crawled across the page before her lover could lie, each black letter blooming like a bruise under moonlight.|Spellbook mystery where secrets become physical evidence',
    'Familiar-Bond Romance|The cat hissed at him first. Sensible creature. Then the warding circle opened anyway, which meant her heart had betrayed them both.|Witch familiars, protective wards, and reluctant trust turning into heat',
    'Kitchen-Sink Enchantment|Rosemary, iron, grave dirt, honey. She measured each ingredient by instinct, saving the last spoonful of sweetness for revenge.|Tactile spellcraft grounded in herbs, thresholds, kitchens, and revenge'
  ],
  dragon: [
    'Hoard-Bound Majesty|"I do not collect gold because it shines," he murmured. "I collect what kingdoms are foolish enough to worship."|Dragon pride, treasure psychology, and courtly dominance',
    'Scale-and-Silk Romance|Heat rolled from him in waves, but his claws touched her sleeve with impossible care, as if silk could bruise.|Massive power restrained by precise tenderness',
    'Sky-Tyrant Epic|When his wings opened, every candle in the palace bent sideways. Even the throne seemed to remember fear.|Aerial grandeur, ancient territorial claims, and throne-room stakes',
    'Molten Devotion|"Name the enemy," he said, smoke curling between his teeth, "and I will make the mountain forget they were born."|Volcanic protectiveness and obsessive loyalty'
  ],
  demon: [
    'Velvet Contract Horror|"Read the last clause," he said softly. "The one your pulse keeps trying to skip."|Demon contracts, loopholes, temptation, and elegant dread',
    'Infernal Ballroom|Hell did not smell like sulfur. It smelled like champagne, hot skin, and the moment before a vow became a chain.|Decadent demon society with manners sharper than knives',
    'Temptation Advocate|"I never make anyone fall," he whispered. "I only ask why they keep standing where it hurts."|Psychological seduction that exposes denied desire',
    'Ash-Crowned Redemption|The halo scar around his throat glowed whenever he told the truth, which made his silence more intimate than any confession.|Fallen monsters, redemption pressure, and sacred-profane tension'
  ],
  angel: [
    'Cathedral Longing|His wings cast shadows across the altar, but it was the hunger in his lowered eyes that made the chapel feel forbidden.|Angel grace strained by desire, duty, and sacred architecture',
    'Fallen-Star Romance|"I was made for obedience," he said, touching the rain on her cheek. "Then you taught me weather."|Celestial innocence breaking into chosen rebellion',
    'Judgment Court Gothic|The choir stopped singing when she entered, and every feather in the room turned its pale eye toward her crime.|Heavenly courts, judgment, ritual law, and forbidden advocacy',
    'Mercy-as-Temptation|He could have condemned her with a word. Instead he knelt, offered his sword hilt-first, and ruined them both.|Mercy, sacrifice, and intimate moral catastrophe'
  ],
  mermaid: [
    'Pearl-Dagger Court|The reef court smiled with too many teeth, each pearl in the queen\'s crown harvested from a drowned promise.|Mermaid court intrigue, ocean law, and beautiful cruelty',
    'Tide-Pull Romance|Every retreat of the wave dragged her farther from him; every return put salt on his lips like a vow.|Rhythmic longing shaped by tides, distance, and return',
    'Shipwreck Gothic|The wreck still sang at low tide, ribs of black wood humming with the names of sailors who had loved badly.|Haunted coasts, wrecks, curses, and drowned secrets',
    'Brine-Bound Bargain|"Give me your voice for one moon," she said, "and I will teach your heart how to breathe underwater."|Voice bargains, salt magic, and amphibious intimacy'
  ]
};

function parseAuthorVoiceRow(row: string): AuthorVoice {
  const cells = row.split(AUTHOR_VOICE_CELL_SEPARATOR).map(cell => cell.trim());
  if (cells.length !== AUTHOR_VOICE_CELL_COUNT || cells.some(cell => cell.length === 0)) {
    throw new Error(`Author voice row must have ${AUTHOR_VOICE_CELL_COUNT} non-empty cells: ${row}`);
  }

  const [author, voiceSample, trait] = cells;
  return { author, voiceSample, trait };
}

/**
 * The voice bank each creature's prompt is built from, and each creature's
 * preview panel reports.
 *
 * One array object per creature, built once at import: `getAuthorStylesForCreature`
 * hands its caller the bank itself, and `tests/story-lab-real-engine.test.ts`
 * asserts by array identity that no two creatures share one — which is how the
 * `siren`/`djinn` collision above is kept from recurring in a new form.
 */
export const AUTHOR_STYLE_BANKS: Record<StoryVoiceCreature, AuthorVoice[]> = Object.fromEntries(
  (Object.entries(AUTHOR_VOICE_ROWS) as Array<[StoryVoiceCreature, readonly string[]]>)
    .map(([creature, rows]) => [creature, rows.map(parseAuthorVoiceRow)])
) as Record<StoryVoiceCreature, AuthorVoice[]>;

/**
 * Which two banks each creature's blend voice is drawn from.
 *
 * A table rather than a switch, because the pairings are a table: four of the
 * ten creatures share a pair with another one — `vampire` and `dragon` both
 * borrow werewolf and fae, `werewolf` and `demon` both borrow vampire and fae —
 * so a switch states two of its arms twice and a reader has to compare bodies
 * to see that they agree.
 */
export const SECONDARY_AUTHOR_BANKS: Record<StoryVoiceCreature, readonly [StoryVoiceCreature, StoryVoiceCreature]> = {
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

/** How many voices a generation draws from the creature's own bank. */
export const PRIMARY_AUTHOR_COUNT = 2;

/** How many it draws from the two banks `SECONDARY_AUTHOR_BANKS` pairs it with. */
export const SECONDARY_AUTHOR_COUNT = 1;

/** The two banks a creature's blend voice is drawn from, flattened in pairing order. */
export function getSecondaryAuthorVoices(creature: StoryVoiceCreature): AuthorVoice[] {
  return SECONDARY_AUTHOR_BANKS[creature].flatMap(bank => AUTHOR_STYLE_BANKS[bank]);
}
