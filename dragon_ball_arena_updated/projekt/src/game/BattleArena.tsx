import React, { useEffect, useRef, useState } from 'react';
import { useGameState } from "../core/stores/rootStore";
import type { BattleCharacter, PlayerEnergy, ActionCost, Technique, DodgeAction } from "../core/types";
import { ScreenShake } from '../animations/ScreenShake';
import { CharacterAnimation } from '../animations/CharacterAnimation';
import { FloatingDamageContainer } from '../animations/FloatingDamage';
import { useAudio } from '../audio/AudioContext';
import type { OnlineBattleSnapshot } from '../multiplayer/matchService';

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
    { key: 'any',      label: '?', color: 'var(--neon-gold)'      },
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
                    color: color,
                    background: 'rgba(0,0,0,0.4)',
                    padding: '1px 4px',
                    borderRadius: '3px',
                    border: `1px solid ${color}44`,
                }}>
                    {label}:{cost[key]}
                </span>
            ))}
        </div>
    );
};

// ─── Constants ───────────────────────────────────────────────────────────────
const effectColors: Record<string, string> = {
    poison: '#84cc16', bleed:  '#ef4444', stun:   '#f59e0b',
    weaken: '#a855f7', buff:   '#22c55e', regen:  '#06b6d4',
    senzu:  '#fcd34d', energy: '#38bdf8', aoe:    '#fb923c',
};

