// Created: 2025-09-19 00:00 UTC
// Ported from PR #24 into the canonical Vercel api/_lib tree.

export interface Trope {
  id: string;
  name: string;
  description: string;
  category: 'personality' | 'power' | 'relationship' | 'setting' | 'conflict';
  subversionInstruction: string;
  intensity: 'subtle' | 'moderate' | 'dramatic';
}

export interface CreatureTropes {
  common: Trope[];
  subversive: Trope[];
}

export const VAMPIRE_TROPES: CreatureTropes = {
  common: [
    {
      id: 'vamp_brooding_loner',
      name: 'Brooding Immortal Loner',
      description: 'Centuries-old vampire who is melancholy and isolated',
      category: 'personality',
      subversionInstruction: 'Make the vampire socially magnetic and unexpectedly optimistic, while preserving danger and romantic intensity.',
      intensity: 'moderate'
    },
    {
      id: 'vamp_blood_bond',
      name: 'Instant Blood Bond/Mate',
      description: 'Immediate supernatural connection upon first meeting',
      category: 'relationship',
      subversionInstruction: 'Let attraction build through friction, choice, and earned trust instead of instant supernatural certainty.',
      intensity: 'dramatic'
    },
    {
      id: 'vamp_hunter_romance',
      name: 'Vampire Hunter Love Interest',
      description: 'Romance between vampire and their destined hunter',
      category: 'conflict',
      subversionInstruction: 'Make the love interest powerful in a non-obvious mundane domain rather than a conventional vampire hunter.',
      intensity: 'moderate'
    },
    {
      id: 'vamp_centuries_lonely',
      name: 'Centuries of Loneliness',
      description: 'Vampire has been alone for hundreds of years',
      category: 'personality',
      subversionInstruction: 'Give the vampire an overfull social history and a private longing for quiet intimacy rather than generalized loneliness.',
      intensity: 'subtle'
    },
    {
      id: 'vamp_reluctant_turn',
      name: 'Reluctant to Turn Human',
      description: 'Vampire hesitates to make their love immortal',
      category: 'conflict',
      subversionInstruction: 'Make immortality a negotiated emotional choice with practical objections instead of a one-sided temptation.',
      intensity: 'moderate'
    },
    {
      id: 'vamp_sunlight_burns',
      name: 'Burned by Sunlight/Crosses',
      description: 'Traditional vampire weaknesses',
      category: 'power',
      subversionInstruction: 'Replace expected vampire weaknesses with a more personal limitation tied to memory, desire, or a specific old bargain.',
      intensity: 'moderate'
    },
    {
      id: 'vamp_aristocratic_ancient',
      name: 'Aristocratic Ancient Vampire',
      description: 'Noble-born vampire with old-world manners',
      category: 'personality',
      subversionInstruction: 'Make the vampire socially sharp but not aristocratic; their authority comes from competence, survival, or craft.',
      intensity: 'moderate'
    },
    {
      id: 'vamp_coven_politics',
      name: 'Vampire Coven Politics',
      description: 'Complex supernatural political structures',
      category: 'setting',
      subversionInstruction: 'Make vampire politics intimate, petty, and personal rather than grand council exposition.',
      intensity: 'dramatic'
    },
    {
      id: 'vamp_struggling_humanity',
      name: 'Struggling with Lost Humanity',
      description: 'Vampire mourns their human nature',
      category: 'conflict',
      subversionInstruction: 'Show the vampire embracing parts of immortality while fearing one specific human feeling they cannot outgrow.',
      intensity: 'moderate'
    },
    {
      id: 'vamp_feeding_ritual',
      name: 'Sensual Blood Feeding',
      description: 'Intimate, erotic feeding scenes',
      category: 'relationship',
      subversionInstruction: 'Make feeding emotionally complicated and consent-forward, with vulnerability carrying more tension than the act itself.',
      intensity: 'dramatic'
    }
  ],
  subversive: [
    {
      id: 'vamp_cheerful_optimist',
      name: 'Cheerfully Optimistic Vampire',
      description: 'Vampire who sees the bright side of immortality',
      category: 'personality',
      subversionInstruction: 'Use optimism as a mask for strategic ruthlessness or hard-won grief, not as comic relief.',
      intensity: 'moderate'
    },
    {
      id: 'vamp_blood_phobic',
      name: 'Blood-Phobic Vampire',
      description: 'Vampire who is squeamish about blood',
      category: 'conflict',
      subversionInstruction: 'Give the vampire a controlled aversion to blood that forces unusual intimacy, restraint, or ritual.',
      intensity: 'dramatic'
    },
    {
      id: 'vamp_social_anxiety',
      name: 'Socially Anxious Vampire',
      description: 'Immortal creature with modern social anxiety',
      category: 'personality',
      subversionInstruction: 'Let supernatural power coexist with social uncertainty, creating tenderness and danger in equal measure.',
      intensity: 'moderate'
    },
    {
      id: 'vamp_newly_turned',
      name: 'Recently Turned Vampire',
      description: 'Still learning vampire basics and making mistakes',
      category: 'power',
      subversionInstruction: 'Make new immortality unstable and sensual, with mistakes that reveal character instead of slapstick.',
      intensity: 'subtle'
    },
    {
      id: 'vamp_prefers_food',
      name: 'Prefers Mortal Food',
      description: 'Vampire who misses and craves human cuisine',
      category: 'conflict',
      subversionInstruction: 'Use mortal food as sensory memory, grief, and longing rather than a simple joke.',
      intensity: 'moderate'
    }
  ]
};

