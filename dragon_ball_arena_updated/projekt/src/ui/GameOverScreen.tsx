import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameState } from "../core/stores/rootStore";
import { getRankForScore } from "../core/stores/authSlice";
import { deleteMatch } from "../multiplayer/matchService";
import { useAudio } from '../audio/AudioContext';

export const GameOverScreen: React.FC = () => {
    const { winner, playerRoster, opponentRoster, turnNumber, playerScore, resetGame, lastBattlePoints, isGuest, isOnlineMatch, matchId } = useGameState();
    const { playSound } = useAudio();

    const isVictory = winner === 'player';
    const matchDeletedRef = useRef(false);

    useEffect(() => {
        if (isVictory) playSound('win');
    }, [isVictory, playSound]);

    // ── Delete match from DB when game ends (online only, only once) ──────────
    useEffect(() => {
        if (!isOnlineMatch || !matchId || matchDeletedRef.current) return;
        matchDeletedRef.current = true;
        const delay = isVictory ? 10_000 : 3_000;
        const t = setTimeout(() => deleteMatch(matchId), delay);
        return () => clearTimeout(t);
    }, [isOnlineMatch, matchId, isVictory]);

    // ── Staged animation ─────────────────────────────────────────────────────
    const [showFlash, setShowFlash] = useState(true);

    useEffect(() => {
        const t1 = setTimeout(() => setShowFlash(false), 500);
        return () => clearTimeout(t1);
    }, []);

    const flashColor = isVictory ? 'rgba(56,189,248,0.55)' : 'rgba(239,68,68,0.55)';

    return (
        <div style={{ minHeight: '100vh', position: 'relative', overflow: 'hidden' }}>
            {/* Background */}
            <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 1 }}
                style={{
                    position: 'absolute',
                    inset: 0,
                    background: isVictory
                        ? 'radial-gradient(circle at center, #0c1a2e 0%, #020817 100%)'
                        : 'radial-gradient(circle at center, #1a0c0c 0%, #020817 100%)',
                }} 
            />

            {/* Color flash */}
            <AnimatePresence>
                {showFlash && (
                    <motion.div 
                        initial={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.5 }}
                        style={{
                            position: 'fixed', inset: 0,
                            background: flashColor,
                            zIndex: 999,
                            pointerEvents: 'none',
                        }} 
                    />
                )}
            </AnimatePresence>

            <div style={{
                minHeight: '100vh',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative',
                zIndex: 1,
            }}>
                <motion.div
                    initial={{ scale: 0.8, opacity: 0, y: 20 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    transition={{ type: 'spring', damping: 15, stiffness: 100, delay: 0.2 }}
                >
                    {isVictory
                        ? <VictoryPanel
                            playerRoster={playerRoster}
                            opponentRoster={opponentRoster}
                            turnNumber={turnNumber}
                            playerScore={playerScore}
                            lastBattlePoints={lastBattlePoints}
                            isGuest={isGuest}
                            resetGame={resetGame}
                          />
                        : <DefeatPanel
                            playerRoster={playerRoster}
                            opponentRoster={opponentRoster}
                            turnNumber={turnNumber}
                            playerScore={playerScore}
                            lastBattlePoints={lastBattlePoints}
                            isGuest={isGuest}
                            resetGame={resetGame}
                          />
                    }
                </motion.div>
            </div>
        </div>
    );
};

// ── Victory Panel — pełne podsumowanie ────────────────────────────────────────

