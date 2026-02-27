export type EnergyType = 'ki' | 'physical' | 'special' | 'universal';

export type EffectType =
  | 'stun'
  | 'weaken'
  | 'buff'
  | 'pierce'
  | 'dodging'
  | 'poison'
  | 'bleed'
  | 'regen'
  | 'heal'
  | 'healAll'
  | 'clear'
  | 'senzu'
  | 'energy'
  | 'drain'
  | 'aoe'
  | 'none';

export type CharacterTier = 1 | 2 | 3;

export interface ActionCost {
  ki?: number;
  physical?: number;
  special?: number;
  any?: number;
}

export interface Technique {
  id: string;
  name: string;
  cost: ActionCost;
  damage: number;
  cooldown: number;
  effect: EffectType;
  effectDuration?: number; // how many turns the effect lasts (default: 1)
  description: string;
  iconUrl?: string;
}

export interface Dodge {
  name: string;
  successRate: number; // 0 to 1
  cost: ActionCost;
  cooldown: number;
  description: string;
  iconUrl?: string;
}

export interface CharacterStats {
  attack: number;
  defense: number;
  speed: number;
}

export interface Character {
  id: string;
  name: string;
  tier: CharacterTier; // 1 = common, 2 = elite, 3 = legendary
  maxHp: number;
  stats: CharacterStats;
  techniques: [Technique, Technique, Technique];
  dodge: Dodge;
  imageColor: string;
  portraitUrl: string;
}

export interface PlayerEnergy {
  ki: number;
  physical: number;
  special: number;
  universal: number;
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

// Draft tier constraint: sum of tiers in a team cannot exceed this value
export const DRAFT_TIER_LIMIT = 6;

// Draft rule: at most one legendary (tier 3) character per roster
export const DRAFT_MAX_LEGENDARY = 1;