export const WEREWOLF_TROPES: CreatureTropes = {
  common: [
    {
      id: 'wolf_alpha_dominance',
      name: 'Alpha Male Dominance',
      description: 'Pack leader with commanding presence',
      category: 'personality',
      subversionInstruction: 'Shift power away from dominance and toward restraint, care, negotiation, or reluctant responsibility.',
      intensity: 'dramatic'
    },
    {
      id: 'wolf_pack_loyalty',
      name: 'Unbreakable Pack Bonds',
      description: 'Absolute loyalty to werewolf family/pack',
      category: 'relationship',
      subversionInstruction: 'Make pack loyalty conditional, earned, or contested by found-family bonds outside the pack.',
      intensity: 'moderate'
    },
    {
      id: 'wolf_full_moon',
      name: 'Full Moon Transformation',
      description: 'Forced transformation during lunar cycle',
      category: 'power',
      subversionInstruction: 'Let transformation be emotionally triggered or chosen, while the full moon creates a different cost.',
      intensity: 'subtle'
    },
    {
      id: 'wolf_mate_bond',
      name: 'Destined Mate Bond',
      description: 'Supernatural connection to perfect mate',
      category: 'relationship',
      subversionInstruction: 'Treat destiny as unreliable; the relationship must be built through choices and repaired mistakes.',
      intensity: 'dramatic'
    },
    {
      id: 'wolf_territorial',
      name: 'Territorial Behavior',
      description: 'Protective of their land and loved ones',
      category: 'personality',
      subversionInstruction: 'Make territory emotional or symbolic rather than land-based: a secret, a promise, a person, or a memory.',
      intensity: 'moderate'
    },
    {
      id: 'wolf_pack_hierarchy',
      name: 'Strict Pack Hierarchy',
      description: 'Alpha, beta, omega social structure',
      category: 'setting',
      subversionInstruction: 'Undermine hierarchy with consensus, hidden competence, or a protagonist who refuses the role expected of them.',
      intensity: 'dramatic'
    },
    {
      id: 'wolf_hunt_instinct',
      name: 'Predatory Hunting Instincts',
      description: 'Natural hunter with killer instincts',
      category: 'power',
      subversionInstruction: 'Redirect the hunt toward truth, desire, or protection rather than prey and violence.',
      intensity: 'dramatic'
    },
    {
      id: 'wolf_savage_beast',
      name: 'Savage Beast Within',
      description: 'Struggle with animalistic nature',
      category: 'conflict',
      subversionInstruction: 'Make the human side more dangerous than the beast, and the wolf side a source of honesty.',
      intensity: 'moderate'
    },
    {
      id: 'wolf_lone_wolf',
      name: 'Lone Wolf Exile',
      description: 'Cast out from pack, surviving alone',
      category: 'conflict',
      subversionInstruction: 'Make solitude chosen but costly, with intimacy threatening independence rather than merely curing loneliness.',
      intensity: 'moderate'
    },
    {
      id: 'wolf_protective_rage',
      name: 'Protective Rage',
      description: 'Violent response to threats against loved ones',
      category: 'personality',
      subversionInstruction: 'Make protection strategic and controlled; the scary thing is how carefully they choose not to explode.',
      intensity: 'dramatic'
    }
  ],
  subversive: [
    {
      id: 'wolf_omega_protagonist',
      name: 'Omega Pack Member Protagonist',
      description: 'Lowest ranking pack member as main character',
      category: 'personality',
      subversionInstruction: 'Let lower rank provide insight, leverage, and emotional intelligence that dominant characters miss.',
      intensity: 'moderate'
    },
    {
      id: 'wolf_voluntary_loner',
      name: 'Voluntary Lone Wolf',
      description: 'Chooses solitude over pack life',
      category: 'relationship',
      subversionInstruction: 'Make independence a value that must coexist with desire, not a flaw to erase.',
      intensity: 'moderate'
    },
    {
      id: 'wolf_gentle_nature',
      name: 'Gentle Giant Werewolf',
      description: 'Large, intimidating werewolf with gentle soul',
      category: 'personality',
      subversionInstruction: 'Use gentleness as disciplined strength, especially under provocation.',
      intensity: 'moderate'
    },
    {
      id: 'wolf_vegetarian',
      name: 'Vegetarian Werewolf',
      description: 'Werewolf who refuses to hunt or eat meat',
      category: 'conflict',
      subversionInstruction: 'Make refusal to hunt a moral boundary that complicates pack expectations and desire.',
      intensity: 'dramatic'
    },
    {
      id: 'wolf_city_dweller',
      name: 'Urban Werewolf',
      description: 'Werewolf who prefers city life to wilderness',
      category: 'setting',
      subversionInstruction: 'Place primal instincts in dense urban spaces where scent, sound, and proximity become overwhelming.',
      intensity: 'moderate'
    }
  ]
};

