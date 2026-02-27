import React, { useEffect, useRef, useState } from 'react';
import { useGameState } from '../stores/rootStore';
import type { BattleCharacter } from '../stores/battleSlice';
import type { PlayerEnergy, ActionCost } from '../types';

// ─── Energy Display ────────────────────────────────────────────────────────────
const EnergyDisplay: React.FC<{ energy: PlayerEnergy; label: string }> = ({ energy, label }) => (
    <div style={{
        background: 'rgba(0,0,0,0.35)',
        padding: '0.4rem 0.75rem',
        borderRadius: '10px',
        display: 'flex',
        alignItems: 'center',
        gap: '0.4rem',
        flexWrap: 'wrap',
        justifyContent: 'center',
        border: '1px solid rgba(255,255,255,0.08)',
    }}>
        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginRight: '0.25rem' }}>{label}:</span>
        {Array.from({ length: energy.ki }).map((_, i) => (
            <span key={`ki-${i}`} className="energy-pill energy-ki">K</span>
        ))}
        {Array.from({ length: energy.physical }).map((_, i) => (
            <span key={`phys-${i}`} className="energy-pill energy-physical">P</span>
        ))}
        {Array.from({ length: energy.special }).map((_, i) => (
            <span key={`spec-${i}`} className="energy-pill energy-special">S</span>
        ))}
        {Array.from({ length: energy.universal || 0 }).map((_, i) => (
            <span key={`uni-${i}`} className="energy-pill energy-universal">U</span>
        ))}
        {energy.ki + energy.physical + energy.special + (energy.universal || 0) === 0 && (
            <span style={{ fontSize: '0.8rem', color: '#555' }}>Empty</span>
        )}
    </div>
);

// ─── Cost Display ──────────────────────────────────────────────────────────────
const CostDisplay: React.FC<{ cost: ActionCost }> = ({ cost }) => (
    <div style={{ display: 'flex', gap: '2px', justifyContent: 'center', marginTop: '4px', flexWrap: 'wrap' }}>
        {Array.from({ length: cost.ki || 0 }).map((_, i) => (
            <span key={`c-ki-${i}`} className="energy-pill energy-ki" style={{ width: 14, height: 14, fontSize: '0.55rem' }}>K</span>
        ))}
        {Array.from({ length: cost.physical || 0 }).map((_, i) => (
            <span key={`c-ph-${i}`} className="energy-pill energy-physical" style={{ width: 14, height: 14, fontSize: '0.55rem' }}>P</span>
        ))}
        {Array.from({ length: cost.special || 0 }).map((_, i) => (
            <span key={`c-sp-${i}`} className="energy-pill energy-special" style={{ width: 14, height: 14, fontSize: '0.55rem' }}>S</span>
        ))}
        {Array.from({ length: cost.any || 0 }).map((_, i) => (
            <span key={`c-any-${i}`} className="energy-pill energy-universal" style={{ width: 14, height: 14, fontSize: '0.55rem' }}>U</span>
        ))}
    </div>
);

// ─── Effect colors / labels ────────────────────────────────────────────────────
const effectColors: Record<string, string> = {
    pierce:  '#f59e0b',
    stun:    '#a855f7',
    weaken:  '#ef4444',
    buff:    '#22c55e',
    poison:  '#84cc16',
    bleed:   '#dc2626',
    regen:   '#06b6d4',
    dodging: '#38bdf8',
    aoe:     '#fb923c',
    heal:    '#34d399',
    healAll: '#10b981',
    clear:   '#e0f2fe',
    senzu:   '#fcd34d',
    energy:  '#38bdf8',
    drain:   '#8b5cf6',
    none:    'transparent',
};

const effectLabel: Record<string, string> = {
    pierce:  'PIERCE',
    stun:    'STUN',
    weaken:  'WEAKEN',
    buff:    'BUFF',
    poison:  '☠ POISON',
    bleed:   '🩸 BLEED',
    regen:   '💚 REGEN',
    aoe:     '💥 AOE',
    heal:    '💊 HEAL',
    healAll: '✨ HEAL ALL',
    clear:   '🧹 CLEAR',
    senzu:   '⚡ SENZU',
    energy:  '🔋 ENERGY',
    drain:   '🌀 DRAIN',
    none:    '',
};

