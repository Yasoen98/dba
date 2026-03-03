import React, { useEffect, useRef, useState } from 'react';
import { useGameState } from '../stores/rootStore';
import { MATCHMAKING_DURATION_SECONDS } from '../stores/gameSlice';
import { createMatch } from '../services/matchService';

const POLL_INTERVAL_MS = 2000;
const STALE_ENTRY_MS = (MATCHMAKING_DURATION_SECONDS + 5) * 1000;
const MATCH_FOUND_DELAY_MS = 3000; // time to show "Match Found!" before going to draft

interface QueueEntry {
    id: string;
    playerName: string;
    score: number;
    joinedAt: number;
    status: 'waiting' | 'matched';
    matchId?: string;
    role?: 'player1' | 'player2';
    matchedWith?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function joinQueue(playerName: string, score: number): Promise<{ id: string; joinedAt: number } | null> {
    try {
        const joinedAt = Date.now();
        const res = await fetch('/api/matchmaking', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ playerName, score, joinedAt, status: 'waiting' }),
        });
        const data = await res.json();
        return data.id ? { id: data.id, joinedAt: data.joinedAt ?? joinedAt } : null;
    } catch {
        return null;
    }
}

async function leaveQueue(entryId: string): Promise<void> {
    try {
        await fetch(`/api/matchmaking/${entryId}`, { method: 'DELETE' });
    } catch {/* ignore */}
}

async function fetchQueue(): Promise<QueueEntry[]> {
    try {
        const res = await fetch('/api/matchmaking');
        const data = await res.json();
        // json-server v1 wraps collections: { data: [...], first, last, ... }
        // json-server v0 returns a plain array
        return Array.isArray(data) ? data : (Array.isArray(data?.data) ? data.data : []);
    } catch {
        return [];
    }
}

async function getQueueEntry(entryId: string): Promise<QueueEntry | null> {
    try {
        const res = await fetch(`/api/matchmaking/${entryId}`);
        if (!res.ok) return null;
        return res.json();
    } catch { return null; }
}

