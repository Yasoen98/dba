import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { useGameState } from "../core/stores/rootStore";
import { MATCHMAKING_DURATION_SECONDS } from "../core/stores/gameSlice";
import { getSocket, findMatch } from "../multiplayer/matchService";

const MATCH_FOUND_DELAY_MS = 3000;

export const Matchmaking: React.FC = () => {
    const {
        matchmakingTimer, tickMatchmaking,
        phase, playerName, playerRank, playerScore,
        setMatchFound, setMatchSession, startDraft,
    } = useGameState();

    const [searchState, setSearchState] = useState<'searching' | 'found' | 'fallback'>('searching');
    const [foundName, setFoundName] = useState<string | null>(null);
    const [streamValues, setStreamValues] = useState(['---', '---', '---', '---']);
    const hasTransitioned = useRef(false);

    useEffect(() => {
        if (phase !== 'matchmaking') return;

        setSearchState('searching');
        setFoundName(null);
        hasTransitioned.current = false;

        const { isRanked } = useGameState.getState();
        const socket = getSocket();

        const onMatchFound = (data: { matchId: string, role: 'player1'|'player2', opponentName: string }) => {
            if (hasTransitioned.current) return;
            hasTransitioned.current = true;
            
            setMatchSession(data.matchId, data.role);
            setMatchFound(data.opponentName);
            setFoundName(data.opponentName);
            setSearchState('found');
            
            setTimeout(() => startDraft(), MATCH_FOUND_DELAY_MS);
        };

        socket.on('matchFound', onMatchFound);
        findMatch(playerName, playerScore, isRanked);

        return () => {
            socket.off('matchFound', onMatchFound);
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [phase]);

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

    if (searchState === 'found') {
        return (
            <div className="matchmaking-screen">
                <div className="matchmaking-bg-grid" />
                {/* Dramatic Flash Overlay */}
                <motion.div 
                    initial={{ opacity: 1 }}
                    animate={{ opacity: 0 }}
                    transition={{ duration: 0.5 }}
                    style={{ position: 'fixed', inset: 0, background: '#fff', zIndex: 100, pointerEvents: 'none' }}
                />

                <div style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center',
                    justifyContent: 'center', height: '100%', gap: '3rem', padding: '2rem', 
                    textAlign: 'center', zIndex: 10, position: 'relative'
                }}>
                    <motion.div 
                        initial={{ scale: 0.5, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ type: 'spring', damping: 12 }}
                        style={{ fontSize: '5rem', filter: 'drop-shadow(0 0 20px var(--neon-gold))' }}
                    >⚔️</motion.div>

                    <motion.h2 
                        initial={{ y: 20, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ delay: 0.2 }}
                        style={{
                            fontFamily: "'Orbitron', sans-serif",
                            fontSize: '2.5rem', fontWeight: 900,
                            color: 'var(--neon-gold)',
                            textShadow: '0 0 30px rgba(255,215,0,0.6)',
                            letterSpacing: '8px', textTransform: 'uppercase',
                            margin: 0,
                        }}
                    >
                        WALKA ROZPOCZĘTA
                    </motion.h2>
                    
                    <div className="vs-container">
                        {/* Player Side */}
                        <div className="vs-player-side">
                            <motion.div 
                                initial={{ x: -100, opacity: 0 }}
                                animate={{ x: 0, opacity: 1 }}
                                transition={{ duration: 0.6, delay: 0.4 }}
                            >
                                <PlayerCard name={playerName} rank={playerRank} score={playerScore} isPlayer large />
                            </motion.div>
                        </div>

                        {/* VS Circle */}
                        <div className="vs-circle">VS</div>

                        {/* Opponent Side */}
                        <div className="vs-opponent-side">
                            <motion.div 
                                initial={{ x: 100, opacity: 0 }}
                                animate={{ x: 0, opacity: 1 }}
                                transition={{ duration: 0.6, delay: 0.4 }}
                            >
                                <PlayerCard name={foundName ?? '???'} rank="Wojownik" score={null} isPlayer={false} large />
                            </motion.div>
                        </div>
                    </div>

                    <motion.p 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 1 }}
                        style={{
                            color: 'var(--text-muted)', fontSize: '1rem',
                            letterSpacing: '4px', textTransform: 'uppercase',
                            animation: 'pulse 1.5s ease-in-out infinite',
                        }}
                    >
                        Inicjalizacja fazy Draftu...
                    </motion.p>
                </div>
            </div>
        );
    }

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

