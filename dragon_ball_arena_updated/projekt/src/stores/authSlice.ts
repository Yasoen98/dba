import type { StateCreator } from 'zustand';
import type { RootState } from './rootStore';

export interface AuthSlice {
    playerName: string;
    playerRank: string;
    playerScore: number;
    loginError: string | null;

    login: (name: string, password?: string) => void;
    register: (name: string, password?: string) => void;
    logout: () => void;
    addScore: (points: number) => void;
}

const RANK_THRESHOLDS: { threshold: number; rank: string }[] = [
    { threshold: 1000, rank: 'Super Saiyan God' },
    { threshold: 500, rank: 'Super Saiyan' },
    { threshold: 250, rank: 'Elite Warrior' },
    { threshold: 100, rank: 'Raditz' },
    { threshold: 0, rank: 'Saibaman' },
];

export function getRankForScore(score: number): string {
    for (const { threshold, rank } of RANK_THRESHOLDS) {
        if (score >= threshold) return rank;
    }
    return 'Saibaman';
}

const currentUser = localStorage.getItem('dba_current_user');
const accounts = JSON.parse(localStorage.getItem('dba_accounts') || '{}');
const savedData = currentUser ? accounts[currentUser] : null;

export const createAuthSlice: StateCreator<RootState, [], [], AuthSlice> = (set, get) => ({
    playerName: savedData?.name || '',
    playerRank: savedData?.rank || 'Saibaman',
    playerScore: savedData?.score || 0,
    loginError: null,

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
            loginError: null,
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
            loginError: null,
        });
    },

    logout: () => {
        localStorage.removeItem('dba_current_user');
        set({
            playerName: '',
            playerRank: '',
            playerScore: 0,
            phase: 'login',
            loginError: null,
        });
    },

    addScore: (points: number) => {
        const s = get();
        const newScore = s.playerScore + points;
        const newRank = getRankForScore(newScore);

        const accs = JSON.parse(localStorage.getItem('dba_accounts') || '{}');
        if (accs[s.playerName]) {
            accs[s.playerName].rank = newRank;
            accs[s.playerName].score = newScore;
            localStorage.setItem('dba_accounts', JSON.stringify(accs));
        }

        set({ playerScore: newScore, playerRank: newRank });
    },
});