async function patchQueueEntry(entryId: string, patch: Partial<QueueEntry>): Promise<void> {
    try {
        await fetch(`/api/matchmaking/${entryId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(patch),
        });
    } catch {/* ignore */}
}

// ─── Component ────────────────────────────────────────────────────────────────

export const Matchmaking: React.FC = () => {
    const {
        matchmakingTimer, tickMatchmaking,
        phase, playerName, playerRank, playerScore,
        setMatchFound, setMatchSession, startDraft, isRealMatch, matchFoundOpponent,
    } = useGameState();

    // 'searching' → searching for opponent
    // 'found'     → real opponent found, showing countdown before draft
    // 'fallback'  → timer expired, going to bot
    const [searchState, setSearchState] = useState<'searching' | 'found' | 'fallback'>('searching');
    const [foundName, setFoundName] = useState<string | null>(null);
    const [streamValues, setStreamValues] = useState(['---', '---', '---', '---']);

    const entryIdRef = useRef<string | null>(null);
    const hasTransitioned = useRef(false); // prevent double-transition

    // ── Join queue on mount ────────────────────────────────────────────────────
    useEffect(() => {
        if (phase !== 'matchmaking') return;

        // These two flags handle React StrictMode's double-invocation:
        // StrictMode runs cleanup before joinQueue resolves, so we need to
        // know whether cleanup already ran when the async result arrives.
        let settled = false;
        let createdId: string | null = null;

        hasTransitioned.current = false;
        setSearchState('searching');
        setFoundName(null);

        joinQueue(playerName, playerScore).then(result => {
            if (!result) return;
            createdId = result.id;
            if (settled) {
                // Cleanup ran before the response arrived (React StrictMode) — undo.
                leaveQueue(result.id);
            } else {
                entryIdRef.current = result.id;
            }
        });

        return () => {
            settled = true;
            // Delete whichever entry we know about (may be from before or after resolution)
            const idToRemove = createdId ?? entryIdRef.current;
            if (idToRemove) leaveQueue(idToRemove);
            entryIdRef.current = null;
            createdId = null;
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [phase]);

    // ── Poll for opponents every 2s ────────────────────────────────────────────
    useEffect(() => {
        if (phase !== 'matchmaking' || searchState !== 'searching') return;

        const poll = async () => {
            if (hasTransitioned.current) return;
            const myId = entryIdRef.current;
            if (!myId) return;

            // Case A: someone else already matched us (patched our entry)
            const myEntry = await getQueueEntry(myId);
            if (myEntry?.status === 'matched' && myEntry.matchId && myEntry.role) {
                hasTransitioned.current = true;
                entryIdRef.current = null;
                await leaveQueue(myId);

                setMatchSession(myEntry.matchId, myEntry.role);
                setMatchFound(myEntry.matchedWith ?? 'Opponent');
                setFoundName(myEntry.matchedWith ?? 'Opponent');
                setSearchState('found');
                setTimeout(() => startDraft(), MATCH_FOUND_DELAY_MS);
                return;
            }

            // Case B: look for an opponent in the queue.
            // The match is created by whichever client has the LOWEST joinedAt
            // (oldest in queue) — determined from the server data, not a local ref.
            // This is race-condition-safe: both clients see the same sorted queue.
            const allWaiting = await fetchQueue();
            const now = Date.now();
            const validEntries = allWaiting.filter(
                e => e.status === 'waiting'
                    && !e.matchId
                    && (now - e.joinedAt) < STALE_ENTRY_MS,
            );

            // Sort by joinedAt asc; use id as tiebreaker for exact-same timestamps
            const sorted = [...validEntries].sort((a, b) =>
                a.joinedAt !== b.joinedAt ? a.joinedAt - b.joinedAt : a.id.localeCompare(b.id)
            );

            // I only create the match if I'm the oldest entry in the queue
            if (sorted[0]?.id !== myId) return;

            const opponent = validEntries.find(
                e => e.id !== myId && e.playerName !== playerName,
            );
            if (!opponent) return; // no opponent yet, keep waiting

            hasTransitioned.current = true;

            // Create shared match record — I am player1
            const match = await createMatch(playerName, opponent.playerName);
            if (!match) { hasTransitioned.current = false; return; } // server error, retry next poll

            // Patch opponent's entry so they know about the match
            await patchQueueEntry(opponent.id, {
                status: 'matched',
                matchId: match.id,
                role: 'player2',
                matchedWith: playerName,
            });
            // Clean up my own entry
            await leaveQueue(myId);
            entryIdRef.current = null;

            // Remove opponent's entry after they've had time to read it.
            // Covers the case where they disconnect before polling.
            setTimeout(
                () => leaveQueue(opponent.id),
                MATCH_FOUND_DELAY_MS + POLL_INTERVAL_MS * 2,
            );

            setMatchSession(match.id, 'player1');
            setMatchFound(opponent.playerName);
            setFoundName(opponent.playerName);
            setSearchState('found');
            setTimeout(() => startDraft(), MATCH_FOUND_DELAY_MS);
        };

        const safePoll = () => poll().catch(err => console.error('[Matchmaking] poll error:', err));
        const interval = setInterval(safePoll, POLL_INTERVAL_MS);
        safePoll(); // immediate first check
        return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [phase, searchState]);

    // ── 1-second countdown ────────────────────────────────────────────────────
    useEffect(() => {
        if (phase !== 'matchmaking' || searchState !== 'searching') return;

        const interval = setInterval(() => {
            tickMatchmaking();
        }, 1000);
        return () => clearInterval(interval);
    }, [phase, searchState, tickMatchmaking]);

    // ── Timer expiry → fallback to bot ────────────────────────────────────────
    useEffect(() => {
        if (matchmakingTimer === 0 && searchState === 'searching' && !hasTransitioned.current) {
            hasTransitioned.current = true;
            setSearchState('fallback');

            if (entryIdRef.current) {
                leaveQueue(entryIdRef.current);
                entryIdRef.current = null;
            }

            setTimeout(() => startDraft(), 1200);
        }
    }, [matchmakingTimer, searchState, startDraft]);

    // ── Data stream animation ──────────────────────────────────────────────────
    useEffect(() => {
        const chars = '0123456789ABCDEF';
        const streamInterval = setInterval(() => {
            setStreamValues([
                Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join(''),
                Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join(''),
                Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join(''),
                Array.from({ length: 5 }, () => chars[Math.floor(Math.random() * chars.length)]).join(''),
            ]);
        }, 200);
        return () => clearInterval(streamInterval);
    }, []);

    const elapsed = MATCHMAKING_DURATION_SECONDS - matchmakingTimer;
    const progressPct = Math.min((elapsed / MATCHMAKING_DURATION_SECONDS) * 100, 100);

    const blips = [
        { top: '25%', left: '60%', delay: '0s' },
        { top: '65%', left: '30%', delay: '1.2s' },
        { top: '40%', left: '75%', delay: '2.4s' },
    ];

    // ── "Match Found!" overlay ─────────────────────────────────────────────────
    if (searchState === 'found') {
        return (
            <div className="matchmaking-screen">
                <div className="matchmaking-bg-grid" />
                <div style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center',
                    gap: '1.5rem', padding: '2rem', textAlign: 'center',
                    animation: 'fadeInUp 0.4s ease both',
                }}>
                    <div style={{ fontSize: '4rem', lineHeight: 1 }}>⚔️</div>
                    <h2 style={{
                        fontFamily: "'Orbitron', sans-serif",
                        fontSize: '2rem', fontWeight: 900,
                        color: 'var(--neon-gold)',
                        textShadow: '0 0 30px rgba(255,215,0,0.6)',
                        letterSpacing: '4px', textTransform: 'uppercase',
                        margin: 0,
                        animation: 'neonPulse 1s ease-in-out infinite',
                    }}>
                        Znaleziono Przeciwnika!
                    </h2>

                    <div style={{
                        display: 'flex', alignItems: 'center', gap: '2rem',
                        marginTop: '0.5rem',
                    }}>
                        <PlayerCard name={playerName} rank={playerRank} score={playerScore} isPlayer />
                        <div style={{
                            fontFamily: "'Orbitron', sans-serif",
                            fontSize: '1.5rem', color: 'var(--neon-cyan)',
                            textShadow: '0 0 20px var(--neon-cyan)',
                        }}>VS</div>
                        <PlayerCard name={foundName ?? '???'} rank="" score={null} isPlayer={false} />
                    </div>

                    <p style={{
                        color: 'var(--text-muted)', fontSize: '0.85rem',
                        letterSpacing: '2px', textTransform: 'uppercase',
                        animation: 'pulse 1s ease-in-out infinite',
                    }}>
                        Przygotowanie draftu...
                    </p>
                </div>
            </div>
        );
    }

    // ── Fallback transitioning ─────────────────────────────────────────────────
    if (searchState === 'fallback') {
        return (
            <div className="matchmaking-screen">
                <div className="matchmaking-bg-grid" />
                <div style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center',
                    gap: '1rem', padding: '2rem', textAlign: 'center',
                    animation: 'fadeInUp 0.4s ease both',
                }}>
                    <div style={{ fontSize: '3rem', lineHeight: 1 }}>🤖</div>
                    <h2 style={{
                        fontFamily: "'Orbitron', sans-serif",
                        fontSize: '1.4rem', fontWeight: 700,
                        color: 'var(--physical-color)',
                        letterSpacing: '3px', textTransform: 'uppercase', margin: 0,
                    }}>
                        Nie znaleziono gracza
                    </h2>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                        Uruchamianie protokołu bota...
                    </p>
                </div>
            </div>
        );
    }

    // ── Searching UI ──────────────────────────────────────────────────────────
    return (
        <div className="matchmaking-screen">
            <div className="matchmaking-bg-grid" />

            <div style={{
                position: 'absolute', top: '20%', left: '50%', transform: 'translateX(-50%)',
                width: 600, height: 300,
                background: 'radial-gradient(ellipse, rgba(56,189,248,0.06) 0%, transparent 70%)',
                pointerEvents: 'none',
            }} />

            <div className="matchmaking-content">

                {/* Header */}
                <div className="matchmaking-status">
                    <h2 className="matchmaking-title">Skanowanie Sieci</h2>
                    <p className="matchmaking-subtitle">Szukanie prawdziwego przeciwnika · Proszę czekać</p>
                </div>

                {/* Radar */}
                <div className="radar-container">
                    <div className="radar-ring radar-ring-1" />
                    <div className="radar-ring radar-ring-2" />
                    <div className="radar-ring radar-ring-3" />
                    <div className="radar-crosshair-h" />
                    <div className="radar-crosshair-v" />
                    <div className="radar-sweep" />
                    <div className="radar-center" />
                    <div className="radar-ping" />
                    <div className="radar-ping-2" />
                    {blips.map((b, i) => (
                        <div key={i} className="radar-blip" style={{ top: b.top, left: b.left, animationDelay: b.delay }} />
                    ))}
                </div>

                {/* Player card */}
                <PlayerCard name={playerName} rank={playerRank} score={playerScore} isPlayer inline />

                {/* Progress */}
                <div className="matchmaking-progress-wrapper">
                    <div className="matchmaking-progress-header">
                        <span className="matchmaking-progress-label">Czas poszukiwania</span>
                        <span className="matchmaking-progress-timer">{matchmakingTimer}s</span>
                    </div>
                    <div className="matchmaking-progress-bar-bg">
                        <div className="matchmaking-progress-bar-fill" style={{ width: `${progressPct}%` }} />
                    </div>
                </div>

                {/* Data streams */}
                <div className="matchmaking-data-streams">
                    {[
                        { label: 'Node ID', value: streamValues[0] },
                        { label: 'Ping', value: `${streamValues[1]} ms` },
                        { label: 'Matchpool', value: streamValues[2] },
                        { label: 'Region', value: 'EU-WEST' },
                    ].map((row, i) => (
                        <div key={i} className="data-stream-row">
                            <div className="data-stream-dot" />
                            <span className="data-stream-label">{row.label}</span>
                            <span className="data-stream-value">{row.value}</span>
                        </div>
                    ))}
                </div>

                {/* Bot fallback warning when almost out of time */}
                {matchmakingTimer > 0 && matchmakingTimer <= 10 && (
                    <div className="bot-alert">
                        <div className="bot-alert-icon" />
                        <span className="bot-alert-text">
                            Brak przeciwnika — inicjalizowanie protokołu bota w {matchmakingTimer}s
                        </span>
                    </div>
                )}
            </div>
        </div>
    );
};

// ─── PlayerCard sub-component ─────────────────────────────────────────────────

const PlayerCard: React.FC<{
    name: string;
    rank: string;
    score: number | null;
    isPlayer: boolean;
    inline?: boolean;
}> = ({ name, rank, score, isPlayer, inline }) => (
    <div style={{
        background: 'rgba(6,18,40,0.9)',
        border: `1px solid ${isPlayer ? 'rgba(56,189,248,0.2)' : 'rgba(239,68,68,0.25)'}`,
        borderRadius: 10,
        padding: '0.75rem 1.5rem',
        display: 'flex',
        alignItems: 'center',
        gap: '1rem',
        ...(inline ? { width: '100%', maxWidth: 400, animation: 'slideInLeft 0.5s ease both' } : { minWidth: 160 }),
    }}>
        <div style={{
            width: 40, height: 40, borderRadius: '50%',
            background: isPlayer
                ? 'linear-gradient(135deg, rgba(56,189,248,0.3), rgba(168,85,247,0.3))'
                : 'linear-gradient(135deg, rgba(239,68,68,0.3), rgba(245,158,11,0.3))',
            border: `2px solid ${isPlayer ? 'rgba(56,189,248,0.5)' : 'rgba(239,68,68,0.5)'}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: "'Orbitron', sans-serif",
            fontWeight: 900, fontSize: '1rem',
            color: isPlayer ? 'var(--neon-cyan)' : 'var(--physical-color)',
            flexShrink: 0,
        }}>
            {name.charAt(0).toUpperCase()}
        </div>
        <div style={{ flex: 1 }}>
            <div style={{
                fontFamily: "'Orbitron', sans-serif",
                fontSize: '0.8rem', fontWeight: 700,
                letterSpacing: 1, textTransform: 'uppercase',
                color: 'var(--text-main)',
            }}>
                {name}
            </div>
            {rank && (
                <div style={{ fontSize: '0.65rem', color: isPlayer ? 'var(--neon-cyan)' : 'var(--physical-color)', letterSpacing: 1 }}>
                    {rank}{score !== null ? ` · PL ${score}` : ''}
                </div>
            )}
        </div>
        <div style={{
            width: 8, height: 8, borderRadius: '50%',
            background: '#22c55e',
            boxShadow: '0 0 10px #22c55e',
            animation: 'pulse 1.5s ease-in-out infinite',
        }} />
    </div>
);