const effectLabel: Record<string, string> = {
    poison:  'POISON',
    bleed:   'BLEED',
    stun:    'STUN',
    weaken:  'WEAKEN',
    buff:    'BUFF',
    regen:   'REGEN',
    senzu:   'SENZU',
    energy:  'ENERGY',
    aoe:     'AOE',
    pierce:  'PIERCE',
    heal:    'HEAL',
    healAll: 'HEAL ALL',
    clear:   'CLEAR',
    drain:   'DRAIN',
    dodging: 'DODGE',
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
    isHit?: boolean;
}> = ({ char, isSelected, isActiveTurn, isOpponent, isExecuting, hasActed, onClick, activeFloats, isHit }) => {
    const hpPercent = Math.max(0, (char.currentHp / char.maxHp) * 100);
    const hpColor = hpPercent > 50 ? '#22c55e' : hpPercent > 20 ? '#eab308' : '#ef4444';
    const isDead = char.currentHp <= 0;
    const borderColor = isOpponent ? 'var(--physical-color)' : 'var(--ki-color)';

    const formattedFloats = (activeFloats || []).map(f => ({
        id: f.id,
        value: Math.abs(f.value),
        type: f.value < 0 ? 'damage' : 'heal'
    } as const));

    const isHitProp = isHit || formattedFloats.some(f => f.type === 'damage');

    return (
        <div style={{ width: '90px', display: 'flex', justifyContent: 'center' }}>
            <CharacterAnimation 
                isAttacking={isExecuting} 
                isDead={isDead} 
                isHit={isHitProp} 
                isPlayer={!isOpponent} 
                isActive={isActiveTurn}
            >
                <div
                    onClick={!isDead && onClick ? onClick : undefined}
                    style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        opacity: isExecuting ? 1 : (isDead ? 0.25 : (hasActed ? 0.65 : 1)),
                        transform: isSelected ? 'scale(1.12) translateY(-6px)' : 'scale(1)',
                        transition: 'all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
                        cursor: !isDead && onClick ? 'pointer' : 'default',
                        width: '72px',
                    }}
                >
                    <div style={{
                        position: 'relative',
                        width: '72px',
                        height: '72px',
                        borderRadius: '50%',
                        border: isSelected ? `3px solid ${borderColor}` : `2px solid rgba(255,255,255,0.12)`,
                        boxShadow: isSelected
                            ? `0 0 18px ${borderColor}, 0 0 40px ${borderColor}44`
                            : '0 4px 12px rgba(0,0,0,0.5)',
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
                        
                        <FloatingDamageContainer floats={formattedFloats} />

                        {isActiveTurn && (
                            <div style={{
                                position: 'absolute',
                                top: -2, right: -2,
                                width: 18, height: 18,
                                background: 'var(--accent)',
                                borderRadius: '50%',
                                border: '2px solid #fff',
                                boxShadow: '0 0 10px var(--accent)',
                                zIndex: 20,
                                animation: 'pulse 1.5s infinite',
                            }} />
                        )}
                    </div>

                    {/* HP Bar */}
                    <div style={{
                        width: '100%',
                        height: '5px',
                        background: 'rgba(255,255,255,0.1)',
                        borderRadius: '3px',
                        marginTop: '0.4rem',
                        overflow: 'hidden',
                        border: '1px solid rgba(255,255,255,0.05)',
                    }}>
                        <div style={{
                            width: `${hpPercent}%`,
                            height: '100%',
                            background: hpColor,
                            transition: 'width 0.4s ease',
                            boxShadow: `0 0 6px ${hpColor}88`,
                        }} />
                    </div>
                    <span style={{ fontSize: '0.62rem', marginTop: '0.15rem', color: '#eee', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                        {Math.floor(char.currentHp)}
                    </span>

                    <div style={{ display: 'flex', gap: '2px', flexWrap: 'wrap', justifyContent: 'center', minHeight: '16px', marginTop: '4px', maxWidth: '85px' }}>
                        {char.statusEffects.map((e, i) => (
                            <span key={i} style={{
                                fontSize: '0.5rem',
                                color: effectColors[e.effect] || '#fff',
                                background: 'rgba(0,0,0,0.85)',
                                padding: '1px 4px',
                                borderRadius: '3px',
                                fontWeight: 900,
                                border: `1px solid ${effectColors[e.effect] || '#555'}55`,
                                textTransform: 'uppercase',
                                letterSpacing: '0.2px'
                            }}>
                                {effectLabel[e.effect]}
                            </span>
                        ))}
                    </div>
                </div>
            </CharacterAnimation>
        </div>
    );
};

// ─── Effect descriptions for tooltips ──────────────────────────────────────────
const EFFECT_DESCRIPTIONS: Partial<Record<string, string>> = {
    pierce:  'Ignoruje obronę przeciwnika (True DMG)',
    stun:    'Blokuje działanie celu na 1 turę',
    weaken:  'Osłabia statystyki ATK celu',
    buff:    'Wzmacnia Twój Power Level o 15%',
    poison:  'Toksyna: -5% max HP co każdą turę',
    bleed:   'Krwawienie: -7% max HP co każdą turę',
    regen:   'Nano-boty: Regeneracja 6% HP co turę',
    aoe:     'Fala uderzeniowa: Trafia całą drużynę wroga',
    heal:    'Leczenie medyczne: +25% max HP',
    healAll: 'Wsparcie drużyny: +20% HP dla wszystkich',
    clear:   'Oczyszczenie: Usuwa debuffy i statusy',
    senzu:   'Magiczna fasolka: +15% DMG do nast. ataku',
    energy:  'Koncentracja: Dodaje +2 Universal Energy',
    drain:   'Wampiryzm: Leczy za 50% zadanych DMG',
    dodging: 'Refleks: Zwiększa szansę na unik o 50%',
};

// ─── Action Button ─────────────────────────────────────────────────────────────
const ActionButton: React.FC<{
    iconUrl?: string;
    name: string;
    subLabel: string;
    cost: ActionCost;
    disabled?: boolean;
    accentColor?: string;
    effect?: string;
    cooldown?: number;
    technique?: Technique | (DodgeAction & { damage: number });
    onClick: () => void;
}> = ({ iconUrl, name, subLabel, cost, disabled, accentColor = 'var(--ki-color)', effect, cooldown, technique, onClick }) => {
    const [isHovered, setIsHovered] = React.useState(false);
    const hasCooldown = (cooldown ?? 0) > 0;

    return (
        <button
            onClick={!disabled ? onClick : undefined}
            disabled={disabled}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            className={`action-btn ${disabled ? 'disabled' : ''} ${hasCooldown ? 'on-cooldown' : ''}`}
            style={{
                background: isHovered ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.5)',
                border: `2px solid ${isHovered ? accentColor : 'rgba(255,255,255,0.15)'}`,
                padding: '1rem 0.75rem',
                borderRadius: '16px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '0.4rem',
                cursor: disabled ? 'not-allowed' : 'pointer',
                opacity: disabled ? 0.4 : 1,
                position: 'relative',
                transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                minWidth: '135px',
                boxShadow: isHovered ? `0 0 30px ${accentColor}55` : 'none',
            }}
        >
            <div style={{ position: 'relative', width: '56px', height: '56px' }}>
                <div style={{
                    width: '100%', height: '100%', borderRadius: '12px',
                    background: accentColor + '33',
                    border: `1px solid ${accentColor}77`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    overflow: 'hidden',
                }}>
                    {iconUrl ? <img src={iconUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : '✨'}
                </div>
                {hasCooldown && (
                    <div style={{
                        position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.8)',
                        borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: '#fff', fontSize: '1.4rem', fontWeight: 900,
                    }}>
                        {cooldown}
                    </div>
                )}
            </div>

            <span style={{ fontSize: '0.85rem', fontWeight: 900, color: '#fff', textAlign: 'center', width: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', letterSpacing: '0.5px' }}>
                {name}
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                {effect && (
                    <span style={{ 
                        fontSize: '0.6rem', 
                        fontWeight: 900, 
                        color: accentColor, 
                        background: `${accentColor}15`, 
                        padding: '1px 5px', 
                        borderRadius: '4px',
                        border: `1px solid ${accentColor}33`,
                        letterSpacing: '0.5px'
                    }}>
                        {effectLabel[effect]}
                    </span>
                )}
                <span style={{ fontSize: '0.7rem', color: accentColor, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{subLabel}</span>
            </div>

            <CostDisplay cost={cost} />

            {/* Enhanced Tooltip */}
            {isHovered && !disabled && technique && (
                <div style={{
                    position: 'absolute', bottom: '115%', left: '50%', transform: 'translateX(-50%)',
                    background: 'rgba(15, 23, 42, 0.98)', border: `2px solid ${accentColor}`, borderRadius: '12px',
                    padding: '12px 16px', width: '260px', zIndex: 500, pointerEvents: 'none',
                    boxShadow: '0 15px 45px rgba(0,0,0,0.95)', textAlign: 'left',
                    backdropFilter: 'blur(10px)'
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <div style={{ color: accentColor, fontWeight: 900, fontSize: '0.95rem', textTransform: 'uppercase', letterSpacing: '1px' }}>{name}</div>
                        {technique.cooldown > 0 && <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>CD: {technique.cooldown}t</div>}
                    </div>
                    
                    <div style={{ color: '#f8fafc', fontSize: '0.78rem', lineHeight: 1.5, marginBottom: '10px', fontStyle: 'italic' }}>
                        "{technique.description}"
                    </div>

                    <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: '8px', padding: '8px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        {technique.damage > 0 && (
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem' }}>
                                <span style={{ color: '#94a3b8' }}>Obrażenia Bazowe:</span>
                                <span style={{ color: 'var(--physical-color)', fontWeight: 800 }}>{technique.damage} HP</span>
                            </div>
                        )}
                        {effect && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '4px' }}>
                                <span style={{ color: '#94a3b8', fontSize: '0.65rem', textTransform: 'uppercase' }}>Efekt Specjalny:</span>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <span style={{ color: '#fff', fontSize: '0.72rem', fontWeight: 600 }}>{EFFECT_DESCRIPTIONS[effect]}</span>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </button>
    );
};

// ─── Main BattleArena ──────────────────────────────────────────────────────────
export const BattleArena: React.FC = () => {
    const {
        playerRoster, opponentRoster,
        playerActiveIndex, opponentActiveIndex,
        playerEnergy, opponentEnergy,
        turnNumber, isPlayerTurn,
        combatLogs, executePlayerAction, passTurn, setPlayerActiveIndex,
        surrender, winner, setOpponentActiveIndex, playerActionsUsed,
        playerName,
        isOnlineMatch, matchId, myRole, applyOnlineBattleSnapshot, phase,
        winByOpponentDisconnect, setPhase
    } = useGameState();

    const { playSound } = useAudio();

    const logsRef = useRef<HTMLDivElement>(null);
    const [flashAction, setFlashAction] = useState<{ iconUrl?: string; name: string } | null>(null);
    const [flashVisible, setFlashVisible] = useState(false);
    const [showSurrenderConfirm, setShowSurrenderConfirm] = useState(false);
    const [executingPlayerIndices, setExecutingPlayerIndices] = useState<number[]>([]);
    const [executingOpponentIndices, setExecutingOpponentIndices] = useState<number[]>([]);
    const [shakeTrigger, setShakeTrigger] = useState(0);

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
            if (newFloats.some(f => f.value < 0)) {
                setShakeTrigger(prev => prev + 1);
                playSound('hit');
            }
            setTimeout(() => {
                setFloats(prev => prev.filter(f => !newFloats.some(nf => nf.id === f.id)));
            }, 1200);
        }
    }, [playerRoster, opponentRoster, playSound]);

    // ── Turn timer (20 seconds per turn) ──────────────────────────────────────
    const TURN_TIME = 20;
    const [turnTimeLeft, setTurnTimeLeft] = useState(TURN_TIME);

    // Reset timer whenever it becomes the player's turn
    useEffect(() => {
        if (isPlayerTurn && !winner) {
            setTurnTimeLeft(TURN_TIME);
        }
    }, [isPlayerTurn, winner]);

    useEffect(() => {
        if (!isPlayerTurn || winner || phase !== 'battle') return;
        if (turnTimeLeft <= 0) {
            passTurn();
            return;
        }
        const t = setTimeout(() => setTurnTimeLeft(s => s - 1), 1000);
        return () => clearTimeout(t);
    }, [isPlayerTurn, turnTimeLeft, winner, passTurn, phase]);

    // ── Online battle sync ─────────────────────────────────────────────────────
    useEffect(() => {
        if (!isOnlineMatch || !matchId || !myRole) return;

        import('../multiplayer/matchService').then(m => {
            const s = m.getSocket();
            
            const onBattleUpdate = (snap: OnlineBattleSnapshot) => {
                applyOnlineBattleSnapshot(snap, myRole);
                setDisconnectCountdown(null);
            };

            const onGameOver = (data: { winner: string, reason: string }) => {
                const iWon = data.winner === myRole;
                useGameState.setState({ winner: iWon ? 'player' : 'opponent' });
                setPhase('gameOver');
            };

            s.on('battleUpdate', onBattleUpdate);
            s.on('gameOver', onGameOver);

            return () => {
                s.off('battleUpdate', onBattleUpdate);
                s.off('gameOver', onGameOver);
            };
        });

    }, [isOnlineMatch, matchId, myRole, applyOnlineBattleSnapshot, setPhase]);

    // ── Disconnect detection ───────────────────────────────────────────────────
    const [disconnectCountdown, setDisconnectCountdown] = useState<number | null>(null);

    // ── Countdown ticker ──────────────────────────────────────────────────────
    useEffect(() => {
        if (disconnectCountdown === null || disconnectCountdown <= 0) return;
        const t = setTimeout(() => setDisconnectCountdown(c => (c ?? 1) - 1), 1000);
        return () => clearTimeout(t);
    }, [disconnectCountdown]);

    // ── Auto-win when countdown expires ──────────────────────────────────────
    useEffect(() => {
        if (disconnectCountdown === 0) winByOpponentDisconnect();
    }, [disconnectCountdown, winByOpponentDisconnect]);

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
            playSound('attack');
            const timer = setTimeout(() => setFlashVisible(false), 900);
            return () => clearTimeout(timer);
        }
    }, [combatLogs, opponentRoster, playerRoster, playSound]);

    // Track deaths to play sound
    useEffect(() => {
        const anyPlayerDead = playerRoster.some((c, i) => c.currentHp <= 0 && (prevPlayerHp.current[i] ?? 1) > 0);
        const anyOppDead = opponentRoster.some((c, i) => c.currentHp <= 0 && (prevOppHp.current[i] ?? 1) > 0);
        if (anyPlayerDead || anyOppDead) {
            playSound('death');
        }
    }, [playerRoster, opponentRoster, playSound]);

    useEffect(() => {
        setExecutingPlayerIndices([]);
        setExecutingOpponentIndices([]);
    }, [turnNumber]);

    const pActive = playerRoster[playerActiveIndex];

    const canAfford = (cost: ActionCost) => {
        let u = playerEnergy.universal || 0;
        let ki = playerEnergy.ki;
        let ph = playerEnergy.physical;
        let sp = playerEnergy.special;

        const pay = (needed: number, available: number) => {
            const fromU = Math.min(u, needed);
            u -= fromU;
            needed -= fromU;
            const fromSpecific = Math.min(available, needed);
            needed -= fromSpecific;
            return { needed, remaining: available - fromSpecific };
        };

        const resKi = pay(cost.ki || 0, ki);
        if (resKi.needed > 0) return false;

        const resPh = pay(cost.physical || 0, ph);
        if (resPh.needed > 0) return false;

        const resSp = pay(cost.special || 0, sp);
        if (resSp.needed > 0) return false;

        const totalAnyAvailable = u + resKi.remaining + resPh.remaining + resSp.remaining;
        return totalAnyAvailable >= (cost.any || 0);
    };

    if (!pActive) return null;

    const isActiveStunned = pActive.statusEffects.some(e => e.effect === 'stun');

    return (
        <ScreenShake trigger={shakeTrigger}>
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            height: '100vh',
            maxHeight: '100vh',
            background: 'radial-gradient(circle at center, #0a1628 0%, #020817 100%)',
            color: 'var(--text-main)',
            position: 'relative',
            overflow: 'hidden',
            padding: '0.75rem',
            gap: '0.75rem',
        }}>
            {/* floatUp animation keyframes */}
            <style>{`
                @keyframes floatUp {
                    0% { opacity: 0; transform: translate(-50%, 0); }
                    20% { opacity: 1; transform: translate(-50%, -20px); }
                    80% { opacity: 1; transform: translate(-50%, -40px); }
                    100% { opacity: 0; transform: translate(-50%, -50px); }
                }
                @keyframes rotateSlow {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
                @keyframes pulse {
                    0% { transform: scale(1); opacity: 0.8; }
                    50% { transform: scale(1.2); opacity: 1; }
                    100% { transform: scale(1); opacity: 0.8; }
                }
                @keyframes flashIn {
                    0% { opacity: 0; transform: translate(-50%, -50%) scale(0.5) rotate(-10deg); }
                    100% { opacity: 1; transform: translate(-50%, -50%) scale(1) rotate(0); }
                }
            `}</style>

            {/* Header: Turn Info & Timer */}
            <div className="glass-panel" style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '0.75rem 1.5rem', flexShrink: 0,
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{
                        width: '44px', height: '44px', borderRadius: '50%',
                        background: 'rgba(56,189,248,0.1)', border: '2px solid var(--accent)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontFamily: "'Orbitron', sans-serif", fontWeight: 900, color: 'var(--accent)',
                        fontSize: '1.1rem'
                    }}>
                        {turnNumber}
                    </div>
                    <div>
                        <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '2px' }}>Runda</div>
                        <div style={{
                            fontSize: '1.1rem', fontWeight: 900,
                            color: isPlayerTurn ? 'var(--ki-color)' : 'var(--physical-color)',
                            textShadow: `0 0 15px ${isPlayerTurn ? 'var(--ki-color)44' : 'var(--physical-color)44'}`,
                            letterSpacing: '1px'
                        }}>
                            {isPlayerTurn ? 'TWOJA TURA' : 'TURA PRZECIWNIKA'}
                        </div>
                    </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
                    {isPlayerTurn && !winner && (
                        <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '2px' }}>Czas</div>
                            <div style={{
                                fontSize: '1.4rem', fontWeight: 900,
                                fontFamily: "'Orbitron', sans-serif",
                                color: turnTimeLeft <= 5 ? '#ef4444' : '#fff',
                                animation: turnTimeLeft <= 5 ? 'pulse 0.5s infinite' : 'none',
                                lineHeight: 1
                            }}>
                                {turnTimeLeft}s
                            </div>
                        </div>
                    )}
                    <button
                        className="btn"
                        onClick={() => setShowSurrenderConfirm(true)}
                        style={{
                            padding: '0.5rem 1rem', fontSize: '0.75rem',
                            background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)',
                            color: '#ef4444', textTransform: 'uppercase', letterSpacing: '1px',
                            boxShadow: 'none'
                        }}
                    >
                        Poddaj się
                    </button>
                </div>
            </div>

            {/* Battle Field */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.75rem', position: 'relative' }}>

                {/* Opponent Side */}
                <div className="glass-panel" style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '0.75rem', position: 'relative' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                        <span style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--physical-color)', letterSpacing: '1px', textTransform: 'uppercase' }}>
                            PRZECIWNIK: {isOnlineMatch ? 'Gracz' : 'AI'}
                        </span>
                        <EnergyDisplay energy={opponentEnergy} label="E" />
                    </div>

                    <div style={{ display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'center', gap: '2.5rem' }}>
                        {opponentRoster.map((char, i) => (
                            <CharacterPortrait
                                key={char.id + '-' + i}
                                char={char}
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

                {/* Action Flash (Center Overlay) */}
                <div style={{
                    position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
                    zIndex: 100, pointerEvents: 'none',
                }}>
                    {flashVisible && flashAction && (
                        <div style={{
                            display: 'flex', flexDirection: 'column', alignItems: 'center',
                            animation: 'flashIn 0.4s ease-out forwards',
                        }}>
                            <div style={{
                                width: '110px', height: '110px', borderRadius: '24px',
                                background: 'rgba(0,0,0,0.85)', border: '4px solid var(--accent)',
                                boxShadow: '0 0 50px var(--accent)66', display: 'flex',
                                alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
                            }}>
                                <img src={flashAction.iconUrl} alt="" style={{ width: '80%', height: '80%', objectFit: 'contain' }} />
                            </div>
                            <div style={{
                                marginTop: '1.25rem', padding: '0.6rem 2.5rem', background: 'rgba(0,0,0,0.9)',
                                border: '2px solid var(--accent)', borderRadius: '12px',
                                fontFamily: "'Orbitron', sans-serif", fontSize: '1.3rem',
                                fontWeight: 900, color: '#fff', textTransform: 'uppercase',
                                letterSpacing: '4px', textShadow: '0 0 15px var(--accent)',
                            }}>
                                {flashAction.name}
                            </div>
                        </div>
                    )}
                </div>

                {/* Player Side */}
                <div className="glass-panel" style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '0.75rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                        <EnergyDisplay energy={playerEnergy} label="Energia" />
                        <span style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--ki-color)', letterSpacing: '1px', textTransform: 'uppercase' }}>
                            {playerName} (TY)
                        </span>
                    </div>

                    <div style={{ display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'center', gap: '2.5rem' }}>
                        {playerRoster.map((char, i) => (
                            <CharacterPortrait
                                key={char.id + '-' + i}
                                char={char}
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
            </div>

            {/* Footer: Controls */}
            <div style={{ height: '260px', display: 'flex', gap: '0.75rem', flexShrink: 0, padding: '0 0.5rem 0.5rem 0.5rem' }}>
                {/* Techniques Panel - Expanded */}
                <div className="glass-panel" style={{ flex: 1, padding: '1.25rem', display: 'flex', flexDirection: 'column', background: 'rgba(6, 18, 40, 0.95)', border: '1px solid rgba(56, 189, 248, 0.3)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                        <span style={{ fontSize: '0.9rem', fontWeight: 900, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '3px' }}>
                            Panel Dowodzenia
                        </span>
                        {isPlayerTurn && (
                            <button
                                className="btn"
                                onClick={passTurn}
                                style={{ padding: '0.6rem 2.5rem', fontSize: '0.9rem', background: 'rgba(56,189,248,0.2)', border: '2px solid var(--accent)', boxShadow: '0 0 15px var(--accent)33', fontWeight: 900 }}
                            >
                                KONIEC TURY
                            </button>
                        )}
                    </div>

                    <div style={{ display: 'flex', gap: '1.25rem', flex: 1, overflowX: 'auto', paddingBottom: '0.5rem', alignItems: 'center', justifyContent: 'center' }}>
                        {isActiveStunned ? (
                            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ef4444', fontWeight: 900, fontSize: '1.3rem', letterSpacing: '2px', animation: 'pulse 1s infinite' }}>
                                💫 POSTAĆ CAŁKOWICIE OGŁUSZONA!
                            </div>
                        ) : (
                            <>
                                {pActive.techniques.map(tech => {
                                    const cdValue = pActive.cooldowns[tech.id] || 0;
                                    const isDisabled = cdValue > 0 || !canAfford(tech.cost) || !isPlayerTurn || !!playerActionsUsed[playerActiveIndex];
                                    return (
                                        <ActionButton
                                            key={tech.id}
                                            iconUrl={tech.iconUrl}
                                            name={tech.name}
                                            subLabel={tech.damage > 0 ? `💥 ${tech.damage} DMG` : 'UTILITY'}
                                            cost={tech.cost}
                                            disabled={isDisabled}
                                            accentColor={tech.damage > 0 ? 'var(--physical-color)' : 'var(--neon-cyan)'}
                                            effect={tech.effect}
                                            cooldown={cdValue}
                                            technique={tech}
                                            onClick={() => executePlayerAction('technique', tech.id)}
                                        />
                                    );
                                })}
                                {/* Dodge Button */}
                                {(() => {
                                    const dodge = pActive.dodge;
                                    const cdValue = pActive.cooldowns['dodge'] || 0;
                                    const isDisabled = cdValue > 0 || !canAfford(dodge.cost) || !isPlayerTurn || !!playerActionsUsed[playerActiveIndex] || isActiveStunned;
                                    return (
                                        <ActionButton
                                            iconUrl={dodge.iconUrl}
                                            name={dodge.name}
                                            subLabel={'UNIK'}
                                            cost={dodge.cost}
                                            disabled={isDisabled}
                                            accentColor="var(--neon-gold)"
                                            cooldown={cdValue}
                                            technique={{...dodge, damage: 0, description: dodge.description || 'Szansa na uniknięcie nadchodzącego ataku.'}}
                                            onClick={() => executePlayerAction('dodge')}
                                        />
                                    );
                                })()}
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* Surrender Confirmation Overlay */}
            {showSurrenderConfirm && (
                <div style={{
                    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
                    backdropFilter: 'blur(8px)', animation: 'fadeInUp 0.3s ease both',
                }}>
                    <div className="glass-panel" style={{ padding: '3rem', textAlign: 'center', maxWidth: '450px' }}>
                        <h3 style={{ fontSize: '1.8rem', color: '#ef4444', marginBottom: '1rem', fontFamily: "'Orbitron', sans-serif", fontWeight: 900 }}>Poddaj się</h3>
                        <p style={{ color: 'var(--text-muted)', marginBottom: '2.5rem', lineHeight: 1.6 }}>
                            Czy na pewno chcesz opuścić walkę? Zostanie to zapisane jako Twoja porażka.
                        </p>
                        <div style={{ display: 'flex', gap: '1.5rem', justifyContent: 'center' }}>
                            <button
                                onClick={() => { surrender(); setShowSurrenderConfirm(false); }}
                                className="btn"
                                style={{ background: 'rgba(239,68,68,0.2)', border: '1px solid rgba(239,68,68,0.5)', color: '#ef4444', boxShadow: 'none' }}
                            >
                                Tak, poddaję się
                            </button>
                            <button
                                onClick={() => setShowSurrenderConfirm(false)}
                                className="btn"
                                style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', boxShadow: 'none' }}
                            >
                                Walczę dalej
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Connection Status Overlay */}
            {disconnectCountdown !== null && (
                <div style={{
                    position: 'fixed', top: '2.5rem', left: '50%', transform: 'translateX(-50%)',
                    background: 'rgba(239,68,68,0.95)', padding: '1.25rem 2.5rem', borderRadius: '16px',
                    color: '#fff', fontWeight: 900, zIndex: 2000, border: '2px solid #fff',
                    boxShadow: '0 0 40px rgba(239,68,68,0.6)', textAlign: 'center',
                    fontFamily: "'Orbitron', sans-serif", letterSpacing: '1px'
                }}>
                    PRZECIWNIK ODŁĄCZONY!<br />
                    <span style={{ fontSize: '0.8rem', opacity: 0.9 }}>Zwycięstwo walkowerem za: {disconnectCountdown}s</span>
                </div>
            )}
        </div>
        </ScreenShake>
    );
};
