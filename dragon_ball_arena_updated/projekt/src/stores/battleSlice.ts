import type { StateCreator } from 'zustand';
import type { RootState } from './rootStore';
import type { Character, PlayerEnergy, CombatLogEntry, ActionCost, EffectType } from '../types';

export interface BattleCharacter extends Character {
    currentHp: number;
    cooldowns: Record<string, number>;
    statusEffects: { effect: EffectType; duration: number }[];
}

interface BattleSliceState {
    playerActiveIndex: number;
    opponentActiveIndex: number;
    playerEnergy: PlayerEnergy;
    opponentEnergy: PlayerEnergy;
    turnNumber: number;
    isPlayerTurn: boolean;
    combatLogs: CombatLogEntry[];
    winner: 'player' | 'opponent' | null;
    playerActionsUsed: Record<number, boolean>;
}

export interface BattleSlice extends BattleSliceState {
    setPlayerActiveIndex: (index: number) => void;
    setOpponentActiveIndex: (index: number) => void;
    startBattle: () => void;
    executePlayerAction: (actionType: 'technique' | 'dodge', actionId: string) => void;
    passTurn: () => void;
    executeOpponentTurn: () => void;
    endTurn: () => void;
    surrender: () => void;                // player can concede
}

const initialEnergy: PlayerEnergy = { ki: 0, physical: 0, special: 0, universal: 0 };

function canAffordCost(energy: PlayerEnergy, cost: ActionCost): boolean {
    const needKi = cost.ki || 0;
    const needPh = cost.physical || 0;
    const needSp = cost.special || 0;
    const needAny = cost.any || 0;

    let availKi = energy.ki;
    let availPh = energy.physical;
    let availSp = energy.special;
    let availUniversal = energy.universal || 0;

    // Try to satisfy each specific requirement, using universal as fallback
    if (availKi < needKi) {
        const shortfall = needKi - availKi;
        if (availUniversal < shortfall) return false;
        availUniversal -= shortfall;
    }
    if (availPh < needPh) {
        const shortfall = needPh - availPh;
        if (availUniversal < shortfall) return false;
        availUniversal -= shortfall;
    }
    if (availSp < needSp) {
        const shortfall = needSp - availSp;
        if (availUniversal < shortfall) return false;
        availUniversal -= shortfall;
    }

    // Check if remaining universal covers 'any' cost
    if (needAny > availUniversal) return false;

    return true;
}

function deductCost(energy: PlayerEnergy, cost: ActionCost): PlayerEnergy {
    let ki = energy.ki;
    let physical = energy.physical;
    let special = energy.special;
    let universal = energy.universal || 0;

    const needKi = cost.ki || 0;
    const needPh = cost.physical || 0;
    const needSp = cost.special || 0;
    const needAny = cost.any || 0;

    // Deduct specific energies, using universal as fallback
    if (ki < needKi) {
        const shortfall = needKi - ki;
        universal -= shortfall;
        ki = 0;
    } else {
        ki -= needKi;
    }

    if (physical < needPh) {
        const shortfall = needPh - physical;
        universal -= shortfall;
        physical = 0;
    } else {
        physical -= needPh;
    }

    if (special < needSp) {
        const shortfall = needSp - special;
        universal -= shortfall;
        special = 0;
    } else {
        special -= needSp;
    }

    // Deduct 'any' cost from universal
    universal -= needAny;

    return { ki, physical, special, universal };
}

function calcDamage(baseDamage: number, attackerAtk: number, defenderDef: number, effect: EffectType): number {
    // Apply pierce (ignore defense)
    let dmg = effect === 'pierce' ? baseDamage : Math.floor(baseDamage * (attackerAtk / defenderDef));
    return dmg;
}

function computeDamage(attacker: BattleCharacter, defender: BattleCharacter, baseDamage: number, effect: EffectType): number {
    let dmg = calcDamage(baseDamage, attacker.stats.attack, defender.stats.defense, effect);
    // Check for senzu/buff on attacker
    if (attacker.statusEffects.some(se => se.effect === 'senzu' || se.effect === 'buff')) {
        dmg = Math.floor(dmg * 1.15);
    }
    return dmg;
}

