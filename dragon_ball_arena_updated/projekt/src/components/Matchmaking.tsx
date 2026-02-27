import React, { useEffect, useState } from 'react';
import { useGameState } from '../stores/rootStore';

const TOTAL_TIME = 30;

export const Matchmaking: React.FC = () => {
    const { matchmakingTimer, tickMatchmaking, phase, playerName, playerRank, playerScore } = useGameState();
    const [streamValues, setStreamValues] = useState(['---', '---', '---', '---']);

    useEffect(() => {
        let interval: ReturnType<typeof setInterval>;
        if (phase === 'matchmaking') {
            interval = setInterval(() => {
                tickMatchmaking();
            }, 1000);
        }
        return () => clearInterval(interval);
    }, [phase, tickMatchmaking]);

    // Animate data stream values
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

    const elapsed = TOTAL_TIME - matchmakingTimer;
    const progressPct = Math.min((elapsed / TOTAL_TIME) * 100, 100);

    // Radar blip positions (randomised once)
    const blips = [
        { top: '25%', left: '60%', delay: '0s' },
        { top: '65%', left: '30%', delay: '1.2s' },
        { top: '40%', left: '75%', delay: '2.4s' },
    ];

    return (
        <div className="matchmaking-screen">
            <div className="matchmaking-bg-grid" />

            {/* Ambient glows */}
            <div style={{
                position: 'absolute', top: '20%', left: '50%', transform: 'translateX(-50%)',
                width: 600, height: 300,
                background: 'radial-gradient(ellipse, rgba(56,189,248,0.06) 0%, transparent 70%)',
                pointerEvents: 'none',
            }} />

            <div className="matchmaking-content">

                {/* Header */}
                <div className="matchmaking-status">
                    <h2 className="matchmaking-title">Scanning Network</h2>
                    <p className="matchmaking-subtitle">Searching for opponent · Please stand by</p>
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
                        <div key={i} className="radar-blip" style={{
                            top: b.top, left: b.left,
                            animationDelay: b.delay,
                        }} />
                    ))}
                </div>

                {/* Player card */}
                <div style={{
                    background: 'rgba(6,18,40,0.9)',
                    border: '1px solid rgba(56,189,248,0.2)',
                    borderRadius: 10,
                    padding: '0.75rem 1.5rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '1rem',
                    width: '100%',
                    maxWidth: 400,
                    animation: 'slideInLeft 0.5s ease both',
                }}>
                    <div style={{
                        width: 40, height: 40, borderRadius: '50%',
                        background: 'linear-gradient(135deg, rgba(56,189,248,0.3), rgba(168,85,247,0.3))',
                        border: '2px solid rgba(56,189,248,0.5)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontFamily: "'Orbitron', sans-serif",
                        fontWeight: 900, fontSize: '1rem',
                        color: 'var(--neon-cyan)',
                        flexShrink: 0,
                    }}>
                        {playerName.charAt(0).toUpperCase()}
                    </div>
                    <div style={{ flex: 1 }}>
                        <div style={{
                            fontFamily: "'Orbitron', sans-serif",
                            fontSize: '0.8rem', fontWeight: 700,
                            letterSpacing: 1, textTransform: 'uppercase',
                            color: 'var(--text-main)',
                        }}>{playerName}</div>
                        <div style={{ fontSize: '0.65rem', color: 'var(--neon-cyan)', letterSpacing: 1 }}>
                            {playerRank} · PL {playerScore}
                        </div>
                    </div>
                    <div style={{
                        width: 8, height: 8, borderRadius: '50%',
                        background: '#22c55e',
                        boxShadow: '0 0 10px #22c55e',
                        animation: 'pulse 1.5s ease-in-out infinite',
                    }} />
                </div>

                {/* Progress */}
                <div className="matchmaking-progress-wrapper">
                    <div className="matchmaking-progress-header">
                        <span className="matchmaking-progress-label">Search Progress</span>
                        <span className="matchmaking-progress-timer">{matchmakingTimer}s</span>
                    </div>
                    <div className="matchmaking-progress-bar-bg">
                        <div
                            className="matchmaking-progress-bar-fill"
                            style={{ width: `${progressPct}%` }}
                        />
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

                {/* Bot alert */}
                {matchmakingTimer <= 10 && (
                    <div className="bot-alert">
                        <div className="bot-alert-icon" />
                        <span className="bot-alert-text">No human opponent found — Initialising Bot Protocol</span>
                    </div>
                )}
            </div>
        </div>
    );
};
