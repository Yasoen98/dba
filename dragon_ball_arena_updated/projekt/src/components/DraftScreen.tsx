import React from 'react';
import { useGameState } from '../stores/rootStore';
import { DRAFT_TIER_LIMIT } from '../types';

const TIER_LABELS: Record<number, string> = {
    1: 'Common',
    2: 'Elite',
    3: 'Legendary',
};

const TIER_COLORS: Record<number, string> = {
    1: '#94a3b8',
    2: '#38bdf8',
    3: '#f59e0b',
};

export const DraftScreen: React.FC = () => {
    const {
        availableCharacters,
        draftCharacter,
        playerRoster,
        opponentRoster,
        draftTurn,
        draftTierUsed,
        opponentTierUsed,
    } = useGameState();

    const remainingBudget = DRAFT_TIER_LIMIT - draftTierUsed;
    const hasLegendary = playerRoster.some(c => c.tier === 3);

    // order available characters: pickable ones first, grouped by tier desc;
    // unavailable (over budget or blocked) go to the end so they don't clutter
    const sortedCharacters = [...availableCharacters].sort((a, b) => {
        const aDisabled = a.tier > remainingBudget || (a.tier === 3 && hasLegendary);
        const bDisabled = b.tier > remainingBudget || (b.tier === 3 && hasLegendary);
        if (aDisabled !== bDisabled) return aDisabled ? 1 : -1;
        return b.tier - a.tier;
    });

    return (
        <div className="glass-panel" style={{ padding: '2rem', maxWidth: '900px', margin: '5vh auto' }}>
            <h2 style={{ textAlign: 'center', marginBottom: '0.5rem', color: 'var(--accent)' }}>Draft Phase</h2>
            <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
                Build your team within the <strong style={{ color: 'var(--accent)' }}>{DRAFT_TIER_LIMIT} Tier Point</strong> budget.
            </p>

            {/* Team displays */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem', gap: '1rem' }}>
                {/* Player side */}
                <div style={{ flex: 1 }}>
                    <h3 style={{ color: draftTurn === 'player' ? 'var(--ki-color)' : 'var(--text-muted)', marginBottom: '0.5rem' }}>
                        Your Team ({playerRoster.length}/3)
                    </h3>
                    {/* Tier budget bar */}
                    <TierBudgetBar used={draftTierUsed} total={DRAFT_TIER_LIMIT} color="var(--ki-color)" />
                    <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
                        {playerRoster.map(c => (
                            <CharacterSlot key={c.id} char={c} isPlayer />
                        ))}
                        {Array.from({ length: 3 - playerRoster.length }).map((_, i) => (
                            <EmptySlot key={i} />
                        ))}
                    </div>
                </div>

                {/* VS divider */}
                <div style={{ display: 'flex', alignItems: 'center', padding: '0 1rem' }}>
                    <span style={{ color: 'var(--accent)', fontWeight: 900, fontSize: '1.5rem' }}>VS</span>
                </div>

                {/* Opponent side */}
                <div style={{ flex: 1, textAlign: 'right' }}>
                    <h3 style={{ color: draftTurn === 'opponent' ? 'var(--physical-color)' : 'var(--text-muted)', marginBottom: '0.5rem' }}>
                        Opponent ({opponentRoster.length}/3)
                    </h3>
                    <TierBudgetBar used={opponentTierUsed} total={DRAFT_TIER_LIMIT} color="var(--physical-color)" />
                    <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem', justifyContent: 'flex-end' }}>
                        {opponentRoster.map(c => (
                            <CharacterSlot key={c.id} char={c} isPlayer={false} />
                        ))}
                        {Array.from({ length: 3 - opponentRoster.length }).map((_, i) => (
                            <EmptySlot key={i} />
                        ))}
                    </div>
                </div>
            </div>

            {/* Turn indicator */}
            <div style={{
                textAlign: 'center',
                marginBottom: '1.5rem',
                fontSize: '1.1rem',
                fontWeight: 'bold',
                color: draftTurn === 'player' ? 'var(--ki-color)' : 'var(--physical-color)',
            }}>
                {draftTurn === 'player'
                    ? `Your turn to pick! (${remainingBudget} tier point${remainingBudget !== 1 ? 's' : ''} remaining)`
                    : 'Opponent is picking...'}
            </div>
            {hasLegendary && draftTurn === 'player' && (
                <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1rem' }}>
                    You already have a Legendary (Tier 3); another cannot be drafted.
                </div>
            )}

            {/* Character grid */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
                gap: '0.75rem',
                maxHeight: '45vh',
                overflowY: 'auto',
                padding: '1rem',
                borderTop: '1px solid rgba(255,255,255,0.1)',
            }}>
                {sortedCharacters.map(char => {
                    const tooExpensive = char.tier > remainingBudget;
                    const exceedsLegendary = char.tier === 3 && hasLegendary;
                    const disabled = draftTurn !== 'player' || tooExpensive || exceedsLegendary;

                    return (
                        <button
                            key={char.id}
                            onClick={() => draftCharacter(char.id)}
                            disabled={disabled}
                            className="glass-panel"
                            style={{
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                padding: '0.75rem 0.5rem',
                                background: (tooExpensive || exceedsLegendary)
                                    ? 'rgba(255,255,255,0.02)'
                                    : `rgba(${char.imageColor.replace('#', '').match(/.{2}/g)?.map(h => parseInt(h, 16)).join(',') || '255,255,255'}, 0.06)`,
                                border: `2px solid ${(tooExpensive || exceedsLegendary) ? 'rgba(255,255,255,0.05)' : char.imageColor}`,
                                cursor: disabled ? 'not-allowed' : 'pointer',
                                opacity: (tooExpensive || exceedsLegendary) ? 0.35 : 1,
                                transition: 'all 0.2s ease',
                            }}
                        >
                            {/* Portrait */}
                            <div style={{
                                width: '54px',
                                height: '54px',
                                borderRadius: '50%',
                                backgroundColor: char.imageColor,
                                backgroundImage: char.portraitUrl ? `url(${char.portraitUrl})` : 'none',
                                backgroundSize: 'cover',
                                backgroundPosition: 'center',
                                border: `2px solid ${char.imageColor}`,
                                marginBottom: '0.5rem',
                            }} />

                            {/* Name */}
                            <span style={{
                                fontSize: '0.8rem',
                                fontWeight: 'bold',
                                color: char.imageColor,
                                textAlign: 'center',
                                lineHeight: 1.2,
                                marginBottom: '0.25rem',
                            }}>
                                {char.name}
                            </span>

                            {/* HP */}
                            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                                HP: {char.maxHp}
                            </span>

                            {/* Tier badge */}
                            <div style={{
                                marginTop: '0.4rem',
                                padding: '2px 8px',
                                borderRadius: '999px',
                                background: `${TIER_COLORS[char.tier]}22`,
                                border: `1px solid ${TIER_COLORS[char.tier]}`,
                                fontSize: '0.65rem',
                                fontWeight: 800,
                                color: TIER_COLORS[char.tier],
                                letterSpacing: '0.5px',
                            }}>
                                T{char.tier} · {TIER_LABELS[char.tier]}
                            </div>

                            {tooExpensive && (
                                <div style={{ fontSize: '0.6rem', color: 'var(--physical-color)', marginTop: '0.25rem' }}>
                                    Over budget
                                </div>
                            )}
                            {exceedsLegendary && (
                                <div style={{ fontSize: '0.6rem', color: 'var(--physical-color)', marginTop: '0.25rem' }}>
                                    Only one Legendary allowed
                                </div>
                            )}
                        </button>
                    );
                })}
            </div>
        </div>
    );
};