export const FAIRY_TROPES: CreatureTropes = {
  common: [
    {
      id: 'fairy_ancient_wisdom',
      name: 'Ancient Otherworldly Wisdom',
      description: 'Ageless knowledge and mystical understanding',
      category: 'personality',
      subversionInstruction: 'Make the fairy brilliant but inexperienced in one crucial human feeling or practical reality.',
      intensity: 'moderate'
    },
    {
      id: 'fairy_nature_power',
      name: 'Deep Connection to Nature',
      description: 'Control over plants, animals, and natural forces',
      category: 'power',
      subversionInstruction: 'Give the fairy a strained or transactional relationship with nature rather than automatic harmony.',
      intensity: 'dramatic'
    },
    {
      id: 'fairy_otherworldly_beauty',
      name: 'Ethereal Otherworldly Beauty',
      description: 'Impossibly beautiful in an inhuman way',
      category: 'personality',
      subversionInstruction: 'Make beauty ordinary at first glance, with strangeness revealed through action, bargain, or desire.',
      intensity: 'moderate'
    },
    {
      id: 'fairy_time_distortion',
      name: 'Time Flows Differently',
      description: 'Fairy realm has different temporal rules',
      category: 'power',
      subversionInstruction: 'Make time distortion personal: one promise, kiss, or lie changes how time behaves around them.',
      intensity: 'subtle'
    },
    {
      id: 'fairy_magic_cost',
      name: 'Magic Comes with Price',
      description: 'Every spell requires significant sacrifice',
      category: 'conflict',
      subversionInstruction: 'Make magic easy but emotionally expensive, requiring honesty, vulnerability, or remembered pain.',
      intensity: 'moderate'
    },
    {
      id: 'fairy_trickster',
      name: 'Mischievous Trickster Nature',
      description: 'Loves pranks and causing harmless chaos',
      category: 'personality',
      subversionInstruction: 'Make the fairy dangerously literal and honest, turning plain speech into the source of tension.',
      intensity: 'moderate'
    },
    {
      id: 'fairy_mortal_fascination',
      name: 'Fascinated by Mortal Life',
      description: 'Intrigued by human emotions and mortality',
      category: 'relationship',
      subversionInstruction: 'Make the fairy unimpressed by mortal novelty but undone by one ordinary human ritual.',
      intensity: 'moderate'
    },
    {
      id: 'fairy_elemental_power',
      name: 'Elemental Magic Control',
      description: 'Commands fire, water, earth, or air',
      category: 'power',
      subversionInstruction: 'Limit elemental power in a strange, specific way that forces cleverness and intimacy.',
      intensity: 'dramatic'
    },
    {
      id: 'fairy_court_politics',
      name: 'Complex Fairy Court Politics',
      description: 'Intricate supernatural political systems',
      category: 'setting',
      subversionInstruction: 'Make court politics personal, domestic, and humiliating rather than abstract royal exposition.',
      intensity: 'dramatic'
    },
    {
      id: 'fairy_mortal_corruption',
      name: 'Corrupted by Human World',
      description: 'Fairy nature changes from exposure to humanity',
      category: 'conflict',
      subversionInstruction: 'Make human contact clarifying or healing, while fairy tradition becomes the corrupting pressure.',
      intensity: 'moderate'
    }
  ],
  subversive: [
    {
      id: 'fairy_tech_savvy',
      name: 'Technology-Savvy Fairy',
      description: 'Fairy who embraces modern technology',
      category: 'personality',
      subversionInstruction: 'Let technology become ritual-adjacent magic, useful but never cute or gimmicky.',
      intensity: 'moderate'
    },
    {
      id: 'fairy_urban_dweller',
      name: 'City-Loving Fairy',
      description: 'Fairy who prefers urban environments',
      category: 'setting',
      subversionInstruction: 'Make the city feel like a living forest of glass, wire, hunger, and bargains.',
      intensity: 'moderate'
    },
    {
      id: 'fairy_anti_nature',
      name: 'Nature-Averse Fairy',
      description: 'Fairy who dislikes natural environments',
      category: 'conflict',
      subversionInstruction: 'Make nature itself suspicious of the fairy, creating tension with their inherited identity.',
      intensity: 'dramatic'
    },
    {
      id: 'fairy_powerless',
      name: 'Magically Powerless Fairy',
      description: 'Fairy born without traditional magical abilities',
      category: 'power',
      subversionInstruction: 'Make the fairy dangerous through bargains, perception, and timing rather than obvious magic.',
      intensity: 'dramatic'
    },
    {
      id: 'fairy_straightforward',
      name: 'Literal and Direct Fairy',
      description: 'Fairy who speaks plainly without riddles',
      category: 'personality',
      subversionInstruction: 'Use directness as a blade: they say exactly what everyone else is trying not to admit.',
      intensity: 'moderate'
    }
  ]
};

export const SIREN_TROPES: CreatureTropes = {
  common: [
    {
      id: 'siren_irresistible_song',
      name: 'Irresistible Song',
      description: 'A voice no listener is able to refuse',
      category: 'power',
      subversionInstruction: 'Make the song persuasive only to someone already tempted, so every surrender is a choice the listener has to own.',
      intensity: 'dramatic'
    },
    {
      id: 'siren_luring_sailors',
      name: 'Lures Sailors onto the Rocks',
      description: 'Draws ships to wreck for hunger or sport',
      category: 'conflict',
      subversionInstruction: 'Give her a wreck she is trying to prevent, and let the coast be the thing that kills.',
      intensity: 'moderate'
    },
    {
      id: 'siren_heartless_predator',
      name: 'Heartless Predator',
      description: 'Feeds on devotion while feeling none of it',
      category: 'personality',
      subversionInstruction: 'Let her feel everything and hunt anyway, so appetite and affection are the same problem.',
      intensity: 'moderate'
    },
    {
      id: 'siren_impossible_beauty',
      name: 'Impossible Sea Beauty',
      description: 'Beauty that is unnatural and disarming',
      category: 'personality',
      subversionInstruction: 'Make her ordinary above the waterline and terrible below it, revealed only once trust is already given.',
      intensity: 'moderate'
    },
    {
      id: 'siren_cursed_by_gods',
      name: 'Cursed by an Old God',
      description: 'Punished into her nature by a divinity',
      category: 'setting',
      subversionInstruction: 'Make the curse an inherited job with duties and a successor rather than a divine tragedy.',
      intensity: 'subtle'
    },
    {
      id: 'siren_cannot_love',
      name: 'Incapable of Love',
      description: 'Her nature forbids real attachment',
      category: 'relationship',
      subversionInstruction: 'Make loving easy for her and being believed the impossible part.',
      intensity: 'dramatic'
    },
    {
      id: 'siren_drowning_kiss',
      name: 'The Drowning Kiss',
      description: 'Intimacy that kills the mortal partner',
      category: 'conflict',
      subversionInstruction: 'Make the danger reciprocal, so what she takes costs her something the mortal can watch happen.',
      intensity: 'moderate'
    },
    {
      id: 'siren_sea_bound',
      name: 'Bound to the Water',
      description: 'Cannot survive long away from the sea',
      category: 'power',
      subversionInstruction: 'Let her stay ashore comfortably and be unable to go back, so the sea is the loss rather than the leash.',
      intensity: 'moderate'
    },
    {
      id: 'siren_drowned_trophies',
      name: 'Collector of Drowned Trophies',
      description: 'Keeps tokens taken from the men she has drowned',
      category: 'setting',
      subversionInstruction: 'Make the collection a record she is ashamed of and cannot bring herself to stop keeping.',
      intensity: 'moderate'
    },
    {
      id: 'siren_ageless_indifference',
      name: 'Ageless Indifference',
      description: 'Mortal lifespans are too short to matter to her',
      category: 'personality',
      subversionInstruction: 'Have her count the days one mortal has left, exactly, and hate that she does.',
      intensity: 'subtle'
    }
  ],
  subversive: [
    {
      id: 'siren_voiceless',
      name: 'Voiceless Siren',
      description: 'A siren who has lost or refuses her song',
      category: 'power',
      subversionInstruction: 'Make her dangerous through listening: she learns what a person wants before they have said it.',
      intensity: 'dramatic'
    },
    {
      id: 'siren_rescuer',
      name: 'Siren of the Lifeboats',
      description: 'Sings sailors off wrecks rather than onto them',
      category: 'conflict',
      subversionInstruction: 'Let rescue compromise as thoroughly as drowning would: everyone she saves owes her.',
      intensity: 'moderate'
    },
    {
      id: 'siren_landlocked',
      name: 'Landlocked Siren',
      description: 'Lives inland, far from any coast',
      category: 'setting',
      subversionInstruction: 'Give a river, a reservoir, or a hotel pool the weight the ocean would have carried.',
      intensity: 'moderate'
    },
    {
      id: 'siren_unhearing_love',
      name: 'The One Who Cannot Hear Her',
      description: 'A love interest immune to the song',
      category: 'relationship',
      subversionInstruction: 'Make the immunity ordinary rather than destined, so she has to be interesting instead of overwhelming.',
      intensity: 'dramatic'
    },
    {
      id: 'siren_under_contract',
      name: 'Siren Under Contract',
      description: 'Hunts on terms negotiated by someone else',
      category: 'setting',
      subversionInstruction: 'Make the contract-holder the antagonist and her appetite the leverage they hold over her.',
      intensity: 'moderate'
    }
  ]
};

