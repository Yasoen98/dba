import type { StateCreator } from 'zustand';
import type { RootState } from './rootStore';
import type { Character } from '../types';
import { DRAFT_TIER_LIMIT, DRAFT_MAX_LEGENDARY } from '../types';
import { INITIAL_CHARACTERS } from '../data/characters';
import type { BattleCharacter } from './battleSlice';

export interface DraftSlice {
    playerRoster: BattleCharacter[];
    opponentRoster: BattleCharacter[];
    availableCharacters: Character[];
    draftTurn: 'player' | 'opponent';
    draftTierUsed: number;      // sum of tiers of player's picked characters
    opponentTierUsed: number;   // sum of tiers of opponent's picked characters

    startDraft: () => void;
    draftCharacter: (characterId: string) => void;
    botDraftPick: () => void;
}

function toBattleCharacter(char: Character): BattleCharacter {
    return { ...char, currentHp: char.maxHp, cooldowns: {}, statusEffects: [] };
}

/**
 * Smart bot draft logic:
 * - Tries to build a balanced team: one high-damage, one tank, one utility/stun character
 * - Respects the tier limit AND ensures enough budget remains for future picks
 * - Counters player picks if possible
 */
function countTier3(roster: BattleCharacter[]) {
    return roster.filter(c => c.tier === 3).length;
}

function chooseBotCharacter(
    available: Character[],
    opponentRoster: BattleCharacter[],
    playerRoster: BattleCharacter[],
    tierUsed: number,
): Character | null {
    const remainingTierBudget = DRAFT_TIER_LIMIT - tierUsed;
    const picksLeft = 3 - opponentRoster.length; // how many more picks the bot needs
    const pickCount = opponentRoster.length;

    // start by filtering based on tier budget and future picks
    const minReserve = Math.max(0, picksLeft - 1);
    let affordable = available.filter(c => c.tier <= remainingTierBudget - minReserve);

    // enforce legendary limit: if bot already has one, remove other tier3s from consideration
    if (countTier3(opponentRoster) >= DRAFT_MAX_LEGENDARY) {
        affordable = affordable.filter(c => c.tier !== 3);
    }

    if (affordable.length === 0) {
        // Fallback: just pick cheapest available within budget (and respect legendary rule)
        let cheapest = [...available]
            .filter(c => c.tier <= remainingTierBudget)
            .sort((a, b) => a.tier - b.tier);
        if (countTier3(opponentRoster) >= DRAFT_MAX_LEGENDARY) {
            cheapest = cheapest.filter(c => c.tier !== 3);
        }
        return cheapest[0] ?? null;
    }

    // Determine what role is missing
    if (pickCount === 0) {
        // First pick: highest attack character within budget (damage dealer)
        const sorted = [...affordable].sort((a, b) => b.stats.attack - a.stats.attack);
        return sorted[0];
    }

    if (pickCount === 1) {
        // Second pick: highest defense/HP character (tank)
        const sorted = [...affordable].sort((a, b) => (b.maxHp + b.stats.defense) - (a.maxHp + a.stats.defense));
        return sorted[0];
    }

    // Third pick: prefer a character with a stun technique (utility)
    const stunners = affordable.filter(c =>
        c.techniques.some(t => t.effect === 'stun')
    );
    if (stunners.length > 0) {
        // Among stunners, pick the one that counters the weakest player character
        const weakestPlayer = [...playerRoster].sort((a, b) => a.stats.defense - b.stats.defense)[0];
        if (weakestPlayer) {
            const counters = stunners.sort((a, b) => b.stats.attack - a.stats.attack);
            return counters[0];
        }
        return stunners[Math.floor(Math.random() * stunners.length)];
    }

    // Fallback: random affordable
    return affordable[Math.floor(Math.random() * affordable.length)];
}

export const createDraftSlice: StateCreator<RootState, [], [], DraftSlice> = (set, get) => ({
    playerRoster: [],
    opponentRoster: [],
    availableCharacters: [],
    draftTurn: 'player',
    draftTierUsed: 0,
    opponentTierUsed: 0,

    startDraft: () => {
        set({
            phase: 'draft',
            playerRoster: [],
            opponentRoster: [],
            availableCharacters: [...INITIAL_CHARACTERS],
            draftTurn: 'player',
            draftTierUsed: 0,
            opponentTierUsed: 0,
            winner: null,
            combatLogs: [],
        });
    },

    draftCharacter: (characterId: string) => {
        const { phase, draftTurn, availableCharacters, playerRoster, opponentRoster, draftTierUsed } = get();
        if (phase !== 'draft' || draftTurn !== 'player' || playerRoster.length >= 3) return;

        const charIndex = availableCharacters.findIndex(c => c.id === characterId);
        if (charIndex === -1) return;

        const char = availableCharacters[charIndex];

        // Enforce tier limit
        if (draftTierUsed + char.tier > DRAFT_TIER_LIMIT) return;

        // Enforce legendary count limit: only one tier‐3 allowed
        const existingLegendary = playerRoster.filter(c => c.tier === 3).length;
        if (char.tier === 3 && existingLegendary >= DRAFT_MAX_LEGENDARY) return;

        const newAvailable = [...availableCharacters];
        newAvailable.splice(charIndex, 1);

        const newRoster = [...playerRoster, toBattleCharacter(char)];
        const newTierUsed = draftTierUsed + char.tier;

        set({ playerRoster: newRoster, availableCharacters: newAvailable, draftTierUsed: newTierUsed });

        if (newRoster.length === 3 && opponentRoster.length === 3) {
            get().startBattle();
        } else {
            set({ draftTurn: 'opponent' });
            setTimeout(() => get().botDraftPick(), 800);
        }
    },

    botDraftPick: () => {
        const { phase, availableCharacters, opponentRoster, playerRoster, opponentTierUsed } = get();
        if (phase !== 'draft' || availableCharacters.length === 0 || opponentRoster.length >= 3) return;

        const chosen = chooseBotCharacter(availableCharacters, opponentRoster, playerRoster, opponentTierUsed);
        if (!chosen) return;

        const newAvailable = availableCharacters.filter(c => c.id !== chosen.id);
        const newRoster = [...opponentRoster, toBattleCharacter(chosen)];
        const newTierUsed = opponentTierUsed + chosen.tier;

        set({ opponentRoster: newRoster, availableCharacters: newAvailable, opponentTierUsed: newTierUsed });

        if (newRoster.length === 3 && playerRoster.length === 3) {
            get().startBattle();
        } else {
            set({ draftTurn: 'player' });
        }
    },
});
