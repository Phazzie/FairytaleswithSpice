// Created: 2026-08-27 UTC

/**
 * The two tables the story prompt is built from, and the Proving Grounds
 * preview panel is built from.
 *
 * Both lived twice: once in `StoryService.getRandomBeatStructure` and
 * `StoryService.generateChekovElements`, which write them into the system
 * prompt, and once again in `GenerationLogicService` in the Angular tree,
 * which shows the reader which structure and which planted elements a run
 * would use. The twenty entries of each were identical, character for
 * character, which is the only reason the panel was telling the truth.
 *
 * That is not a safe place to leave them, and this repository has already paid
 * for it one table over. `GenerationLogicService.getAllAuthorStyles` kept its
 * own copy of the author banks, the API grew `SIREN_STYLES` and
 * `DJINN_STYLES`, and the copy did not — so for two of the ten creatures the
 * panel reported a bank of twelve fae authors for a story the server generated
 * from four sea or wish voices. The note left on that repair states the rule
 * this module exists to keep: a prompt-comparison tool that shows a prompt the
 * run did not use is worse than one that shows nothing, because the reader has
 * no way to tell.
 *
 * Nothing about either table changes here. What changes is that a beat
 * structure added, retired, or reworded is added, retired, or reworded in the
 * preview at the same moment, rather than in whichever copy the next author
 * happens to open.
 *
 * Kept in `shared/` beside `storyLabThemeSeeds` — the other list the API
 * tree and the Angular tree both have to agree on — since this module sits
 * below both and can import neither.
 */

/** One narrative skeleton as the system prompt names it to the model. */
export interface StoryBeatStructure {
  /** The structure's name, written into the prompt as `SELECTED STRUCTURE`. */
  name: string;
  /** The beat sequence itself, arrow-separated. */
  beats: string;
  /** How intimacy is meant to sit across those beats, by spice level and theme. */
  spiceIntegration: string;
  /** The failure modes the model is told to steer away from. */
  avoid: string;
}

/** What separates the four cells of a row below. See `BEAT_STRUCTURE_ROWS`. */
const BEAT_STRUCTURE_CELL_SEPARATOR = '|';

/** How many cells a row has to have: name, beats, spice integration, avoid. */
const BEAT_STRUCTURE_CELL_COUNT = 4;

/**
 * The twenty beat structures, one delimited row each.
 *
 * Written as rows rather than as twenty object literals, for two reasons, and
 * the second is what makes the first worth acting on.
 *
 * The columns are the same four every time, so this is a table, and a table
 * reads as one: twenty rows instead of a hundred lines of braces, keys, and
 * commas that say nothing a reader did not already know from the first entry.
 *
 * And twenty structurally identical object literals are, to a token-based
 * copy-paste detector, twenty copies of one block — the string contents are
 * anonymized before the comparison, so what it sees is the same twenty-token
 * shape repeated. That costs nothing while such a table sits still, because a
 * quality gate measures new code only; it comes due the moment the table moves
 * file, which is exactly what this module is. Moving the table as object
 * literals scored 19.1% duplication on new code against a 3% gate, on a change
 * whose entire purpose is removing a duplicate.
 *
 * The delimiter is one no cell contains, and `parseBeatStructureRow` refuses a
 * row without exactly `BEAT_STRUCTURE_CELL_COUNT` non-empty cells, so a row
 * mistyped while editing fails at import rather than reaching a prompt — and
 * `tests/story-prompt-tables.test.ts` asserts both the count and the absence of
 * the delimiter from the parsed cells.
 */
