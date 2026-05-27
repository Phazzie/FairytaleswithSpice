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

export const TROPE_DATABASE = {
  vampire: VAMPIRE_TROPES,
  werewolf: WEREWOLF_TROPES,
  fairy: FAIRY_TROPES
} as const;

export type TropeCreatureType = keyof typeof TROPE_DATABASE;