export const DJINN_TROPES: CreatureTropes = {
  common: [
    {
      id: 'djinn_three_wishes',
      name: 'Three Wishes',
      description: 'Grants a fixed number of wishes to whoever frees them',
      category: 'power',
      subversionInstruction: 'Make the count negotiable and the wording the real currency, so bargaining is where the romance happens.',
      intensity: 'dramatic'
    },
    {
      id: 'djinn_malicious_literalism',
      name: 'Malicious Wish-Twisting',
      description: 'Grants each wish in its worst available reading',
      category: 'personality',
      subversionInstruction: 'Have the djinn argue for what the wisher actually meant, and be overruled by them.',
      intensity: 'moderate'
    },
    {
      id: 'djinn_vessel_prison',
      name: 'Imprisoned in a Vessel',
      description: 'Bound inside a lamp, ring, or bottle',
      category: 'setting',
      subversionInstruction: 'Make the vessel a home they furnished, and being outside it the exposed state.',
      intensity: 'moderate'
    },
    {
      id: 'djinn_desperate_for_freedom',
      name: 'Desperate for Freedom',
      description: 'Every act aims at escaping bondage',
      category: 'conflict',
      subversionInstruction: 'Give them freedom in the first chapter and make what they want next the harder question.',
      intensity: 'dramatic'
    },
    {
      id: 'djinn_smokeless_fire',
      name: 'Born of Smokeless Fire',
      description: 'An elemental being of flame and smoke',
      category: 'power',
      subversionInstruction: 'Make the fire a temperature other people feel — rooms, skin, held metal — rather than a special effect.',
      intensity: 'moderate'
    },
    {
      id: 'djinn_ancient_arrogance',
      name: 'Millennia of Arrogance',
      description: 'Open contempt for short-lived mortals',
      category: 'personality',
      subversionInstruction: 'Make the contempt a performance covering how much one mortal has come to matter.',
      intensity: 'moderate'
    },
    {
      id: 'djinn_forbidden_master',
      name: 'Forbidden to Love the Holder',
      description: 'Bondage makes affection impossible or forbidden',
      category: 'relationship',
      subversionInstruction: 'Make consent the problem rather than the rule: neither can trust a yes given under a binding.',
      intensity: 'dramatic'
    },
    {
      id: 'djinn_shapeshifter',
      name: 'Wears Any Shape',
      description: 'Takes whatever form the beholder desires',
      category: 'power',
      subversionInstruction: 'Let them keep one form on principle, so being seen as themselves is the intimacy.',
      intensity: 'moderate'
    },
    {
      id: 'djinn_desert_court',
      name: 'Court of the Desert',
      description: 'Answers to an ancient hierarchy of djinn',
      category: 'setting',
      subversionInstruction: 'Make the court petty, procedural, and close at hand rather than a distant mythic empire.',
      intensity: 'subtle'
    },
    {
      id: 'djinn_price_of_magic',
      name: 'Every Wish Has a Price',
      description: 'Magic extracts payment from the wisher',
      category: 'conflict',
      subversionInstruction: 'Have the djinn pay it instead, quietly, and hide the receipts until they cannot.',
      intensity: 'moderate'
    }
  ],
  subversive: [
    {
      id: 'djinn_grants_nothing',
      name: 'Djinn Who Grants Nothing',
      description: 'A djinn with no wish-granting power at all',
      category: 'power',
      subversionInstruction: 'Make them valuable for what they know rather than for what they can do.',
      intensity: 'dramatic'
    },
    {
      id: 'djinn_honest_broker',
      name: 'Scrupulously Honest Djinn',
      description: 'Refuses to twist any wish',
      category: 'personality',
      subversionInstruction: 'Make plain dealing the unsettling thing: they state exactly what a wish will cost, and it is worse than a trick.',
      intensity: 'moderate'
    },
    {
      id: 'djinn_wants_the_vessel',
      name: 'Djinn Who Wants the Vessel Back',
      description: 'Prefers confinement to the open world',
      category: 'setting',
      subversionInstruction: 'Make the world genuinely too loud, and the lamp a room with a chair in it.',
      intensity: 'moderate'
    },
    {
      id: 'djinn_bound_by_choice',
      name: 'Bound by Choice',
      description: 'Stays bound to someone deliberately',
      category: 'relationship',
      subversionInstruction: 'Make the choice revocable at any moment, so every scene is a renewal of it.',
      intensity: 'dramatic'
    },
    {
      id: 'djinn_modern_contract',
      name: 'Djinn on Modern Terms',
      description: 'Operates through contemporary contracts and clauses',
      category: 'setting',
      subversionInstruction: 'Keep the legalism dry and the stakes elemental, with no winking at the anachronism.',
      intensity: 'moderate'
    }
  ]
};

