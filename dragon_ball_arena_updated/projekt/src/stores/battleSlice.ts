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
    lastBattlePoints: number; // FIX #2: trzyma realne punkty do wyświetlenia na GameOverScreen
}

export interface BattleSlice extends BattleSliceState {
    setPlayerActiveIndex: (index: number) => void;
    setOpponentActiveIndex: (index: number) => void;
    startBattle: () => void;
    executePlayerAction: (actionType: 'technique' | 'dodge', actionId: string) => void;
    passTurn: () => void;
    executeOpponentTurn: () => void;
    endTurn: () => void;
    surrender: () => void;
}

const initialEnergy: PlayerEnergy = { ki: 0, physical: 0, special: 0, universal: 0 };

// ─── Energy helpers ────────────────────────────────────────────────────────────

function canAffordCost(energy: PlayerEnergy, cost: ActionCost): boolean {
    const needKi = cost.ki || 0;
    const needPh = cost.physical || 0;
    const needSp = cost.special || 0;
    const needAny = cost.any || 0;

    let availKi = energy.ki;
    let availPh = energy.physical;
    let availSp = energy.special;
    let availUniversal = energy.universal || 0;

    // First, fulfill specific energy requirements using universal as fallback
    if (availKi < needKi) {
        const shortfall = needKi - availKi;
        if (availUniversal < shortfall) return false;
        availUniversal -= shortfall;
        availKi = 0;
    } else {
        availKi -= needKi;
    }
    if (availPh < needPh) {
        const shortfall = needPh - availPh;
        if (availUniversal < shortfall) return false;
        availUniversal -= shortfall;
        availPh = 0;
    } else {
        availPh -= needPh;
    }
    if (availSp < needSp) {
        const shortfall = needSp - availSp;
        if (availUniversal < shortfall) return false;
        availUniversal -= shortfall;
        availSp = 0;
    } else {
        availSp -= needSp;
    }

    // For `any` cost, check if we have enough from remaining energies (any type)
    const availableForAny = availKi + availPh + availSp + availUniversal;
    if (availableForAny < needAny) return false;

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

    // Deduct specific energies first
    if (ki < needKi) {
        universal -= (needKi - ki);
        ki = 0;
    } else {
        ki -= needKi;
    }
    if (physical < needPh) {
        universal -= (needPh - physical);
        physical = 0;
    } else {
        physical -= needPh;
    }
    if (special < needSp) {
        universal -= (needSp - special);
        special = 0;
    } else {
        special -= needSp;
    }

    // For `any` cost, use any available energy in order: ki, physical, special, universal
    let remainingAny = needAny;
    if (remainingAny > 0 && ki > 0) {
        const use = Math.min(remainingAny, ki);
        ki -= use;
        remainingAny -= use;
    }
    if (remainingAny > 0 && physical > 0) {
        const use = Math.min(remainingAny, physical);
        physical -= use;
        remainingAny -= use;
    }
    if (remainingAny > 0 && special > 0) {
        const use = Math.min(remainingAny, special);
        special -= use;
        remainingAny -= use;
    }
    if (remainingAny > 0) {
        universal -= remainingAny;
    }

    return { ki, physical, special, universal };
}

// ─── Damage calculation ────────────────────────────────────────────────────────

function calcDamage(baseDamage: number, attackerAtk: number, defenderDef: number, effect: EffectType): number {
    return effect === 'pierce' ? baseDamage : Math.floor(baseDamage * (attackerAtk / defenderDef));
}

function computeDamage(attacker: BattleCharacter, defender: BattleCharacter, baseDamage: number, effect: EffectType): number {
    let dmg = calcDamage(baseDamage, attacker.stats.attack, defender.stats.defense, effect);
    if (attacker.statusEffects.some(se => se.effect === 'senzu' || se.effect === 'buff')) {
        dmg = Math.floor(dmg * 1.15);
    }
    return dmg;
}

// ─── Status helpers ────────────────────────────────────────────────────────────

function isStunned(char: BattleCharacter): boolean {
    return char.statusEffects.some(e => e.effect === 'stun');
}

function isDodging(char: BattleCharacter): boolean {
    return char.statusEffects.some(e => e.effect === 'dodging');
}

// ─── Points calculation ────────────────────────────────────────────────────────