// ── Sub-components ─────────────────────────────────────────────────────────────

const TierBudgetBar: React.FC<{ used: number; total: number; color: string }> = ({ used, total, color }) => {
    const pct = Math.min(100, (used / total) * 100);
    const isOver = used > total;
    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '3px' }}>
                <span>Tier Budget</span>
                <span style={{ color: isOver ? 'var(--physical-color)' : color, fontWeight: 700 }}>
                    {used} / {total}
                </span>
            </div>
            <div style={{ height: '6px', background: 'rgba(255,255,255,0.08)', borderRadius: '3px', overflow: 'hidden' }}>
                <div style={{
                    width: `${pct}%`,
                    height: '100%',
                    background: isOver ? 'var(--physical-color)' : color,
                    borderRadius: '3px',
                    transition: 'width 0.3s ease',
                    boxShadow: `0 0 6px ${color}88`,
                }} />
            </div>
        </div>
    );
};

const CharacterSlot: React.FC<{
    char: { name: string; portraitUrl?: string; imageColor: string; tier: number };
    isPlayer: boolean;
}> = ({ char, isPlayer }) => (
    <div style={{
        width: '64px',
        height: '64px',
        borderRadius: '50%',
        backgroundColor: char.imageColor,
        backgroundImage: char.portraitUrl ? `url(${char.portraitUrl})` : 'none',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        border: `2px solid ${isPlayer ? 'var(--ki-color)' : 'var(--physical-color)'}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '9px',
        fontWeight: 'bold',
        textAlign: 'center',
        position: 'relative',
    }}>
        {!char.portraitUrl && char.name}
        {/* Tier badge */}
        <div style={{
            position: 'absolute',
            bottom: -2,
            right: -2,
            width: '18px',
            height: '18px',
            borderRadius: '50%',
            background: TIER_COLORS[char.tier],
            border: '2px solid #0f172a',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '0.6rem',
            fontWeight: 900,
            color: '#000',
        }}>
            {char.tier}
        </div>
    </div>
);

const EmptySlot: React.FC = () => (
    <div style={{
        width: '64px',
        height: '64px',
        borderRadius: '50%',
        border: '2px dashed rgba(255,255,255,0.15)',
        background: 'rgba(255,255,255,0.02)',
    }} />
);
