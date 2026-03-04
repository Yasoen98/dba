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

export interface PlayerEnergy {
    ki: number;
    physical: number;
    special: number;
    universal: number;
}

export interface ActionCost {
    ki?: number;
    physical?: number;
    special?: number;
    any?: number;
}

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

export interface DodgeAction {
    name: string;
    cost: ActionCost;
    cooldown: number;
    successRate: number;
    description?: string;
    iconUrl?: string;
}

export type PassiveId =
    | 'teamwork'
    | 'wolf_spirit'
    | 'city_defender'
    | 'death_grip'
    | 'low_class_fury'
    | 'brute_force'
    | 'mental_fortress'
    | 'speed_demon'
    | 'elite_soldier'
    | 'iron_mother'
    | 'battle_frenzy'
    | 'psychic_dominance'
    | 'first_strike'
    | 'survivor_instinct'
    | 'opportunist'
    | 'water_discipline'
    | 'pain_immunity'
    | 'gravity_mastery'
    | 'putrid_aura'
    | 'namekian_body'
    | 'infinite_energy'
    | 'tri_form'
    | 'saiyan_armor'
    | 'sleeping_warrior'
    | 'future_warrior'
    | 'iron_will'
    | 'android_link'
    | 'monster_transform'
    | 'battle_pose'
    | 'fathers_prophecy'
    | 'demon_curse'
    | 'saiyan_instinct'
    | 'saiyan_pride'
    | 'immortal_body'
    | 'perfect_adaptation'
    | 'legendary_power'
    | 'tyrant_pressure'
    | 'rubbery_body'
    | 'force_captain'
    | 'fusion_power'
    | 'potara_mastery'
    | 'ghost_army';

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

export const DRAFT_TIER_LIMIT = 6;
export const DRAFT_MAX_LEGENDARY = 1;

export const ENERGY_TYPE_CAP = 5;

export interface BattleCharacter extends Character {
    currentHp: number;
    cooldowns: Record<string, number>;
    statusEffects: { effect: EffectType; duration: number }[];
    passiveStacks?: number;
}

export interface CombatLogEntry {
    id: number;
    turn: number;
    playerName: string;
    characterName: string;
    action: string;
    details: string;
    isOpponent: boolean;
}