function calculateBattlePoints(
    playerRoster: BattleCharacter[],
    opponentRoster: BattleCharacter[],
    winner: 'player' | 'opponent',
): number {
    const playerAlive = playerRoster.filter(c => c.currentHp > 0).length;
    const opponentAlive = opponentRoster.filter(c => c.currentHp > 0).length;
    const killedOpponents = opponentRoster.length - opponentAlive;

    if (winner === 'player') {
        return 50 + playerAlive * 30 + killedOpponents * 20;
    } else {
        const basePenalty = 40;
        const opponentSurvivePenalty = opponentAlive * 30;
        const consolation = killedOpponents * 10;
        return -(basePenalty + opponentSurvivePenalty) + consolation;
    }
}

// ─── Per-turn effect processing ────────────────────────────────────────────────

function decrementEffects(char: BattleCharacter): BattleCharacter {
    let updated = { ...char };
    const appliedEffects: typeof char.statusEffects = [];

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
        const roll = Math.random();
        if (roll < 0.35) newEnergy.ki++;
        else if (roll < 0.65) newEnergy.physical++;
        else if (roll < 0.90) newEnergy.special++;
        else newEnergy.universal++;
        total++;
    }
    return newEnergy;
}

// ─── Bot AI ────────────────────────────────────────────────────────────────────

function chooseBotAction(
    botChar: BattleCharacter,
    playerChar: BattleCharacter,
    energy: PlayerEnergy,
): { type: 'technique' | 'pass'; techId?: string } {
    if (isStunned(botChar)) return { type: 'pass' };

    const affordable = botChar.techniques.filter(t => {
        const cd = botChar.cooldowns[t.id] || 0;
        return cd === 0 && canAffordCost(energy, t.cost);
    });

    if (affordable.length === 0) return { type: 'pass' };

    const botHpRatio   = botChar.currentHp / botChar.maxHp;
    const enemyHpRatio = playerChar.currentHp / playerChar.maxHp;
    const totalEnergy  = energy.ki + energy.physical + energy.special + (energy.universal || 0);

    // Heal self if critically low HP
    if (botHpRatio < 0.25) {
        const heal = affordable.find(t => t.effect === 'heal');
        if (heal) return { type: 'technique', techId: heal.id };
        const drain = affordable.find(t => t.effect === 'drain');
        if (drain) return { type: 'technique', techId: drain.id };
        const regen = affordable.find(t => t.effect === 'regen');
        if (regen) return { type: 'technique', techId: regen.id };
    }

    // Clear debuffs if heavily afflicted
    const negEffects = botChar.statusEffects.filter(e =>
        ['poison', 'bleed', 'weaken'].includes(e.effect),
    ).length;
    if (negEffects >= 2) {
        const clearMove = affordable.find(t => t.effect === 'clear');
        if (clearMove) return { type: 'technique', techId: clearMove.id };
    }

    // Energy boost if nearly empty
    if (totalEnergy <= 1) {
        const energyMove = affordable.find(t => t.effect === 'energy');
        if (energyMove) return { type: 'technique', techId: energyMove.id };
    }

    // Regen if moderate HP loss
    if (botHpRatio < 0.55 && !botChar.statusEffects.some(e => e.effect === 'regen')) {
        const regen = affordable.find(t => t.effect === 'regen');
        if (regen) return { type: 'technique', techId: regen.id };
    }

    // Drain when HP not full
    if (botHpRatio < 0.70) {
        const drain = affordable.find(t => t.effect === 'drain');
        if (drain && Math.random() < 0.65) return { type: 'technique', techId: drain.id };
    }

    // Senzu boost before a big attack
    const senzuMove  = affordable.find(t => t.effect === 'senzu');
    const hasBigMove = affordable.some(t => t.damage > 150 && t.effect !== 'senzu');
    if (senzuMove && hasBigMove && !botChar.statusEffects.some(e => e.effect === 'senzu')) {
        return { type: 'technique', techId: senzuMove.id };
    }

    // Pierce on low-HP enemies
    if (enemyHpRatio < 0.35) {
        const pierce = affordable.find(t => t.effect === 'pierce');
        if (pierce) return { type: 'technique', techId: pierce.id };
    }

    // Stun when enemy is healthy
    if (enemyHpRatio > 0.6) {
        const stun = affordable.find(t => t.effect === 'stun');
        if (stun) return { type: 'technique', techId: stun.id };
    }

    // Apply DoT if not already active
    if (!playerChar.statusEffects.some(e => e.effect === 'poison')) {
        const poison = affordable.find(t => t.effect === 'poison');
        if (poison) return { type: 'technique', techId: poison.id };
    }
    if (!playerChar.statusEffects.some(e => e.effect === 'bleed')) {
        const bleed = affordable.find(t => t.effect === 'bleed');
        if (bleed && Math.random() < 0.55) return { type: 'technique', techId: bleed.id };
    }

    // Weaken enemy
    if (!playerChar.statusEffects.some(e => e.effect === 'weaken') && enemyHpRatio > 0.45) {
        const weaken = affordable.find(t => t.effect === 'weaken');
        if (weaken && Math.random() < 0.50) return { type: 'technique', techId: weaken.id };
    }

    // Default: highest damage
    const best = [...affordable].sort((a, b) => b.damage - a.damage)[0];
    return { type: 'technique', techId: best.id };
}

