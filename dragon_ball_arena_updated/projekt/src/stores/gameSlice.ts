import type { StateCreator } from 'zustand';
import type { RootState } from './rootStore';
import { INITIAL_CHARACTERS } from '../data/characters'; // FIX #3

export type GamePhase = 'login' | 'menu' | 'matchmaking' | 'draft' | 'battle' | 'gameOver';

export interface GameSlice {
    phase: GamePhase;
    matchmakingTimer: number;

    setPhase: (phase: GamePhase) => void;
    startMatchmaking: () => void;
    tickMatchmaking: () => void;
    resetGame: () => void;
}

const currentUser = localStorage.getItem('dba_current_user');

export const createGameSlice: StateCreator<RootState, [], [], GameSlice> = (set, get) => ({
    phase: currentUser ? 'menu' : 'login',
    matchmakingTimer: 30,

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

    resetGame: () => {
        set({
            phase: 'menu',
            playerRoster: [],
            opponentRoster: [],
            availableCharacters: [...INITIAL_CHARACTERS], // FIX #3: było []
            draftTurn: 'player',
            draftTierUsed: 0,
            opponentTierUsed: 0,
            playerActiveIndex: 0,
            opponentActiveIndex: 0,
            playerEnergy: { ki: 0, physical: 0, special: 0, universal: 0 },
            opponentEnergy: { ki: 0, physical: 0, special: 0, universal: 0 },
            turnNumber: 1,
            isPlayerTurn: true,
            combatLogs: [],
            winner: null,
            lastBattlePoints: 0,
        });
    },
});