// ─── Character Portrait ────────────────────────────────────────────────────────
const CharacterPortrait: React.FC<{
    char: BattleCharacter;
    isSelected?: boolean;
    isActiveTurn?: boolean;
    isOpponent?: boolean;
    isExecuting?: boolean;
    onClick?: () => void;
}> = ({ char, isSelected, isActiveTurn, isOpponent, isExecuting, onClick }) => {
    const hpPercent = Math.max(0, (char.currentHp / char.maxHp) * 100);
    const hpColor = hpPercent > 50 ? '#22c55e' : hpPercent > 20 ? '#eab308' : '#ef4444';
    const isDead = char.currentHp <= 0;
    const borderColor = isOpponent ? 'var(--physical-color)' : 'var(--ki-color)';

    return (
        <div
            onClick={!isDead && onClick ? onClick : undefined}
            style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                opacity: isExecuting ? 0.55 : (isDead ? 0.25 : 1),
                transform: isExecuting
                    ? 'scale(0.88) translateY(0px)'
                    : (isSelected ? 'scale(1.12) translateY(-6px)' : 'scale(1)'),
                transition: 'all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
                cursor: !isDead && onClick ? 'pointer' : 'default',
                width: '90px',
                filter: isExecuting
                    ? 'brightness(0.7) saturate(0.6)'
                    : (isDead ? 'grayscale(1)' : 'none'),
            }}
        >
            <div style={{
                position: 'relative',
                width: '72px',
                height: '72px',
                borderRadius: '50%',
                border: isSelected ? `3px solid ${borderColor}` : `2px solid rgba(255,255,255,0.12)`,
                boxShadow: isSelected
                    ? `0 0 18px ${borderColor}, 0 0 40px ${borderColor}55`
                    : '0 4px 12px rgba(0,0,0,0.6)',
                backgroundImage: char.portraitUrl ? `url(${char.portraitUrl})` : 'none',
                backgroundColor: char.imageColor,
                backgroundSize: 'cover',
                backgroundPosition: 'center top',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: isSelected ? 10 : 1,
                overflow: 'hidden',
            }}>
                {!char.portraitUrl && (
                    <span style={{ fontWeight: 'bold', fontSize: '10px', textAlign: 'center', padding: '4px' }}>
                        {char.name}
                    </span>
                )}
                {isActiveTurn && (
                    <div style={{
                        position: 'absolute',
                        top: -4, right: -4,
                        width: 18, height: 18,
                        background: 'var(--accent)',
                        borderRadius: '50%',
                        border: '2px solid #fff',
                        animation: 'pulse 1.2s infinite',
                        boxShadow: '0 0 8px var(--accent)',
                    }} />
                )}
            </div>

            <div style={{
                marginTop: '0.35rem',
                fontWeight: 700,
                fontSize: '0.72rem',
                color: isSelected
                    ? (isOpponent ? 'var(--physical-color)' : 'var(--ki-color)')
                    : '#ddd',
                textShadow: '0 1px 3px rgba(0,0,0,0.9)',
                textAlign: 'center',
                maxWidth: '88px',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
            }}>
                {char.name}
            </div>

            <div style={{
                width: '100%',
                height: '6px',
                background: '#1a1a2e',
                marginTop: '0.4rem',
                borderRadius: '3px',
                overflow: 'hidden',
                border: '1px solid rgba(255,255,255,0.1)',
            }}>
                <div style={{
                    width: `${hpPercent}%`,
                    height: '100%',
                    background: hpColor,
                    transition: 'width 0.4s ease',
                    boxShadow: `0 0 6px ${hpColor}88`,
                }} />
            </div>
            <span style={{ fontSize: '0.68rem', marginTop: '0.15rem', color: '#aaa', fontVariantNumeric: 'tabular-nums' }}>
                {Math.floor(char.currentHp)}/{char.maxHp}
            </span>

            <div style={{ display: 'flex', gap: '2px', flexWrap: 'wrap', justifyContent: 'center', minHeight: '18px', marginTop: '3px' }}>
                {char.statusEffects.map((e, i) => (
                    <span key={i} style={{
                        fontSize: '0.58rem',
                        color: effectColors[e.effect] || '#fff',
                        background: 'rgba(0,0,0,0.75)',
                        padding: '1px 4px',
                        borderRadius: '4px',
                        border: `1px solid ${effectColors[e.effect] || '#555'}55`,
                        fontWeight: 700,
                        letterSpacing: '0.3px',
                    }}>
                        {effectLabel[e.effect] || e.effect.toUpperCase()} {e.duration > 0 ? `(${e.duration})` : ''}
                    </span>
                ))}
            </div>
        </div>
    );
};