// ─── Slice ────────────────────────────────────────────────────────────────────

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
    lastBattlePoints: 0, // FIX #2: dodane pole

    setPlayerActiveIndex: (index) => set({ playerActiveIndex: index }),
    setOpponentActiveIndex: (index) => set({ opponentActiveIndex: index }),

    startBattle: () => {
        const pe = { ...initialEnergy };
        const oe = { ...initialEnergy };
        const types = ['ki', 'physical', 'special'] as const;
        for (let i = 0; i < 3; i++) {
            pe[types[Math.floor(Math.random() * 3)]]++;
            oe[types[Math.floor(Math.random() * 3)]]++;
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
            lastBattlePoints: 0,
        });
    },

    executePlayerAction: (actionType, actionId) => {
        const state = get();
        if (!state.isPlayerTurn || state.phase !== 'battle' || state.winner) return;

        const activeChar = state.playerRoster[state.playerActiveIndex];
        const oppChar = state.opponentRoster[state.opponentActiveIndex];

        // Stunned check
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
            set({
                combatLogs: [stunnedLog, ...state.combatLogs],
                playerActionsUsed: { ...state.playerActionsUsed, [state.playerActiveIndex]: true },
            });
            return;
        }

        // One action per character per round
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
            // FIX #4: usunięto fragile check na dodge.name – identyfikujemy po stałym kluczu 'dodge'
            if ((activeChar.cooldowns['dodge'] || 0) > 0) return;

            energyCost = activeChar.dodge.cost;
            actionName = activeChar.dodge.name;
            cooldown = activeChar.dodge.cooldown;
        }

        if (!canAffordCost(state.playerEnergy, energyCost)) return;

        let pe = deductCost(state.playerEnergy, energyCost);

        // Apply cooldown using stable key
        const cdKey = actionType === 'dodge' ? 'dodge' : actionId;
        const newPlayerRoster = state.playerRoster.map((c, i) => {
            if (i !== state.playerActiveIndex) return c;
            return { ...c, cooldowns: { ...c.cooldowns, [cdKey]: cooldown } };
        });

        let newOppRoster = [...state.opponentRoster];
        let newOppChar = { ...oppChar };
        let logDetail = `${activeChar.name} used ${actionName}.`;

        if (actionType === 'technique') {
            if (effect === 'aoe') {
                let totalDeals = 0;
                newOppRoster = newOppRoster.map((tar) => {
                    if (tar.currentHp <= 0) return tar;
                    const actualDamage = computeDamage(newPlayerRoster[state.playerActiveIndex], tar, damage, 'none');
                    totalDeals += actualDamage;
                    return { ...tar, currentHp: Math.max(0, tar.currentHp - actualDamage) };
                });
                logDetail += ` Deals ${totalDeals} total damage to all opponents!`;
            } else if (effect === 'heal') {
                const healAmt = Math.max(1, Math.floor(newPlayerRoster[state.playerActiveIndex].maxHp * 0.25));
                newPlayerRoster[state.playerActiveIndex] = {
                    ...newPlayerRoster[state.playerActiveIndex],
                    currentHp: Math.min(
                        newPlayerRoster[state.playerActiveIndex].maxHp,
                        newPlayerRoster[state.playerActiveIndex].currentHp + healAmt,
                    ),
                };
                logDetail += ` Heals ${newPlayerRoster[state.playerActiveIndex].name} for ${healAmt} HP.`;
            } else if (effect === 'healAll') {
                newPlayerRoster.forEach((pc, idx) => {
                    if (pc.currentHp <= 0) return;
                    const healAmt = Math.max(1, Math.floor(pc.maxHp * 0.20));
                    newPlayerRoster[idx] = { ...pc, currentHp: Math.min(pc.maxHp, pc.currentHp + healAmt) };
                });
                logDetail += ` Heals all allies.`;
            } else if (effect === 'clear') {
                const before = newPlayerRoster[state.playerActiveIndex].statusEffects.length;
                newPlayerRoster[state.playerActiveIndex] = {
                    ...newPlayerRoster[state.playerActiveIndex],
                    statusEffects: newPlayerRoster[state.playerActiveIndex].statusEffects.filter(
                        se => !['poison', 'bleed', 'weaken', 'stun'].includes(se.effect),
                    ),
                };
                const after = newPlayerRoster[state.playerActiveIndex].statusEffects.length;
                const cleared = before - after;
                logDetail += cleared > 0
                    ? ` ${newPlayerRoster[state.playerActiveIndex].name} cleared ${cleared} negative effect(s)!`
                    : ` ${newPlayerRoster[state.playerActiveIndex].name} has nothing to clear.`;
            } else if (effect === 'senzu') {
                newPlayerRoster[state.playerActiveIndex] = {
                    ...newPlayerRoster[state.playerActiveIndex],
                    statusEffects: [
                        ...newPlayerRoster[state.playerActiveIndex].statusEffects,
                        { effect: 'senzu', duration: effectDuration },
                    ],
                };
                logDetail += ` ${newPlayerRoster[state.playerActiveIndex].name} gains a damage boost.`;
            } else if (effect === 'energy') {
                pe = { ...pe, universal: (pe.universal || 0) + 2 };
                logDetail += ` Grants energy boost.`;
            } else if (effect === 'drain') {
                const actualDamage = computeDamage(newPlayerRoster[state.playerActiveIndex], newOppChar, damage, 'none');
                newOppChar.currentHp = Math.max(0, newOppChar.currentHp - actualDamage);
                const heal = Math.floor(actualDamage * 0.5);
                newPlayerRoster[state.playerActiveIndex] = {
                    ...newPlayerRoster[state.playerActiveIndex],
                    currentHp: Math.min(
                        newPlayerRoster[state.playerActiveIndex].maxHp,
                        newPlayerRoster[state.playerActiveIndex].currentHp + heal,
                    ),
                };
                logDetail += ` Deals ${actualDamage} damage and drains ${heal} HP.`;
            } else {
                const actualDamage = computeDamage(newPlayerRoster[state.playerActiveIndex], newOppChar, damage, effect);
                newOppChar.currentHp = Math.max(0, newOppChar.currentHp - actualDamage);
                logDetail += ` Deals ${actualDamage} damage!`;

                if (['weaken', 'stun', 'poison', 'bleed', 'regen', 'buff'].includes(effect)) {
                    newOppChar.statusEffects = [...newOppChar.statusEffects, { effect, duration: effectDuration }];
                    logDetail += effect === 'stun'   ? ` ${newOppChar.name} is STUNNED for ${effectDuration} turn(s)!`
                        : effect === 'weaken'        ? ` ${newOppChar.name} is WEAKENED for ${effectDuration} turn(s)!`
                        : effect === 'poison'        ? ` ${newOppChar.name} is POISONED for ${effectDuration} turn(s)!`
                        : effect === 'bleed'         ? ` ${newOppChar.name} is BLEEDING for ${effectDuration} turn(s)!`
                        : effect === 'buff'          ? ` ${newOppChar.name} is BUFFED!`
                        : ` ${newOppChar.name} will regenerate HP.`;
                }
            }

            newOppRoster[state.opponentActiveIndex] = newOppChar;

        } else if (actionType === 'dodge') {
            // Apply dodging status to this character for the opponent's next attack
            newPlayerRoster[state.playerActiveIndex] = {
                ...newPlayerRoster[state.playerActiveIndex],
                statusEffects: [
                    ...newPlayerRoster[state.playerActiveIndex].statusEffects,
                    { effect: 'dodging', duration: 1 },
                ],
            };
            logDetail += ` ${activeChar.name} prepares to dodge (${Math.round(activeChar.dodge.successRate * 100)}% chance).`;
        }

        const newLog: CombatLogEntry = {
            id: Date.now(),
            turn: state.turnNumber,
            playerName: 'Player',
            characterName: activeChar.name,
            action: actionName,
            details: logDetail,
            isOpponent: false,
        };

        const newActionsUsed = { ...state.playerActionsUsed, [state.playerActiveIndex]: true };
        set({
            playerEnergy: pe,
            playerRoster: newPlayerRoster,
            opponentRoster: newOppRoster,
            combatLogs: [newLog, ...state.combatLogs],
            playerActionsUsed: newActionsUsed,
        });

        // Check opponent defeat
        if (newOppChar.currentHp <= 0) {
            const nextOppIndex = newOppRoster.findIndex(c => c.currentHp > 0);
            if (nextOppIndex === -1) {
                const pts = calculateBattlePoints(newPlayerRoster, newOppRoster, 'player');
                set({ winner: 'player', phase: 'gameOver', lastBattlePoints: pts }); // FIX #2
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
    },

    passTurn: () => {
        const state = get();
        if (!state.isPlayerTurn || state.phase !== 'battle' || state.winner) return;

        const updatedActionsUsed = { ...state.playerActionsUsed };
        const newLogs: CombatLogEntry[] = [];

        state.playerRoster.forEach((char, index) => {
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

        set({
            combatLogs: [...newLogs, ...state.combatLogs],
            playerActionsUsed: updatedActionsUsed,
        });

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

            // Check player dodge
            if (isDodging(updatedPlayerChar) && Math.random() < updatedPlayerChar.dodge.successRate) {
                logDetail = `${botChar.name} used ${actionName} but ${updatedPlayerChar.name} dodged it!`;
                updatedPlayerChar = {
                    ...updatedPlayerChar,
                    statusEffects: updatedPlayerChar.statusEffects.filter(e => e.effect !== 'dodging'),
                };
            } else {
                if (action.effect === 'heal') {
                    const healAmt = Math.max(1, Math.floor(botChar.maxHp * 0.25));
                    newOppRoster[state.opponentActiveIndex] = {
                        ...newOppRoster[state.opponentActiveIndex],
                        currentHp: Math.min(botChar.maxHp, botChar.currentHp + healAmt),
                    };
                    logDetail = `${botChar.name} used ${actionName}. Heals for ${healAmt} HP!`;
                } else if (action.effect === 'drain') {
                    const actualDamage = computeDamage(botChar, updatedPlayerChar, action.damage, 'none');
                    updatedPlayerChar.currentHp = Math.max(0, updatedPlayerChar.currentHp - actualDamage);
                    const heal = Math.floor(actualDamage * 0.5);
                    newOppRoster[state.opponentActiveIndex] = {
                        ...newOppRoster[state.opponentActiveIndex],
                        currentHp: Math.min(botChar.maxHp, botChar.currentHp + heal),
                    };
                    logDetail = `${botChar.name} used ${actionName}. Deals ${actualDamage} damage and drains ${heal} HP!`;
                } else {
                    const actualDamage = computeDamage(botChar, updatedPlayerChar, action.damage, action.effect);
                    updatedPlayerChar.currentHp = Math.max(0, updatedPlayerChar.currentHp - actualDamage);
                    logDetail = `${botChar.name} used ${actionName}. Deals ${actualDamage} damage!`;

                    if (['stun', 'weaken', 'poison', 'bleed', 'regen', 'senzu', 'buff'].includes(action.effect)) {
                        const dur = action.effectDuration ?? 1;
                        updatedPlayerChar.statusEffects = [
                            ...updatedPlayerChar.statusEffects,
                            { effect: action.effect as EffectType, duration: dur },
                        ];
                        logDetail += action.effect === 'stun'   ? ` ${updatedPlayerChar.name} is STUNNED for ${dur} turn(s)!`
                            : action.effect === 'weaken'        ? ` ${updatedPlayerChar.name} is WEAKENED!`
                            : action.effect === 'poison'        ? ` ${updatedPlayerChar.name} is POISONED!`
                            : action.effect === 'bleed'         ? ` ${updatedPlayerChar.name} is BLEEDING!`
                            : action.effect === 'regen'         ? ` ${updatedPlayerChar.name} will regenerate HP.`
                            : action.effect === 'buff'          ? ` ${updatedPlayerChar.name} is BUFFED!`
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
                const pts = calculateBattlePoints(newPlayerRoster, state.opponentRoster, 'opponent');
                set({ winner: 'opponent', phase: 'gameOver', lastBattlePoints: pts }); // FIX #2
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

        const pts = calculateBattlePoints(s.playerRoster, s.opponentRoster, 'opponent');
        set({
            winner: 'opponent',
            phase: 'gameOver',
            combatLogs: [log, ...s.combatLogs],
            lastBattlePoints: pts, // FIX #2
        });
        get().addScore(pts);
    },

    endTurn: () => {
        const s = get();
        if (s.winner) return;

        if (!s.isPlayerTurn) {
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
            set({ isPlayerTurn: false });
            setTimeout(() => get().executeOpponentTurn(), 1000);
        }
    },
});
