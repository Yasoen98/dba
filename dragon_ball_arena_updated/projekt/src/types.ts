// ─── Effect Types ──────────────────────────────────────────────────────────────
export type EffectType =
    | 'none'
    | 'pierce'
    | 'stun'
    | 'weaken'
    | 'buff'
    | 'poison'
    | 'bleed'
    | 'regen'
    | 'dodging'
    | 'aoe'
    | 'heal'
    | 'healAll'
    | 'clear'
    | 'senzu'
    | 'energy'
    | 'drain';

// ─── Energy ───────────────────────────────────────────────────────────────────
export interface PlayerEnergy {
    ki: number;
    physical: number;
    special: number;
    universal: number;
}

// ─── Action Cost ──────────────────────────────────────────────────────────────
export interface ActionCost {
    ki?: number;
    physical?: number;
    special?: number;
    any?: number;
}

// ─── Technique ────────────────────────────────────────────────────────────────
export interface Technique {
    id: string;
    name: string;
    damage: number;
    effect: EffectType;
    effectDuration?: number;
    cost: ActionCost;
    cooldown: number;
    description?: string;
    iconUrl?: string;
}

// ─── Dodge ────────────────────────────────────────────────────────────────────
export interface DodgeAction {
    name: string;
    cost: ActionCost;
    cooldown: number;
    successRate: number;
    description?: string;
    iconUrl?: string;
}

// ─── Passive System ───────────────────────────────────────────────────────────
export type PassiveId =
    // T1
    | 'teamwork'            // Krillin:  DEF +10% per alive ally
    | 'wolf_spirit'         // Yamcha:   ATK +20% when HP < 50%
    | 'city_defender'       // Videl:    +15% dmg to weakened enemies
    | 'death_grip'          // Saibaman: ATK +30% when HP < 30%
    | 'low_class_fury'      // Raditz:   ATK +5% per round elapsed (max 5 stacks)
    | 'brute_force'         // Dodoria:  ignores 25% of target DEF
    | 'mental_fortress'     // Guldo:    immune to weaken
    | 'speed_demon'         // Burter:   dodge success rate +20%
    | 'elite_soldier'       // Jeice:    ATK +12% when any ally alive
    | 'iron_mother'         // Chi-Chi:  ATK +15% per KO'd ally (max 2 stacks)
    | 'battle_frenzy'       // Launch:   ATK +8% per hit received (max 3 stacks)
    | 'psychic_dominance'   // Gen.Blue: stun effects last +1 extra turn
    | 'first_strike'        // Tao:      first technique per turn deals +20% damage
    | 'survivor_instinct'   // Cui:      ATK +25% when HP < 40%
    | 'opportunist'         // Yajirobe: +15% dmg when target has any negative status
    | 'water_discipline'    // Nam:      immune to bleed
    | 'pain_immunity'       // Spopovich:incoming damage -15%
    | 'gravity_mastery'     // Pui Pui:  DEF +20% when HP > 60%
    | 'putrid_aura'         // Bacterian:bleed effects applied by this char last +1 turn
    // T2
    | 'namekian_body'       // Piccolo:  start battle with +1 special energy
    | 'infinite_energy'     // Android18:+1 universal energy per round
    | 'tri_form'            // Tien:     ATK +20% when at full HP
    | 'saiyan_armor'        // Nappa:    incoming damage -12%
    | 'sleeping_warrior'    // Gohan:    ATK +15% per KO'd ally
    | 'future_warrior'      // Trunks:   ATK +18% when HP < 50%
    | 'iron_will'           // Android16:immune to bleed and poison
    | 'android_link'        // Android17:+1 physical energy per round
    | 'monster_transform'   // Zarbon:   drain attacks +25% damage
    | 'battle_pose'         // Recoome:  ATK +20% for 1 turn after dodging
    | 'fathers_prophecy'    // Bardock:  first lethal hit leaves at 1 HP instead
    | 'demon_curse'         // Dabra:    stun effects last +1 extra turn
    // T3
    | 'saiyan_instinct'     // Goku SS:  dodge success rate +20%
    | 'saiyan_pride'        // Vegeta SS:ATK +25% when HP < 35%
    | 'immortal_body'       // Frieza:   immune to stun
    | 'perfect_adaptation'  // Cell:     DEF +7% per hit taken (max 3 stacks)
    | 'legendary_power'     // Broly:    ATK +5% per hit received (max 3 stacks)
    | 'tyrant_pressure'     // Cooler:   +20% dmg to poisoned or weakened enemies
    | 'rubbery_body'        // Majin Buu:incoming damage -20%
    | 'force_captain'       // Ginyu:    ATK +20% when any ally alive
    | 'fusion_power'        // Gogeta:   all techniques +12% damage
    | 'potara_mastery'      // Vegito:   immune to stun + ATK +10% when HP > 70%
    | 'ghost_army';         // Gotenks:  AOE attacks deal +20% bonus damage

// ─── Character ────────────────────────────────────────────────────────────────
export interface Character {
    id: string;
    name: string;
    tier: 1 | 2 | 3;
    portraitUrl?: string;
    imageColor: string;
    maxHp: number;
    stats: {
        attack: number;
        defense: number;
    };
    techniques: Technique[];
    dodge: DodgeAction;
    passive?: { id: PassiveId; description: string };
}

// ─── Draft Constants ──────────────────────────────────────────────────────────
export const DRAFT_TIER_LIMIT = 6;        // Total tier budget for a 3v3 team
export const DRAFT_MAX_LEGENDARY = 1;     // Max tier-3 characters per team

// ─── Battle Constants ─────────────────────────────────────────────────────────
export const ENERGY_TYPE_CAP = 5;         // Max of each individual energy type

// ─── Battle Character ─────────────────────────────────────────────────────────
export interface BattleCharacter extends Character {
    currentHp: number;
    cooldowns: Record<string, number>;
    statusEffects: { effect: EffectType; duration: number }[];
    passiveStacks?: number; // multi-purpose: legendary_power rage stacks, low_class_fury rounds, battle_pose flag, fathers_prophecy used-flag, perfect_adaptation def stacks
}

// ─── Rank Thresholds ──────────────────────────────────────────────────────────
export const RANK_THRESHOLDS: { threshold: number; rank: string }[] = [
    { threshold: 1000, rank: 'Super Saiyan God' },
    { threshold: 500, rank: 'Super Saiyan' },
    { threshold: 250, rank: 'Elite Warrior' },
    { threshold: 100, rank: 'Raditz' },
    { threshold: 0, rank: 'Saibaman' },
];

// ─── Combat Log ───────────────────────────────────────────────────────────────
export interface CombatLogEntry {
    id: number;
    turn: number;
    playerName: string;
    characterName: string;
    action: string;
    details: string;
    isOpponent: boolean;
}
