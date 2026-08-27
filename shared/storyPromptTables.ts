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

/**
 * The twenty beat structures a generation draws one of, uniformly.
 *
 * The draw is uniform today and the `spiceIntegration` lines are advisory
 * prose written into the prompt rather than weights read by the selection —
 * see `StoryService.getRandomBeatStructure`, which had its blueprint
 * parameter removed for saying otherwise.
 */
export const STORY_BEAT_STRUCTURES: readonly StoryBeatStructure[] = [
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