export const WITCH_TROPES: CreatureTropes = {
  common: [
    {
      id: 'witch_hidden_coven',
      name: 'Secret Coven',
      description: 'Practises inside a hidden circle of witches',
      category: 'setting',
      subversionInstruction: 'Make the coven a demanding social obligation with attendance, dues, and long-running grudges.',
      intensity: 'moderate'
    },
    {
      id: 'witch_persecuted_outsider',
      name: 'Persecuted Outsider',
      description: 'Feared and hunted by the ordinary world',
      category: 'conflict',
      subversionInstruction: 'Make her locally beloved and privately dangerous, so exposure costs the town more than it costs her.',
      intensity: 'moderate'
    },
    {
      id: 'witch_love_spell_temptation',
      name: 'Tempted by a Love Spell',
      description: 'Could compel the beloved and must refuse',
      category: 'relationship',
      subversionInstruction: 'Have her refuse it in the first scene, and make being wanted without it the harder story.',
      intensity: 'dramatic'
    },
    {
      id: 'witch_bonded_familiar',
      name: 'Bonded Familiar',
      description: 'An animal companion carrying part of her power',
      category: 'power',
      subversionInstruction: 'Give the familiar its own opinions and the ability to withhold them at the worst moment.',
      intensity: 'moderate'
    },
    {
      id: 'witch_blood_price',
      name: 'Magic Paid in Blood',
      description: 'Spellwork costs her body',
      category: 'conflict',
      subversionInstruction: 'Make the cost boring and cumulative — sleep, warmth, memory — rather than a dramatic wound.',
      intensity: 'moderate'
    },
    {
      id: 'witch_inherited_grimoire',
      name: 'Inherited Grimoire',
      description: 'Power comes from a book an ancestor left behind',
      category: 'setting',
      subversionInstruction: 'Make the ancestor wrong about something important, so the book has to be argued with rather than obeyed.',
      intensity: 'subtle'
    },
    {
      id: 'witch_natural_prodigy',
      name: 'Effortless Natural Talent',
      description: 'Magic comes easily and instinctively',
      category: 'power',
      subversionInstruction: 'Make her competent through rehearsal and preparation, with instinct the part that fails her.',
      intensity: 'moderate'
    },
    {
      id: 'witch_cold_pragmatist',
      name: 'Coldly Pragmatic',
      description: 'Treats people as components of a working',
      category: 'personality',
      subversionInstruction: 'Make the pragmatism a discipline she keeps breaking for exactly one person.',
      intensity: 'moderate'
    },
    {
      id: 'witch_forbidden_resurrection',
      name: 'The Forbidden Resurrection',
      description: 'Tempted to bring back someone she lost',
      category: 'conflict',
      subversionInstruction: 'Make the dead person reachable and unwilling.',
      intensity: 'dramatic'
    },
    {
      id: 'witch_curse_specialist',
      name: 'Feared Curse-Worker',
      description: 'Known for laying curses on her enemies',
      category: 'power',
      subversionInstruction: 'Make her far better at lifting them, and let lifting one be what exposes her.',
      intensity: 'moderate'
    }
  ],
  subversive: [
    {
      id: 'witch_without_magic',
      name: 'Witch Without Magic',
      description: 'Holds the role with no power behind it',
      category: 'power',
      subversionInstruction: 'Let reputation, herbs, and close observation do all of it, and make the bluff genuinely sustainable.',
      intensity: 'dramatic'
    },
    {
      id: 'witch_practising_openly',
      name: 'Openly Practising Witch',
      description: 'Works publicly, with no secrecy at all',
      category: 'setting',
      subversionInstruction: 'Make ordinariness the pressure — clients, hours, complaints — with no glamour left to hide behind.',
      intensity: 'moderate'
    },
    {
      id: 'witch_coven_reject',
      name: 'Expelled from the Coven',
      description: 'Cast out and working alone',
      category: 'relationship',
      subversionInstruction: 'Make the expulsion justified, and her standing the thing the story puts at risk.',
      intensity: 'moderate'
    },
    {
      id: 'witch_of_wires',
      name: 'Witch of Wires and Signal',
      description: 'Works magic through modern infrastructure',
      category: 'power',
      subversionInstruction: 'Keep the workings physical and costly: the substrate changes, the price does not.',
      intensity: 'moderate'
    },
    {
      id: 'witch_hunter_ally',
      name: 'Witch Who Works with Hunters',
      description: 'Partners with the people who hunt her kind',
      category: 'conflict',
      subversionInstruction: 'Make the partnership genuinely useful to both sides and genuinely unforgivable to hers.',
      intensity: 'dramatic'
    }
  ]
};

