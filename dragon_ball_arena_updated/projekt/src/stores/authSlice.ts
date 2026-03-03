import type { StateCreator } from 'zustand';
import type { RootState } from './rootStore';
import { RANK_THRESHOLDS } from '../types';

export interface AuthSlice {
    playerName: string;
    playerRank: string;
    playerScore: number;
    playerWins: number;
    playerLosses: number;
    playerWinStreak: number;
    playerBestStreak: number;
    loginError: string | null;
    loginLoading: boolean;
    isGuest: boolean;

    login: (name: string, password: string) => Promise<void>;
    register: (name: string, password: string) => Promise<void>;
    loginAsGuest: () => void;
    logout: () => void;
    addScore: (points: number) => void;
}

export function getRankForScore(score: number): string {
    for (const { threshold, rank } of RANK_THRESHOLDS) {
        if (score >= threshold) return rank;
    }
    return 'Saibaman';
}

const API = '/api/users';

// ── Restore session from localStorage (non-guest only) ────────────────────────
const savedSession = (() => {
    try {
        const raw = localStorage.getItem('dba_session');
        return raw ? JSON.parse(raw) : null;
    } catch { return null; }
})();

type UserRecord = {
    id: string; name: string; password: string; score: number;
    wins?: number; losses?: number; winStreak?: number; bestStreak?: number;
};

export const createAuthSlice: StateCreator<RootState, [], [], AuthSlice> = (set, get) => ({
    playerName: savedSession?.name || '',
    playerRank: savedSession?.rank || 'Saibaman',
    playerScore: savedSession?.score ?? 0,
    playerWins: savedSession?.wins ?? 0,
    playerLosses: savedSession?.losses ?? 0,
    playerWinStreak: savedSession?.winStreak ?? 0,
    playerBestStreak: savedSession?.bestStreak ?? 0,
    loginError: null,
    loginLoading: false,
    isGuest: false,

    login: async (name: string, password: string) => {
        set({ loginLoading: true, loginError: null });
        try {
            const res = await fetch(`${API}?name=${encodeURIComponent(name)}`);
            const data = await res.json();
            const users: UserRecord[] = Array.isArray(data) ? data : (data?.data ?? []);
            const user = users[0];

            if (!user) {
                set({ loginError: 'Konto nie istnieje. Zarejestruj się.', loginLoading: false });
                return;
            }
            if (user.password !== password) {
                set({ loginError: 'Nieprawidłowe hasło.', loginLoading: false });
                return;
            }

            const rank = getRankForScore(user.score);
            const session = { id: user.id, name: user.name, rank, score: user.score, wins: user.wins ?? 0, losses: user.losses ?? 0, winStreak: user.winStreak ?? 0, bestStreak: user.bestStreak ?? 0 };
            localStorage.setItem('dba_session', JSON.stringify(session));
            set({ playerName: user.name, playerRank: rank, playerScore: user.score, playerWins: user.wins ?? 0, playerLosses: user.losses ?? 0, playerWinStreak: user.winStreak ?? 0, playerBestStreak: user.bestStreak ?? 0, loginError: null, loginLoading: false, isGuest: false });
            get().setPhase('menu');
        } catch {
            set({ loginError: 'Błąd połączenia z serwerem.', loginLoading: false });
        }
    },

    register: async (name: string, password: string) => {
        set({ loginLoading: true, loginError: null });
        try {
            const checkRes = await fetch(`${API}?name=${encodeURIComponent(name)}`);
            const checkData = await checkRes.json();
            const existing = Array.isArray(checkData) ? checkData : (checkData?.data ?? []);
            if (existing.length > 0) {
                set({ loginError: 'Nazwa użytkownika jest już zajęta.', loginLoading: false });
                return;
            }

            const newUser = { name, password, score: 0, wins: 0, losses: 0, winStreak: 0, bestStreak: 0 };
            const createRes = await fetch(API, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newUser),
            });
            const created: UserRecord = await createRes.json();

            const session = { id: created.id, name: created.name, rank: 'Saibaman', score: 0, wins: 0, losses: 0, winStreak: 0, bestStreak: 0 };
            localStorage.setItem('dba_session', JSON.stringify(session));
            set({ playerName: name, playerRank: 'Saibaman', playerScore: 0, playerWins: 0, playerLosses: 0, playerWinStreak: 0, playerBestStreak: 0, loginError: null, loginLoading: false, isGuest: false });
            get().setPhase('menu');
        } catch {
            set({ loginError: 'Błąd połączenia z serwerem.', loginLoading: false });
        }
    },

    loginAsGuest: () => {
        localStorage.removeItem('dba_session');
        set({ playerName: 'Gość', playerRank: 'Saibaman', playerScore: 0, playerWins: 0, playerLosses: 0, playerWinStreak: 0, playerBestStreak: 0, loginError: null, loginLoading: false, isGuest: true });
        get().setPhase('menu');
    },

    logout: () => {
        localStorage.removeItem('dba_session');
        set({ playerName: '', playerRank: '', playerScore: 0, playerWins: 0, playerLosses: 0, playerWinStreak: 0, playerBestStreak: 0, loginError: null, loginLoading: false, isGuest: false });
        get().setPhase('login');
    },

    addScore: (points: number) => {
        const s = get();
        const newScore = s.playerScore + points;
        const newRank = getRankForScore(newScore);

        // get().winner is set by battleSlice before addScore is called
        const matchWinner = get().winner;
        const isWin  = matchWinner === 'player';
        const isLoss = matchWinner === 'opponent';
        const newWins   = s.playerWins + (isWin ? 1 : 0);
        const newLosses = s.playerLosses + (isLoss ? 1 : 0);
        const newStreak = isWin ? s.playerWinStreak + 1 : 0;
        const newBest   = Math.max(s.playerBestStreak, newStreak);

        set({ playerScore: newScore, playerRank: newRank, playerWins: newWins, playerLosses: newLosses, playerWinStreak: newStreak, playerBestStreak: newBest });

        if (s.isGuest) return;

        const raw = localStorage.getItem('dba_session');
        if (raw) {
            const session = JSON.parse(raw);
            localStorage.setItem('dba_session', JSON.stringify({ ...session, rank: newRank, score: newScore, wins: newWins, losses: newLosses, winStreak: newStreak, bestStreak: newBest }));
            if (session.id) {
                fetch(`${API}/${session.id}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ score: newScore, wins: newWins, losses: newLosses, winStreak: newStreak, bestStreak: newBest }),
                }).catch(() => {});
            }
        }
    },
});
