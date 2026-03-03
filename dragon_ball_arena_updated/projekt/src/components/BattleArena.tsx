import React, { useEffect, useRef, useState } from 'react';
import { useGameState } from '../stores/rootStore';
import type { BattleCharacter } from '../types';
import type { PlayerEnergy, ActionCost } from '../types';
import { getMatch, patchMatch, buildOnlineSnapshot } from '../services/matchService';

// ─── Energy Display ────────────────────────────────────────────────────────────
const ENERGY_TYPES = [
    { key: 'ki',        label: 'K', color: 'var(--ki-color)'       },
    { key: 'physical',  label: 'P', color: 'var(--physical-color)' },
    { key: 'special',   label: 'S', color: 'var(--special-color)'  },
    { key: 'universal', label: 'U', color: 'var(--neon-gold)'      },
] as const;

const EnergyDisplay: React.FC<{ energy: PlayerEnergy; label: string }> = ({ energy, label }) => (
    <div style={{
        background: 'rgba(0,0,0,0.35)',
        padding: '0.3rem 0.6rem',
        borderRadius: '10px',
        display: 'flex',
        alignItems: 'center',
        gap: '0.3rem',
        border: '1px solid rgba(255,255,255,0.08)',
    }}>
        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginRight: '0.1rem' }}>{label}:</span>
        {ENERGY_TYPES.map(({ key, label: l, color }) => {
            const val = energy[key] ?? 0;
            const active = val > 0;
            return (
                <div key={key} style={{
                    display: 'flex',
                    alignItems: 'center',
                    background: active ? `${color}22` : 'rgba(255,255,255,0.03)',
                    border: `1px solid ${active ? color + '66' : 'rgba(255,255,255,0.07)'}`,
                    borderRadius: '6px',
                    padding: '2px 7px',
                    minWidth: '38px',
                    justifyContent: 'center',
                    transition: 'all 0.2s ease',
                }}>
                    <span style={{ fontSize: '0.72rem', fontWeight: 800, color: active ? color : '#3a3a3a', lineHeight: 1 }}>{l}</span>
                    <span style={{ fontSize: '0.72rem', fontWeight: 700, color: active ? '#e2e8f0' : '#3a3a3a', lineHeight: 1 }}>:{val}</span>
                </div>
            );
        })}
    </div>
);

// ─── Cost Display ──────────────────────────────────────────────────────────────
const COST_TYPES = [
    { key: 'ki',       label: 'K', color: 'var(--ki-color)'       },
    { key: 'physical', label: 'P', color: 'var(--physical-color)' },
    { key: 'special',  label: 'S', color: 'var(--special-color)'  },
    { key: 'any',      label: 'Any', color: 'var(--neon-gold)'      },
] as const;

const CostDisplay: React.FC<{ cost: ActionCost }> = ({ cost }) => {
    const parts = COST_TYPES.filter(({ key }) => (cost[key] ?? 0) > 0);
    if (parts.length === 0) return <div style={{ height: '16px' }} />;
    return (
        <div style={{ display: 'flex', gap: '3px', justifyContent: 'center', marginTop: '4px', flexWrap: 'wrap' }}>
            {parts.map(({ key, label, color }) => (
                <span key={key} style={{
                    fontSize: '0.6rem',
                    fontWeight: 800,
                    color,
                    background: `${color}22`,
                    border: `1px solid ${color}55`,
                    borderRadius: '4px',
                    padding: '1px 5px',
                    lineHeight: 1.4,
                }}>
                    {label}:{cost[key]}
                </span>
            ))}
        </div>
    );
};

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
interface FloatEntry { id: number; value: number }

