import { create } from 'zustand';
import type { Character, PlayerEnergy, CombatLogEntry, ActionCost, EffectType } from '../types';
import { INITIAL_CHARACTERS } from '../data/characters';

export type GamePhase = 'login' | 'menu' | 'matchmaking' | 'draft' | 'battle' | 'gameOver';

export interface BattleCharacter extends Character {
    currentHp: number;
    cooldowns: Record<string, number>; // technique/dodge ID -> turns remaining
    statusEffects: { effect: EffectType; duration: number }[];
}

interface GameState {
    phase: GamePhase;
    matchmakingTimer: number;

    // Player Profile
    playerName: string;
    playerRank: string;
    playerScore: number;
    loginError: string | null;

    // Draft Phase
    playerRoster: BattleCharacter[];
    opponentRoster: BattleCharacter[];
    availableCharacters: Character[];
    draftTurn: 'player' | 'opponent';

    // Battle Phase
    playerActiveIndex: number;
    opponentActiveIndex: number;
    playerEnergy: PlayerEnergy;
    opponentEnergy: PlayerEnergy;
    turnNumber: number;
    isPlayerTurn: boolean;
    combatLogs: CombatLogEntry[];
    winner: 'player' | 'opponent' | null;

    // Actions
    login: (name: string, password?: string) => void;
    register: (name: string, password?: string) => void;
    logout: () => void;
    addScore: (points: number) => void;
    setPhase: (phase: GamePhase) => void;
    startMatchmaking: () => void;
    tickMatchmaking: () => void;
    startDraft: () => void;
    draftCharacter: (characterId: string) => void;
    botDraftPick: () => void;
    startBattle: () => void;

    // Battle Actions
    setPlayerActiveIndex: (index: number) => void;
    executePlayerAction: (actionType: 'technique' | 'dodge', actionId: string) => void;
    passTurn: () => void;
    executeOpponentTurn: () => void;
    endTurn: () => void;
}

const initialEnergy: PlayerEnergy = { ki: 0, physical: 0, special: 0, universal: 0 };

const accounts = JSON.parse(localStorage.getItem('dba_accounts') || '{}');
const currentUser = localStorage.getItem('dba_current_user');
const savedData = currentUser ? accounts[currentUser] : null;

