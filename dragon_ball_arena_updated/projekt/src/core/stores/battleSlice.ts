import type { StateCreator } from 'zustand';
import type { RootState } from './rootStore';
import type { PlayerEnergy, CombatLogEntry, ActionCost, EffectType, BattleCharacter } from "../../core/types";
import { ENERGY_TYPE_CAP } from "../../core/types";

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
    resetBattle: () => void;
    startBattle: () => void;
    executePlayerAction: (actionType: 'technique' | 'dodge', actionId: string) => void;
    passTurn: () => void;
    executeOpponentTurn: () => void;
    endTurn: () => void;
    surrender: () => void;
    winByOpponentDisconnect: () => void;
    applyOnlineBattleSnapshot: (snap: import("../../multiplayer/matchService").OnlineBattleSnapshot, myRole: import("../../multiplayer/matchService").MatchRole) => void;
}

const initialEnergy: PlayerEnergy = { ki: 0, physical: 0, special: 0, universal: 0 };

// ─── Energy helpers ────────────────────────────────────────────────────────────

function canAffordCost(energy: PlayerEnergy, cost: ActionCost): boolean {
    let u = energy.universal || 0;
    let ki = energy.ki;
    let ph = energy.physical;
    let sp = energy.special;

    const pay = (needed: number, available: number) => {
        const fromU = Math.min(u, needed);
        u -= fromU;
        needed -= fromU;
        const fromSpecific = Math.min(available, needed);
        needed -= fromSpecific;
        return { needed, remaining: available - fromSpecific };
    };

    const resKi = pay(cost.ki || 0, ki);
    if (resKi.needed > 0) return false;

    const resPh = pay(cost.physical || 0, ph);
    if (resPh.needed > 0) return false;

    const resSp = pay(cost.special || 0, sp);
    if (resSp.needed > 0) return false;

    const totalAnyAvailable = u + resKi.remaining + resPh.remaining + resSp.remaining;
    if (totalAnyAvailable < (cost.any || 0)) return false;

    return true;
}

function deductCost(energy: PlayerEnergy, cost: ActionCost): PlayerEnergy {
    const result = { ...energy };

    const deduct = (needed: number, type: keyof PlayerEnergy) => {
        const fromU = Math.min(result.universal || 0, needed);
        result.universal = (result.universal || 0) - fromU;
        needed -= fromU;
        if (needed > 0) {
            result[type] -= needed;
        }
    };

    deduct(cost.ki || 0, 'ki');
    deduct(cost.physical || 0, 'physical');
    deduct(cost.special || 0, 'special');

    let anyAmount = cost.any || 0;
    // Use Universal first for 'any'
    const fromU = Math.min(result.universal || 0, anyAmount);
    result.universal = (result.universal || 0) - fromU;
    anyAmount -= fromU;

    // Then use specific energies
    const types: (keyof PlayerEnergy)[] = ['ki', 'physical', 'special'];
    for (const t of types) {
        if (anyAmount <= 0) break;
        const fromType = Math.min(result[t] || 0, anyAmount);
        result[t] = (result[t] || 0) - fromType;
        anyAmount -= fromType;
    }

    return result;
}

// ─── Damage calculation ────────────────────────────────────────────────────────

