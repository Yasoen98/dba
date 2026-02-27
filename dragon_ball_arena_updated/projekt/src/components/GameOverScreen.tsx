import React from 'react';
import { useGameState } from '../stores/rootStore';
import { getRankForScore } from '../stores/authSlice';

export const GameOverScreen: React.FC = () => {
    // FIX #2: pobieramy lastBattlePoints ze store zamiast hardkodować 50
    const { winner, playerRoster, opponentRoster, turnNumber, playerScore, resetGame, lastBattlePoints } = useGameState();

    const isVictory = winner === 'player';
    const pointsEarned = lastBattlePoints; // FIX #2: realna wartość punktów
    const newScore = playerScore;

    const playerSurvivors = playerRoster.filter(c => c.currentHp > 0).length;
    const opponentSurvivors = opponentRoster.filter(c => c.currentHp > 0).length;

    return (
        <div style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: isVictory
                ? 'radial-gradient(circle at center, #0c1a2e 0%, #0f172a 100%)'
                : 'radial-gradient(circle at center, #1a0c0c 0%, #0f172a 100%)',
        }}>
            <div className="glass-panel" style={{
                padding: '3rem 2.5rem',
                maxWidth: '560px',
                width: '90%',
                textAlign: 'center',
                animation: 'popIn 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
            }}>
                {/* Trophy / Skull */}
                <div style={{ fontSize: '5rem', marginBottom: '0.5rem', lineHeight: 1 }}>
                    {isVictory ? '🏆' : '💀'}
                </div>

                {/* Title */}
                <h1 style={{
                    fontSize: '3.5rem',
                    fontWeight: 900,
                    color: isVictory ? 'var(--ki-color)' : 'var(--physical-color)',
                    marginBottom: '0.25rem',
                    textShadow: isVictory
                        ? '0 0 30px rgba(56,189,248,0.6)'
                        : '0 0 30px rgba(239,68,68,0.6)',
                    letterSpacing: '3px',
                }}>
                    {isVictory ? 'VICTORY!' : 'DEFEAT'}
                </h1>

                <p style={{ fontSize: '1rem', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
                    {isVictory
                        ? 'You crushed the opponent! Your power grows!'
                        : 'You were defeated. Train harder, warrior.'}
                </p>

                {/* Stats grid */}
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr 1fr',
                    gap: '0.75rem',
                    marginBottom: '1.5rem',
                }}>
                    <StatCard label="Rounds" value={String(turnNumber - 1)} color="var(--accent)" />
                    <StatCard
                        label="Survivors"
                        value={`${playerSurvivors} vs ${opponentSurvivors}`}
                        color={isVictory ? 'var(--ki-color)' : 'var(--physical-color)'}
                    />
                    {/* FIX #2: pokazuje realne punkty (mogą być ujemne przy przegranej) */}
                    <StatCard
                        label="Points"
                        value={pointsEarned > 0 ? `+${pointsEarned}` : String(pointsEarned)}
                        color={pointsEarned > 0 ? '#22c55e' : pointsEarned === 0 ? 'var(--text-muted)' : 'var(--physical-color)'}
                    />
                </div>

                {/* Rank display */}
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
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Current Rank</span>
                    <span style={{ color: 'var(--accent)', fontWeight: 800, fontSize: '1rem' }}>
                        {getRankForScore(newScore)}
                    </span>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                        Power Level: <strong style={{ color: 'var(--text-main)' }}>{newScore}</strong>
                    </span>
                </div>

                {/* Roster summary */}
                <div style={{ display: 'flex', justifyContent: 'center', gap: '2rem', marginBottom: '2rem' }}>
                    <RosterSummary label="Your Team" roster={playerRoster} isPlayer />
                    <RosterSummary label="Opponent" roster={opponentRoster} isPlayer={false} />
                </div>

                {/* Buttons */}
                <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
                    <button
                        className="btn"
                        style={{ fontSize: '1.05rem', padding: '0.85rem 2rem' }}
                        onClick={resetGame}
                    >
                        Return to Menu
                    </button>
                    <button
                        className="btn"
                        style={{
                            fontSize: '1.05rem',
                            padding: '0.85rem 2rem',
                            background: 'rgba(255,255,255,0.08)',
                            border: '1px solid rgba(255,255,255,0.15)',
                            boxShadow: 'none',
                        }}
                        onClick={() => {
                            resetGame();
                            setTimeout(() => useGameState.getState().startMatchmaking(), 50);
                        }}
                    >
                        Play Again
                    </button>
                </div>
            </div>
        </div>
    );
};

// ── Helper sub-components ──────────────────────────────────────────────────────

const StatCard: React.FC<{ label: string; value: string; color: string }> = ({ label, value, color }) => (
    <div style={{
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: '10px',
        padding: '0.6rem 0.5rem',
    }}>
        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '0.2rem' }}>{label}</div>
        <div style={{ fontSize: '1.2rem', fontWeight: 800, color }}>{value}</div>
    </div>
);

const RosterSummary: React.FC<{
    label: string;
    roster: { name: string; currentHp: number; maxHp: number; portraitUrl: string; imageColor: string }[];
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
            {roster.map((c) => (
                <div key={c.name} style={{ textAlign: 'center' }}>
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
                </div>
            ))}
        </div>
    </div>
);