const CharacterPortrait: React.FC<{
    char: BattleCharacter;
    isSelected?: boolean;
    isActiveTurn?: boolean;
    isOpponent?: boolean;
    isExecuting?: boolean;
    hasActed?: boolean;
    onClick?: () => void;
    activeFloats?: FloatEntry[];
}> = ({ char, isSelected, isActiveTurn, isOpponent, isExecuting, hasActed, onClick, activeFloats }) => {
    const [passiveHovered, setPassiveHovered] = React.useState(false);
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
                opacity: isExecuting ? 0.55 : (isDead ? 0.25 : (hasActed ? 0.65 : 1)),
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
                overflow: 'visible',
            }}>
                {!char.portraitUrl && (
                    <span style={{ fontWeight: 'bold', fontSize: '10px', textAlign: 'center', padding: '4px' }}>
                        {char.name}
                    </span>
                )}
                {/* Floating damage/heal numbers */}
                {activeFloats?.map(f => (
                    <div key={f.id} style={{
                        position: 'absolute',
                        top: '-10px',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        color: f.value < 0 ? '#ef4444' : '#22c55e',
                        fontWeight: 900,
                        fontSize: '0.85rem',
                        pointerEvents: 'none',
                        animation: 'floatUp 1.2s ease-out forwards',
                        zIndex: 50,
                        textShadow: '0 1px 3px rgba(0,0,0,0.8)',
                        whiteSpace: 'nowrap',
                    }}>
                        {f.value > 0 ? `+${f.value}` : f.value}
                    </div>
                ))}
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
                {hasActed && !isDead && (
                    <div style={{
                        position: 'absolute',
                        bottom: -4, right: -4,
                        width: 18, height: 18,
                        background: '#22c55e',
                        borderRadius: '50%',
                        border: '2px solid #fff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '10px',
                        fontWeight: 900,
                        color: '#fff',
                        boxShadow: '0 0 6px #22c55e',
                    }}>✓</div>
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
            {char.passive && !isDead && (
                <div style={{ position: 'relative' }}>
                    <div
                        onMouseEnter={() => setPassiveHovered(true)}
                        onMouseLeave={() => setPassiveHovered(false)}
                        style={{
                            fontSize: '0.55rem',
                            color: '#fbbf24',
                            background: 'rgba(251,191,36,0.12)',
                            padding: '1px 4px',
                            borderRadius: '4px',
                            marginTop: '2px',
                            cursor: 'help',
                            border: '1px solid rgba(251,191,36,0.25)',
                            maxWidth: '88px',
                            textAlign: 'center',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                        }}
                    >
                        ✦ {char.passive.id.replace(/_/g, ' ')}
                        {char.passiveStacks ? ` (${char.passiveStacks})` : ''}
                    </div>
                    {passiveHovered && (
                        <div style={{
                            position: 'absolute',
                            bottom: '120%',
                            left: '50%',
                            transform: 'translateX(-50%)',
                            background: '#0f172a',
                            border: '1px solid rgba(251,191,36,0.4)',
                            borderRadius: '8px',
                            padding: '6px 9px',
                            zIndex: 300,
                            width: '170px',
                            pointerEvents: 'none',
                            boxShadow: '0 4px 14px rgba(0,0,0,0.8)',
                            textAlign: 'left',
                        }}>
                            <div style={{ fontSize: '0.65rem', color: '#fbbf24', fontWeight: 700, marginBottom: '3px' }}>
                                ✦ Pasywna zdolność
                            </div>
                            <div style={{ fontSize: '0.62rem', color: '#e2e8f0', lineHeight: 1.4 }}>
                                {char.passive.description}
                            </div>
                            {char.passiveStacks !== undefined && char.passiveStacks > 0 && (
                                <div style={{ fontSize: '0.6rem', color: '#fb923c', marginTop: '3px' }}>
                                    Stacki: {char.passiveStacks}/3
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

// ─── Effect descriptions for tooltips ──────────────────────────────────────────
const EFFECT_DESCRIPTIONS: Partial<Record<string, string>> = {
    pierce:  'Ignoruje obronę przeciwnika',
    stun:    'Blokuje działanie celu na N tur',
    weaken:  'Osłabia ATK celu',
    buff:    'Zwiększa twój ATK o 15%',
    poison:  'Zadaje 5% max HP/turę',
    bleed:   'Zadaje 7% max HP/turę',
    regen:   'Regeneruje 6% max HP/turę',
    aoe:     'Trafia wszystkich przeciwników',
    heal:    'Leczy 25% max HP',
    healAll: 'Leczy 20% max HP wszystkim sojusznikom',
    clear:   'Usuwa zatrucie, krwawienie, osłabienie, ogłuszenie',
    senzu:   'Następny atak zadaje +15% obrażeń',
    energy:  'Zyskujesz +2 energy universal',
    drain:   'Kradnie HP: leczysz się za 50% obrażeń',
    dodging: 'Zwiększa szansę uniku na tę turę',
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
    cooldown?: number;
    techniqueDescription?: string;
    onClick: () => void;
    tooltip?: string;
}> = ({ iconUrl, name, subLabel, cost, disabled, accentColor = 'var(--ki-color)', effect, cooldown, techniqueDescription, onClick }) => {
    const [isHovered, setIsHovered] = React.useState(false);
    const hasCooldown = (cooldown ?? 0) > 0;

    return (
        <button
            onClick={!disabled ? onClick : undefined}
            disabled={disabled}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            style={{
                position: 'relative',
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
            {/* Rich tooltip */}
            {isHovered && (
                <div style={{
                    position: 'absolute',
                    bottom: '110%',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    background: '#0f172a',
                    border: '1px solid #334155',
                    padding: '8px 10px',
                    borderRadius: '8px',
                    zIndex: 200,
                    width: '185px',
                    pointerEvents: 'none',
                    textAlign: 'left',
                    boxShadow: '0 4px 16px rgba(0,0,0,0.7)',
                }}>
                    <div style={{ fontWeight: 700, fontSize: '0.75rem', color: accentColor, marginBottom: '4px' }}>{name}</div>
                    {techniqueDescription && (
                        <div style={{ fontSize: '0.68rem', color: '#94a3b8', marginBottom: '3px', lineHeight: 1.3 }}>
                            {techniqueDescription}
                        </div>
                    )}
                    {effect && effect !== 'none' && EFFECT_DESCRIPTIONS[effect] && (
                        <div style={{ fontSize: '0.68rem', color: effectColors[effect] || '#888', fontWeight: 600 }}>
                            ⚡ {EFFECT_DESCRIPTIONS[effect]}
                        </div>
                    )}
                </div>
            )}

            {/* Icon + cooldown overlay */}
            {iconUrl && (
                <div style={{ position: 'relative', marginBottom: '3px' }}>
                    <img
                        src={iconUrl}
                        alt={name}
                        style={{
                            width: '36px',
                            height: '36px',
                            borderRadius: '8px',
                            objectFit: 'cover',
                            border: `1px solid ${accentColor}44`,
                            display: 'block',
                        }}
                    />
                    {hasCooldown && (
                        <div style={{
                            position: 'absolute',
                            inset: 0,
                            background: 'rgba(0,0,0,0.72)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '1.1rem',
                            fontWeight: 900,
                            color: '#fbbf24',
                            borderRadius: '8px',
                        }}>
                            {cooldown}
                        </div>
                    )}
                </div>
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
};

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
        // Online match
        isOnlineMatch, matchId, myRole, applyOnlineBattleSnapshot, phase,
        winByOpponentDisconnect,
    } = useGameState();

    const logsRef = useRef<HTMLDivElement>(null);
    const [flashAction, setFlashAction] = useState<{ iconUrl?: string; name: string } | null>(null);
    const [flashVisible, setFlashVisible] = useState(false);
    const [showSurrenderConfirm, setShowSurrenderConfirm] = useState(false);
    const [executingPlayerIndices, setExecutingPlayerIndices] = useState<number[]>([]);
    const [executingOpponentIndices, setExecutingOpponentIndices] = useState<number[]>([]);

    // Floating damage/heal numbers
    const [floats, setFloats] = useState<{ id: number; value: number; charIndex: number; isOpponent: boolean }[]>([]);
    const floatIdRef = useRef(0);
    const prevPlayerHp = useRef<number[]>([]);
    const prevOppHp = useRef<number[]>([]);

    useEffect(() => {
        const newFloats: typeof floats = [];
        playerRoster.forEach((c, i) => {
            const prev = prevPlayerHp.current[i];
            if (prev !== undefined && prev !== c.currentHp) {
                newFloats.push({ id: ++floatIdRef.current, value: c.currentHp - prev, charIndex: i, isOpponent: false });
            }
        });
        opponentRoster.forEach((c, i) => {
            const prev = prevOppHp.current[i];
            if (prev !== undefined && prev !== c.currentHp) {
                newFloats.push({ id: ++floatIdRef.current, value: c.currentHp - prev, charIndex: i, isOpponent: true });
            }
        });
        prevPlayerHp.current = playerRoster.map(c => c.currentHp);
        prevOppHp.current = opponentRoster.map(c => c.currentHp);
        if (newFloats.length > 0) {
            setFloats(prev => [...prev, ...newFloats]);
            setTimeout(() => {
                setFloats(prev => prev.filter(f => !newFloats.some(nf => nf.id === f.id)));
            }, 1200);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [playerRoster, opponentRoster]);

    // ── Turn timer (20 seconds per turn) ──────────────────────────────────────
    const TURN_TIME = 20;
    const [turnTimeLeft, setTurnTimeLeft] = useState(TURN_TIME);

    // Reset timer whenever it becomes the player's turn
    useEffect(() => {
        if (isPlayerTurn && !winner) {
            setTurnTimeLeft(TURN_TIME);
        }
    }, [isPlayerTurn, winner]);

    // Count down and auto-pass when time runs out
    useEffect(() => {
        if (!isPlayerTurn || winner) return;
        if (turnTimeLeft <= 0) {
            passTurn();
            return;
        }
        const t = setTimeout(() => setTurnTimeLeft(s => s - 1), 1000);
        return () => clearTimeout(t);
    }, [isPlayerTurn, turnTimeLeft, winner, passTurn]);

    // ── Online battle sync ─────────────────────────────────────────────────────
    const onlineBattleVersionRef = useRef(0);
    const prevIsPlayerTurnRef = useRef<boolean | null>(null);

    // ── Disconnect detection ───────────────────────────────────────────────────
    const HEARTBEAT_INTERVAL_MS  = 5_000;
    const DISCONNECT_THRESHOLD_MS = 12_000; // stale heartbeat → opponent gone
    const DISCONNECT_COUNTDOWN_S  = 30;

    const [disconnectCountdown, setDisconnectCountdown] = useState<number | null>(null);
    const disconnectActiveRef = useRef(false); // true while countdown is running

    // Post snapshot to server whenever I finish my turn (isPlayerTurn flips true→false)
    useEffect(() => {
        if (!isOnlineMatch || !matchId || !myRole || phase !== 'battle') return;
        if (prevIsPlayerTurnRef.current === null) {
            prevIsPlayerTurnRef.current = isPlayerTurn;
            return;
        }
        const justFinished = prevIsPlayerTurnRef.current === true && isPlayerTurn === false;
        prevIsPlayerTurnRef.current = isPlayerTurn;
        if (!justFinished) return;

        const nextActor = myRole === 'player1' ? 'player2' : 'player1';
        const snap = buildOnlineSnapshot(
            playerRoster, opponentRoster,
            playerActiveIndex, opponentActiveIndex,
            playerEnergy, opponentEnergy,
            turnNumber, winner, myRole, nextActor,
            ++onlineBattleVersionRef.current,
        );
        patchMatch(matchId, { battle: snap });
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isPlayerTurn]);

    // Post final snapshot when BattleArena unmounts (win OR surrender).
    // Using useEffect([winner]) doesn't work because winner and phase:'gameOver' are set
    // simultaneously — React unmounts the component before the effect can fire.
    // The unmount cleanup always runs and reads the latest store state directly.
    // Handles both winner==='player' (normal win) and winner==='opponent' (surrender),
    // so the other client can detect the result when they next poll.
    useEffect(() => {
        return () => {
            const s = useGameState.getState();
            if (!s.isOnlineMatch || !s.matchId || !s.myRole || !s.winner) return;
            const snap = buildOnlineSnapshot(
                s.playerRoster, s.opponentRoster,
                s.playerActiveIndex, s.opponentActiveIndex,
                s.playerEnergy, s.opponentEnergy,
                s.turnNumber, s.winner, s.myRole, s.myRole,
                ++onlineBattleVersionRef.current,
            );
            patchMatch(s.matchId, { battle: snap });
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Poll for opponent's action while waiting for their turn.
    // Also checks the opponent's heartbeat to detect disconnection.
    useEffect(() => {
        if (!isOnlineMatch || isPlayerTurn || !matchId || !myRole || phase !== 'battle' || winner) return;

        const opHeartbeatKey = myRole === 'player1' ? 'p2Heartbeat' : 'p1Heartbeat';

        const poll = setInterval(async () => {
            const match = await getMatch(matchId);
            if (!match?.battle) return;

            // ── Snapshot received ──────────────────────────────────────────
            if (match.battle.version > onlineBattleVersionRef.current) {
                onlineBattleVersionRef.current = match.battle.version;
                // Opponent is alive — cancel any disconnect countdown
                if (disconnectActiveRef.current) {
                    disconnectActiveRef.current = false;
                    setDisconnectCountdown(null);
                }
                applyOnlineBattleSnapshot(match.battle, myRole);
                return;
            }

            // ── Heartbeat check ────────────────────────────────────────────
            const opHeartbeat = (match as Record<string, unknown>)[opHeartbeatKey] as number | undefined;
            if (opHeartbeat === undefined) return; // grace period: no heartbeat sent yet

            const heartbeatAge = Date.now() - opHeartbeat;
            if (heartbeatAge < DISCONNECT_THRESHOLD_MS) {
                // Opponent alive — reset if we were counting down
                if (disconnectActiveRef.current) {
                    disconnectActiveRef.current = false;
                    setDisconnectCountdown(null);
                }
            } else if (!disconnectActiveRef.current) {
                // Heartbeat stale — start countdown
                disconnectActiveRef.current = true;
                setDisconnectCountdown(DISCONNECT_COUNTDOWN_S);
            }
        }, 2000);

        return () => {
            clearInterval(poll);
            // Reset countdown if we stop waiting (turn switched back)
            if (disconnectActiveRef.current) {
                disconnectActiveRef.current = false;
                setDisconnectCountdown(null);
            }
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOnlineMatch, isPlayerTurn, phase, winner, matchId, myRole]);

    // ── Heartbeat sender — tells opponent we're still here ────────────────────
    useEffect(() => {
        if (!isOnlineMatch || !matchId || !myRole || phase !== 'battle' || winner) return;
        const field = myRole === 'player1' ? 'p1Heartbeat' : 'p2Heartbeat';
        patchMatch(matchId, { [field]: Date.now() });
        const interval = setInterval(() => patchMatch(matchId, { [field]: Date.now() }), HEARTBEAT_INTERVAL_MS);
        return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOnlineMatch, matchId, myRole, phase, winner]);

    // ── Countdown ticker ──────────────────────────────────────────────────────
    useEffect(() => {
        if (disconnectCountdown === null || disconnectCountdown <= 0) return;
        const t = setTimeout(() => setDisconnectCountdown(c => (c ?? 1) - 1), 1000);
        return () => clearTimeout(t);
    }, [disconnectCountdown]);

    // ── Auto-win when countdown expires ──────────────────────────────────────
    useEffect(() => {
        if (disconnectCountdown === 0) winByOpponentDisconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [disconnectCountdown]);

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

        // Fulfill specific costs, using universal as fallback
        if (availKi < needKi) { const s = needKi - availKi; if (availUniversal < s) return false; availUniversal -= s; availKi = 0; } else { availKi -= needKi; }
        if (availPh < needPh) { const s = needPh - availPh; if (availUniversal < s) return false; availUniversal -= s; availPh = 0; } else { availPh -= needPh; }
        if (availSp < needSp) { const s = needSp - availSp; if (availUniversal < s) return false; availUniversal -= s; availSp = 0; } else { availSp -= needSp; }
        // `any` can be paid by any remaining energy type
        if (needAny > availKi + availPh + availSp + availUniversal) return false;
        return true;
    };

    if (!pActive) return null;

    const isActiveStunned = pActive.statusEffects.some(e => e.effect === 'stun');

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
            {/* floatUp animation keyframes */}
            <style>{`
                @keyframes floatUp {
                    0%   { opacity: 1; transform: translateX(-50%) translateY(0); }
                    80%  { opacity: 0.8; }
                    100% { opacity: 0; transform: translateX(-50%) translateY(-38px); }
                }
            `}</style>
            {flashAction && (
                <FlashOverlay iconUrl={flashAction.iconUrl} name={flashAction.name} visible={flashVisible} />
            )}

            {/* ── Disconnect countdown overlay ── */}
            {disconnectCountdown !== null && (
                <div style={{
                    position: 'fixed', inset: 0, zIndex: 500,
                    background: 'rgba(0,0,0,0.78)',
                    display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center', gap: '1.25rem',
                }}>
                    <div style={{ fontSize: '2.5rem', lineHeight: 1 }}>⚠️</div>
                    <h2 style={{
                        fontFamily: "'Orbitron', sans-serif",
                        fontSize: '1.3rem', fontWeight: 900,
                        color: '#f97316', letterSpacing: '3px',
                        textTransform: 'uppercase', margin: 0,
                        textShadow: '0 0 20px rgba(249,115,22,0.6)',
                    }}>
                        Opponent Disconnected
                    </h2>
                    <div style={{
                        width: 96, height: 96, borderRadius: '50%',
                        border: '4px solid rgba(239,68,68,0.25)',
                        borderTopColor: 'var(--physical-color)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        boxShadow: '0 0 30px rgba(239,68,68,0.3)',
                    }}>
                        <span style={{
                            fontSize: '2.2rem', fontWeight: 900,
                            color: 'var(--physical-color)',
                            fontFamily: "'Orbitron', sans-serif",
                        }}>
                            {disconnectCountdown}
                        </span>
                    </div>
                    <p style={{
                        color: 'var(--text-muted)', fontSize: '0.82rem',
                        textAlign: 'center', maxWidth: 260, margin: 0,
                        letterSpacing: '1px',
                    }}>
                        Waiting for opponent to reconnect...
                    </p>
                </div>
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
                        <span style={{ fontWeight: 700, color: 'var(--physical-color)', fontSize: '0.9rem' }}>
                            {isOnlineMatch ? (useGameState.getState().matchFoundOpponent ?? 'Opponent') : 'Bot Opponent'}
                        </span>
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
                            activeFloats={floats.filter(f => f.isOpponent && f.charIndex === i)}
                        />
                    ))}
                </div>
            </div>

            {/* ── MIDDLE: Turn info + Timer bar + Combat log ── */}
            <div className="glass-panel" style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '0',
                padding: '0.75rem 1rem',
            }}>
                {/* Top row: turn badge + round + surrender */}
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
                            {isPlayerTurn
                                ? `${playerName || 'Your'} Turn`
                                : isOnlineMatch
                                    ? 'Waiting for opponent...'
                                    : 'Opponent Turn'
                            }
                        </span>
                    </div>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Round {turnNumber}</span>

                    <button
                        onClick={() => setShowSurrenderConfirm(true)}
                        disabled={!!winner || !isPlayerTurn}
                        style={{
                            marginLeft: 'auto',
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
                        Poddaj się
                    </button>
                </div>

                {/* Timer bar */}
                {(() => {
                    const pct = (turnTimeLeft / TURN_TIME) * 100;
                    const isUrgent = turnTimeLeft <= 5;
                    const isMid    = turnTimeLeft <= 10;
                    const barColor = isUrgent
                        ? 'var(--physical-color)'
                        : isMid
                            ? 'var(--accent)'
                            : 'var(--ki-color)';
                    return (
                        <div style={{ marginTop: '0.55rem', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                            {/* Countdown number */}
                            <span style={{
                                fontFamily: "'Orbitron', sans-serif",
                                fontSize: '0.72rem',
                                fontWeight: 800,
                                color: isPlayerTurn ? barColor : 'var(--text-muted)',
                                minWidth: '22px',
                                textAlign: 'right',
                                transition: 'color 0.3s',
                            }}>
                                {isPlayerTurn ? turnTimeLeft : '—'}
                            </span>

                            {/* Bar track */}
                            <div style={{
                                flex: 1,
                                height: '5px',
                                background: 'rgba(255,255,255,0.06)',
                                borderRadius: '3px',
                                overflow: 'hidden',
                            }}>
                                <div style={{
                                    height: '100%',
                                    width: isPlayerTurn ? `${pct}%` : '0%',
                                    background: barColor,
                                    borderRadius: '3px',
                                    boxShadow: isPlayerTurn ? `0 0 8px ${barColor}` : 'none',
                                    transition: 'width 1s linear, background 0.4s, box-shadow 0.4s',
                                    animation: isUrgent && isPlayerTurn ? 'pulse 0.6s ease-in-out infinite' : 'none',
                                }} />
                            </div>

                            {/* s label */}
                            <span style={{
                                fontSize: '0.62rem',
                                color: 'var(--text-muted)',
                                minWidth: '14px',
                            }}>
                                {isPlayerTurn ? 's' : ''}
                            </span>
                        </div>
                    );
                })()}
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
                                hasActed={!!playerActionsUsed[i]}
                                onClick={() => isPlayerTurn && setPlayerActiveIndex(i)}
                                activeFloats={floats.filter(f => !f.isOpponent && f.charIndex === i)}
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

                    {/* BUG 10 FIX: stun disables all actions */}
                    {isActiveStunned && (
                        <div style={{
                            color: '#a855f7',
                            textAlign: 'center',
                            fontWeight: 700,
                            fontSize: '0.8rem',
                            padding: '0.25rem 0',
                            marginBottom: '0.25rem',
                        }}>
                            ⚡ {pActive.name} jest ogłuszony — nie może działać!
                        </div>
                    )}

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
                            const isDisabled = cd > 0 || !canAfford(tech.cost) || !isPlayerTurn || !!playerActionsUsed[playerActiveIndex] || isActiveStunned;
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
                                    subLabel={tech.damage > 0 ? `💥 ${tech.damage}` : effectLabel[tech.effect] || '✦ Utility'}
                                    cost={tech.cost}
                                    disabled={isDisabled}
                                    effect={tech.effect}
                                    cooldown={cd}
                                    techniqueDescription={tech.description}
                                    accentColor={accentMap[tech.effect] || 'var(--ki-color)'}
                                    onClick={() => executePlayerAction('technique', tech.id)}
                                />
                            );
                        })}

                        {/* FIX #4: wywołanie dodge przez stały klucz 'dodge' zamiast dodge.name */}
                        {(() => {
                            const dodge = pActive.dodge;
                            const cd = pActive.cooldowns['dodge'] || 0;
                            const isDisabled = cd > 0 || !canAfford(dodge.cost) || !isPlayerTurn || !!playerActionsUsed[playerActiveIndex] || isActiveStunned;
                            return (
                                <ActionButton
                                    iconUrl={dodge.iconUrl}
                                    name={dodge.name}
                                    subLabel={`🛡 ${Math.round(dodge.successRate * 100)}% dodge`}
                                    cost={dodge.cost}
                                    disabled={isDisabled}
                                    cooldown={cd}
                                    techniqueDescription={dodge.description}
                                    accentColor="rgba(168,85,247,0.6)"
                                    onClick={() => executePlayerAction('dodge', 'dodge')} // FIX #4
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