export const DRAGON_TROPES: CreatureTropes = {
  common: [
    {
      id: 'dragon_great_hoard',
      name: 'Guards a Great Hoard',
      description: 'Sits on treasure it will not part with',
      category: 'setting',
      subversionInstruction: 'Make the hoard a record — letters, debts, keepsakes — that is worthless to everyone but the dragon.',
      intensity: 'moderate'
    },
    {
      id: 'dragon_human_form',
      name: 'Takes Human Shape',
      description: 'Wears a human body to move among mortals',
      category: 'power',
      subversionInstruction: 'Make the human form the costly one, held at effort and lost under strong feeling.',
      intensity: 'moderate'
    },
    {
      id: 'dragon_ancient_pride',
      name: 'Immense Ancient Pride',
      description: 'Cannot tolerate insult or condescension',
      category: 'personality',
      subversionInstruction: 'Make the pride easily wounded in one specific, unglamorous place, and steady everywhere else.',
      intensity: 'moderate'
    },
    {
      id: 'dragon_fated_bond',
      name: 'The Fated Rider or Bonded Mate',
      description: 'A destined partner recognised on sight',
      category: 'relationship',
      subversionInstruction: 'Let the bond be built by repeated choice and stay refusable at every point.',
      intensity: 'dramatic'
    },
    {
      id: 'dragon_devastating_fire',
      name: 'Devastating Fire',
      description: 'A breath weapon that levels what it touches',
      category: 'power',
      subversionInstruction: 'Make the fire hard to aim and worse to hold in, so restraint is the visible effort.',
      intensity: 'moderate'
    },
    {
      id: 'dragon_woken_from_sleep',
      name: 'Woken from Centuries of Sleep',
      description: 'Newly returned to a world that moved on',
      category: 'setting',
      subversionInstruction: 'Make it current and well-informed, with the sleep a decision it now regrets.',
      intensity: 'subtle'
    },
    {
      id: 'dragon_hunted_by_knights',
      name: 'Hunted by Knights',
      description: 'The champions of a kingdom come for it',
      category: 'conflict',
      subversionInstruction: 'Make the hunters ordinary, correct about the danger, and impossible to simply kill.',
      intensity: 'moderate'
    },
    {
      id: 'dragon_possessive',
      name: 'Possessive Over What Is Its',
      description: 'Treats a lover as part of the hoard',
      category: 'relationship',
      subversionInstruction: 'Make it aware the instinct is wrong and unable to stop feeling it, so the pair have to negotiate rather than indulge.',
      intensity: 'dramatic'
    },
    {
      id: 'dragon_impossibly_vast',
      name: 'Impossibly Vast',
      description: 'Too large to share a human room or a human life',
      category: 'power',
      subversionInstruction: 'Make the size a logistical intimacy problem that gets solved in undignified ways.',
      intensity: 'moderate'
    },
    {
      id: 'dragon_riddling_bargainer',
      name: 'Bargains in Riddles',
      description: 'Speaks in tests, conditions, and indirection',
      category: 'personality',
      subversionInstruction: 'Make it blunt, and the bluntness harder to survive than any riddle would have been.',
      intensity: 'moderate'
    }
  ],
  subversive: [
    {
      id: 'dragon_hoardless',
      name: 'Dragon Without a Hoard',
      description: 'Owns nothing and wants nothing kept',
      category: 'setting',
      subversionInstruction: 'Make the emptiness deliberate, and unsettling to everyone who needs it to want something.',
      intensity: 'dramatic'
    },
    {
      id: 'dragon_domestic',
      name: 'Dragon Keeping House',
      description: 'Living a small, settled, ordinary life',
      category: 'personality',
      subversionInstruction: 'Play the domesticity straight; the threat is what disturbing it would cost.',
      intensity: 'moderate'
    },
    {
      id: 'dragon_fireless',
      name: 'Dragon That Cannot Burn',
      description: 'No breath weapon at all',
      category: 'power',
      subversionInstruction: 'Make weight, patience, and reputation the whole of its danger.',
      intensity: 'dramatic'
    },
    {
      id: 'dragon_in_service',
      name: 'Dragon in Service',
      description: 'Answers to a mortal authority by agreement',
      category: 'conflict',
      subversionInstruction: 'Make the agreement fair and current, and make it the thing the plot threatens.',
      intensity: 'moderate'
    },
    {
      id: 'dragon_hand_sized',
      name: 'Dragon the Size of a Hand',
      description: 'Genuinely tiny, with nothing else diminished',
      category: 'power',
      subversionInstruction: 'Keep the menace and the pride exactly as large as they would be at any other size.',
      intensity: 'moderate'
    }
  ]
};

export const DEMON_TROPES: CreatureTropes = {
  common: [
    {
      id: 'demon_soul_contract',
      name: 'Contract for a Soul',
      description: 'Trades power for the soul of whoever signs',
      category: 'conflict',
      subversionInstruction: 'Make the terms fair and fully explained, and let the temptation work anyway.',
      intensity: 'dramatic'
    },
    {
      id: 'demon_irredeemable',
      name: 'Beyond Redemption',
      description: 'Incapable of good by nature',
      category: 'personality',
      subversionInstruction: 'Have it do decent things routinely and treat redemption as beside the point.',
      intensity: 'moderate'
    },
    {
      id: 'demon_seductive_corruptor',
      name: 'Seductive Corruptor',
      description: 'Exists to tempt the virtuous into falling',
      category: 'relationship',
      subversionInstruction: 'Make it uninterested in corrupting the love interest and unnerved by being wanted honestly.',
      intensity: 'moderate'
    },
    {
      id: 'demon_hellish_hierarchy',
      name: 'Answers to a Hellish Hierarchy',
      description: 'Outranked and overseen by worse things',
      category: 'setting',
      subversionInstruction: 'Make the hierarchy a workplace with quotas, reviews, and a supervisor who is merely tedious.',
      intensity: 'moderate'
    },
    {
      id: 'demon_true_name',
      name: 'Bound by a True Name',
      description: 'Compelled by whoever knows the name',
      category: 'power',
      subversionInstruction: 'Have the name given freely as an act of trust, and make the compulsion the thing neither will use.',
      intensity: 'dramatic'
    },
    {
      id: 'demon_forbidden_love',
      name: 'Forbidden to Love',
      description: 'Attachment is against its nature or its rules',
      category: 'relationship',
      subversionInstruction: 'Make attachment permitted and inconvenient — it complicates the job rather than breaking a law.',
      intensity: 'moderate'
    },
    {
      id: 'demon_marks_its_claims',
      name: 'Marks the Ones It Claims',
      description: 'Leaves a visible sign on those it has taken',
      category: 'power',
      subversionInstruction: 'Make the mark removable at a cost one of them has to volunteer to pay.',
      intensity: 'moderate'
    },
    {
      id: 'demon_lies_constantly',
      name: 'Cannot Speak Plainly',
      description: 'Deceives as a reflex',
      category: 'personality',
      subversionInstruction: 'Make it scrupulously truthful and let honesty do the damage the lies were doing.',
      intensity: 'moderate'
    },
    {
      id: 'demon_summoned_unwilling',
      name: 'Summoned Against Its Will',
      description: 'Dragged up by a circle it did not choose',
      category: 'setting',
      subversionInstruction: 'Have it arrive by appointment, on time, and resent how amateur the summoning was.',
      intensity: 'subtle'
    },
    {
      id: 'demon_hunger_for_ruin',
      name: 'Hungers for Ruin',
      description: 'Feeds on destruction and despair',
      category: 'power',
      subversionInstruction: 'Give the hunger an ordinary substitute it is embarrassed to depend on.',
      intensity: 'moderate'
    }
  ],
  subversive: [
    {
      id: 'demon_caseworker',
      name: 'Demon on the Paperwork Desk',
      description: 'Handles administration, not temptation',
      category: 'setting',
      subversionInstruction: 'Keep the job dull and the stakes real: the danger is what a signature does.',
      intensity: 'moderate'
    },
    {
      id: 'demon_contract_breaker',
      name: 'Demon Who Voids Contracts',
      description: 'Works to release people from their bargains',
      category: 'conflict',
      subversionInstruction: 'Make each release cost someone, so mercy always arrives with a bill attached.',
      intensity: 'dramatic'
    },
    {
      id: 'demon_refuses_to_tempt',
      name: 'Demon Who Refuses to Tempt',
      description: 'Will not offer a bargain to the person it wants',
      category: 'relationship',
      subversionInstruction: 'Make the refusal a genuine loss of power that neither of them can undo.',
      intensity: 'dramatic'
    },
    {
      id: 'demon_keeps_every_word',
      name: 'Demon Who Keeps Every Word',
      description: 'Absolutely reliable once committed',
      category: 'personality',
      subversionInstruction: 'Make reliability terrifying: it will do exactly what it promised, including the parts nobody wanted.',
      intensity: 'moderate'
    },
    {
      id: 'demon_in_daylight',
      name: 'Demon in Daylight',
      description: 'Lives openly in the ordinary human world',
      category: 'setting',
      subversionInstruction: 'Give it neighbours, obligations, and something to lose that is not a soul.',
      intensity: 'moderate'
    }
  ]
};