const VictoryPanel: React.FC<{
    playerRoster: { name: string; currentHp: number; maxHp: number; portraitUrl?: string; imageColor: string }[];
    opponentRoster: { name: string; currentHp: number; maxHp: number; portraitUrl?: string; imageColor: string }[];
    turnNumber: number;
    playerScore: number;
    lastBattlePoints: number;
    isGuest: boolean;
    resetGame: () => void;
}> = ({ playerRoster, opponentRoster, turnNumber, playerScore, lastBattlePoints, isGuest, resetGame }) => {
    const playerSurvivors  = playerRoster.filter(c => c.currentHp > 0).length;
    const opponentSurvivors = opponentRoster.filter(c => c.currentHp > 0).length;

    return (
        <div className="glass-panel" style={{
            padding: '3rem 2.5rem',
            maxWidth: '560px',
            width: '90%',
            textAlign: 'center',
        }}>
            <motion.div 
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: 'spring', delay: 0.5 }}
                style={{ fontSize: '5rem', marginBottom: '0.5rem', lineHeight: 1 }}
            >
                🏆
            </motion.div>

            <motion.h1 
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.7 }}
                style={{
                    fontSize: '3.5rem', fontWeight: 900,
                    color: 'var(--ki-color)',
                    marginBottom: '0.25rem',
                    textShadow: '0 0 30px rgba(56,189,248,0.6)',
                    letterSpacing: '3px',
                    fontFamily: "'Orbitron', sans-serif",
                }}
            >
                VICTORY!
            </motion.h1>

            <p style={{ fontSize: '1rem', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
                Rozgniotłeś przeciwnika! Twoja moc rośnie!
            </p>

            {/* Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem', marginBottom: '1.5rem' }}>
                <StatCard label="Rundy"   value={String(turnNumber - 1)} color="var(--accent)" delay={0.9} />
                <StatCard label="Ocalałe" value={`${playerSurvivors} vs ${opponentSurvivors}`} color="var(--ki-color)" delay={1.0} />
                <StatCard
                    label="Punkty"
                    value={lastBattlePoints > 0 ? `+${lastBattlePoints}` : String(lastBattlePoints)}
                    color={lastBattlePoints > 0 ? '#22c55e' : 'var(--text-muted)'}
                    delay={1.1}
                />
            </div>

            {/* Rank */}
            {isGuest ? (
                <div style={{
                    background: 'rgba(168,85,247,0.08)',
                    border: '1px solid rgba(168,85,247,0.2)',
                    borderRadius: '12px',
                    padding: '0.75rem 1rem',
                    marginBottom: '1.5rem',
                    fontSize: '0.85rem',
                    color: 'var(--text-muted)',
                }}>
                    Grasz jako <strong style={{ color: 'var(--special-color)' }}>Gość</strong> — postęp nie jest zapisywany.
                </div>
            ) : (
                <div style={{
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '12px',
                    padding: '0.75rem 1rem',
                    marginBottom: '1.5rem',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                }}>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Ranga</span>
                    <span style={{ color: 'var(--accent)', fontWeight: 800, fontSize: '1rem' }}>
                        {getRankForScore(playerScore)}
                    </span>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                        Power Level: <strong style={{ color: 'var(--text-main)' }}>{playerScore}</strong>
                    </span>
                </div>
            )}

            {/* Roster summary */}
            <div style={{ display: 'flex', justifyContent: 'center', gap: '2rem', marginBottom: '2rem' }}>
                <RosterSummary label="Twoja Drużyna" roster={playerRoster}   isPlayer />
                <RosterSummary label="Przeciwnik"    roster={opponentRoster} isPlayer={false} />
            </div>

            <ActionButtons resetGame={resetGame} />
        </div>
    );
};

// ── Defeat Panel — pełne podsumowanie w czerwonych odcieniach ─────────────────

const DefeatPanel: React.FC<{
    playerRoster: { name: string; currentHp: number; maxHp: number; portraitUrl?: string; imageColor: string }[];
    opponentRoster: { name: string; currentHp: number; maxHp: number; portraitUrl?: string; imageColor: string }[];
    turnNumber: number;
    playerScore: number;
    lastBattlePoints: number;
    isGuest: boolean;
    resetGame: () => void;
}> = ({ playerRoster, opponentRoster, turnNumber, playerScore, lastBattlePoints, isGuest, resetGame }) => {
    const playerSurvivors  = playerRoster.filter(c => c.currentHp > 0).length;
    const opponentSurvivors = opponentRoster.filter(c => c.currentHp > 0).length;

    return (
        <div className="glass-panel" style={{
            padding: '3rem 2.5rem',
            maxWidth: '560px',
            width: '90%',
            textAlign: 'center',
            border: '1px solid rgba(239,68,68,0.2)',
        }}>
            <motion.div 
                initial={{ opacity: 0, scale: 2 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5, delay: 0.5 }}
                style={{ fontSize: '5rem', marginBottom: '0.5rem', lineHeight: 1 }}
            >
                💀
            </motion.div>

            <motion.h1 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.8 }}
                style={{
                    fontSize: '3.5rem', fontWeight: 900,
                    color: 'var(--physical-color)',
                    marginBottom: '0.25rem',
                    textShadow: '0 0 30px rgba(239,68,68,0.6)',
                    letterSpacing: '3px',
                    fontFamily: "'Orbitron', sans-serif",
                }}
            >
                YOU LOSE!
            </motion.h1>

            <p style={{ fontSize: '1rem', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
                Poniosłeś porażkę. Trenuj ciężej, wojowniku.
            </p>

            {/* Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem', marginBottom: '1.5rem' }}>
                <StatCard label="Rundy"   value={String(turnNumber - 1)} color="var(--physical-color)" delay={1.0} />
                <StatCard label="Ocalałe" value={`${playerSurvivors} vs ${opponentSurvivors}`} color="var(--physical-color)" delay={1.1} />
                <StatCard
                    label="Punkty"
                    value={lastBattlePoints > 0 ? `+${lastBattlePoints}` : String(lastBattlePoints)}
                    color={lastBattlePoints >= 0 ? '#f97316' : '#ef4444'}
                    delay={1.2}
                />
            </div>

            {/* Rank */}
            {isGuest ? (
                <div style={{
                    background: 'rgba(168,85,247,0.08)',
                    border: '1px solid rgba(168,85,247,0.2)',
                    borderRadius: '12px',
                    padding: '0.75rem 1rem',
                    marginBottom: '1.5rem',
                    fontSize: '0.85rem',
                    color: 'var(--text-muted)',
                }}>
                    Grasz jako <strong style={{ color: 'var(--special-color)' }}>Gość</strong> — postęp nie jest zapisywany.
                </div>
            ) : (
                <div style={{
                    background: 'rgba(239,68,68,0.05)',
                    border: '1px solid rgba(239,68,68,0.15)',
                    borderRadius: '12px',
                    padding: '0.75rem 1rem',
                    marginBottom: '1.5rem',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                }}>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Ranga</span>
                    <span style={{ color: 'var(--physical-color)', fontWeight: 800, fontSize: '1rem' }}>
                        {getRankForScore(playerScore)}
                    </span>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                        Power Level: <strong style={{ color: 'var(--text-main)' }}>{playerScore}</strong>
                    </span>
                </div>
            )}

            {/* Roster summary */}
            <div style={{ display: 'flex', justifyContent: 'center', gap: '2rem', marginBottom: '2rem' }}>
                <RosterSummary label="Twoja Drużyna" roster={playerRoster}   isPlayer />
                <RosterSummary label="Przeciwnik"    roster={opponentRoster} isPlayer={false} />
            </div>

            <ActionButtons resetGame={resetGame} />
        </div>
    );
};

