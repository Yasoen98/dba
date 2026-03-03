import type { BattleCharacter, PlayerEnergy, EffectType } from '../types';

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
    version: number;
    p1: CompactSide;       // always player1's data
    p2: CompactSide;       // always player2's data
    turnNumber: number;
    whoseTurn: MatchRole;  // who acts NEXT
    winner: MatchRole | null;
}

export interface MatchDoc {
    id: string;
    player1Name: string;
    player2Name: string;
    status: 'draft' | 'battle' | 'done';
    p1Roster: string[] | null;  // character IDs picked by player1
    p2Roster: string[] | null;  // character IDs picked by player2
    draftTurn: MatchRole;       // whose draft turn it is
    battle: OnlineBattleSnapshot | null;
    p1Heartbeat?: number;       // ms timestamp, updated every ~5s while in battle
    p2Heartbeat?: number;
}

// ─── API helpers ──────────────────────────────────────────────────────────────

const API = '/api/matches';

export async function createMatch(player1Name: string, player2Name: string): Promise<MatchDoc | null> {
    try {
        const res = await fetch(API, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                player1Name, player2Name,
                status: 'draft',
                p1Roster: null, p2Roster: null,
                draftTurn: 'player1',
                battle: null,
            }),
        });
        return res.json();
    } catch { return null; }
}

export async function getMatch(matchId: string): Promise<MatchDoc | null> {
    try {
        const res = await fetch(`${API}/${matchId}`);
        if (!res.ok) return null;
        return res.json();
    } catch { return null; }
}

export async function patchMatch(matchId: string, patch: Record<string, unknown>): Promise<void> {
    try {
        await fetch(`${API}/${matchId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(patch),
        });
    } catch {/* ignore — no connectivity */}
}

export async function deleteMatch(matchId: string): Promise<void> {
    try {
        await fetch(`${API}/${matchId}`, { method: 'DELETE' });
    } catch {/* ignore — no connectivity */}
}

// ─── Snapshot helpers ─────────────────────────────────────────────────────────

/** Serialise a player's roster into the compact wire format */
function compactSide(roster: BattleCharacter[], activeIndex: number, energy: PlayerEnergy): CompactSide {
    return {
        chars: roster.map(c => ({
            currentHp: c.currentHp,
            cooldowns: { ...c.cooldowns },
            statusEffects: c.statusEffects.map(e => ({ ...e })),
            passiveStacks: c.passiveStacks,
        })),
        activeIndex,
        energy: { ...energy },
    };
}

/**
 * Build the OnlineBattleSnapshot that the acting client posts to the server.
 * The snapshot is always stored from player1's perspective (p1/p2 are absolute roles).
 *
 * @param myRole      - the client's role ('player1' | 'player2')
 * @param whoseTurnNext - who should act next after this snapshot
 */
export function buildOnlineSnapshot(
    playerRoster: BattleCharacter[],
    opponentRoster: BattleCharacter[],
    playerActiveIndex: number,
    opponentActiveIndex: number,
    playerEnergy: PlayerEnergy,
    opponentEnergy: PlayerEnergy,
    turnNumber: number,
    winner: 'player' | 'opponent' | null,
    myRole: MatchRole,
    whoseTurnNext: MatchRole,
    version: number,
): OnlineBattleSnapshot {
    const mySide  = compactSide(playerRoster,   playerActiveIndex,   playerEnergy);
    const opSide  = compactSide(opponentRoster,  opponentActiveIndex, opponentEnergy);

    let winnerRole: MatchRole | null = null;
    if (winner === 'player')   winnerRole = myRole;
    if (winner === 'opponent') winnerRole = myRole === 'player1' ? 'player2' : 'player1';

    return {
        version,
        p1: myRole === 'player1' ? mySide : opSide,
        p2: myRole === 'player1' ? opSide : mySide,
        turnNumber,
        whoseTurn: whoseTurnNext,
        winner: winnerRole,
    };
}