function isStunned(char: BattleCharacter): boolean {
    return char.statusEffects.some(e => e.effect === 'stun');
}

// Calculate points delta for the player when a battle ends.
// Rewards surviving player characters and gives bonus for how many opponents were defeated.
// If the player loses, returns a negative value (penalty) that scales with how many opponents remain alive.
function calculateBattlePoints(playerRoster: BattleCharacter[], opponentRoster: BattleCharacter[], winner: 'player'|'opponent'): number {
    const playerAlive = playerRoster.filter(c => c.currentHp > 0).length;
    const opponentAlive = opponentRoster.filter(c => c.currentHp > 0).length;
    const killedOpponents = opponentRoster.length - opponentAlive;

    if (winner === 'player') {
        const baseWin = 50;
        const surviveBonus = playerAlive * 30; // reward living characters
        const mopUpBonus = killedOpponents * 20; // bonus for how many enemies you defeated
        return baseWin + surviveBonus + mopUpBonus;
    } else {
        // Player lost: penalize more when opponent has more survivors;
        // still give small consolation for enemies you managed to take down.
        const basePenalty = 40;
        const opponentSurvivePenalty = opponentAlive * 30;
        const consolation = killedOpponents * 10;
        return -(basePenalty + opponentSurvivePenalty) + consolation;
    }
}

function isDodging(char: BattleCharacter): boolean {
    return char.statusEffects.some(e => e.effect === 'dodging');
}

function decrementEffects(char: BattleCharacter): BattleCharacter {
    let updated = { ...char };
    const appliedEffects: typeof char.statusEffects = [];

    // Apply per-turn effects before decrementing durations
    for (const e of char.statusEffects) {
        if (e.effect === 'poison') {
            const dmg = Math.max(1, Math.floor(char.maxHp * 0.05));
            updated = { ...updated, currentHp: Math.max(0, updated.currentHp - dmg) };
        } else if (e.effect === 'bleed') {
            const dmg = Math.max(1, Math.floor(char.maxHp * 0.07));
            updated = { ...updated, currentHp: Math.max(0, updated.currentHp - dmg) };
        } else if (e.effect === 'regen') {
            const heal = Math.max(1, Math.floor(char.maxHp * 0.06));
            updated = { ...updated, currentHp: Math.min(updated.maxHp, updated.currentHp + heal) };
        }
        // keep effect for duration decrement pass
        appliedEffects.push({ ...e });
    }

    const newEffects = appliedEffects
        .map(e => ({ ...e, duration: e.duration - 1 }))
        .filter(e => e.duration > 0);

    return { ...updated, statusEffects: newEffects };
}

function decrementCooldowns(char: BattleCharacter): BattleCharacter {
    const newCooldowns: Record<string, number> = {};
    for (const [k, v] of Object.entries(char.cooldowns)) {
        if (v > 0) newCooldowns[k] = v - 1;
    }
    return { ...char, cooldowns: newCooldowns };
}

function grantEnergy(energy: PlayerEnergy, aliveCount: number): PlayerEnergy {
    const newEnergy = { ...energy };
    let total = newEnergy.ki + newEnergy.physical + newEnergy.special + newEnergy.universal;
    for (let i = 0; i < aliveCount; i++) {
        if (total >= 10) break;
        // Weighted distribution: ki 35%, physical 30%, special 25%, universal 10%
        const roll = Math.random();
        if (roll < 0.35) newEnergy.ki++;
        else if (roll < 0.65) newEnergy.physical++;
        else if (roll < 0.90) newEnergy.special++;
        else newEnergy.universal++;
        total++;
    }
    return newEnergy;
}

/**
 * Improved bot AI for battle:
 * - Targets the player's character with the lowest HP
 * - Prefers high-damage techniques
 * - Uses pierce against low-HP targets
 * - Uses stun when player has high HP (to delay)
 * - Avoids wasting energy on pass when it can act
 */