const PlayerCard: React.FC<{
    name: string;
    rank: string;
    score: number | null;
    isPlayer: boolean;
    inline?: boolean;
    large?: boolean;
}> = ({ name, rank, score, isPlayer, inline, large }) => (
    <div style={{
        background: large ? 'rgba(0,0,0,0.6)' : 'rgba(6,18,40,0.9)',
        backdropFilter: large ? 'blur(10px)' : 'none',
        border: `2px solid ${isPlayer ? 'var(--neon-cyan)' : 'var(--physical-color)'}`,
        boxShadow: `0 0 20px ${isPlayer ? 'var(--neon-cyan)44' : 'var(--physical-color)44'}`,
        borderRadius: large ? 20 : 10,
        padding: large ? '2rem 3rem' : '0.75rem 1.5rem',
        display: 'flex',
        flexDirection: large ? 'column' : 'row',
        alignItems: 'center',
        gap: large ? '1.5rem' : '1rem',
        ...(inline ? { width: '100%', maxWidth: 400, animation: 'slideInLeft 0.5s ease both' } : {}),
        position: 'relative',
        overflow: 'hidden'
    }}>
        {/* Glow background for large version */}
        {large && (
            <div style={{
                position: 'absolute', inset: 0,
                background: `radial-gradient(circle at center, ${isPlayer ? 'var(--neon-cyan)22' : 'var(--physical-color)22'} 0%, transparent 70%)`,
                pointerEvents: 'none'
            }} />
        )}

        <div style={{
            width: large ? 100 : 40, 
            height: large ? 100 : 40, 
            borderRadius: '50%',
            background: isPlayer
                ? 'linear-gradient(135deg, var(--neon-cyan), #1e40af)'
                : 'linear-gradient(135deg, var(--physical-color), #7f1d1d)',
            border: `3px solid #fff`,
            boxShadow: `0 0 20px ${isPlayer ? 'var(--neon-cyan)' : 'var(--physical-color)'}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: "'Orbitron', sans-serif",
            fontWeight: 900, fontSize: large ? '2.5rem' : '1rem',
            color: '#fff',
            flexShrink: 0,
            zIndex: 2
        }}>
            {name.charAt(0).toUpperCase()}
        </div>
        <div style={{ flex: 1, zIndex: 2, textAlign: large ? 'center' : 'left' }}>
            <div style={{
                fontFamily: "'Orbitron', sans-serif",
                fontSize: large ? '1.5rem' : '0.8rem', 
                fontWeight: 900,
                letterSpacing: 2, textTransform: 'uppercase',
                color: '#fff',
                textShadow: large ? `0 0 10px ${isPlayer ? 'var(--neon-cyan)' : 'var(--physical-color)'}` : 'none'
            }}>
                {name}
            </div>
            {rank && (
                <div style={{ 
                    fontSize: large ? '0.9rem' : '0.65rem', 
                    color: isPlayer ? 'var(--neon-cyan)' : 'var(--physical-color)', 
                    letterSpacing: 2,
                    fontWeight: 800,
                    marginTop: '0.25rem',
                    textTransform: 'uppercase'
                }}>
                    {rank}{score !== null ? ` · PL ${score}` : ''}
                </div>
            )}
        </div>
        {!large && (
            <div style={{
                width: 8, height: 8, borderRadius: '50%',
                background: '#22c55e',
                boxShadow: '0 0 10px #22c55e',
                animation: 'pulse 1.5s ease-in-out infinite',
            }} />
        )}
    </div>
);