function computeDamage(
    attacker: BattleCharacter,
    defender: BattleCharacter,
    baseDamage: number,
    effect: EffectType,
    context?: { attackerAllyKOs?: number; defenderAliveAllies?: number; attackerAliveAllies?: number },
): number {
    // ── ATK stat modifiers ──────────────────────────────────────────────────────
    let atkStat = attacker.stats.attack;

    // sleeping_warrior: Gohan +15% ATK per KO'd ally
    if (attacker.passive?.id === 'sleeping_warrior' && (context?.attackerAllyKOs ?? 0) > 0)
        atkStat = Math.floor(atkStat * (1 + context!.attackerAllyKOs! * 0.15));
    // wolf_spirit: Yamcha +20% ATK when HP < 50%
    if (attacker.passive?.id === 'wolf_spirit' && attacker.currentHp / attacker.maxHp < 0.50)
        atkStat = Math.floor(atkStat * 1.20);
    // death_grip: Saibaman +30% ATK when HP < 30%
    if (attacker.passive?.id === 'death_grip' && attacker.currentHp / attacker.maxHp < 0.30)
        atkStat = Math.floor(atkStat * 1.30);
    // low_class_fury: Raditz +5% ATK per elapsed round (max 5)
    if (attacker.passive?.id === 'low_class_fury' && (attacker.passiveStacks ?? 0) > 0)
        atkStat = Math.floor(atkStat * (1 + Math.min(attacker.passiveStacks!, 5) * 0.05));
    // elite_soldier: Jeice +12% ATK when any ally alive
    if (attacker.passive?.id === 'elite_soldier' && (context?.attackerAliveAllies ?? 0) > 0)
        atkStat = Math.floor(atkStat * 1.12);
    // tri_form: Tien +20% ATK at full HP
    if (attacker.passive?.id === 'tri_form' && attacker.currentHp === attacker.maxHp)
        atkStat = Math.floor(atkStat * 1.20);
    // future_warrior: Trunks +18% ATK when HP < 50%
    if (attacker.passive?.id === 'future_warrior' && attacker.currentHp / attacker.maxHp < 0.50)
        atkStat = Math.floor(atkStat * 1.18);
    // battle_pose: Recoome +20% ATK turn after dodging
    if (attacker.passive?.id === 'battle_pose' && (attacker.passiveStacks ?? 0) > 0)
        atkStat = Math.floor(atkStat * 1.20);
    // force_captain: Ginyu +20% ATK when any ally alive
    if (attacker.passive?.id === 'force_captain' && (context?.attackerAliveAllies ?? 0) > 0)
        atkStat = Math.floor(atkStat * 1.20);
    // potara_mastery: Vegito +10% ATK when HP > 70%
    if (attacker.passive?.id === 'potara_mastery' && attacker.currentHp / attacker.maxHp > 0.70)
        atkStat = Math.floor(atkStat * 1.10);
    // survivor_instinct: Cui +25% ATK when HP < 40%
    if (attacker.passive?.id === 'survivor_instinct' && attacker.currentHp / attacker.maxHp < 0.40)
        atkStat = Math.floor(atkStat * 1.25);
    // iron_mother: Chi-Chi +15% ATK per KO'd ally (max 2)
    if (attacker.passive?.id === 'iron_mother' && (context?.attackerAllyKOs ?? 0) > 0)
        atkStat = Math.floor(atkStat * (1 + Math.min(context!.attackerAllyKOs!, 2) * 0.15));
    // battle_frenzy: Launch +8% ATK per hit received (max 3)
    if (attacker.passive?.id === 'battle_frenzy' && (attacker.passiveStacks ?? 0) > 0)
        atkStat = Math.floor(atkStat * (1 + Math.min(attacker.passiveStacks!, 3) * 0.08));

    // ── DEF stat modifiers ──────────────────────────────────────────────────────
    let defStat = defender.stats.defense;

    // teamwork: Krillin DEF +10% per alive ally
    if (defender.passive?.id === 'teamwork' && (context?.defenderAliveAllies ?? 0) > 0)
        defStat = Math.floor(defStat * (1 + context!.defenderAliveAllies! * 0.10));
    // perfect_adaptation: Cell DEF +7% per hit taken (max 3 stacks)
    if (defender.passive?.id === 'perfect_adaptation' && (defender.passiveStacks ?? 0) > 0)
        defStat = Math.floor(defStat * (1 + Math.min(defender.passiveStacks!, 3) * 0.07));
    // brute_force: Dodoria ignores 25% of target DEF
    if (attacker.passive?.id === 'brute_force')
        defStat = Math.floor(defStat * 0.75);
    // gravity_mastery: Pui Pui DEF +20% when HP > 60%
    if (defender.passive?.id === 'gravity_mastery' && defender.currentHp / defender.maxHp > 0.60)
        defStat = Math.floor(defStat * 1.20);

    // ── Base damage ─────────────────────────────────────────────────────────────
    let dmg = effect === 'pierce' ? baseDamage : Math.floor(baseDamage * (atkStat / defStat));

    // ── Post-formula multipliers ────────────────────────────────────────────────

    // senzu / buff status boost
    if (attacker.statusEffects.some(se => se.effect === 'senzu' || se.effect === 'buff'))
        dmg = Math.floor(dmg * 1.15);
    // saiyan_pride: Vegeta SS +25% when HP < 35%
    if (attacker.passive?.id === 'saiyan_pride' && attacker.currentHp / attacker.maxHp < 0.35)
        dmg = Math.floor(dmg * 1.25);
    // legendary_power: Broly +5% per rage stack (max 3)
    if (attacker.passive?.id === 'legendary_power') {
        const stacks = Math.min(attacker.passiveStacks ?? 0, 3);
        if (stacks > 0) dmg = Math.floor(dmg * (1 + stacks * 0.05));
    }
    // city_defender: Videl +15% dmg to weakened enemies
    if (attacker.passive?.id === 'city_defender' && defender.statusEffects.some(se => se.effect === 'weaken'))
        dmg = Math.floor(dmg * 1.15);
    // tyrant_pressure: Cooler +20% dmg to poisoned/weakened enemies
    if (attacker.passive?.id === 'tyrant_pressure' && defender.statusEffects.some(se => ['poison', 'weaken'].includes(se.effect)))
        dmg = Math.floor(dmg * 1.20);
    // saiyan_armor: Nappa incoming damage -12%
    if (defender.passive?.id === 'saiyan_armor')
        dmg = Math.floor(dmg * 0.88);
    // rubbery_body: Majin Buu incoming damage -20%
    if (defender.passive?.id === 'rubbery_body')
        dmg = Math.floor(dmg * 0.80);
    // fusion_power: Gogeta all techniques +12%
    if (attacker.passive?.id === 'fusion_power')
        dmg = Math.floor(dmg * 1.12);
    // pain_immunity: Spopovich incoming damage -15%
    if (defender.passive?.id === 'pain_immunity')
        dmg = Math.floor(dmg * 0.85);
    // opportunist: Yajirobe +15% dmg when target has any negative status
    if (attacker.passive?.id === 'opportunist' && defender.statusEffects.some(se => ['poison', 'bleed', 'weaken', 'stun'].includes(se.effect)))
        dmg = Math.floor(dmg * 1.15);
    // first_strike: Tao +20% dmg for first technique per turn (passiveStacks === 0 means unused this turn)
    if (attacker.passive?.id === 'first_strike' && (attacker.passiveStacks ?? 0) === 0)
        dmg = Math.floor(dmg * 1.20);

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

function capEnergy(e: PlayerEnergy): PlayerEnergy {
    return {
        ki:        Math.min(e.ki,        ENERGY_TYPE_CAP),
        physical:  Math.min(e.physical,  ENERGY_TYPE_CAP),
        special:   Math.min(e.special,   ENERGY_TYPE_CAP),
        universal: Math.min(e.universal, ENERGY_TYPE_CAP),
    };
}

function grantEnergy(energy: PlayerEnergy, aliveCount: number): PlayerEnergy {
    const e = { ...energy };
    for (let i = 0; i < aliveCount; i++) {
        const roll = Math.random();
        if      (roll < 0.35 && e.ki        < ENERGY_TYPE_CAP) e.ki++;
        else if (roll < 0.65 && e.physical  < ENERGY_TYPE_CAP) e.physical++;
        else if (roll < 0.90 && e.special   < ENERGY_TYPE_CAP) e.special++;
        else if (               e.universal < ENERGY_TYPE_CAP) e.universal++;
    }
    return e;
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

    // Regen if moderate HP loss and not already active on bot
    if (botHpRatio < 0.55 && !botChar.statusEffects.some(e => e.effect === 'regen') && !playerChar.statusEffects.some(e => e.effect === 'regen')) {
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

    setPlayerActiveIndex: (index) => {
        const state = get();
        if (state.playerRoster[index]?.currentHp > 0) {
            if (state.isOnlineMatch) {
                import("../../multiplayer/matchService").then(m => m.selectAction('switchCharacter', index.toString()));
                // We'll optimistically update locally to make UI snappy
            }
            set({ playerActiveIndex: index });
        }
    },
    setOpponentActiveIndex: (index) => {
        const state = get();
        if (state.opponentRoster[index]?.currentHp > 0) {
            if (state.isOnlineMatch) {
                import("../../multiplayer/matchService").then(m => m.selectAction('changeTarget', index.toString()));
            }
            set({ opponentActiveIndex: index });
        }
    },

    resetBattle: () => {
        set({
            playerActiveIndex: 0,
            opponentActiveIndex: 0,
            playerEnergy: { ki: 0, physical: 0, special: 0, universal: 0 },
            opponentEnergy: { ki: 0, physical: 0, special: 0, universal: 0 },
            turnNumber: 1,
            isPlayerTurn: true,
            combatLogs: [],
            winner: null,
            playerActionsUsed: {},
            lastBattlePoints: 0,
        });
    },

    startBattle: () => {
        let pe = { ...initialEnergy };
        let oe = { ...initialEnergy };
        const types = ['ki', 'physical', 'special'] as const;
        for (let i = 0; i < 3; i++) {
            pe[types[Math.floor(Math.random() * 3)]]++;
            oe[types[Math.floor(Math.random() * 3)]]++;
        }

        // Namekian body: Piccolo starts with +1 special energy
        const state = get();
        state.playerRoster.forEach(c => {
            if (c.passive?.id === 'namekian_body') {
                pe = capEnergy({ ...pe, special: pe.special + 1 });
            }
        });
        state.opponentRoster.forEach(c => {
            if (c.passive?.id === 'namekian_body') {
                oe = capEnergy({ ...oe, special: oe.special + 1 });
            }
        });

        // In online mode: player1 acts first, player2 starts by polling
        const isOnline = state.isOnlineMatch;
        const role = state.myRole;
        const initialTurn = !isOnline || role === 'player1';

        set({
            playerActiveIndex: 0,
            opponentActiveIndex: 0,
            playerEnergy: pe,
            opponentEnergy: oe,
            turnNumber: 1,
            isPlayerTurn: initialTurn,
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
        get().setPhase('battle');
    },

    executePlayerAction: (actionType, actionId) => {
        const state = get();
        if (!state.isPlayerTurn || state.phase !== 'battle' || state.winner) return;

        if (state.isOnlineMatch) {
            import("../../multiplayer/matchService").then(m => {
                m.selectAction(actionType, actionId);
            });
            // Don't execute locally, wait for server's battleUpdate
            return;
        }

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
                const koCount = newPlayerRoster.filter((c, idx) => idx !== state.playerActiveIndex && c.currentHp <= 0).length;
                const attackerAliveAllies = newPlayerRoster.filter((c, idx) => idx !== state.playerActiveIndex && c.currentHp > 0).length;
                const playerAttacker = newPlayerRoster[state.playerActiveIndex];
                newOppRoster = newOppRoster.map((tar) => {
                    if (tar.currentHp <= 0) return tar;
                    const aliveAllies = newOppRoster.filter((c) => c !== tar && c.currentHp > 0).length;
                    let actualDamage = computeDamage(playerAttacker, tar, damage, 'none', {
                        attackerAllyKOs: koCount,
                        defenderAliveAllies: aliveAllies,
                        attackerAliveAllies,
                    });
                    // ghost_army: Gotenks AOE +20%
                    if (playerAttacker.passive?.id === 'ghost_army')
                        actualDamage = Math.floor(actualDamage * 1.20);
                    totalDeals += actualDamage;
                    let updated = { ...tar, currentHp: Math.max(0, tar.currentHp - actualDamage) };
                    // legendary_power: Broly rage stacks
                    if (updated.passive?.id === 'legendary_power' && actualDamage > 0)
                        updated = { ...updated, passiveStacks: Math.min((updated.passiveStacks ?? 0) + 1, 3) };
                    // perfect_adaptation: Cell DEF stacks
                    if (updated.passive?.id === 'perfect_adaptation' && actualDamage > 0)
                        updated = { ...updated, passiveStacks: Math.min((updated.passiveStacks ?? 0) + 1, 3) };
                    // battle_frenzy: Launch stacks when hit
                    if (updated.passive?.id === 'battle_frenzy' && actualDamage > 0)
                        updated = { ...updated, passiveStacks: Math.min((updated.passiveStacks ?? 0) + 1, 3) };
                    return updated;
                });
                // battle_pose: clear stack after attack
                if (playerAttacker.passive?.id === 'battle_pose' && (playerAttacker.passiveStacks ?? 0) > 0)
                    newPlayerRoster[state.playerActiveIndex] = { ...newPlayerRoster[state.playerActiveIndex], passiveStacks: 0 };
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
                pe = capEnergy({ ...pe, universal: (pe.universal || 0) + 2 });
                logDetail += ` Grants energy boost.`;
            } else if (effect === 'drain') {
                const drainAttacker = newPlayerRoster[state.playerActiveIndex];
                let actualDamage = computeDamage(drainAttacker, newOppChar, damage, 'none');
                // monster_transform: Zarbon drain +25%
                if (drainAttacker.passive?.id === 'monster_transform') actualDamage = Math.floor(actualDamage * 1.25);
                // fathers_prophecy: Bardock opponent survives lethal hit at 1 HP (once)
                if (newOppChar.passive?.id === 'fathers_prophecy' && (newOppChar.passiveStacks ?? 0) === 0 && newOppChar.currentHp - actualDamage <= 0 && newOppChar.currentHp > 1) {
                    actualDamage = newOppChar.currentHp - 1;
                    newOppChar = { ...newOppChar, passiveStacks: 1 };
                    logDetail += ` ${newOppChar.name}'s vision saves him!`;
                }
                newOppChar.currentHp = Math.max(0, newOppChar.currentHp - actualDamage);
                const heal = Math.floor(actualDamage * 0.5);
                newPlayerRoster[state.playerActiveIndex] = {
                    ...newPlayerRoster[state.playerActiveIndex],
                    currentHp: Math.min(newPlayerRoster[state.playerActiveIndex].maxHp, drainAttacker.currentHp + heal),
                };
                // battle_pose: clear stack after attack
                if (drainAttacker.passive?.id === 'battle_pose' && (drainAttacker.passiveStacks ?? 0) > 0)
                    newPlayerRoster[state.playerActiveIndex] = { ...newPlayerRoster[state.playerActiveIndex], passiveStacks: 0 };
                logDetail += ` Deals ${actualDamage} damage and drains ${heal} HP.`;
            } else {
                const attacker = newPlayerRoster[state.playerActiveIndex];
                const koCount = newPlayerRoster.filter((c, idx) => idx !== state.playerActiveIndex && c.currentHp <= 0).length;
                const defenderAliveAllies = newOppRoster.filter((c, idx) => idx !== state.opponentActiveIndex && c.currentHp > 0).length;
                const attackerAliveAllies = newPlayerRoster.filter((c, idx) => idx !== state.playerActiveIndex && c.currentHp > 0).length;
                let actualDamage = computeDamage(attacker, newOppChar, damage, effect, {
                    attackerAllyKOs: koCount,
                    defenderAliveAllies,
                    attackerAliveAllies,
                });
                // fathers_prophecy: Bardock opponent survives lethal hit at 1 HP (once)
                if (newOppChar.passive?.id === 'fathers_prophecy' && (newOppChar.passiveStacks ?? 0) === 0 && newOppChar.currentHp - actualDamage <= 0 && newOppChar.currentHp > 1) {
                    actualDamage = newOppChar.currentHp - 1;
                    newOppChar = { ...newOppChar, passiveStacks: 1 };
                    logDetail += ` ${newOppChar.name}'s vision saves him!`;
                }
                newOppChar.currentHp = Math.max(0, newOppChar.currentHp - actualDamage);
                logDetail += ` Deals ${actualDamage} damage!`;

                // legendary_power: Broly rage stacks
                if (newOppChar.passive?.id === 'legendary_power' && actualDamage > 0)
                    newOppChar = { ...newOppChar, passiveStacks: Math.min((newOppChar.passiveStacks ?? 0) + 1, 3) };
                // perfect_adaptation: Cell DEF stacks
                if (newOppChar.passive?.id === 'perfect_adaptation' && actualDamage > 0)
                    newOppChar = { ...newOppChar, passiveStacks: Math.min((newOppChar.passiveStacks ?? 0) + 1, 3) };
                // battle_frenzy: Launch stacks when hit
                if (newOppChar.passive?.id === 'battle_frenzy' && actualDamage > 0)
                    newOppChar = { ...newOppChar, passiveStacks: Math.min((newOppChar.passiveStacks ?? 0) + 1, 3) };
                // battle_pose: clear stack after attack
                if (attacker.passive?.id === 'battle_pose' && (attacker.passiveStacks ?? 0) > 0)
                    newPlayerRoster[state.playerActiveIndex] = { ...newPlayerRoster[state.playerActiveIndex], passiveStacks: 0 };
                // first_strike: mark as used after technique
                if (attacker.passive?.id === 'first_strike' && (attacker.passiveStacks ?? 0) === 0)
                    newPlayerRoster[state.playerActiveIndex] = { ...newPlayerRoster[state.playerActiveIndex], passiveStacks: 1 };

                // BUG 11 FIX: buff and regen are self-targeted
                if (['buff', 'regen'].includes(effect)) {
                    newPlayerRoster[state.playerActiveIndex] = {
                        ...newPlayerRoster[state.playerActiveIndex],
                        statusEffects: [
                            ...newPlayerRoster[state.playerActiveIndex].statusEffects,
                            { effect, duration: effectDuration },
                        ],
                    };
                    logDetail += effect === 'buff'
                        ? ` ${newPlayerRoster[state.playerActiveIndex].name} is BUFFED!`
                        : ` ${newPlayerRoster[state.playerActiveIndex].name} will regenerate HP.`;
                } else if (['weaken', 'poison', 'bleed'].includes(effect)) {
                    // mental_fortress: Guldo immune to weaken; iron_will: Android 16 immune to bleed/poison; water_discipline: Nam immune to bleed
                    if (effect === 'weaken' && newOppChar.passive?.id === 'mental_fortress') {
                        logDetail += ` ${newOppChar.name} resists the weaken!`;
                    } else if (['bleed', 'poison'].includes(effect) && newOppChar.passive?.id === 'iron_will') {
                        logDetail += ` ${newOppChar.name} resists the ${effect}!`;
                    } else if (effect === 'bleed' && newOppChar.passive?.id === 'water_discipline') {
                        logDetail += ` ${newOppChar.name} resists the bleed!`;
                    } else {
                        // putrid_aura: Bacterian bleed effects last +1 extra turn
                        const bleedDur = (effect === 'bleed' && activeChar.passive?.id === 'putrid_aura') ? effectDuration + 1 : effectDuration;
                        newOppChar.statusEffects = [...newOppChar.statusEffects, { effect, duration: bleedDur }];
                        logDetail += effect === 'weaken' ? ` ${newOppChar.name} is WEAKENED for ${effectDuration} turn(s)!`
                            : effect === 'poison' ? ` ${newOppChar.name} is POISONED for ${effectDuration} turn(s)!`
                            : ` ${newOppChar.name} is BLEEDING for ${bleedDur} turn(s)!`;
                    }
                } else if (effect === 'stun') {
                    // potara_mastery: Vegito immune to stun; immortal_body: Frieza immune to stun
                    if (newOppChar.passive?.id === 'potara_mastery' || newOppChar.passive?.id === 'immortal_body') {
                        logDetail += ` ${newOppChar.name} resists the stun!`;
                    } else {
                        // demon_curse / psychic_dominance: stun lasts +1 extra turn
                        const stunDur = (activeChar.passive?.id === 'demon_curse' || activeChar.passive?.id === 'psychic_dominance') ? effectDuration + 1 : effectDuration;
                        newOppChar.statusEffects = [...newOppChar.statusEffects, { effect: 'stun', duration: stunDur }];
                        logDetail += ` ${newOppChar.name} is STUNNED for ${stunDur} turn(s)!`;
                    }
                }
            }

            // AOE already updated newOppRoster via .map(); sync newOppChar so the win-check below sees correct HP
            if (effect !== 'aoe') {
                newOppRoster[state.opponentActiveIndex] = newOppChar;
            } else {
                newOppChar = { ...newOppRoster[state.opponentActiveIndex] };
            }

        } else if (actionType === 'dodge') {
            let dodgingChar = {
                ...newPlayerRoster[state.playerActiveIndex],
                statusEffects: [
                    ...newPlayerRoster[state.playerActiveIndex].statusEffects,
                    { effect: 'dodging' as EffectType, duration: 1 },
                ],
            };
            // battle_pose: Recoome gains ATK boost after dodging
            if (activeChar.passive?.id === 'battle_pose')
                dodgingChar = { ...dodgingChar, passiveStacks: 1 };
            newPlayerRoster[state.playerActiveIndex] = dodgingChar;
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
                set({ winner: 'player', lastBattlePoints: pts }); // FIX #2
                get().setPhase('gameOver');
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

        if (state.isOnlineMatch) {
            import("../../multiplayer/matchService").then(m => m.selectAction('pass'));
            return;
        }

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

            // Self-targeted effects — not affected by player dodge
            if (action.effect === 'heal') {
                const healAmt = Math.max(1, Math.floor(botChar.maxHp * 0.25));
                newOppRoster[state.opponentActiveIndex] = {
                    ...newOppRoster[state.opponentActiveIndex],
                    currentHp: Math.min(botChar.maxHp, botChar.currentHp + healAmt),
                };
                logDetail = `${botChar.name} used ${actionName}. Heals for ${healAmt} HP!`;
            } else if (action.effect === 'healAll') {
                let totalHeal = 0;
                newOppRoster.forEach((pc, idx) => {
                    if (pc.currentHp <= 0) return;
                    const healAmt = Math.max(1, Math.floor(pc.maxHp * 0.20));
                    totalHeal += healAmt;
                    newOppRoster[idx] = { ...pc, currentHp: Math.min(pc.maxHp, pc.currentHp + healAmt) };
                });
                logDetail = `${botChar.name} used ${actionName}. Heals all allies for ${totalHeal} total HP!`;
            } else if (action.effect === 'clear') {
                const before = newOppRoster[state.opponentActiveIndex].statusEffects.length;
                newOppRoster[state.opponentActiveIndex] = {
                    ...newOppRoster[state.opponentActiveIndex],
                    statusEffects: newOppRoster[state.opponentActiveIndex].statusEffects.filter(
                        se => !['poison', 'bleed', 'weaken', 'stun'].includes(se.effect),
                    ),
                };
                const cleared = before - newOppRoster[state.opponentActiveIndex].statusEffects.length;
                logDetail = cleared > 0
                    ? `${botChar.name} used ${actionName}. Cleared ${cleared} negative effect(s)!`
                    : `${botChar.name} used ${actionName}. Nothing to clear.`;
            } else if (action.effect === 'energy') {
                oe = capEnergy({ ...oe, universal: (oe.universal || 0) + 2 });
                logDetail = `${botChar.name} used ${actionName}. Gained energy boost!`;
            } else if (action.effect === 'senzu') {
                const dur = action.effectDuration ?? 1;
                newOppRoster[state.opponentActiveIndex] = {
                    ...newOppRoster[state.opponentActiveIndex],
                    statusEffects: [
                        ...newOppRoster[state.opponentActiveIndex].statusEffects,
                        { effect: 'senzu' as EffectType, duration: dur },
                    ],
                };
                logDetail = `${botChar.name} used ${actionName}. Gains a damage boost for ${dur} turn(s)!`;
            } else {
                // Opponent-targeted effects — check player dodge first
                // saiyan_instinct & speed_demon: +20% dodge success rate
                const baseRate = updatedPlayerChar.dodge.successRate;
                const effectiveDodgeRate = (updatedPlayerChar.passive?.id === 'saiyan_instinct' || updatedPlayerChar.passive?.id === 'speed_demon')
                    ? Math.min(1, baseRate + 0.2)
                    : baseRate;
                if (isDodging(updatedPlayerChar) && Math.random() < effectiveDodgeRate) {
                    logDetail = `${botChar.name} used ${actionName} but ${updatedPlayerChar.name} dodged it!`;
                    updatedPlayerChar = {
                        ...updatedPlayerChar,
                        statusEffects: updatedPlayerChar.statusEffects.filter(e => e.effect !== 'dodging'),
                    };
                } else if (action.effect === 'drain') {
                    const botCurrent = newOppRoster[state.opponentActiveIndex];
                    let actualDamage = computeDamage(botCurrent, updatedPlayerChar, action.damage, 'none');
                    // monster_transform: Zarbon drain +25%
                    if (botCurrent.passive?.id === 'monster_transform') actualDamage = Math.floor(actualDamage * 1.25);
                    // fathers_prophecy: player's Bardock survives lethal drain (once)
                    if (updatedPlayerChar.passive?.id === 'fathers_prophecy' && (updatedPlayerChar.passiveStacks ?? 0) === 0 && updatedPlayerChar.currentHp - actualDamage <= 0 && updatedPlayerChar.currentHp > 1) {
                        actualDamage = updatedPlayerChar.currentHp - 1;
                        updatedPlayerChar = { ...updatedPlayerChar, passiveStacks: 1 };
                        logDetail = `${botChar.name} used ${actionName}. ${updatedPlayerChar.name}'s vision saves him!`;
                    }
                    updatedPlayerChar = { ...updatedPlayerChar, currentHp: Math.max(0, updatedPlayerChar.currentHp - actualDamage) };
                    const heal = Math.floor(actualDamage * 0.5);
                    newOppRoster[state.opponentActiveIndex] = { ...botCurrent, currentHp: Math.min(botCurrent.maxHp, botCurrent.currentHp + heal) };
                    logDetail = `${botChar.name} used ${actionName}. Deals ${actualDamage} damage and drains ${heal} HP!`;
                } else if (action.effect === 'aoe') {
                    let totalDeals = 0;
                    const botAttacker = newOppRoster[state.opponentActiveIndex];
                    const botAliveAllies = newOppRoster.filter((c, idx) => idx !== state.opponentActiveIndex && c.currentHp > 0).length;
                    newPlayerRoster.forEach((tar, idx) => {
                        if (tar.currentHp <= 0) return;
                        let actualDamage = computeDamage(botAttacker, tar, action.damage, 'none', { attackerAliveAllies: botAliveAllies });
                        // ghost_army: Gotenks AOE +20%
                        if (botAttacker.passive?.id === 'ghost_army') actualDamage = Math.floor(actualDamage * 1.20);
                        totalDeals += actualDamage;
                        let updated = { ...tar, currentHp: Math.max(0, tar.currentHp - actualDamage) };
                        // perfect_adaptation: Cell DEF stacks
                        if (updated.passive?.id === 'perfect_adaptation' && actualDamage > 0)
                            updated = { ...updated, passiveStacks: Math.min((updated.passiveStacks ?? 0) + 1, 3) };
                        // battle_frenzy: Launch stacks when hit
                        if (updated.passive?.id === 'battle_frenzy' && actualDamage > 0)
                            updated = { ...updated, passiveStacks: Math.min((updated.passiveStacks ?? 0) + 1, 3) };
                        newPlayerRoster[idx] = updated;
                    });
                    updatedPlayerChar = newPlayerRoster[state.playerActiveIndex];
                    logDetail = `${botChar.name} used ${actionName}. Deals ${totalDeals} total damage to all opponents!`;
                } else {
                    const botCurrent = newOppRoster[state.opponentActiveIndex];
                    const botAllyKOs = newOppRoster.filter((c, idx) => idx !== state.opponentActiveIndex && c.currentHp <= 0).length;
                    const botAliveAllies = newOppRoster.filter((c, idx) => idx !== state.opponentActiveIndex && c.currentHp > 0).length;
                    const playerAliveAllies = newPlayerRoster.filter((c, idx) => idx !== state.playerActiveIndex && c.currentHp > 0).length;
                    let actualDamage = computeDamage(
                        botCurrent, updatedPlayerChar, action.damage, action.effect,
                        { attackerAllyKOs: botAllyKOs, defenderAliveAllies: playerAliveAllies, attackerAliveAllies: botAliveAllies },
                    );
                    // fathers_prophecy: player's Bardock survives lethal hit (once)
                    if (updatedPlayerChar.passive?.id === 'fathers_prophecy' && (updatedPlayerChar.passiveStacks ?? 0) === 0 && updatedPlayerChar.currentHp - actualDamage <= 0 && updatedPlayerChar.currentHp > 1) {
                        actualDamage = updatedPlayerChar.currentHp - 1;
                        updatedPlayerChar = { ...updatedPlayerChar, passiveStacks: 1 };
                        logDetail = `${botChar.name} used ${actionName}. ${updatedPlayerChar.name}'s vision saves him!`;
                    }
                    updatedPlayerChar = { ...updatedPlayerChar, currentHp: Math.max(0, updatedPlayerChar.currentHp - actualDamage) };
                    logDetail = `${botChar.name} used ${actionName}. Deals ${actualDamage} damage!`;

                    // legendary_power: Broly rage stacks
                    if (updatedPlayerChar.passive?.id === 'legendary_power' && actualDamage > 0)
                        updatedPlayerChar = { ...updatedPlayerChar, passiveStacks: Math.min((updatedPlayerChar.passiveStacks ?? 0) + 1, 3) };
                    // perfect_adaptation: Cell DEF stacks
                    if (updatedPlayerChar.passive?.id === 'perfect_adaptation' && actualDamage > 0)
                        updatedPlayerChar = { ...updatedPlayerChar, passiveStacks: Math.min((updatedPlayerChar.passiveStacks ?? 0) + 1, 3) };
                    // battle_frenzy: Launch stacks when hit
                    if (updatedPlayerChar.passive?.id === 'battle_frenzy' && actualDamage > 0)
                        updatedPlayerChar = { ...updatedPlayerChar, passiveStacks: Math.min((updatedPlayerChar.passiveStacks ?? 0) + 1, 3) };
                    // first_strike: mark bot's Tao as used after technique
                    if (botCurrent.passive?.id === 'first_strike' && (botCurrent.passiveStacks ?? 0) === 0)
                        newOppRoster[state.opponentActiveIndex] = { ...newOppRoster[state.opponentActiveIndex], passiveStacks: 1 };

                    const dur = action.effectDuration ?? 1;
                    // BUG 11 FIX: buff and regen are self-targeted
                    if (['buff', 'regen'].includes(action.effect)) {
                        newOppRoster[state.opponentActiveIndex] = {
                            ...newOppRoster[state.opponentActiveIndex],
                            statusEffects: [
                                ...newOppRoster[state.opponentActiveIndex].statusEffects,
                                { effect: action.effect as EffectType, duration: dur },
                            ],
                        };
                        logDetail += action.effect === 'buff' ? ` ${botChar.name} is BUFFED!` : ` ${botChar.name} will regenerate HP.`;
                    } else if (['weaken', 'poison', 'bleed'].includes(action.effect)) {
                        // mental_fortress: Guldo immune to weaken; iron_will: Android 16 immune to bleed/poison; water_discipline: Nam immune to bleed
                        if (action.effect === 'weaken' && updatedPlayerChar.passive?.id === 'mental_fortress') {
                            logDetail += ` ${updatedPlayerChar.name} resists the weaken!`;
                        } else if (['bleed', 'poison'].includes(action.effect) && updatedPlayerChar.passive?.id === 'iron_will') {
                            logDetail += ` ${updatedPlayerChar.name} resists the ${action.effect}!`;
                        } else if (action.effect === 'bleed' && updatedPlayerChar.passive?.id === 'water_discipline') {
                            logDetail += ` ${updatedPlayerChar.name} resists the bleed!`;
                        } else {
                            // putrid_aura: Bacterian bleed effects last +1 extra turn
                            const bleedDur = (action.effect === 'bleed' && botCurrent.passive?.id === 'putrid_aura') ? dur + 1 : dur;
                            updatedPlayerChar = { ...updatedPlayerChar, statusEffects: [...updatedPlayerChar.statusEffects, { effect: action.effect as EffectType, duration: bleedDur }] };
                            logDetail += action.effect === 'weaken' ? ` ${updatedPlayerChar.name} is WEAKENED!`
                                : action.effect === 'poison' ? ` ${updatedPlayerChar.name} is POISONED!`
                                : ` ${updatedPlayerChar.name} is BLEEDING!`;
                        }
                    } else if (action.effect === 'stun') {
                        // potara_mastery & immortal_body: immune to stun
                        if (updatedPlayerChar.passive?.id === 'potara_mastery' || updatedPlayerChar.passive?.id === 'immortal_body') {
                            logDetail += ` ${updatedPlayerChar.name} resists the stun!`;
                        } else {
                            // demon_curse / psychic_dominance: stun lasts +1 extra turn
                            const stunDur = (botCurrent.passive?.id === 'demon_curse' || botCurrent.passive?.id === 'psychic_dominance') ? dur + 1 : dur;
                            updatedPlayerChar = { ...updatedPlayerChar, statusEffects: [...updatedPlayerChar.statusEffects, { effect: 'stun', duration: stunDur }] };
                            logDetail += ` ${updatedPlayerChar.name} is STUNNED for ${stunDur} turn(s)!`;
                        }
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
                set({ winner: 'opponent', lastBattlePoints: pts }); // FIX #2
                get().setPhase('gameOver');
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

        if (s.isOnlineMatch) {
            import("../../multiplayer/matchService").then(m => m.surrenderMatch());
            // Wait for server to confirm gameOver
            return;
        }

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
            combatLogs: [log, ...s.combatLogs],
            lastBattlePoints: pts,
        });
        get().setPhase('gameOver');
        get().addScore(pts);
    },

    winByOpponentDisconnect: () => {
        const s = get();
        if (s.phase !== 'battle' || s.winner) return;

        const log: CombatLogEntry = {
            id: Date.now(),
            turn: s.turnNumber,
            playerName: 'System',
            characterName: '',
            action: 'Disconnect',
            details: 'Opponent disconnected — you win by forfeit!',
            isOpponent: false,
        };

        const pts = calculateBattlePoints(s.playerRoster, s.opponentRoster, 'player');
        set({
            winner: 'player',
            combatLogs: [log, ...s.combatLogs],
            lastBattlePoints: pts,
        });
        get().setPhase('gameOver');
        get().addScore(pts);
    },

    endTurn: () => {
        const s = get();
        if (s.winner) return;

        // ── Online mode ──────────────────────────────────────────────────────
        if (s.isOnlineMatch) {
            if (!s.isPlayerTurn) return; // safety guard

            if (s.myRole === 'player2') {
                // Player2 is always the second-to-act in a round → run end-of-round effects
                let pRoster = s.playerRoster.map((c) => decrementCooldowns(decrementEffects(c)));
                let oRoster = s.opponentRoster.map((c) => decrementCooldowns(decrementEffects(c)));

                const pAlive = pRoster.filter(c => c.currentHp > 0).length;
                const oAlive = oRoster.filter(c => c.currentHp > 0).length;

                if (oAlive === 0) {
                    const pts = calculateBattlePoints(pRoster, oRoster, 'player');
                    set({ playerRoster: pRoster, opponentRoster: oRoster, winner: 'player', lastBattlePoints: pts, isPlayerTurn: false, playerActionsUsed: {} });
                    get().setPhase('gameOver');
                    get().addScore(pts);
                    return;
                }
                if (pAlive === 0) {
                    const pts = calculateBattlePoints(pRoster, oRoster, 'opponent');
                    set({ playerRoster: pRoster, opponentRoster: oRoster, winner: 'opponent', lastBattlePoints: pts, isPlayerTurn: false, playerActionsUsed: {} });
                    get().setPhase('gameOver');
                    get().addScore(pts);
                    return;
                }

                let pe = grantEnergy(s.playerEnergy, pAlive);
                let oe = grantEnergy(s.opponentEnergy, oAlive);
                pRoster.forEach(c => {
                    if (c.currentHp <= 0) return;
                    if (c.passive?.id === 'infinite_energy') pe = capEnergy({ ...pe, universal: (pe.universal || 0) + 1 });
                    if (c.passive?.id === 'android_link')    pe = capEnergy({ ...pe, physical: (pe.physical || 0) + 1 });
                });
                oRoster.forEach(c => {
                    if (c.currentHp <= 0) return;
                    if (c.passive?.id === 'infinite_energy') oe = capEnergy({ ...oe, universal: (oe.universal || 0) + 1 });
                    if (c.passive?.id === 'android_link')    oe = capEnergy({ ...oe, physical: (oe.physical || 0) + 1 });
                });
                pRoster = pRoster.map(c => (c.passive?.id === 'low_class_fury' && c.currentHp > 0)
                    ? { ...c, passiveStacks: Math.min((c.passiveStacks ?? 0) + 1, 5) } : c);
                oRoster = oRoster.map(c => (c.passive?.id === 'low_class_fury' && c.currentHp > 0)
                    ? { ...c, passiveStacks: Math.min((c.passiveStacks ?? 0) + 1, 5) } : c);
                // first_strike: reset usage flag each round
                pRoster = pRoster.map(c => (c.passive?.id === 'first_strike' && c.currentHp > 0) ? { ...c, passiveStacks: 0 } : c);
                oRoster = oRoster.map(c => (c.passive?.id === 'first_strike' && c.currentHp > 0) ? { ...c, passiveStacks: 0 } : c);

                set({
                    playerRoster: pRoster, opponentRoster: oRoster,
                    playerEnergy: pe, opponentEnergy: oe,
                    turnNumber: s.turnNumber + 1,
                    isPlayerTurn: false, // BattleArena posts snapshot; poll brings isPlayerTurn back to true
                    playerActionsUsed: {},
                });
            } else {
                // Player1 just finished — wait for player2
                set({ isPlayerTurn: false, playerActionsUsed: {} });
            }
            return;
        }
        // ── End online mode ──────────────────────────────────────────────────

        if (!s.isPlayerTurn) {
            let pRoster = s.playerRoster.map((c) => decrementCooldowns(decrementEffects(c)));
            let oRoster = s.opponentRoster.map((c) => decrementCooldowns(decrementEffects(c)));

            const pAlive = pRoster.filter(c => c.currentHp > 0).length;
            const oAlive = oRoster.filter(c => c.currentHp > 0).length;

            // Win check after DoT/regen effects — handles poison/bleed kills between turns
            if (oAlive === 0) {
                const pts = calculateBattlePoints(pRoster, oRoster, 'player');
                set({ playerRoster: pRoster, opponentRoster: oRoster, winner: 'player', lastBattlePoints: pts });
                get().setPhase('gameOver');
                get().addScore(pts);
                return;
            }
            if (pAlive === 0) {
                const pts = calculateBattlePoints(pRoster, oRoster, 'opponent');
                set({ playerRoster: pRoster, opponentRoster: oRoster, winner: 'opponent', lastBattlePoints: pts });
                get().setPhase('gameOver');
                get().addScore(pts);
                return;
            }

            let pe = grantEnergy(s.playerEnergy, pAlive);
            let oe = grantEnergy(s.opponentEnergy, oAlive);

            // Passive per-round effects
            pRoster.forEach(c => {
                if (c.currentHp <= 0) return;
                if (c.passive?.id === 'infinite_energy') pe = capEnergy({ ...pe, universal: (pe.universal || 0) + 1 });
                if (c.passive?.id === 'android_link')    pe = capEnergy({ ...pe, physical: (pe.physical || 0) + 1 });
            });
            oRoster.forEach(c => {
                if (c.currentHp <= 0) return;
                if (c.passive?.id === 'infinite_energy') oe = capEnergy({ ...oe, universal: (oe.universal || 0) + 1 });
                if (c.passive?.id === 'android_link')    oe = capEnergy({ ...oe, physical: (oe.physical || 0) + 1 });
            });
            // low_class_fury: Raditz gains fury stacks each round (max 5)
            pRoster = pRoster.map(c => (c.passive?.id === 'low_class_fury' && c.currentHp > 0)
                ? { ...c, passiveStacks: Math.min((c.passiveStacks ?? 0) + 1, 5) } : c);
            oRoster = oRoster.map(c => (c.passive?.id === 'low_class_fury' && c.currentHp > 0)
                ? { ...c, passiveStacks: Math.min((c.passiveStacks ?? 0) + 1, 5) } : c);
            // first_strike: reset usage flag each round
            pRoster = pRoster.map(c => (c.passive?.id === 'first_strike' && c.currentHp > 0) ? { ...c, passiveStacks: 0 } : c);
            oRoster = oRoster.map(c => (c.passive?.id === 'first_strike' && c.currentHp > 0) ? { ...c, passiveStacks: 0 } : c);

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

    // ── Online: apply opponent's state snapshot received from server ──────────
    applyOnlineBattleSnapshot: (snap, myRole) => {
        const mySide  = myRole === 'player1' ? snap.p1 : snap.p2;
        const opSide  = myRole === 'player1' ? snap.p2 : snap.p1;

        // Ensure we preserve local Character details (like image, name) if the backend only sends partial or full roster.
        // Actually the backend sends the FULL BattleCharacter object now.
        const newPlayerRoster = mySide.roster;
        const newOpponentRoster = opSide.roster;

        const isPlayerTurn = snap.whoseTurn === myRole;
        let winner: 'player' | 'opponent' | null = null;
        if (snap.winner === myRole) winner = 'player';
        else if (snap.winner !== null) winner = 'opponent';

        set({
            playerRoster: newPlayerRoster,
            opponentRoster: newOpponentRoster,
            playerActiveIndex: mySide.activeIndex,
            opponentActiveIndex: opSide.activeIndex,
            playerEnergy: mySide.energy,
            opponentEnergy: opSide.energy,
            turnNumber: snap.turnNumber,
            combatLogs: snap.combatLogs,
            isPlayerTurn,
            winner,
            playerActionsUsed: mySide.actionsUsed || {},
        });

        if (winner !== null) {
            const pts = calculateBattlePoints(newPlayerRoster, newOpponentRoster, winner);
            set({ lastBattlePoints: pts });
            get().setPhase('gameOver');
            get().addScore(pts);
        }
    },
});