function chooseBotAction(
    botChar: BattleCharacter,
    playerChar: BattleCharacter,
    energy: PlayerEnergy,
): { type: 'technique' | 'pass'; techId?: string } {
    // Check if stunned — must pass
    if (isStunned(botChar)) {
        return { type: 'pass' };
    }

    const affordable = botChar.techniques.filter(t => {
        const cd = botChar.cooldowns[t.id] || 0;
        return cd === 0 && canAffordCost(energy, t.cost);
    });

    if (affordable.length === 0) return { type: 'pass' };

    const playerHpPercent = playerChar.currentHp / playerChar.maxHp;

    // If player is low HP, prefer pierce to finish them off
    if (playerHpPercent < 0.3) {
        const piercing = affordable.filter(t => t.effect === 'pierce');
        if (piercing.length > 0) {
            const best = piercing.sort((a, b) => b.damage - a.damage)[0];
            return { type: 'technique', techId: best.id };
        }
    }

    // If player is high HP, prefer stun to delay
    if (playerHpPercent > 0.7) {
        const stunners = affordable.filter(t => t.effect === 'stun');
        if (stunners.length > 0) {
            return { type: 'technique', techId: stunners[0].id };
        }
    }

    // Otherwise pick highest damage available
    const best = affordable.sort((a, b) => b.damage - a.damage)[0];
    return { type: 'technique', techId: best.id };
}

