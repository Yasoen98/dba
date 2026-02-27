import { useGameState } from './stores/rootStore';
import { Matchmaking } from './components/Matchmaking';
import { DraftScreen } from './components/DraftScreen';
import { BattleArena } from './components/BattleArena';
import { LoginScreen } from './components/LoginScreen';
import { GameOverScreen } from './components/GameOverScreen';
import './index.css';

function App() {
    const { phase, startMatchmaking, playerName, playerRank, playerScore, logout } = useGameState();

    return (
        <div className="app-container">
            {phase === 'login' && <LoginScreen />}

            {phase === 'menu' && (
                <div className="menu-screen">
                    {/* Background effects */}
                    <div className="menu-bg-grid" />
                    <div className="menu-bg-glow-top" />
                    <div className="menu-bg-glow-bottom" />
                    <div className="menu-scanline" />

                    {/* Floating particles */}
                    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
                        {[
                            { top: '15%', left: '8%', size: 3, delay: '0s', dur: '6s', color: 'var(--neon-cyan)' },
                            { top: '70%', left: '5%', size: 2, delay: '1s', dur: '8s', color: 'var(--special-color)' },
                            { top: '30%', right: '7%', size: 4, delay: '2s', dur: '7s', color: 'var(--neon-cyan)' },
                            { top: '80%', right: '10%', size: 2, delay: '0.5s', dur: '9s', color: 'var(--neon-gold)' },
                            { top: '50%', left: '3%', size: 3, delay: '3s', dur: '5s', color: 'rgba(56,189,248,0.5)' },
                            { top: '20%', right: '4%', size: 2, delay: '1.5s', dur: '7s', color: 'var(--special-color)' },
                        ].map((p, i) => (
                            <div key={i} style={{
                                position: 'absolute',
                                top: p.top,
                                left: (p as any).left,
                                right: (p as any).right,
                                width: p.size,
                                height: p.size,
                                borderRadius: '50%',
                                background: p.color,
                                boxShadow: `0 0 ${p.size * 3}px ${p.color}`,
                                animation: `particleFloat ${p.dur} ease-in-out ${p.delay} infinite`,
                            }} />
                        ))}
                    </div>

                    <div className="menu-content">
                        {/* Player HUD */}
                        <div className="player-hud">
                            <div className="player-hud-card">
                                <div className="player-hud-avatar">
                                    {playerName.charAt(0).toUpperCase()}
                                </div>
                                <div className="player-hud-info">
                                    <span className="player-hud-name">{playerName}</span>
                                    <span className="player-hud-rank">{playerRank}</span>
                                    <span className="player-hud-score">PL: {playerScore}</span>
                                </div>
                            </div>
                            <button className="signout-btn" onClick={logout}>
                                ⏻ Sign Out
                            </button>
                        </div>

                        {/* Logo */}
                        <div className="menu-logo-section">
                            <div className="menu-logo-eyebrow">⬡ Battle System v2.6 ⬡</div>
                            <h1 className="menu-logo-title">Dragon Ball<br />Arena</h1>
                            <div className="menu-logo-subtitle">Tournament of Power</div>
                            <div className="menu-logo-divider" />
                        </div>

                        {/* Stats grid */}
                        <div className="menu-stats-grid">
                            <div className="menu-stat-card">
                                <span className="menu-stat-icon">⚔</span>
                                <span className="menu-stat-value">30</span>
                                <span className="menu-stat-label">Fighters</span>
                            </div>
                            <div className="menu-stat-card">
                                <span className="menu-stat-icon">◈</span>
                                <span className="menu-stat-value">6</span>
                                <span className="menu-stat-label">Tier Limit</span>
                            </div>
                            <div className="menu-stat-card">
                                <span className="menu-stat-icon">⚡</span>
                                <span className="menu-stat-value">3v3</span>
                                <span className="menu-stat-label">Format</span>
                            </div>
                        </div>

                        {/* Find Match CTA */}
                        <div className="find-match-btn-wrapper">
                            <button className="find-match-btn" onClick={startMatchmaking}>
                                <span className="find-match-btn-corner tl" />
                                <span className="find-match-btn-corner tr" />
                                <span className="find-match-btn-corner bl" />
                                <span className="find-match-btn-corner br" />
                                <span className="find-match-btn-text">
                                    <span className="find-match-btn-icon" />
                                    Find Match
                                </span>
                            </button>

                            <div className="tier-info-bar">
                                <div className="tier-badge">
                                    <div className="tier-dot t1" />
                                    <span>T1 Common</span>
                                </div>
                                <div className="tier-badge">
                                    <div className="tier-dot t2" />
                                    <span>T2 Elite</span>
                                </div>
                                <div className="tier-badge">
                                    <div className="tier-dot t3" />
                                    <span>T3 Legendary</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {phase === 'matchmaking' && <Matchmaking />}
            {phase === 'draft' && <DraftScreen />}
            {phase === 'battle' && <BattleArena />}
            {phase === 'gameOver' && <GameOverScreen />}
        </div>
    );
}

export default App;
