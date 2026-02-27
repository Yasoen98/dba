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
}

// ─── Draft Constants ──────────────────────────────────────────────────────────
export const DRAFT_TIER_LIMIT = 6;        // Total tier budget for a 3v3 team
export const DRAFT_MAX_LEGENDARY = 1;     // Max tier-3 characters per team

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