export const createBattleSlice: StateCreator<RootState, [], [], BattleSlice> = (set, get) => ({
    playerActiveIndex: 0,
    opponentActiveIndex: 0,
    playerEnergy: { ...initialEnergy },
    opponentEnergy: { ...initialEnergy },
    turnNumber: 1,
    isPlayerTurn: true,
    combatLogs: [],
    winner: null,
    playerActionsUsed: {},

    setPlayerActiveIndex: (index: number) => {
        const state = get();
        if (state.phase === 'battle' && state.playerRoster[index]?.currentHp > 0) {
            set({ playerActiveIndex: index });
        }
    },

    setOpponentActiveIndex: (index: number) => {
        const state = get();
        if (state.phase === 'battle' && state.opponentRoster[index]?.currentHp > 0) {
            set({ opponentActiveIndex: index });
        }
    },

    startBattle: () => {
        const types = ['ki', 'physical', 'special', 'universal'] as const;
        const pe = { ...initialEnergy };
        const oe = { ...initialEnergy };
        for (let i = 0; i < 3; i++) {
            pe[types[Math.floor(Math.random() * 4)]]++;
            oe[types[Math.floor(Math.random() * 4)]]++;
        }

        set({
            phase: 'battle',
            playerActiveIndex: 0,
            opponentActiveIndex: 0,
            playerEnergy: pe,
            opponentEnergy: oe,
            turnNumber: 1,
            isPlayerTurn: true,
            combatLogs: [{
                id: Date.now(),
                turn: 1,
                playerName: 'System',
                characterName: '',
                action: 'Battle Start',
                details: 'The battle begins! Choose your actions wisely.',
                isOpponent: false,
            }],
            playerActionsUsed: {},
        });
    },

    executePlayerAction: (actionType, actionId) => {
        const state = get();
        if (!state.isPlayerTurn || state.phase !== 'battle' || state.winner) return;

        const activeChar = state.playerRoster[state.playerActiveIndex];
        const oppChar = state.opponentRoster[state.opponentActiveIndex];

        // Check if player's character is stunned
        if (isStunned(activeChar)) {
            const stunnedLog: CombatLogEntry = {
                id: Date.now(),
                turn: state.turnNumber,
                playerName: 'Player',
                characterName: activeChar.name,
                action: 'Stunned',
                details: `${activeChar.name} is stunned and cannot act!`,
                isOpponent: false,
            };
            set({ combatLogs: [stunnedLog, ...state.combatLogs], playerActionsUsed: { ...state.playerActionsUsed, [state.playerActiveIndex]: true } });
            return;
        }

        // Prevent multiple actions by same character in one round
        if (state.playerActionsUsed[state.playerActiveIndex]) return;

        let energyCost: ActionCost = {};
        let actionName = '';
        let damage = 0;
        let effect: EffectType = 'none';
        let cooldown = 0;
        let effectDuration = 1;

        if (actionType === 'technique') {
            const tech = activeChar.techniques.find(t => t.id === actionId);
            if (!tech) return;
            if ((activeChar.cooldowns[tech.id] || 0) > 0) return;

            energyCost = tech.cost;
            actionName = tech.name;
            damage = tech.damage;
            effect = tech.effect;
            cooldown = tech.cooldown;
            effectDuration = tech.effectDuration ?? 1;
        } else if (actionType === 'dodge') {
            if (activeChar.dodge.name !== actionId) return;
            if ((activeChar.cooldowns['dodge'] || 0) > 0) return;

            energyCost = activeChar.dodge.cost;
            actionName = activeChar.dodge.name;
            cooldown = activeChar.dodge.cooldown;
        }

        if (!canAffordCost(state.playerEnergy, energyCost)) return;

        let pe = deductCost(state.playerEnergy, energyCost);

        // Apply cooldown to active character
        const newPlayerRoster = state.playerRoster.map((c, i) => {
            if (i !== state.playerActiveIndex) return c;
            const cdKey = actionType === 'dodge' ? 'dodge' : actionId;
            return { ...c, cooldowns: { ...c.cooldowns, [cdKey]: cooldown } };
        });

        let newOppRoster = [...state.opponentRoster];
        let newOppChar = { ...oppChar };
        let logDetail = `${activeChar.name} used ${actionName}.`;

        if (actionType === 'technique') {
            // AoE: apply to all opponents
            if (effect === 'aoe') {
                let totalDeals = 0;
                newOppRoster = newOppRoster.map((tar) => {
                    if (tar.currentHp <= 0) return tar;
                    const actualDamage = computeDamage(newPlayerRoster[state.playerActiveIndex], tar, damage, 'none');
                    const newHp = Math.max(0, tar.currentHp - actualDamage);
                    totalDeals += actualDamage;
                    return { ...tar, currentHp: newHp };
                });
                logDetail += ` Deals ${totalDeals} total damage to all opponents!`;
            } else if (effect === 'heal') {
                // heal target (self or ally) — here heal active player char
                const healAmt = Math.max(1, Math.floor(newPlayerRoster[state.playerActiveIndex].maxHp * 0.25));
                newPlayerRoster[state.playerActiveIndex] = { ...newPlayerRoster[state.playerActiveIndex], currentHp: Math.min(newPlayerRoster[state.playerActiveIndex].maxHp, newPlayerRoster[state.playerActiveIndex].currentHp + healAmt) };
                logDetail += ` Heals ${newPlayerRoster[state.playerActiveIndex].name} for ${healAmt} HP.`;
            } else if (effect === 'healAll') {
                newPlayerRoster.forEach((pc, idx) => {
                    if (pc.currentHp <= 0) return;
                    const healAmt = Math.max(1, Math.floor(pc.maxHp * 0.20));
                    newPlayerRoster[idx] = { ...pc, currentHp: Math.min(pc.maxHp, pc.currentHp + healAmt) };
                });
                logDetail += ` Heals all allies.`;
            } else if (effect === 'clear') {
                // remove negative effects from opponent target
                newOppChar.statusEffects = newOppChar.statusEffects.filter(se => !['poison','bleed','weaken','stun'].includes(se.effect));
                logDetail += ` Cleared negative effects on ${newOppChar.name}.`;
            } else if (effect === 'senzu') {
                // grant damage buff to self
                newPlayerRoster[state.playerActiveIndex] = { ...newPlayerRoster[state.playerActiveIndex], statusEffects: [...newPlayerRoster[state.playerActiveIndex].statusEffects, { effect: 'senzu', duration: effectDuration }] };
                logDetail += ` ${newPlayerRoster[state.playerActiveIndex].name} gains a damage boost.`;
            } else if (effect === 'energy') {
                // small energy boost to player
                pe = { ...pe, universal: (pe.universal || 0) + 2 };
                logDetail += ` Grants energy boost.`;
            } else if (effect === 'drain') {
                const actualDamage = computeDamage(newPlayerRoster[state.playerActiveIndex], newOppChar, damage, 'none');
                newOppChar.currentHp = Math.max(0, newOppChar.currentHp - actualDamage);
                // heal attacker for portion
                const heal = Math.floor(actualDamage * 0.5);
                newPlayerRoster[state.playerActiveIndex] = { ...newPlayerRoster[state.playerActiveIndex], currentHp: Math.min(newPlayerRoster[state.playerActiveIndex].maxHp, newPlayerRoster[state.playerActiveIndex].currentHp + heal) };
                logDetail += ` Deals ${actualDamage} damage and drains ${heal} HP.`;
            } else {
                // default: single-target damage and possible status effects
                const actualDamage = computeDamage(newPlayerRoster[state.playerActiveIndex], newOppChar, damage, effect);
                newOppChar.currentHp = Math.max(0, newOppChar.currentHp - actualDamage);
                logDetail += ` Deals ${actualDamage} damage!`;

                if (['weaken','stun','poison','bleed','regen'].includes(effect)) {
                    newOppChar.statusEffects = [
                        ...newOppChar.statusEffects,
                        { effect, duration: effectDuration },
                    ];
                    logDetail += effect === 'stun'
                        ? ` ${newOppChar.name} is STUNNED for ${effectDuration} turn(s)!`
                        : effect === 'weaken'
                            ? ` ${newOppChar.name} is weakened!`
                            : effect === 'poison'
                                ? ` ${newOppChar.name} is POISONED!`
                                : effect === 'bleed'
                                    ? ` ${newOppChar.name} is BLEEDING!`
                                    : effect === 'regen'
                                        ? ` ${newOppChar.name} will regenerate HP.`
                                        : '';
                }
            }
        } else {
            // Dodge: mark character as actively dodging
            logDetail += ` ${activeChar.name} prepares to dodge!`;
            newPlayerRoster[state.playerActiveIndex] = {
                ...newPlayerRoster[state.playerActiveIndex],
                statusEffects: [
                    ...newPlayerRoster[state.playerActiveIndex].statusEffects,
                    { effect: 'dodging', duration: 1 },
                ],
            };
        }

        newOppRoster[state.opponentActiveIndex] = newOppChar;

        const newLog: CombatLogEntry = {
            id: Date.now(),
            turn: state.turnNumber,
            playerName: 'Player',
            characterName: activeChar.name,
            action: actionName,
            details: logDetail,
            isOpponent: false,
        };

        set({
            playerEnergy: pe,
            playerRoster: newPlayerRoster,
            opponentRoster: newOppRoster,
            combatLogs: [newLog, ...state.combatLogs],
            playerActionsUsed: { ...state.playerActionsUsed, [state.playerActiveIndex]: true },
        });

        // Check opponent defeat
        if (newOppChar.currentHp <= 0) {
            const nextOppIndex = newOppRoster.findIndex(c => c.currentHp > 0);
            if (nextOppIndex === -1) {
                set({ winner: 'player', phase: 'gameOver' });
                // calculate points based on surviving characters and defeated opponents
                const pts = calculateBattlePoints(state.playerRoster, newOppRoster, 'player');
                get().addScore(pts);
                return;
            } else {
                set({ opponentActiveIndex: nextOppIndex });
                set((s) => ({
                    combatLogs: [{
                        id: Date.now() + 1,
                        turn: s.turnNumber,
                        playerName: 'System',
                        characterName: '',
                        action: 'Fallen',
                        details: `${newOppChar.name} was defeated! ${newOppRoster[nextOppIndex].name} enters the battle!`,
                        isOpponent: true,
                    }, ...s.combatLogs],
                }));
            }
        }

        // do not auto-end the whole round: player may act with other characters
    },

    passTurn: () => {
        const state = get();
        if (!state.isPlayerTurn || state.phase !== 'battle' || state.winner) return;

        // Mark ALL remaining characters (alive and haven't acted) as passed
        const updatedActionsUsed = { ...state.playerActionsUsed };
        const newLogs: CombatLogEntry[] = [];
        
        state.playerRoster.forEach((char, index) => {
            // Only pass characters that are alive and haven't acted yet
            if (char.currentHp > 0 && !updatedActionsUsed[index]) {
                updatedActionsUsed[index] = true;
                newLogs.push({
                    id: Date.now() + index,
                    turn: state.turnNumber,
                    playerName: 'Player',
                    characterName: char.name,
                    action: 'Passed Turn',
                    details: `${char.name} conserved energy and passed their turn.`,
                    isOpponent: false,
                });
            }
        });

        // Update state with all characters passed and all new logs
        set({
            combatLogs: [...newLogs, ...state.combatLogs],
            playerActionsUsed: updatedActionsUsed,
        });

        // Immediately end the round since all characters have now acted/passed
        get().endTurn();
    },

    executeOpponentTurn: () => {
        const state = get();
        if (state.winner || state.phase !== 'battle') return;

        const botChar = state.opponentRoster[state.opponentActiveIndex];
        const playerChar = state.playerRoster[state.playerActiveIndex];
        let oe = { ...state.opponentEnergy };

        const decision = chooseBotAction(botChar, playerChar, oe);

        const newOppRoster = [...state.opponentRoster];
        const newPlayerRoster = [...state.playerRoster];
        let updatedPlayerChar = { ...playerChar };
        let actionName = 'Passed';
        let logDetail = `${botChar.name} ended their turn.`;

        if (decision.type === 'pass') {
            if (isStunned(botChar)) {
                logDetail = `${botChar.name} is stunned and cannot act!`;
                actionName = 'Stunned';
            }
        } else if (decision.type === 'technique' && decision.techId) {
            const action = botChar.techniques.find(t => t.id === decision.techId)!;
            oe = deductCost(oe, action.cost);

            newOppRoster[state.opponentActiveIndex] = {
                ...botChar,
                cooldowns: { ...botChar.cooldowns, [action.id]: action.cooldown },
            };

            actionName = action.name;

            // Check if player is dodging
            if (isDodging(updatedPlayerChar) && Math.random() < updatedPlayerChar.dodge.successRate) {
                logDetail = `${botChar.name} used ${actionName} but ${updatedPlayerChar.name} dodged it!`;
                // Remove dodge status after use
                updatedPlayerChar = {
                    ...updatedPlayerChar,
                    statusEffects: updatedPlayerChar.statusEffects.filter(e => e.effect !== 'dodging'),
                };
            } else {
                // Handle various effects: damage, poison/bleed/regeneration, heal, drain
                if (action.effect === 'heal') {
                    // heal self
                    const healAmt = Math.max(1, Math.floor(botChar.maxHp * 0.25));
                    newOppRoster[state.opponentActiveIndex] = { ...botChar, currentHp: Math.min(botChar.maxHp, botChar.currentHp + healAmt) };
                    logDetail = `${botChar.name} used ${actionName}. Heals for ${healAmt} HP!`;
                } else if (action.effect === 'drain') {
                    const actualDamage = computeDamage(botChar, updatedPlayerChar, action.damage, 'none');
                    updatedPlayerChar.currentHp = Math.max(0, updatedPlayerChar.currentHp - actualDamage);
                    const heal = Math.floor(actualDamage * 0.5);
                    newOppRoster[state.opponentActiveIndex] = { ...botChar, currentHp: Math.min(botChar.maxHp, botChar.currentHp + heal) };
                    logDetail = `${botChar.name} used ${actionName}. Deals ${actualDamage} damage and drains ${heal} HP!`;
                } else {
                    const actualDamage = computeDamage(botChar, updatedPlayerChar, action.damage, action.effect);
                    updatedPlayerChar.currentHp = Math.max(0, updatedPlayerChar.currentHp - actualDamage);
                    logDetail = `${botChar.name} used ${actionName}. Deals ${actualDamage} damage!`;

                    if (['stun','weaken','poison','bleed','regen','senzu'].includes(action.effect)) {
                        const dur = action.effectDuration ?? 1;
                        updatedPlayerChar.statusEffects = [
                            ...updatedPlayerChar.statusEffects,
                            { effect: action.effect as EffectType, duration: dur },
                        ];
                        logDetail += action.effect === 'stun'
                            ? ` ${updatedPlayerChar.name} is STUNNED for ${dur} turn(s)!`
                            : action.effect === 'weaken'
                                ? ` ${updatedPlayerChar.name} is weakened!`
                                : action.effect === 'poison'
                                    ? ` ${updatedPlayerChar.name} is POISONED!`
                                    : action.effect === 'bleed'
                                        ? ` ${updatedPlayerChar.name} is BLEEDING!`
                                        : action.effect === 'regen'
                                            ? ` ${updatedPlayerChar.name} will regenerate HP.`
                                            : ` ${updatedPlayerChar.name} affected.`;
                    }
                }
            }
        }

        newPlayerRoster[state.playerActiveIndex] = updatedPlayerChar;

        const newLog: CombatLogEntry = {
            id: Date.now(),
            turn: state.turnNumber,
            playerName: 'Opponent',
            characterName: botChar.name,
            action: actionName,
            details: logDetail,
            isOpponent: true,
        };

        set({
            opponentEnergy: oe,
            opponentRoster: newOppRoster,
            playerRoster: newPlayerRoster,
            combatLogs: [newLog, ...state.combatLogs],
        });

        // Check player defeat
        if (updatedPlayerChar.currentHp <= 0) {
            const nextPlayerIndex = newPlayerRoster.findIndex(c => c.currentHp > 0);
            if (nextPlayerIndex === -1) {
                set({ winner: 'opponent', phase: 'gameOver' });
                const pts = calculateBattlePoints(newPlayerRoster, state.opponentRoster, 'opponent');
                get().addScore(pts);
                return;
            } else {
                set({ playerActiveIndex: nextPlayerIndex });
                set((s) => ({
                    combatLogs: [{
                        id: Date.now() + 1,
                        turn: s.turnNumber,
                        playerName: 'System',
                        characterName: '',
                        action: 'Fallen',
                        details: `${updatedPlayerChar.name} was defeated! ${newPlayerRoster[nextPlayerIndex].name} enters the battle!`,
                        isOpponent: false,
                    }, ...s.combatLogs],
                }));
            }
        }

        get().endTurn();
    },

    surrender: () => {
        const s = get();
        if (s.phase !== 'battle' || s.winner) return;

        const log: CombatLogEntry = {
            id: Date.now(),
            turn: s.turnNumber,
            playerName: 'Player',
            characterName: '',
            action: 'Surrender',
            details: `${s.playerRoster[s.playerActiveIndex]?.name || 'Player'} has surrendered!`,
            isOpponent: false,
        };

        set({
            winner: 'opponent',
            phase: 'gameOver',
            combatLogs: [log, ...s.combatLogs],
        });
        // apply penalty for surrender based on current rosters
        const pts = calculateBattlePoints(s.playerRoster, s.opponentRoster, 'opponent');
        get().addScore(pts);
    },

    endTurn: () => {
        const s = get();
        if (s.winner) return;

        if (!s.isPlayerTurn) {
            // End of full round — both players acted
            // Decrement effects and cooldowns for ALL characters each round
            let pRoster = s.playerRoster.map((c) => decrementCooldowns(decrementEffects(c)));
            let oRoster = s.opponentRoster.map((c) => decrementCooldowns(decrementEffects(c)));

            const pAlive = pRoster.filter(c => c.currentHp > 0).length;
            const oAlive = oRoster.filter(c => c.currentHp > 0).length;

            const pe = grantEnergy(s.playerEnergy, pAlive);
            const oe = grantEnergy(s.opponentEnergy, oAlive);

            set({
                playerRoster: pRoster,
                opponentRoster: oRoster,
                playerEnergy: pe,
                opponentEnergy: oe,
                turnNumber: s.turnNumber + 1,
                isPlayerTurn: true,
                playerActionsUsed: {},
            });
        } else {
            // Player just acted — now it's bot's turn
            set({ isPlayerTurn: false });
            setTimeout(() => get().executeOpponentTurn(), 1000);
        }
    },
});