export const ANGEL_TROPES: CreatureTropes = {
  common: [
    {
      id: 'angel_falls_for_mortal',
      name: 'Falls for a Mortal',
      description: 'Loving a human costs the angel its grace',
      category: 'relationship',
      subversionInstruction: 'Leave grace unthreatened and put the judgement of the angel at risk instead.',
      intensity: 'dramatic'
    },
    {
      id: 'angel_serene_perfection',
      name: 'Serene and Perfect',
      description: 'Untroubled, gentle, above the human mess',
      category: 'personality',
      subversionInstruction: 'Make it short-tempered, exacting, and bad at comfort, with the tenderness rationed and real.',
      intensity: 'moderate'
    },
    {
      id: 'angel_obedient_soldier',
      name: 'Obedient Soldier of Heaven',
      description: 'Follows orders without question',
      category: 'conflict',
      subversionInstruction: 'Have it argue every order on the record and comply anyway, so obedience is a decision each time.',
      intensity: 'moderate'
    },
    {
      id: 'angel_innocent_of_desire',
      name: 'Innocent of Desire',
      description: 'Does not understand wanting',
      category: 'relationship',
      subversionInstruction: 'Let it understand desire perfectly and have chosen against it for a very long time.',
      intensity: 'dramatic'
    },
    {
      id: 'angel_healing_touch',
      name: 'Heals with a Touch',
      description: 'Can mend injury and illness at will',
      category: 'power',
      subversionInstruction: 'Make healing transfer the harm rather than erase it, so every mercy is a wound taken.',
      intensity: 'moderate'
    },
    {
      id: 'angel_wings_revealed',
      name: 'The Wings Revealed',
      description: 'A concealed true form shown at the climax',
      category: 'power',
      subversionInstruction: 'Show the wings early and make them a nuisance — a body it has to live in, not a reveal.',
      intensity: 'subtle'
    },
    {
      id: 'angel_guardian_assignment',
      name: 'Assigned Guardian',
      description: 'Watches over one mortal by appointment',
      category: 'setting',
      subversionInstruction: 'Make the assignment reassignable, and the fear of reassignment the pressure on both of them.',
      intensity: 'moderate'
    },
    {
      id: 'angel_cannot_lie',
      name: 'Incapable of Lying',
      description: 'Bound to truth in all things',
      category: 'personality',
      subversionInstruction: 'Let it lie easily and treat each lie as a debt it records and intends to repay.',
      intensity: 'moderate'
    },
    {
      id: 'angel_war_in_heaven',
      name: 'A War in Heaven',
      description: 'Caught up in a celestial conflict',
      category: 'setting',
      subversionInstruction: 'Make the war petty, procedural, and mostly about jurisdiction.',
      intensity: 'moderate'
    },
    {
      id: 'angel_judges_the_unworthy',
      name: 'Judges the Unworthy',
      description: 'Measures mortals against a fixed standard',
      category: 'conflict',
      subversionInstruction: 'Have it refuse to judge, and be punished for the refusal.',
      intensity: 'moderate'
    }
  ],
  subversive: [
    {
      id: 'angel_fallen_and_content',
      name: 'Fallen and Unrepentant',
      description: 'Cast out, and better for it',
      category: 'personality',
      subversionInstruction: 'Give the fall no tragedy and no lesson: the loss is real and the choice was right.',
      intensity: 'dramatic'
    },
    {
      id: 'angel_terrible_form',
      name: 'Angel of the Terrible Form',
      description: 'Frightening rather than beautiful',
      category: 'power',
      subversionInstruction: 'Build the intimacy on being looked at without anyone flinching.',
      intensity: 'dramatic'
    },
    {
      id: 'angel_off_duty',
      name: 'Angel Off Duty',
      description: 'No assignment, no orders, no purpose',
      category: 'setting',
      subversionInstruction: 'Make purposelessness a real problem it has to solve the way anyone else would.',
      intensity: 'moderate'
    },
    {
      id: 'angel_negotiator',
      name: 'Angel Who Bargains',
      description: 'Trades and compromises rather than commands',
      category: 'conflict',
      subversionInstruction: 'Make the bargains binding on Heaven, and the paperwork worse than any demon could produce.',
      intensity: 'moderate'
    },
    {
      id: 'angel_mortal_habits',
      name: 'Angel With Mortal Habits',
      description: 'Has picked up ordinary human routines',
      category: 'relationship',
      subversionInstruction: 'Keep the habits specific and unromantic, and make losing them the thing it fears.',
      intensity: 'subtle'
    }
  ]
};

