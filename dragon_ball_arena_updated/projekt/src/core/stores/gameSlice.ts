import type { StateCreator } from 'zustand';
import type { RootState } from './rootStore';
import type { MatchRole } from "../../multiplayer/matchService";

// ─── Łatwa do zmiany stała czasu oczekiwania w matchmakingu ───────────────────
export const MATCHMAKING_DURATION_SECONDS = 30;

export type GamePhase = 'login' | 'menu' | 'matchmaking' | 'draft' | 'battle' | 'gameOver' | 'ranking';

export interface GameSlice {
    phase: GamePhase;
    matchmakingTimer: number;
    matchFoundOpponent: string | null;  // real opponent username if found
    isRealMatch: boolean;               // true when matched with a real player

    // Online match state
    matchId: string | null;
    myRole: MatchRole | null;
    isOnlineMatch: boolean;
    isRanked: boolean;

    setPhase: (phase: GamePhase) => void;
    startMatchmaking: (ranked?: boolean) => void;
    tickMatchmaking: () => void;        // pure 1-second decrement — component drives transition
    setMatchFound: (opponentName: string) => void;
    setMatchSession: (matchId: string, role: MatchRole) => void;
    clearMatchSession: () => void;
    resetGame: () => void;
}

// Fix: use dba_session (new auth system) instead of old dba_current_user key
const savedSession = (() => {
    try { return JSON.parse(localStorage.getItem('dba_session') || 'null'); } catch { return null; }
})();

export const createGameSlice: StateCreator<RootState, [], [], GameSlice> = (set, get) => ({
    phase: savedSession ? 'menu' : 'login',
    matchmakingTimer: MATCHMAKING_DURATION_SECONDS,
    matchFoundOpponent: null,
    isRealMatch: false,
    matchId: null,
    myRole: null,
    isOnlineMatch: false,
    isRanked: true,

    setPhase: (phase) => set({ phase }),

    startMatchmaking: (ranked = true) => {
        set({
            phase: 'matchmaking',
            matchmakingTimer: MATCHMAKING_DURATION_SECONDS,
            matchFoundOpponent: null,
            isRealMatch: false,
            matchId: null,
            myRole: null,
            isOnlineMatch: false,
            isRanked: ranked,
        });
    },

    // Pure decrement — does NOT auto-start draft; Matchmaking.tsx drives the transition
    tickMatchmaking: () => {
        const { matchmakingTimer } = get();
        if (matchmakingTimer > 0) {
            set({ matchmakingTimer: matchmakingTimer - 1 });
        }
    },

    setMatchFound: (opponentName: string) => {
        set({ matchFoundOpponent: opponentName, isRealMatch: true });
    },

    setMatchSession: (matchId: string, role: MatchRole) => {
        set({ matchId, myRole: role, isOnlineMatch: true });
    },

    clearMatchSession: () => {
        set({ matchId: null, myRole: null, isOnlineMatch: false });
    },

    resetGame: () => {
        // Disconnect from multiplayer if active
        import("../../multiplayer/matchService").then(m => m.disconnectSocket());

        // Reset only GameSlice state; draft and battle slices reset themselves
        set({
            phase: 'menu',
            matchFoundOpponent: null,
            isRealMatch: false,
            matchId: null,
            myRole: null,
            isOnlineMatch: false,
        });
        get().resetDraft();
        get().resetBattle();
    },
});