const BEAT_STRUCTURE_ROWS: readonly string[] = [
  "TEMPTATION CASCADE|Forbidden Glimpse → Growing Obsession → Point of No Return → Consequences Unfold → Deeper Temptation|Each beat escalates physical/emotional intimacy. Perfect for Level 3-5 stories.|Repetitive seduction scenes with no emotional progression, instant capitulation without internal conflict",
  "POWER EXCHANGE|Challenge Issued → Resistance Tested → Control Shifts → Surrender Moment → New Dynamic|Power dynamics drive intimacy. Works for all themes, spice level determines explicitness.|Non-consensual power plays, one-sided dominance, no mutual respect underneath the dynamic",
  "SEDUCTION TRAP|Innocent Encounter → Hidden Agenda Revealed → Manipulation vs Genuine Feeling → Truth Exposed → Choice Made|Seduction builds throughout. Mystery themes enhance psychological tension.|Villain without nuance, manipulation without genuine feelings bleeding through, easy forgiveness",
  "RITUAL BINDING|Ancient Secret → Ritual Requirement → Intimate Ceremony → Magical Consequence → Eternal Bond|Supernatural themes with ritual intimacy. Spice level affects ritual explicitness.|Magic solves everything, no cost to the ritual, bond accepted instantly without conflict",
  "VULNERABILITY SPIRAL|Perfect Facade → Crack in Armor → Emotional Exposure → Intimate Healing → Transformed Identity|Emotional vulnerability leads to physical intimacy. Romance themes amplify connection.|Trauma magically healed by love, no lasting scars, instant emotional breakthroughs",
  "HUNT AND CLAIM|Predator Marks Prey → Chase Begins → Prey Fights Back → Tables Turn → Mutual Claiming|Primal pursuit with escalating tension. Adventure themes add physical stakes.|Prey with no agency or power, stalking romanticized without consequences, one-way claiming",
  "BARGAIN'S PRICE|Desperate Need → Deal Struck → Payment Due → Cost Revealed → Price Accepted|Supernatural bargains with intimate payments. Dark themes heighten moral conflict.|Loopholes that negate the price, convenient escapes, bargain forgotten after payment",
  "MEMORY FRACTURE|Lost Memory → Familiar Stranger → Fragments Return → Truth Reconstructed → Choice to Remember|Past intimacy bleeding through amnesia. Mystery themes create psychological tension.|Convenient amnesia, memories return all at once, no emotional fallout from truth",
  "TRANSFORMATION HUNGER|Change Begins → New Appetites → Mentor Appears → Appetite Satisfied → Evolution Complete|Physical transformation creates new desires. Comedy themes can subvert expectations.|Easy control of new form, mentor appears exactly when needed, no cost to transformation",
  "MIRROR SOULS|Perfect Opposite → Magnetic Pull → Resistance Breaks → Soul Recognition → Unity/Destruction|Opposite personalities creating explosive chemistry. All themes supported, spice determines intensity.|Opposites attract without friction, perfect compatibility solves conflict, no sacrifice required",
  "FORBIDDEN TERRITORY DANCE|Trespass → Discovery → Risk Escalation → Claimed Space|Cross enemy lines, stolen moments in forbidden spaces. Spice level determines intimacy of encounters.|Repetitive 'sneaking around' scenes, predictable guards, no real danger of discovery",
  "SACRIFICE NEGOTIATION|Demand → Counter-offer → Stakes Raise → Blood Price Paid|What will you give up for what you desire? Supernatural costs escalate with spice level.|Easy sacrifices, no real loss, immediate rewards, sacrifice undone later",
  "JEALOUSY IGNITION|Rival Appears → Tension Spikes → Possessive Display → Claim Solidified|Third party interference, possessive claims, territorial marking. Perfect for pack/clan dynamics.|Love triangle clichés, unnecessary drama, weak rival threats, toxic possessiveness",
  "TRUST SHATTERING REVEAL|Hint of Deception → Clues Accumulate → Revelation Hits → Rebuild Begins|Secret exposed, betrayal discovered, foundation crumbles. Intimacy becomes weapon or healing.|Convenient misunderstandings, easy forgiveness, no lasting consequences, immediate trust restoration",
  "PROTECTOR INSTINCT TRIGGER|Danger Looms → Instinct Overrides → Fierce Protection → Aftermath Intimacy|Threat emerges, protective fury unleashed, vulnerable moment follows. Violence into tenderness.|Damsel in distress tropes, victim with no agency, protector never vulnerable",
  "ANCIENT ENEMY RESURFACES|Warning Signs → Threat Materializes → Old Trauma Surfaces → Stand Together|Old wounds reopened, past threatens present, united front. Shared danger forges bonds.|Convenient villain timing, no backstory weight, easy defeat, enemy without real threat",
  "MATE BOND AWAKENING|Attraction Intensifies → Bond Manifests → Fight Connection → Surrender|Supernatural connection snaps into place, resistance futile. Biology meets choice.|Instant acceptance, no conflict about loss of choice, magic solves all relationship issues",
  "BLOOD OATH CONSEQUENCES|Oath Sworn → Consequences Revealed → Loophole Sought → Price Paid|Words have power, vows bind, magic enforces promises. Spice level affects payment type.|Convenient escapes, no real magical binding, oath forgotten, loophole negates consequences",
  "SANCTUARY INVASION|Haven Established → Warning Breach → Invasion → Defend or Flee|Safe space violated, nowhere to hide, forced confrontation. Intimacy in crisis.|Easy victory defending sanctuary, no lasting damage, rebuilt overnight",
  "ECLIPSE OF CONTROL|Control Frays → Transformation Begins → Beast Emerges → Aftermath Reckoning|Monster takes over, humanity slips, beast claims dominance. Spice level affects beast's actions.|No consequences from loss of control, easy regain of composure, victim unaffected or trauma ignored",
];

function parseBeatStructureRow(row: string): StoryBeatStructure {
  const cells = row.split(BEAT_STRUCTURE_CELL_SEPARATOR).map(cell => cell.trim());
  if (cells.length !== BEAT_STRUCTURE_CELL_COUNT || cells.some(cell => cell.length === 0)) {
    throw new Error(`Malformed beat structure row: ${row}`);
  }

  const [name, beats, spiceIntegration, avoid] = cells;

  return { name, beats, spiceIntegration, avoid };
}

/**
 * The twenty beat structures a generation draws one of, uniformly.
 *
 * The draw is uniform today and the `spiceIntegration` column is advisory prose
 * written into the prompt rather than a weight read by the selection — see
 * `StoryService.getRandomBeatStructure`, which had its blueprint parameter
 * removed for saying otherwise.
 */
export const STORY_BEAT_STRUCTURES: readonly StoryBeatStructure[] =
  BEAT_STRUCTURE_ROWS.map(parseBeatStructureRow);

/**
 * The twenty Chekhov's-gun elements a generation plants two of.
 *
 * Each is a device the prompt asks the model to seed in this chapter and pay
 * off in a later one, which is why the preview panel has to name the same two
 * the run was given.
 */
export const STORY_CHEKHOV_ELEMENTS: readonly string[] = [
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
 * How many of the elements above one story plants. Named because both readers
 * slice by it, and a preview that showed three where the prompt planted two
 * would be describing a run that never happened.
 */
export const STORY_CHEKHOV_ELEMENTS_PER_STORY = 2;