export const MERMAID_TROPES: CreatureTropes = {
  common: [
    {
      id: 'mermaid_tail_for_legs',
      name: 'Trades Her Tail for Legs',
      description: 'Gives up the sea to walk beside a lover',
      category: 'conflict',
      subversionInstruction: 'Make the trade reversible and the choice repeatable, so it is a relationship rather than a sacrifice.',
      intensity: 'dramatic'
    },
    {
      id: 'mermaid_voice_given_away',
      name: 'Voice Given Away',
      description: 'Loses her voice as the price of the change',
      category: 'power',
      subversionInstruction: 'Let her keep the voice and take something nobody thinks to ask about — balance, sleep, the ability to lie.',
      intensity: 'moderate'
    },
    {
      id: 'mermaid_naive_wonder',
      name: 'Wide-Eyed at the Surface World',
      description: 'Delighted and baffled by everything on land',
      category: 'personality',
      subversionInstruction: 'Make her well-travelled on land and unimpressed, with one specific ordinary thing that undoes her.',
      intensity: 'moderate'
    },
    {
      id: 'mermaid_rescues_a_sailor',
      name: 'Rescues a Drowning Sailor',
      description: 'The romance begins with her saving him',
      category: 'relationship',
      subversionInstruction: 'Have him save her, badly, on her own ground, and let her be furious about having needed it.',
      intensity: 'moderate'
    },
    {
      id: 'mermaid_hidden_kingdom',
      name: 'A Hidden Kingdom Below',
      description: 'An undersea court she is heir or exile to',
      category: 'setting',
      subversionInstruction: 'Make the kingdom small, poor, and administratively demanding rather than a splendid palace.',
      intensity: 'moderate'
    },
    {
      id: 'mermaid_forbidden_surface',
      name: 'Forbidden to Surface',
      description: 'Her people prohibit contact with land',
      category: 'conflict',
      subversionInstruction: 'Make the prohibition a well-reasoned safety rule, and breaking it genuinely dangerous to other people.',
      intensity: 'moderate'
    },
    {
      id: 'mermaid_song_of_calling',
      name: 'Song That Carries Across Water',
      description: 'Her voice travels the sea to summon',
      category: 'power',
      subversionInstruction: 'Make the song a practical signal her people all use, with the intimacy in who she calls rather than how.',
      intensity: 'subtle'
    },
    {
      id: 'mermaid_sunken_treasure',
      name: 'Keeper of Sunken Treasure',
      description: 'Guards what the sea has taken',
      category: 'setting',
      subversionInstruction: 'Make the treasure a catalogue of losses belonging to other people, waiting to be returned.',
      intensity: 'moderate'
    },
    {
      id: 'mermaid_cold_beneath',
      name: 'Cold and Inhuman Beneath',
      description: 'Alien in feeling despite a human face',
      category: 'personality',
      subversionInstruction: 'Make her feelings entirely legible and her body the part that is hard to live with.',
      intensity: 'moderate'
    },
    {
      id: 'mermaid_sickens_on_land',
      name: 'Sickens Out of the Water',
      description: 'Cannot stay long on land',
      category: 'power',
      subversionInstruction: 'Make the limit manageable, mundane, and humiliating to manage in company.',
      intensity: 'moderate'
    }
  ],
  subversive: [
    {
      id: 'mermaid_will_not_trade',
      name: 'Mermaid Who Will Not Trade',
      description: 'Refuses to give up the tail for anyone',
      category: 'conflict',
      subversionInstruction: 'Put the whole burden of adaptation on the land-dweller and keep it there.',
      intensity: 'dramatic'
    },
    {
      id: 'mermaid_lightless_deep',
      name: 'Mermaid of the Lightless Deep',
      description: 'From a depth the surface never reaches',
      category: 'setting',
      subversionInstruction: 'Make her adapted to pressure and dark, so the shallows are the hostile environment.',
      intensity: 'dramatic'
    },
    {
      id: 'mermaid_salvage_broker',
      name: 'Mermaid Who Sells the Wrecks',
      description: 'Runs a salvage trade with people on land',
      category: 'relationship',
      subversionInstruction: 'Make the trade long-established and the romance an inconvenience to a working arrangement.',
      intensity: 'moderate'
    },
    {
      id: 'mermaid_of_a_river',
      name: 'Mermaid of a River',
      description: 'Lives in fresh water, not the sea',
      category: 'setting',
      subversionInstruction: 'Give the river its own rules, neighbours, and territorial disputes.',
      intensity: 'moderate'
    },
    {
      id: 'mermaid_nothing_to_hide',
      name: 'Mermaid With Nothing to Hide',
      description: 'Open about what she is from the first scene',
      category: 'personality',
      subversionInstruction: 'Remove concealment as a plot engine and let the consequences of being known carry the story.',
      intensity: 'moderate'
    }
  ]
};

/**
 * One trope bank per creature the blueprint offers.
 *
 * `TropeSubversionService` is what keeps a generation off the stock version of
 * its own premise: it picks two or three tropes for the chosen creature and
 * appends the HIDDEN UNIQUENESS DIRECTIVES block instructing the model to
 * subvert them, and it serializes the selection into `tropeMetadata` so every
 * later continuation is told to honour the same inversions. `StoryService`
 * reaches it through `supportsCreature`, which asks this object whether the
 * creature has a bank.
 *
 * It had three. `CreatureType` has named ten archetypes since the Story Lab
 * blueprint was introduced, so seven of the ten creatures the form offers —
 * siren, djinn, witch, dragon, demon, angel, and mermaid — answered `false`,
 * and `selectTropeSubversions` returned `undefined` for every one of them. No
 * directives went into the genesis prompt, and `tropeMetadata` was `undefined`,
 * so no continuation carried any either: the feature was silently off for most
 * of the app, and the only visible sign was that those stories read like the
 * first thing anyone would write about a siren.
 *
 * The trope-subversion test could not have caught this. It iterates
 * `Object.keys(TROPE_DATABASE)`, so it asserts only about the creatures already
 * in the table — a missing one is not a failing case, it is a case that never
 * runs. It now checks this object against the creature list itself.
 *
 * Each bank matches the shape of the original three, ten common tropes and five
 * subversive ones, because `createWeightedTropePool` weights the common entries
 * three-to-one and the selector needs enough distinct ids to fill a request of
 * three without repeating across generations. A thinner bank would quietly give
 * its creature less variety than the rest.
 */
export const TROPE_DATABASE = {
  vampire: VAMPIRE_TROPES,
  werewolf: WEREWOLF_TROPES,
  fairy: FAIRY_TROPES,
  siren: SIREN_TROPES,
  djinn: DJINN_TROPES,
  witch: WITCH_TROPES,
  dragon: DRAGON_TROPES,
  demon: DEMON_TROPES,
  angel: ANGEL_TROPES,
  mermaid: MERMAID_TROPES
} as const;

export type TropeCreatureType = keyof typeof TROPE_DATABASE;