// ── Shared buttons ─────────────────────────────────────────────────────────────

const ActionButtons: React.FC<{ resetGame: () => void }> = ({ resetGame }) => (
    <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
        <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="btn"
            style={{ fontSize: '1.05rem', padding: '0.85rem 2rem' }}
            onClick={resetGame}
        >
            Menu Główne
        </motion.button>
        <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="btn"
            style={{
                fontSize: '1.05rem', padding: '0.85rem 2rem',
                background: 'rgba(255,255,255,0.08)',
                border: '1px solid rgba(255,255,255,0.15)',
                boxShadow: 'none',
            }}
            onClick={() => {
                resetGame();
                setTimeout(() => useGameState.getState().startMatchmaking(), 50);
            }}
        >
            Zagraj Ponownie
        </motion.button>
    </div>
);

// ── Helper sub-components ──────────────────────────────────────────────────────

const StatCard: React.FC<{ label: string; value: string; color: string; delay?: number }> = ({ label, value, color, delay = 0 }) => (
    <motion.div 
        initial={{ y: 10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay }}
        style={{
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '10px',
            padding: '0.6rem 0.5rem',
        }}
    >
        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '0.2rem' }}>{label}</div>
        <div style={{ fontSize: '1.2rem', fontWeight: 800, color }}>{value}</div>
    </motion.div>
);

const RosterSummary: React.FC<{
    label: string;
    roster: { name: string; currentHp: number; maxHp: number; portraitUrl?: string; imageColor: string }[];
    isPlayer: boolean;
}> = ({ label, roster, isPlayer }) => (
    <div style={{ textAlign: 'center' }}>
        <div style={{
            fontSize: '0.75rem',
            color: isPlayer ? 'var(--ki-color)' : 'var(--physical-color)',
            marginBottom: '0.5rem',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '1px',
        }}>
            {label}
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
            {roster.map((c, i) => (
                <motion.div 
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 1.3 + i * 0.1 }}
                    key={c.name} 
                    style={{ textAlign: 'center' }}
                >
                    <div style={{
                        width: 44, height: 44, borderRadius: '8px',
                        overflow: 'hidden',
                        border: `2px solid ${c.currentHp > 0 ? c.imageColor : '#444'}`,
                        opacity: c.currentHp > 0 ? 1 : 0.4,
                        marginBottom: '0.2rem',
                    }}>
                        <img src={c.portraitUrl} alt={c.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </div>
                    <div style={{ fontSize: '0.6rem', color: c.currentHp > 0 ? '#e2e8f0' : '#555' }}>
                        {c.currentHp > 0 ? `${c.currentHp}/${c.maxHp}` : 'KO'}
                    </div>
                </motion.div>
            ))}
        </div>
    </div>
);
