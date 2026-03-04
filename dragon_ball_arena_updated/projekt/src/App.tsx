import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameState } from './core/stores/rootStore';
import { Matchmaking } from './matchmaking/Matchmaking';
import { DraftScreen } from './game/DraftScreen';
import { BattleArena } from './game/BattleArena';
import { LoginScreen } from './ui/LoginScreen';
import { GameOverScreen } from './ui/GameOverScreen';
import { RankingScreen } from './ranking/RankingScreen';
import { INITIAL_CHARACTERS } from './core/data/characters'; // FIX #5
import { useAudio } from './audio/AudioContext';
import './index.css';

function App() {
    const { phase, startMatchmaking, setPhase, playerName, playerRank, playerScore, logout } = useGameState();
    const { playSound, isMuted, toggleMute } = useAudio();

    // Sync session on load and when entering menu
    useEffect(() => {
        if (phase === 'menu') {
            useGameState.getState().syncSession();
        }
    }, [phase]);

    // Manage Background Music
    useEffect(() => {
        if (phase === 'login' || phase === 'menu' || phase === 'matchmaking' || phase === 'draft' || phase === 'ranking') {
            playSound('menu');
        } else if (phase === 'battle') {
            playSound('battle');
        }
    }, [phase, playSound]);

    return (
        <div className="app-container">
            {/* Global Mute Toggle */}
            <motion.button 
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={toggleMute}
                onMouseEnter={() => playSound('ui_hover')}
                style={{
                    position: 'fixed',
                    bottom: '20px',
                    right: '20px',
                    zIndex: 1000,
                    width: '50px',
                    height: '50px',
                    borderRadius: '50%',
                    background: 'rgba(6, 18, 40, 0.8)',
                    backdropFilter: 'blur(10px)',
                    border: '2px solid var(--neon-cyan)',
                    color: 'var(--neon-cyan)',
                    cursor: 'pointer',
                    fontSize: '1.4rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 0 20px var(--neon-cyan)44',
                    transition: 'all 0.3s ease',
                }}
            >
                {isMuted ? '🔇' : '🔊'}
            </motion.button>

            <AnimatePresence mode="wait">
                {phase === 'login' && (
                    <motion.div key="login" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                        <LoginScreen />
                    </motion.div>
                )}

                {phase === 'menu' && (
                    <motion.div 
                        key="menu" 
                        initial={{ opacity: 0 }} 
                        animate={{ opacity: 1 }} 
                        exit={{ opacity: 0 }}
                        className="menu-screen"
                    >
                        {/* Background effects */}
                        <div className="menu-bg-grid" />
                        <div className="menu-bg-glow-top" />
                        <div className="menu-bg-glow-bottom" />
                        <div className="menu-scanline" />

                        {/* Enhanced Floating particles */}
                        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
                            {(
                                [
                                    { top: '15%', left: '8%', size: 4, delay: '0s', dur: '6s', color: 'var(--neon-cyan)' },
                                    { top: '70%', left: '5%', size: 3, delay: '1s', dur: '8s', color: 'var(--special-color)' },
                                    { top: '30%', right: '7%', size: 5, delay: '2s', dur: '7s', color: 'var(--neon-cyan)' },
                                    { top: '80%', right: '10%', size: 3, delay: '0.5s', dur: '9s', color: 'var(--neon-gold)' },
                                    { top: '50%', left: '3%', size: 4, delay: '3s', dur: '5s', color: 'rgba(56,189,248,0.5)' },
                                    { top: '20%', right: '4%', size: 3, delay: '1.5s', dur: '7s', color: 'var(--special-color)' },
                                ] as Array<{top: string, left?: string, right?: string, size: number, delay: string, dur: string, color: string}>
                            ).map((p, i) => (
                                <motion.div 
                                    key={i} 
                                    animate={{ 
                                        y: [0, -30, 0],
                                        opacity: [0.4, 1, 0.4],
                                        scale: [1, 1.2, 1]
                                    }}
                                    transition={{ 
                                        duration: parseFloat(p.dur), 
                                        repeat: Infinity, 
                                        delay: parseFloat(p.delay),
                                        ease: "easeInOut"
                                    }}
                                    style={{
                                        position: 'absolute',
                                        top: p.top,
                                        left: p.left,
                                        right: p.right,
                                        width: p.size,
                                        height: p.size,
                                        borderRadius: '50%',
                                        background: p.color,
                                        boxShadow: `0 0 ${p.size * 4}px ${p.color}`,
                                    }} 
                                />
                            ))}
                        </div>

                        <div className="menu-content">
                            {/* Player HUD - More stylized */}
                            <motion.div 
                                initial={{ y: -50, opacity: 0 }}
                                animate={{ y: 0, opacity: 1 }}
                                transition={{ delay: 0.2 }}
                                className="player-hud"
                            >
                                <div className="player-hud-card bg-glass border-neon-cyan">
                                    <div className="player-hud-avatar" style={{ border: '2px solid var(--neon-cyan)', boxShadow: '0 0 10px var(--neon-cyan)44' }}>
                                        {playerName.charAt(0).toUpperCase()}
                                    </div>
                                    <div className="player-hud-info">
                                        <span className="player-hud-name text-glow-cyan">{playerName}</span>
                                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                            <span className="player-hud-rank" style={{ color: 'var(--neon-gold)', fontWeight: 800 }}>{playerRank}</span>
                                            <span style={{ color: 'rgba(255,255,255,0.2)' }}>|</span>
                                            <span className="player-hud-score">PL: {playerScore}</span>
                                        </div>
                                    </div>
                                </div>
                                <motion.button 
                                    whileHover={{ scale: 1.05, backgroundColor: 'rgba(239, 68, 68, 0.2)' }}
                                    whileTap={{ scale: 0.95 }}
                                    className="signout-btn" 
                                    onClick={logout}
                                    onMouseEnter={() => playSound('ui_hover')}
                                    style={{ border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '8px' }}
                                >
                                    ⏻ Sign Out
                                </motion.button>
                            </motion.div>

                            {/* Logo - Epic Reveal */}
                            <div className="menu-logo-section">
                                <motion.div 
                                    initial={{ opacity: 0, scale: 0.5 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    transition={{ type: 'spring', damping: 12 }}
                                    className="menu-logo-eyebrow"
                                >⬡ Tournament of Power ⬡</motion.div>
                                
                                <motion.h1 
                                    initial={{ filter: 'blur(10px)', opacity: 0, y: 20 }}
                                    animate={{ filter: 'blur(0px)', opacity: 1, y: 0 }}
                                    transition={{ duration: 0.8, delay: 0.3 }}
                                    className="menu-logo-title"
                                    style={{ textShadow: '0 0 40px rgba(56, 189, 248, 0.4)', lineHeight: 0.9 }}
                                >
                                    Dragon Ball<br />
                                    <span style={{ color: 'var(--neon-gold)', textShadow: '0 0 30px rgba(245, 158, 11, 0.5)' }}>ARENA</span>
                                </motion.h1>
                                
                                <motion.div 
                                    initial={{ width: 0 }}
                                    animate={{ width: '100px' }}
                                    transition={{ delay: 0.8, duration: 0.5 }}
                                    className="menu-logo-divider" 
                                />
                            </div>

                            {/* Stats grid - Enhanced icons and layout */}
                            <motion.div 
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.5 }}
                                className="menu-stats-grid"
                            >
                                <div className="menu-stat-card bg-glass">
                                    <span className="menu-stat-icon" style={{ color: 'var(--neon-gold)' }}>⚔</span>
                                    <span className="menu-stat-value">{INITIAL_CHARACTERS.length}</span>
                                    <span className="menu-stat-label">Fighters</span>
                                </div>
                                <div className="menu-stat-card bg-glass">
                                    <span className="menu-stat-icon" style={{ color: 'var(--neon-cyan)' }}>◈</span>
                                    <span className="menu-stat-value">6</span>
                                    <span className="menu-stat-label">Tier Limit</span>
                                </div>
                                <div className="menu-stat-card bg-glass">
                                    <span className="menu-stat-icon" style={{ color: 'var(--special-color)' }}>⚡</span>
                                    <span className="menu-stat-value">3v3</span>
                                    <span className="menu-stat-label">Format</span>
                                </div>
                            </motion.div>

                            {/* Find Match CTA - Large and glowing */}
                            <motion.div 
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ delay: 0.7 }}
                                className="find-match-btn-wrapper"
                            >
                                <button className="find-match-btn" 
                                    onClick={() => startMatchmaking(true)}
                                    onMouseEnter={() => playSound('ui_hover')}
                                    style={{ height: '80px' }}
                                >
                                    <span className="find-match-btn-corner tl" />
                                    <span className="find-match-btn-corner tr" />
                                    <span className="find-match-btn-corner bl" />
                                    <span className="find-match-btn-corner br" />
                                    <span className="find-match-btn-text" style={{ fontSize: '1.4rem', fontWeight: 900 }}>
                                        <span className="find-match-btn-icon" style={{ width: '24px', height: '24px' }} />
                                        Szukaj Walki
                                    </span>
                                </button>

                                <div className="tier-info-bar bg-glass" style={{ borderRadius: '20px', padding: '0.5rem 1rem' }}>
                                    <div className="tier-badge"><div className="tier-dot t1" /><span>T1</span></div>
                                    <div className="tier-badge"><div className="tier-dot t2" /><span>T2</span></div>
                                    <div className="tier-badge"><div className="tier-dot t3" /><span>T3</span></div>
                                </div>

                                <motion.button 
                                    whileHover={{ scale: 1.05, boxShadow: '0 0 20px var(--neon-gold)44' }}
                                    whileTap={{ scale: 0.95 }}
                                    className="ranking-btn" 
                                    onClick={() => setPhase('ranking')}
                                    onMouseEnter={() => playSound('ui_hover')}
                                    style={{ border: '2px solid var(--neon-gold)', color: 'var(--neon-gold)' }}
                                >
                                    <span className="ranking-btn-corner tl" style={{ background: 'var(--neon-gold)' }} />
                                    <span className="ranking-btn-corner tr" style={{ background: 'var(--neon-gold)' }} />
                                    <span className="ranking-btn-corner bl" style={{ background: 'var(--neon-gold)' }} />
                                    <span className="ranking-btn-corner br" style={{ background: 'var(--neon-gold)' }} />
                                    <span className="ranking-btn-text" style={{ fontWeight: 900 }}>⬡ TABELA LIDERÓW</span>
                                </motion.button>
                            </motion.div>
                        </div>
                    </motion.div>
                )}

                {phase === 'matchmaking' && (
                    <motion.div key="matchmaking" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                        <Matchmaking />
                    </motion.div>
                )}
                {phase === 'draft' && (
                    <motion.div key="draft" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                        <DraftScreen />
                    </motion.div>
                )}
                {phase === 'battle' && (
                    <motion.div key="battle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                        <BattleArena />
                    </motion.div>
                )}
                {phase === 'gameOver' && (
                    <motion.div key="gameOver" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                        <GameOverScreen />
                    </motion.div>
                )}
                {phase === 'ranking' && (
                    <motion.div key="ranking" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                        <RankingScreen />
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

export default App;