// ─── Action Button ─────────────────────────────────────────────────────────────
const ActionButton: React.FC<{
    iconUrl?: string;
    name: string;
    subLabel: string;
    cost: ActionCost;
    disabled: boolean;
    isActive?: boolean;
    accentColor?: string;
    effect?: string;
    onClick: () => void;
    tooltip?: string;
}> = ({ iconUrl, name, subLabel, cost, disabled, accentColor = 'var(--ki-color)', effect, onClick, tooltip }) => (
    <button
        onClick={!disabled ? onClick : undefined}
        disabled={disabled}
        title={tooltip}
        style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0.5rem 0.35rem',
            background: disabled ? 'rgba(20,25,40,0.6)' : `linear-gradient(135deg, rgba(15,23,42,0.95), rgba(20,30,50,0.9))`,
            border: `1px solid ${disabled ? 'rgba(255,255,255,0.06)' : accentColor + '55'}`,
            borderRadius: '10px',
            cursor: disabled ? 'not-allowed' : 'pointer',
            opacity: disabled ? 0.45 : 1,
            transition: 'all 0.2s ease',
            boxShadow: disabled ? 'none' : `0 0 10px ${accentColor}22, inset 0 1px 0 rgba(255,255,255,0.05)`,
            minHeight: '90px',
        }}
    >
        {iconUrl && (
            <img
                src={iconUrl}
                alt={name}
                style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '8px',
                    objectFit: 'cover',
                    border: `1px solid ${accentColor}44`,
                    marginBottom: '3px',
                }}
            />
        )}
        <div style={{
            fontSize: '0.7rem',
            fontWeight: 700,
            color: disabled ? '#555' : '#e2e8f0',
            textAlign: 'center',
            lineHeight: 1.2,
            maxWidth: '100%',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
        }}>
            {name}
        </div>
        <div style={{ fontSize: '0.6rem', color: disabled ? '#444' : accentColor, fontWeight: 600 }}>
            {subLabel}
        </div>
        <CostDisplay cost={cost} />
        {effect && effect !== 'none' && (
            <div style={{
                fontSize: '0.55rem',
                color: effectColors[effect] || '#888',
                fontWeight: 700,
                marginTop: '2px',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
            }}>
                {effectLabel[effect] || effect}
            </div>
        )}
    </button>
);

// ─── Flash overlay ─────────────────────────────────────────────────────────────
const FlashOverlay: React.FC<{ iconUrl?: string; name: string; visible: boolean }> = ({ iconUrl, name, visible }) => (
    <div style={{
        position: 'fixed',
        top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        zIndex: 200,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '0.5rem',
        pointerEvents: 'none',
        opacity: visible ? 1 : 0,
        transition: 'opacity 0.3s ease',
    }}>
        {iconUrl && (
            <img
                src={iconUrl}
                alt={name}
                style={{
                    width: '96px',
                    height: '96px',
                    borderRadius: '16px',
                    border: '3px solid var(--accent)',
                    boxShadow: '0 0 40px var(--accent), 0 0 80px rgba(245,158,11,0.3)',
                    animation: visible ? 'popIn 0.4s ease' : 'none',
                }}
            />
        )}
        <div style={{
            fontSize: '1.1rem',
            fontWeight: 800,
            color: 'var(--accent)',
            textShadow: '0 0 20px var(--accent)',
            letterSpacing: '1px',
            textTransform: 'uppercase',
        }}>
            {name}
        </div>
    </div>
);