export const useGameState = create<GameState>((set, get) => ({
    phase: savedData ? 'menu' : 'login',
    matchmakingTimer: 30,

    playerName: savedData?.name || '',
    playerRank: savedData?.rank || 'Saibaman',
    playerScore: savedData?.score || 0,
    loginError: null,

    playerRoster: [],
    opponentRoster: [],
    availableCharacters: [...INITIAL_CHARACTERS],
    draftTurn: 'player',

    playerActiveIndex: 0,
    opponentActiveIndex: 0,
    playerEnergy: { ...initialEnergy },
    opponentEnergy: { ...initialEnergy },
    turnNumber: 1,
    isPlayerTurn: true,
    combatLogs: [],
    winner: null,

    login: (name: string, password?: string) => {
        const accs = JSON.parse(localStorage.getItem('dba_accounts') || '{}');
        const user = accs[name];

        if (!user) {
            set({ loginError: 'Account not found. Please register.' });
            return;
        }

        if (user.password !== password) {
            set({ loginError: 'Incorrect password.' });
            return;
        }

        localStorage.setItem('dba_current_user', name);
        set({
            playerName: user.name,
            playerRank: user.rank,
            playerScore: user.score,
            phase: 'menu',
            loginError: null
        });
    },

    register: (name: string, password?: string) => {
        const accs = JSON.parse(localStorage.getItem('dba_accounts') || '{}');
        if (accs[name]) {
            set({ loginError: 'Username already exists.' });
            return;
        }

        const newUser = { name, password, rank: 'Saibaman', score: 0 };
        accs[name] = newUser;
        localStorage.setItem('dba_accounts', JSON.stringify(accs));
        localStorage.setItem('dba_current_user', name);

        set({
            playerName: name,
            playerRank: 'Saibaman',
            playerScore: 0,
            phase: 'menu',
            loginError: null
        });
    },

    logout: () => {
        localStorage.removeItem('dba_current_user');
        set({
            playerName: '',
            playerRank: '',
            playerScore: 0,
            phase: 'login',
            loginError: null
        });
    },

    addScore: (points: number) => {
        const s = get();
        const newScore = s.playerScore + points;
        let newRank = s.playerRank;

        if (newScore >= 500) newRank = 'Super Saiyan';
        else if (newScore >= 250) newRank = 'Elite';
        else if (newScore >= 100) newRank = 'Raditz';

        const accs = JSON.parse(localStorage.getItem('dba_accounts') || '{}');
        if (accs[s.playerName]) {
            accs[s.playerName].rank = newRank;
            accs[s.playerName].score = newScore;
            localStorage.setItem('dba_accounts', JSON.stringify(accs));
        }

        set({ playerScore: newScore, playerRank: newRank });
    },

    setPhase: (phase) => set({ phase }),

    startMatchmaking: () => {
        set({ phase: 'matchmaking', matchmakingTimer: 30 });
    },

    tickMatchmaking: () => {
        const { matchmakingTimer } = get();
        if (matchmakingTimer > 0) {
            set({ matchmakingTimer: matchmakingTimer - 1 });
        } else {
            get().startDraft();
        }
    },

    startDraft: () => {
        set({
            phase: 'draft',
            playerRoster: [],
            opponentRoster: [],
            availableCharacters: [...INITIAL_CHARACTERS],
            draftTurn: 'player',
            winner: null,
            combatLogs: []
        });
    },

    draftCharacter: (characterId) => {
        const { phase, draftTurn, availableCharacters, playerRoster, opponentRoster } = get();
        if (phase !== 'draft' || draftTurn !== 'player' || playerRoster.length >= 3) return;

        const charIndex = availableCharacters.findIndex(c => c.id === characterId);
        if (charIndex === -1) return;

        const char = availableCharacters[charIndex];
        const newAvailable = [...availableCharacters];
        newAvailable.splice(charIndex, 1);

        const newRoster = [...playerRoster, { ...char, currentHp: char.maxHp, cooldowns: {}, statusEffects: [] }];

        set({ playerRoster: newRoster, availableCharacters: newAvailable });

        if (newRoster.length === 3 && opponentRoster.length === 3) {
            get().startBattle();
        } else {
            set({ draftTurn: 'opponent' });
            setTimeout(() => get().botDraftPick(), 800); // Simulate bot thinking
        }
    },

    botDraftPick: () => {
        const { phase, availableCharacters, opponentRoster, playerRoster } = get();
        if (phase !== 'draft' || availableCharacters.length === 0 || opponentRoster.length >= 3) return;

        // Random pick
        const randomIndex = Math.floor(Math.random() * availableCharacters.length);
        const char = availableCharacters[randomIndex];

        const newAvailable = [...availableCharacters];
        newAvailable.splice(randomIndex, 1);

        const newRoster = [...opponentRoster, { ...char, currentHp: char.maxHp, cooldowns: {}, statusEffects: [] }];

        set({ opponentRoster: newRoster, availableCharacters: newAvailable });

        if (newRoster.length === 3 && playerRoster.length === 3) {
            get().startBattle();
        } else {
            set({ draftTurn: 'player' });
        }
    },

    startBattle: () => {
        // Both players get 1 random energy at start of turn 1
        // Change: No free energy on turn 1 start, wait for end of turn 1 to generate energy based on alive characters.
        // Wait, normally they need energy on Turn 1 to do anything. Let's give them 1 per alive character on start.
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
                details: 'The battle begins!',
                isOpponent: false
            }]
        });
    },

    setPlayerActiveIndex: (index: number) => {
        const state = get();
        if (state.phase === 'battle' && state.playerRoster[index] && state.playerRoster[index].currentHp > 0) {
            set({ playerActiveIndex: index });
        }
    },

    executePlayerAction: (actionType, actionId) => {
        const state = get();
        if (!state.isPlayerTurn || state.phase !== 'battle' || state.winner) return;

        const activeChar = state.playerRoster[state.playerActiveIndex];
        const oppChar = state.opponentRoster[state.opponentActiveIndex];

        let energyCost: ActionCost = {};
        let actionName = '';
        let damage = 0;
        let effect: EffectType = 'none';
        let cooldown = 0;

        // Find action
        if (actionType === 'technique') {
            const tech = activeChar.techniques.find(t => t.id === actionId);
            if (!tech) return;
            if (activeChar.cooldowns[tech.id] > 0) return; // Cooldown active

            energyCost = tech.cost;
            actionName = tech.name;
            damage = tech.damage;
            effect = tech.effect;
            cooldown = tech.cooldown;

        } else if (actionType === 'dodge') {
            if (activeChar.dodge.name !== actionId) return;
            if (activeChar.cooldowns['dodge'] > 0) return;

            energyCost = activeChar.dodge.cost;
            actionName = activeChar.dodge.name;
            cooldown = activeChar.dodge.cooldown;
            // Dodge effect handled below
        }

        // Check energy
        const pe = { ...state.playerEnergy };
        if ((energyCost.ki && pe.ki < energyCost.ki) ||
            (energyCost.physical && pe.physical < energyCost.physical) ||
            (energyCost.special && pe.special < energyCost.special)) {
            return; // Not enough energy
        }

        // Deduct energy
        if (energyCost.ki) pe.ki -= energyCost.ki;
        if (energyCost.physical) pe.physical -= energyCost.physical;
        if (energyCost.special) pe.special -= energyCost.special;

        // Apply cooldown
        const newPlayerRoster = [...state.playerRoster];
        newPlayerRoster[state.playerActiveIndex] = {
            ...activeChar,
            cooldowns: { ...activeChar.cooldowns, [actionId === activeChar.dodge.name ? 'dodge' : actionId]: cooldown }
        };

        const newOppRoster = [...state.opponentRoster];
        let newOppChar = { ...oppChar };

        let logDetail = `${activeChar.name} used ${actionName}.`;

        // Process damage
        if (actionType === 'technique') {
            // Basic damage calculation (simplistic for MVP)
            let actualDamage = damage * (activeChar.stats.attack / newOppChar.stats.defense);
            if (effect === 'pierce') actualDamage = damage; // Ignore defense
            actualDamage = Math.floor(actualDamage);

            newOppChar.currentHp -= actualDamage;
            logDetail += ` Deals ${actualDamage} damage!`;

            // Apply effect
            if (effect === 'weaken' || effect === 'stun') {
                newOppChar.statusEffects.push({ effect, duration: 1 });
                logDetail += ` Opponent is ${effect}ed!`;
            }
        } else {
            logDetail += ` Prepared to dodge!`;
            newPlayerRoster[state.playerActiveIndex].statusEffects.push({ effect: 'buff', duration: 1 }); // Simplish representation of dodge active
        }

        if (newOppChar.currentHp < 0) newOppChar.currentHp = 0;
        newOppRoster[state.opponentActiveIndex] = newOppChar;

        const newLog: CombatLogEntry = {
            id: Date.now(),
            turn: state.turnNumber,
            playerName: 'Player',
            characterName: activeChar.name,
            action: actionName,
            details: logDetail,
            isOpponent: false
        };

        set({
            playerEnergy: pe,
            playerRoster: newPlayerRoster,
            opponentRoster: newOppRoster,
            combatLogs: [newLog, ...state.combatLogs],
        });

        // Check death
        if (newOppChar.currentHp <= 0) {
            // Find next alive
            const nextOppIndex = newOppRoster.findIndex(c => c.currentHp > 0);
            if (nextOppIndex === -1) {
                set({ winner: 'player', phase: 'gameOver' });
                get().addScore(50); // Award points for winning
                return;
            } else {
                set({ opponentActiveIndex: nextOppIndex });
                set((s) => ({
                    combatLogs: [{
                        id: Date.now() + 1, turn: s.turnNumber, playerName: 'System', characterName: '',
                        action: 'Fallen', details: `${newOppChar.name} was defeated! ${newOppRoster[nextOppIndex].name} enters the battle!`, isOpponent: true
                    }, ...s.combatLogs]
                }));
            }
        }

        get().endTurn();
    },

    passTurn: () => {
        const state = get();
        if (!state.isPlayerTurn || state.phase !== 'battle' || state.winner) return;

        const activeChar = state.playerRoster[state.playerActiveIndex];
        const newLog: CombatLogEntry = {
            id: Date.now(),
            turn: state.turnNumber,
            playerName: 'Player',
            characterName: activeChar.name,
            action: 'Passed Turn',
            details: `${activeChar.name} conserved energy and passed their turn.`,
            isOpponent: false
        };

        set({ combatLogs: [newLog, ...state.combatLogs] });
        get().endTurn();
    },

    executeOpponentTurn: () => {
        // Very simple Bot AI
        const state = get();
        if (state.winner || state.phase !== 'battle') return;

        const botChar = state.opponentRoster[state.opponentActiveIndex];
        let oe = { ...state.opponentEnergy };

        // Find affordable action that is not on cooldown
        const availableActions = botChar.techniques.filter(t => {
            const cd = botChar.cooldowns[t.id] || 0;
            if (cd > 0) return false;
            if ((t.cost.ki || 0) > oe.ki) return false;
            if ((t.cost.physical || 0) > oe.physical) return false;
            if ((t.cost.special || 0) > oe.special) return false;
            return true;
        });

        let actionName = 'Passed';
        let logDetail = `${botChar.name} ended their turn.`;

        const newOppRoster = [...state.opponentRoster];
        const newPlayerRoster = [...state.playerRoster];
        let playerChar = { ...newPlayerRoster[state.playerActiveIndex] };

        if (availableActions.length > 0) {
            // Pick random available action
            const action = availableActions[Math.floor(Math.random() * availableActions.length)];

            if (action.cost.ki) oe.ki -= action.cost.ki;
            if (action.cost.physical) oe.physical -= action.cost.physical;
            if (action.cost.special) oe.special -= action.cost.special;

            newOppRoster[state.opponentActiveIndex] = {
                ...botChar,
                cooldowns: { ...botChar.cooldowns, [action.id]: action.cooldown }
            };

            actionName = action.name;

            let actualDamage = action.damage * (botChar.stats.attack / playerChar.stats.defense);
            if (action.effect === 'pierce') actualDamage = action.damage;

            // Check if player is dodging
            const playerIsDodging = playerChar.statusEffects.some(e => e.effect === 'buff');
            if (playerIsDodging && Math.random() < playerChar.dodge.successRate) {
                actualDamage = 0;
                logDetail = `${botChar.name} used ${actionName} but ${playerChar.name} dodged it!`;
            } else {
                actualDamage = Math.floor(actualDamage);
                playerChar.currentHp -= actualDamage;
                logDetail = `${botChar.name} used ${actionName}. Deals ${actualDamage} damage!`;
            }
        } else {
            // Just normal pass
        }

        if (playerChar.currentHp < 0) playerChar.currentHp = 0;
        newPlayerRoster[state.playerActiveIndex] = playerChar;

        const newLog: CombatLogEntry = {
            id: Date.now(),
            turn: state.turnNumber,
            playerName: 'Opponent',
            characterName: botChar.name,
            action: actionName,
            details: logDetail,
            isOpponent: true
        };

        set({
            opponentEnergy: oe,
            opponentRoster: newOppRoster,
            playerRoster: newPlayerRoster,
            combatLogs: [newLog, ...state.combatLogs],
        });

        // Check death
        if (playerChar.currentHp <= 0) {
            const nextPlayerIndex = newPlayerRoster.findIndex(c => c.currentHp > 0);
            if (nextPlayerIndex === -1) {
                set({ winner: 'opponent', phase: 'gameOver' });
                return;
            } else {
                set({ playerActiveIndex: nextPlayerIndex });
                set((s) => ({
                    combatLogs: [{
                        id: Date.now() + 1, turn: s.turnNumber, playerName: 'System', characterName: '',
                        action: 'Fallen', details: `${playerChar.name} was defeated! ${newPlayerRoster[nextPlayerIndex].name} enters the battle!`, isOpponent: false
                    }, ...s.combatLogs]
                }));
            }
        }

        get().endTurn();
    },

    endTurn: () => {
        const s = get();
        if (s.winner) return;

        if (!s.isPlayerTurn) {
            // End of round (both players took a turn)
            // Decrease cooldowns & effects, grant energy
            const pRoster = [...s.playerRoster];
            const oRoster = [...s.opponentRoster];

            // Reduce cooldowns for active characters
            const pChar = pRoster[s.playerActiveIndex];
            const oChar = oRoster[s.opponentActiveIndex];

            Object.keys(pChar.cooldowns).forEach(k => { if (pChar.cooldowns[k] > 0) pChar.cooldowns[k]--; });
            Object.keys(oChar.cooldowns).forEach(k => { if (oChar.cooldowns[k] > 0) oChar.cooldowns[k]--; });

            // Clear dodge effects (buffs used to simulate dodge)
            pChar.statusEffects = pChar.statusEffects.filter(e => e.effect !== 'buff');
            oChar.statusEffects = oChar.statusEffects.filter(e => e.effect !== 'buff');

            // Grant random energy per alive character
            const pAlive = pRoster.filter(c => c.currentHp > 0).length;
            const oAlive = oRoster.filter(c => c.currentHp > 0).length;
            const types = ['ki', 'physical', 'special'] as const;

            const pe = { ...s.playerEnergy };
            const oe = { ...s.opponentEnergy };

            let pTotal = pe.ki + pe.physical + pe.special;
            let oTotal = oe.ki + oe.physical + oe.special;

            for (let i = 0; i < pAlive; i++) {
                if (pTotal >= 10) break;
                pe[types[Math.floor(Math.random() * 3)]]++;
                pTotal++;
            }

            for (let i = 0; i < oAlive; i++) {
                if (oTotal >= 10) break;
                oe[types[Math.floor(Math.random() * 3)]]++;
                oTotal++;
            }

            set({
                playerRoster: pRoster,
                opponentRoster: oRoster,
                playerEnergy: pe,
                opponentEnergy: oe,
                turnNumber: s.turnNumber + 1,
                isPlayerTurn: true
            });
        } else {
            // End of player turn, now bot turn
            set({ isPlayerTurn: false });
            setTimeout(() => get().executeOpponentTurn(), 1000);
        }
    }
}));
