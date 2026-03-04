import { io, Socket } from 'socket.io-client';
import type { BattleCharacter, PlayerEnergy, EffectType, CombatLogEntry } from "../core/types";

// ─── Types ────────────────────────────────────────────────────────────────────
export type MatchRole = 'player1' | 'player2';

export interface CompactChar {
    currentHp: number;
    cooldowns: Record<string, number>;
    statusEffects: { effect: EffectType; duration: number }[];
    passiveStacks?: number;
}

export interface CompactSide {
    chars: CompactChar[];
    activeIndex: number;
    energy: PlayerEnergy;
}

export interface OnlineBattleSnapshot {
    id: string;
    phase: 'draft' | 'battle' | 'gameOver';
    turnNumber: number;
    whoseTurn: MatchRole;
    winner: MatchRole | null;
    combatLogs: CombatLogEntry[];
    p1: {
      playerName: string;
      score: number;
      roster: BattleCharacter[];
      energy: PlayerEnergy;
      activeIndex: number;
      actionsUsed?: Record<number, boolean>;
    };
    p2: {
      playerName: string;
      score: number;
      roster: BattleCharacter[];
      energy: PlayerEnergy;
      activeIndex: number;
      actionsUsed?: Record<number, boolean>;
    };
}

// ─── Socket Initialization ────────────────────────────────────────────────────

// SOCKET_URL determines where the socket.io client connects.
// We use the proxy defined in vite.config.ts if no explicit VITE_BACKEND_URL is set.
const getSocketUrl = () => {
    if (import.meta.env.VITE_BACKEND_URL) return import.meta.env.VITE_BACKEND_URL;
    return window.location.origin;
};

let socket: Socket | null = null;

export function getSocket(): Socket {
    if (!socket) {
        socket = io(getSocketUrl());
        
        socket.on('connect', () => {
            console.log('Connected to multiplayer server:', socket?.id);
        });
        
        socket.on('disconnect', () => {
            console.log('Disconnected from multiplayer server');
        });
    }
    return socket;
}

export function disconnectSocket() {
    if (socket) {
        socket.disconnect();
        socket = null;
    }
}

// ─── Actions ──────────────────────────────────────────────────────────────────

export function findMatch(playerName: string, playerScore: number, isRanked: boolean = true) {
    const s = getSocket();
    s.emit('findMatch', { playerName, score: playerScore, isRanked });
}

export function selectCharacter(charId: string) {
    const s = getSocket();
    s.emit('selectCharacter', { charId });
}

export function selectAction(actionType: 'technique' | 'dodge' | 'pass' | 'switchCharacter' | 'changeTarget', actionId?: string) {
    const s = getSocket();
    s.emit('selectAction', { actionType, actionId });
}

export function surrenderMatch() {
    const s = getSocket();
    s.emit('surrender');
}

// Deprecated REST functions kept for backward compatibility if still called somewhere
export async function createMatch() { return null; }
export async function getMatch() { return null; }
export async function patchMatch() {}
export async function deleteMatch() {}
export function buildOnlineSnapshot(): OnlineBattleSnapshot { return {} as OnlineBattleSnapshot; }