// ─── Main BattleArena ──────────────────────────────────────────────────────────
export const BattleArena: React.FC = () => {
    const {
        playerRoster, opponentRoster,
        playerActiveIndex, opponentActiveIndex,
        playerEnergy, opponentEnergy,
        turnNumber, isPlayerTurn,
        // FIX #7: passTurn zamiast endTurn w UI (endTurn to metoda wewnętrzna)
        combatLogs, executePlayerAction, passTurn, setPlayerActiveIndex,
        surrender, winner, setOpponentActiveIndex, playerActionsUsed,
        playerName,
    } = useGameState();

    const logsRef = useRef<HTMLDivElement>(null);
    const [flashAction, setFlashAction] = useState<{ iconUrl?: string; name: string } | null>(null);
    const [flashVisible, setFlashVisible] = useState(false);
    const [showSurrenderConfirm, setShowSurrenderConfirm] = useState(false);
    const [executingPlayerIndices, setExecutingPlayerIndices] = useState<number[]>([]);
    const [executingOpponentIndices, setExecutingOpponentIndices] = useState<number[]>([]);

    useEffect(() => {
        if (logsRef.current) {
            logsRef.current.scrollTop = 0;
        }
    }, [combatLogs]);

    useEffect(() => {
        if (combatLogs.length === 0) return;
        const latest = combatLogs[0];
        if (latest.playerName === 'System') return;

        const roster = latest.isOpponent ? opponentRoster : playerRoster;
        const char = roster.find(c => c.name === latest.characterName);
        if (!char) return;

        if (latest.isOpponent) {
            const opIndex = opponentRoster.findIndex(c => c.name === latest.characterName);
            if (opIndex !== -1) setExecutingOpponentIndices(prev => prev.includes(opIndex) ? prev : [...prev, opIndex]);
        } else {
            const pIndex = playerRoster.findIndex(c => c.name === latest.characterName);
            if (pIndex !== -1) setExecutingPlayerIndices(prev => prev.includes(pIndex) ? prev : [...prev, pIndex]);
        }

        const tech = char.techniques.find(t => t.name === latest.action);
        const iconUrl = tech?.iconUrl ?? (char.dodge.name === latest.action ? char.dodge.iconUrl : undefined);

        if (iconUrl) {
            setFlashAction({ iconUrl, name: latest.action });
            setFlashVisible(true);
            const timer = setTimeout(() => setFlashVisible(false), 900);
            return () => clearTimeout(timer);
        }
    }, [combatLogs]);

    useEffect(() => {
        setExecutingPlayerIndices([]);
        setExecutingOpponentIndices([]);
    }, [turnNumber]);

    const pActive = playerRoster[playerActiveIndex];

    const canAfford = (cost: ActionCost) => {
        const needKi = cost.ki || 0;
        const needPh = cost.physical || 0;
        const needSp = cost.special || 0;
        const needAny = cost.any || 0;

        let availKi = playerEnergy.ki;
        let availPh = playerEnergy.physical;
        let availSp = playerEnergy.special;
        let availUniversal = playerEnergy.universal || 0;

        if (availKi < needKi) { const s = needKi - availKi; if (availUniversal < s) return false; availUniversal -= s; }
        if (availPh < needPh) { const s = needPh - availPh; if (availUniversal < s) return false; availUniversal -= s; }
        if (availSp < needSp) { const s = needSp - availSp; if (availUniversal < s) return false; availUniversal -= s; }
        if (needAny > availUniversal) return false;
        return true;
    };

    if (!pActive) return null;

    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            height: '100vh',
            maxHeight: '100vh',
            overflow: 'hidden',
            padding: '0.5rem',
            gap: '0.5rem',
            background: 'var(--bg-main)',
        }}>
            {flashAction && (
                <FlashOverlay iconUrl={flashAction.iconUrl} name={flashAction.name} visible={flashVisible} />
            )}

            {/* ── TOP: Opponent row ── */}
            <div className="glass-panel" style={{
                padding: '0.75rem 1rem',
                background: 'rgba(239,68,68,0.04)',
                borderColor: 'rgba(239,68,68,0.2)',
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <div style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--physical-color)', boxShadow: '0 0 8px var(--physical-color)' }} />
                        <span style={{ fontWeight: 700, color: 'var(--physical-color)', fontSize: '0.9rem' }}>Bot Opponent</span>
                    </div>
                    <EnergyDisplay energy={opponentEnergy} label="Energy" />
                </div>
                <div style={{ display: 'flex', gap: '1.5rem', justifyContent: 'center' }}>
                    {opponentRoster.map((c, i) => (
                        <CharacterPortrait
                            key={c.id}
                            char={c}
                            isSelected={i === opponentActiveIndex}
                            isActiveTurn={!isPlayerTurn && i === opponentActiveIndex}
                            isExecuting={executingOpponentIndices.includes(i)}
                            isOpponent
                            onClick={() => isPlayerTurn && setOpponentActiveIndex(i)}
                        />
                    ))}
                </div>
            </div>

            {/* ── MIDDLE: Turn info + Combat log ── */}
            <div className="glass-panel" style={{
                display: 'grid',
                gridTemplateColumns: '1fr auto',
                gap: '0.75rem',
                padding: '0.75rem 1rem',
                alignItems: 'center',
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{
                        background: isPlayerTurn
                            ? 'linear-gradient(135deg, rgba(56,189,248,0.2), rgba(56,189,248,0.05))'
                            : 'linear-gradient(135deg, rgba(239,68,68,0.2), rgba(239,68,68,0.05))',
                        border: `1px solid ${isPlayerTurn ? 'var(--ki-color)' : 'var(--physical-color)'}`,
                        borderRadius: '10px',
                        padding: '0.4rem 1rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                    }}>
                        <div style={{
                            width: 8, height: 8, borderRadius: '50%',
                            background: isPlayerTurn ? 'var(--ki-color)' : 'var(--physical-color)',
                            animation: 'pulse 1s infinite',
                            boxShadow: `0 0 6px ${isPlayerTurn ? 'var(--ki-color)' : 'var(--physical-color)'}`,
                        }} />
                        <span style={{ fontWeight: 800, fontSize: '0.85rem', color: isPlayerTurn ? 'var(--ki-color)' : 'var(--physical-color)' }}>
                            {isPlayerTurn ? `${playerName || 'Your'} Turn` : 'Opponent Turn'}
                        </span>
                    </div>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Round {turnNumber}</span>
                </div>

                <button
                    onClick={() => setShowSurrenderConfirm(true)}
                    disabled={!!winner || !isPlayerTurn}
                    style={{
                        padding: '0.35rem 0.8rem',
                        background: 'rgba(239,68,68,0.1)',
                        border: '1px solid rgba(239,68,68,0.3)',
                        color: 'rgba(239,68,68,0.8)',
                        borderRadius: '6px',
                        fontSize: '0.7rem',
                        cursor: (winner || !isPlayerTurn) ? 'not-allowed' : 'pointer',
                        opacity: (winner || !isPlayerTurn) ? 0.4 : 1,
                        fontWeight: 700,
                        letterSpacing: '0.5px',
                    }}
                >
                    Surrender
                </button>
            </div>

            {/* ── COMBAT LOG ── */}
            <div
                ref={logsRef}
                className="glass-panel"
                style={{
                    flex: 1,
                    overflowY: 'auto',
                    padding: '0.75rem 1rem',
                    maxHeight: '180px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.35rem',
                }}
            >
                {combatLogs.map(log => (
                    <div key={log.id} style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', minWidth: '40px', flexShrink: 0 }}>
                            R{log.turn}
                        </span>
                        <div>
                            <div style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
                                <strong style={{
                                    color: log.playerName === 'System'
                                        ? 'var(--accent)'
                                        : log.isOpponent ? 'var(--physical-color)' : 'var(--ki-color)',
                                }}>{log.playerName}</strong>
                                {log.characterName ? ` (${log.characterName})` : ''}
                            </div>
                            <div style={{ fontSize: '0.82rem', color: '#e2e8f0' }}>{log.details}</div>
                        </div>
                    </div>
                ))}
            </div>

            {/* ── BOTTOM: Player row + Actions ── */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <div className="glass-panel" style={{
                    padding: '0.75rem 1rem',
                    background: 'rgba(56,189,248,0.04)',
                    borderColor: 'rgba(56,189,248,0.2)',
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <div style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--ki-color)', boxShadow: '0 0 8px var(--ki-color)' }} />
                            <span style={{ fontWeight: 700, color: 'var(--ki-color)', fontSize: '0.9rem' }}>
                                {playerName || 'You'}
                            </span>
                        </div>
                        <EnergyDisplay energy={playerEnergy} label="Energy" />
                    </div>
                    <div style={{ display: 'flex', gap: '1.5rem', justifyContent: 'center' }}>
                        {playerRoster.map((c, i) => (
                            <CharacterPortrait
                                key={c.id}
                                char={c}
                                isSelected={i === playerActiveIndex}
                                isActiveTurn={isPlayerTurn && i === playerActiveIndex}
                                isExecuting={executingPlayerIndices.includes(i)}
                                onClick={() => isPlayerTurn && setPlayerActiveIndex(i)}
                            />
                        ))}
                    </div>
                </div>

                {/* Action bar */}
                <div className="glass-panel" style={{ padding: '0.75rem', background: 'rgba(10,15,30,0.92)' }}>
                    <div style={{
                        fontSize: '0.75rem',
                        color: 'var(--text-muted)',
                        marginBottom: '0.5rem',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                    }}>
                        <span>
                            Actions for{' '}
                            <strong style={{ color: pActive.imageColor }}>{pActive.name}</strong>
                            {!isPlayerTurn && (
                                <span style={{ color: 'var(--physical-color)', marginLeft: '0.5rem' }}>
                                    (Waiting for opponent...)
                                </span>
                            )}
                        </span>
                        {isPlayerTurn && (
                            // FIX #7: passTurn zamiast endTurn — poprawnie loguje "passed" dla każdej postaci
                            <button
                                onClick={passTurn}
                                disabled={!!winner}
                                style={{
                                    padding: '0.35rem 0.8rem',
                                    background: 'rgba(59,130,246,0.35)',
                                    border: '1px solid rgba(59,130,246,0.5)',
                                    color: '#fff',
                                    borderRadius: '6px',
                                    fontSize: '0.75rem',
                                    fontWeight: 700,
                                    cursor: winner ? 'not-allowed' : 'pointer',
                                    opacity: winner ? 0.5 : 1,
                                    transition: 'all 0.2s ease',
                                }}
                                title="Pass remaining actions and end round"
                            >
                                End Round
                            </button>
                        )}
                    </div>

                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(4, 1fr)',
                        gap: '0.5rem',
                        opacity: isPlayerTurn ? 1 : 0.5,
                        pointerEvents: isPlayerTurn ? 'auto' : 'none',
                        marginBottom: '0.5rem',
                    }}>
                        {pActive.techniques.map(tech => {
                            const cd = pActive.cooldowns[tech.id] || 0;
                            const isDisabled = cd > 0 || !canAfford(tech.cost) || !isPlayerTurn || !!playerActionsUsed[playerActiveIndex];
                            const accentMap: Record<string, string> = {
                                pierce:  '#f59e0b', stun:    '#a855f7', weaken:  '#ef4444',
                                buff:    '#22c55e', poison:  '#84cc16', bleed:   '#dc2626',
                                regen:   '#06b6d4', aoe:     '#fb923c', heal:    '#34d399',
                                healAll: '#10b981', clear:   '#bae6fd', senzu:   '#fcd34d',
                                energy:  '#38bdf8', drain:   '#8b5cf6',
                            };
                            return (
                                <ActionButton
                                    key={tech.id}
                                    iconUrl={tech.iconUrl}
                                    name={tech.name}
                                    subLabel={cd > 0 ? `⏳ CD: ${cd}` : tech.damage > 0 ? `💥 ${tech.damage}` : effectLabel[tech.effect] || '✦ Utility'}
                                    cost={tech.cost}
                                    disabled={isDisabled}
                                    effect={tech.effect}
                                    accentColor={accentMap[tech.effect] || 'var(--ki-color)'}
                                    onClick={() => executePlayerAction('technique', tech.id)}
                                    tooltip={tech.description}
                                />
                            );
                        })}

                        {/* FIX #4: wywołanie dodge przez stały klucz 'dodge' zamiast dodge.name */}
                        {(() => {
                            const dodge = pActive.dodge;
                            const cd = pActive.cooldowns['dodge'] || 0;
                            const isDisabled = cd > 0 || !canAfford(dodge.cost) || !isPlayerTurn || !!playerActionsUsed[playerActiveIndex];
                            return (
                                <ActionButton
                                    iconUrl={dodge.iconUrl}
                                    name={dodge.name}
                                    subLabel={cd > 0 ? `⏳ CD: ${cd}` : `🛡 ${Math.round(dodge.successRate * 100)}% dodge`}
                                    cost={dodge.cost}
                                    disabled={isDisabled}
                                    accentColor="rgba(168,85,247,0.6)"
                                    onClick={() => executePlayerAction('dodge', 'dodge')} // FIX #4
                                    tooltip={dodge.description}
                                />
                            );
                        })()}
                    </div>
                </div>
            </div>

            {/* ── Surrender Confirmation Modal ── */}
            {showSurrenderConfirm && (
                <div
                    style={{
                        position: 'fixed', inset: 0,
                        background: 'rgba(0,0,0,0.7)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 300,
                    }}
                    onClick={() => setShowSurrenderConfirm(false)}
                >
                    <div
                        style={{
                            background: 'linear-gradient(135deg, rgba(15,23,42,0.95), rgba(20,30,50,0.95))',
                            border: '2px solid rgba(239,68,68,0.5)',
                            borderRadius: '12px',
                            padding: '2rem',
                            maxWidth: '400px',
                            textAlign: 'center',
                            boxShadow: '0 8px 32px rgba(0,0,0,0.8), 0 0 20px rgba(239,68,68,0.2)',
                        }}
                        onClick={e => e.stopPropagation()}
                    >
                        <h3 style={{ color: 'var(--accent)', marginBottom: '1rem', fontSize: '1.2rem', fontWeight: 700 }}>
                            Surrender Battle?
                        </h3>
                        <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem', fontSize: '0.9rem', lineHeight: 1.5 }}>
                            Are you sure you want to give up? You will lose this battle.
                        </p>
                        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
                            <button
                                onClick={() => { surrender(); setShowSurrenderConfirm(false); }}
                                style={{
                                    padding: '0.75rem 1.5rem',
                                    background: 'rgba(239,68,68,0.2)',
                                    border: '1px solid rgba(239,68,68,0.5)',
                                    color: '#ef4444',
                                    borderRadius: '8px',
                                    cursor: 'pointer',
                                    fontWeight: 700,
                                    fontSize: '0.95rem',
                                }}
                            >
                                Yes, Surrender
                            </button>
                            <button
                                onClick={() => setShowSurrenderConfirm(false)}
                                style={{
                                    padding: '0.75rem 1.5rem',
                                    background: 'rgba(255,255,255,0.08)',
                                    border: '1px solid rgba(255,255,255,0.2)',
                                    color: '#fff',
                                    borderRadius: '8px',
                                    cursor: 'pointer',
                                    fontWeight: 700,
                                    fontSize: '0.95rem',
                                }}
                            >
                                Keep Fighting
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
