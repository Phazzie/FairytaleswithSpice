// ==================== INVISIBLE TROPE SUBVERSION DATABASE ====================
// Comprehensive trope definitions for supernatural romance story enhancement
// This system secretly selects and subverts 2-3 tropes per story for uniqueness

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
      subversionInstruction: 'Make the vampire cheerful, optimistic, and social. They enjoy company and are the life of any gathering, despite their immortal nature.',
      intensity: 'moderate'
    },
    {
      id: 'vamp_blood_bond',
      name: 'Instant Blood Bond/Mate',
      description: 'Immediate supernatural connection upon first meeting',
      category: 'relationship',
      subversionInstruction: 'The characters initially find each other annoying or incompatible. Their attraction builds slowly through conflict and mutual irritation.',
      intensity: 'dramatic'
    },
    {
      id: 'vamp_hunter_romance',
      name: 'Vampire Hunter Love Interest',
      description: 'Romance between vampire and their destined hunter',
      category: 'conflict',
      subversionInstruction: 'The love interest is completely oblivious to supernatural threats and more interested in mundane things like gardening or accounting.',
      intensity: 'moderate'
    },
    {
      id: 'vamp_centuries_lonely',
      name: 'Centuries of Loneliness',
      description: 'Vampire has been alone for hundreds of years',
      category: 'personality',
      subversionInstruction: 'The vampire has been trying to get alone time for centuries but is constantly surrounded by clingy supernatural beings who won\'t leave them alone.',
      intensity: 'subtle'
    },
    {
      id: 'vamp_reluctant_turn',
      name: 'Reluctant to Turn Human',
      description: 'Vampire hesitates to make their love immortal',
      category: 'conflict',
      subversionInstruction: 'The vampire is eager to turn the human, but the human keeps finding excuses to postpone it (afraid of needles, wants to finish a book series first, etc.).',
      intensity: 'moderate'
    },
    {
      id: 'vamp_sunlight_burns',
      name: 'Burned by Sunlight/Crosses',
      description: 'Traditional vampire weaknesses',
      category: 'power',
      subversionInstruction: 'The vampire loves sunlight and has found magical protection. They\'re often found sunbathing or in bright, airy spaces.',
      intensity: 'moderate'
    },
    {
      id: 'vamp_aristocratic_ancient',
      name: 'Aristocratic Ancient Vampire',
      description: 'Noble-born vampire with old-world manners',
      category: 'personality',
      subversionInstruction: 'The vampire is from a working-class background and uses modern slang. They find formal etiquette stuffy and prefer casual interactions.',
      intensity: 'moderate'
    },
    {
      id: 'vamp_coven_politics',
      name: 'Vampire Coven Politics',
      description: 'Complex supernatural political structures',
      category: 'setting',
      subversionInstruction: 'The vampire community is more like a dysfunctional book club that argues about plot holes and whose turn it is to bring snacks.',
      intensity: 'dramatic'
    },
    {
      id: 'vamp_struggling_humanity',
      name: 'Struggling with Lost Humanity',
      description: 'Vampire mourns their human nature',
      category: 'conflict',
      subversionInstruction: 'The vampire is relieved to be free from human concerns like taxes, aging, and social media. They embrace their new nature enthusiastically.',
      intensity: 'moderate'
    },
    {
      id: 'vamp_feeding_ritual',
      name: 'Sensual Blood Feeding',
      description: 'Intimate, erotic feeding scenes',
      category: 'relationship',
      subversionInstruction: 'The feeding is awkward and the vampire apologizes constantly, asks if it\'s okay, and offers the human juice and cookies afterward.',
      intensity: 'dramatic'
    }
  ],
  subversive: [
    {
      id: 'vamp_cheerful_optimist',
      name: 'Cheerfully Optimistic Vampire',
      description: 'Vampire who sees the bright side of immortality',
      category: 'personality',
      subversionInstruction: 'Emphasize their sunny disposition and how they use immortality for positive goals like learning every hobby.',
      intensity: 'moderate'
    },
    {
      id: 'vamp_blood_phobic',
      name: 'Blood-Phobic Vampire',
      description: 'Vampire who is squeamish about blood',
      category: 'conflict',
      subversionInstruction: 'They survive on blood substitutes and get nauseous at the sight of real blood.',
      intensity: 'dramatic'
    },
    {
      id: 'vamp_social_anxiety',
      name: 'Socially Anxious Vampire',
      description: 'Immortal creature with modern social anxiety',
      category: 'personality',
      subversionInstruction: 'They overthink every social interaction and need reassurance despite being supernaturally powerful.',
      intensity: 'moderate'
    },
    {
      id: 'vamp_newly_turned',
      name: 'Recently Turned Vampire',
      description: 'Still learning vampire basics and making mistakes',
      category: 'power',
      subversionInstruction: 'They constantly mess up basic vampire things and need guidance from more experienced supernatural beings.',
      intensity: 'subtle'
    },
    {
      id: 'vamp_prefers_food',
      name: 'Prefers Mortal Food',
      description: 'Vampire who misses and craves human cuisine',
      category: 'conflict',
      subversionInstruction: 'They spend most of their time trying to recreate their favorite recipes from when they were human.',
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
      subversionInstruction: 'Make them an omega who prefers following others and gets anxious when asked to lead anything.',
      intensity: 'dramatic'
    },
    {
      id: 'wolf_pack_loyalty',
      name: 'Unbreakable Pack Bonds',
      description: 'Absolute loyalty to werewolf family/pack',
      category: 'relationship',
      subversionInstruction: 'The werewolf is terrible at pack dynamics and constantly argues with their pack about everything from hunting spots to movie choices.',
      intensity: 'moderate'
    },
    {
      id: 'wolf_full_moon',
      name: 'Full Moon Transformation',
      description: 'Forced transformation during lunar cycle',
      category: 'power',
      subversionInstruction: 'They can transform at will but always forget to check the calendar and are surprised by the full moon every month.',
      intensity: 'subtle'
    },
    {
      id: 'wolf_mate_bond',
      name: 'Destined Mate Bond',
      description: 'Supernatural connection to perfect mate',
      category: 'relationship',
      subversionInstruction: 'Their supposed "mate" is completely incompatible with them, and they have to work to build an actual relationship through normal means.',
      intensity: 'dramatic'
    },
    {
      id: 'wolf_territorial',
      name: 'Territorial Behavior',
      description: 'Protective of their land and loved ones',
      category: 'personality',
      subversionInstruction: 'They are terrible with directions and constantly get lost in their own territory, having to ask for help finding familiar places.',
      intensity: 'moderate'
    },
    {
      id: 'wolf_pack_hierarchy',
      name: 'Strict Pack Hierarchy',
      description: 'Alpha, beta, omega social structure',
      category: 'setting',
      subversionInstruction: 'The pack operates like a democratic committee where everyone gets equal votes and they debate everything extensively.',
      intensity: 'dramatic'
    },
    {
      id: 'wolf_hunt_instinct',
      name: 'Predatory Hunting Instincts',
      description: 'Natural hunter with killer instincts',
      category: 'power',
      subversionInstruction: 'They are vegetarian and terrible at hunting, constantly apologizing to prey and trying to make friends with animals instead.',
      intensity: 'dramatic'
    },
    {
      id: 'wolf_savage_beast',
      name: 'Savage Beast Within',
      description: 'Struggle with animalistic nature',
      category: 'conflict',
      subversionInstruction: 'Their wolf form is actually very gentle and prefers playing fetch and getting belly rubs to anything savage.',
      intensity: 'moderate'
    },
    {
      id: 'wolf_lone_wolf',
      name: 'Lone Wolf Exile',
      description: 'Cast out from pack, surviving alone',
      category: 'conflict',
      subversionInstruction: 'They voluntarily left the pack because they found group living too stressful and prefer their alone time.',
      intensity: 'moderate'
    },
    {
      id: 'wolf_protective_rage',
      name: 'Protective Rage',
      description: 'Violent response to threats against loved ones',
      category: 'personality',
      subversionInstruction: 'When angry, they become extremely passive-aggressive and leave strongly worded notes instead of fighting.',
      intensity: 'dramatic'
    }
  ],
  subversive: [
    {
      id: 'wolf_omega_protagonist',
      name: 'Omega Pack Member Protagonist',
      description: 'Lowest ranking pack member as main character',
      category: 'personality',
      subversionInstruction: 'Celebrate their different perspective and how they solve problems through cooperation rather than dominance.',
      intensity: 'moderate'
    },
    {
      id: 'wolf_voluntary_loner',
      name: 'Voluntary Lone Wolf',
      description: 'Chooses solitude over pack life',
      category: 'relationship',
      subversionInstruction: 'They left the pack by choice because they value independence and found group dynamics exhausting.',
      intensity: 'moderate'
    },
    {
      id: 'wolf_gentle_nature',
      name: 'Gentle Giant Werewolf',
      description: 'Large, intimidating werewolf with gentle soul',
      category: 'personality',
      subversionInstruction: 'Their size intimidates others but they are actually very gentle and prefer peaceful solutions.',
      intensity: 'moderate'
    },
    {
      id: 'wolf_vegetarian',
      name: 'Vegetarian Werewolf',
      description: 'Werewolf who refuses to hunt or eat meat',
      category: 'conflict',
      subversionInstruction: 'They maintain their strength through supernatural plant-based diet and avoid hunting entirely.',
      intensity: 'dramatic'
    },
    {
      id: 'wolf_city_dweller',
      name: 'Urban Werewolf',
      description: 'Werewolf who prefers city life to wilderness',
      category: 'setting',
      subversionInstruction: 'They love city conveniences and find wilderness uncomfortable, preferring urban parks for their nature needs.',
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
      subversionInstruction: 'The fairy is relatively young for their kind and constantly has to look things up or ask for advice from humans who know more.',
      intensity: 'moderate'
    },
    {
      id: 'fairy_nature_power',
      name: 'Deep Connection to Nature',
      description: 'Control over plants, animals, and natural forces',
      category: 'power',
      subversionInstruction: 'The fairy is terrible with plants and accidentally kills every houseplant they touch, preferring technology and urban environments.',
      intensity: 'dramatic'
    },
    {
      id: 'fairy_otherworldly_beauty',
      name: 'Ethereal Otherworldly Beauty',
      description: 'Impossibly beautiful in an inhuman way',
      category: 'personality',
      subversionInstruction: 'The fairy is attractive but in a completely ordinary, human way, and gets self-conscious about not being mystical enough.',
      intensity: 'moderate'
    },
    {
      id: 'fairy_time_distortion',
      name: 'Time Flows Differently',
      description: 'Fairy realm has different temporal rules',
      category: 'power',
      subversionInstruction: 'The fairy is constantly confused by human time concepts and shows up early or late to everything, carrying multiple watches.',
      intensity: 'subtle'
    },
    {
      id: 'fairy_magic_cost',
      name: 'Magic Comes with Price',
      description: 'Every spell requires significant sacrifice',
      category: 'conflict',
      subversionInstruction: 'Their magic is basically free but they still feel guilty using it and constantly overcompensate by doing extra nice things.',
      intensity: 'moderate'
    },
    {
      id: 'fairy_trickster',
      name: 'Mischievous Trickster Nature',
      description: 'Loves pranks and causing harmless chaos',
      category: 'personality',
      subversionInstruction: 'The fairy is extremely straightforward and literal, terrible at jokes, and constantly apologizes for any misunderstandings.',
      intensity: 'moderate'
    },
    {
      id: 'fairy_mortal_fascination',
      name: 'Fascinated by Mortal Life',
      description: 'Intrigued by human emotions and mortality',
      category: 'relationship',
      subversionInstruction: 'The fairy finds human life boring and misses the excitement of the fairy realm, constantly trying to make human experiences more magical.',
      intensity: 'moderate'
    },
    {
      id: 'fairy_elemental_power',
      name: 'Elemental Magic Control',
      description: 'Commands fire, water, earth, or air',
      category: 'power',
      subversionInstruction: 'Their elemental powers are really specific and useless, like only being able to make lukewarm water or slightly humid air.',
      intensity: 'dramatic'
    },
    {
      id: 'fairy_court_politics',
      name: 'Complex Fairy Court Politics',
      description: 'Intricate supernatural political systems',
      category: 'setting',
      subversionInstruction: 'Fairy court politics are like a suburban homeowners association - petty arguments about garden maintenance and noise complaints.',
      intensity: 'dramatic'
    },
    {
      id: 'fairy_mortal_corruption',
      name: 'Corrupted by Human World',
      description: 'Fairy nature changes from exposure to humanity',
      category: 'conflict',
      subversionInstruction: 'The fairy has been improved by human contact and learned valuable life skills like time management and emotional communication.',
      intensity: 'moderate'
    }
  ],
  subversive: [
    {
      id: 'fairy_tech_savvy',
      name: 'Technology-Savvy Fairy',
      description: 'Fairy who embraces modern technology',
      category: 'personality',
      subversionInstruction: 'They love technology and use it to enhance their magic, running a supernatural tech support business.',
      intensity: 'moderate'
    },
    {
      id: 'fairy_urban_dweller',
      name: 'City-Loving Fairy',
      description: 'Fairy who prefers urban environments',
      category: 'setting',
      subversionInstruction: 'They find cities more interesting than nature and work in human corporate environments.',
      intensity: 'moderate'
    },
    {
      id: 'fairy_anti_nature',
      name: 'Nature-Averse Fairy',
      description: 'Fairy who dislikes natural environments',
      category: 'conflict',
      subversionInstruction: 'They are allergic to most plants and prefer climate-controlled indoor spaces.',
      intensity: 'dramatic'
    },
    {
      id: 'fairy_powerless',
      name: 'Magically Powerless Fairy',
      description: 'Fairy born without traditional magical abilities',
      category: 'power',
      subversionInstruction: 'They compensate with human skills and technology, often outperforming magical fairies through clever solutions.',
      intensity: 'dramatic'
    },
    {
      id: 'fairy_straightforward',
      name: 'Literal and Direct Fairy',
      description: 'Fairy who speaks plainly without riddles',
      category: 'personality',
      subversionInstruction: 'They hate mysterious speaking and prefer clear, direct communication.',
      intensity: 'moderate'
    }
  ]
};

export const TROPE_DATABASE = {
  vampire: VAMPIRE_TROPES,
  werewolf: WEREWOLF_TROPES,
  fairy: FAIRY_TROPES
} as const;

export type CreatureType = keyof typeof TROPE_DATABASE;