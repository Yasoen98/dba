import React, { useEffect, useState, useMemo } from 'react';
import { useGameState } from "../core/stores/rootStore";
import { getRankForScore } from "../core/stores/authSlice";

interface UserRow {
    id: string;
    name: string;
    score: number;
    wins: number;
    losses: number;
    winStreak: number;
    bestStreak: number;
    globalRank: number; // index in sorted list — stored in row to avoid Map id-collision
}

const PAGE_SIZE = 10;

const MEDAL: Record<number, string> = { 0: '🥇', 1: '🥈', 2: '🥉' };

const RANK_COLOR: Record<string, string> = {
    'Super Saiyan God': '#f43f5e',
    'Super Saiyan':     '#f97316',
    'Elite Warrior':    '#a78bfa',
    'Raditz':           '#38bdf8',
    'Saibaman':         '#6b7280',
};

export const RankingScreen: React.FC = () => {
    const { setPhase, playerName } = useGameState();
    const [rows, setRows]         = useState<UserRow[]>([]);
    const [loading, setLoading]   = useState(true);
    const [error, setError]       = useState(false);
    const [search, setSearch]     = useState('');
    const [page, setPage]         = useState(1);

    useEffect(() => {
        fetch('/api/leaderboard')
            .then(r => r.json())
            .then(data => {
                const list: UserRow[] = (Array.isArray(data) ? data : (data?.data ?? []))
                    .map((u: Record<string, unknown>) => ({
                        id:         String(u.id ?? ''),
                        name:       String(u.name ?? ''),
                        score:      Number(u.score ?? 0),
                        wins:       Number(u.wins ?? 0),
                        losses:     Number(u.losses ?? 0),
                        winStreak:  Number(u.winStreak ?? 0),
                        bestStreak: Number(u.bestStreak ?? 0),
                        globalRank: 0, // filled below after sort
                    }))
                    .map((r, i) => ({ ...r, globalRank: i })); // stable rank index after sort
                setRows(list);
                setLoading(false);
            })
            .catch(() => { setError(true); setLoading(false); });
    }, []);

    const filtered = useMemo<UserRow[]>(() => {
        const q = search.trim().toLowerCase();
        return q ? rows.filter(r => r.name.toLowerCase().includes(q)) : rows;
    }, [rows, search]);

    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    const safePage   = Math.min(page, totalPages);
    const visible    = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

    const handleSearch = (v: string) => {
        setSearch(v);
        setPage(1);
    };

    const col = '3rem 1fr 7rem 6rem 7rem 6rem';

    return (
        <div style={{ minHeight: '100vh', position: 'relative', overflow: 'hidden', background: 'radial-gradient(circle at 30% 20%, #0c1a2e 0%, #020817 100%)' }}>
            {/* grid lines */}
            <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(rgba(56,189,248,0.04) 1px,transparent 1px),linear-gradient(90deg,rgba(56,189,248,0.04) 1px,transparent 1px)', backgroundSize: '40px 40px', pointerEvents: 'none' }} />

            <div style={{ position: 'relative', zIndex: 1, maxWidth: 760, margin: '0 auto', padding: '2rem 1rem' }}>

                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2rem' }}>
                    <button
                        className="btn"
                        style={{ padding: '0.5rem 1.2rem', fontSize: '0.85rem', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', boxShadow: 'none' }}
                        onClick={() => setPhase('menu')}
                    >
                        ← Powrót
                    </button>
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '0.7rem', letterSpacing: '4px', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.25rem' }}>
                            ⬡ Global ⬡
                        </div>
                        <h1 style={{ margin: 0, fontFamily: "'Orbitron', sans-serif", fontSize: '1.8rem', fontWeight: 900, color: 'var(--neon-gold)', textShadow: '0 0 24px rgba(255,215,0,0.5)', letterSpacing: '4px' }}>
                            RANKING
                        </h1>
                    </div>
                    <div style={{ width: 100 }} />
                </div>

                {/* Search bar */}
                {!loading && !error && (
                    <div style={{ marginBottom: '1.25rem', position: 'relative' }}>
                        <span style={{ position: 'absolute', left: '0.9rem', top: '50%', transform: 'translateY(-50%)', fontSize: '0.8rem', color: 'var(--text-muted)', pointerEvents: 'none' }}>
                            ⌕
                        </span>
                        <input
                            type="text"
                            placeholder="Szukaj gracza..."
                            value={search}
                            onChange={e => handleSearch(e.target.value)}
                            style={{
                                width: '100%',
                                padding: '0.6rem 1rem 0.6rem 2.2rem',
                                background: 'rgba(6,18,40,0.85)',
                                border: '1px solid rgba(56,189,248,0.2)',
                                borderRadius: '6px',
                                color: 'var(--text-main)',
                                fontSize: '0.85rem',
                                fontFamily: "'Inter', sans-serif",
                                outline: 'none',
                                boxSizing: 'border-box',
                                transition: 'border-color 0.2s',
                            }}
                            onFocus={e => (e.target.style.borderColor = 'rgba(56,189,248,0.55)')}
                            onBlur={e  => (e.target.style.borderColor = 'rgba(56,189,248,0.2)')}
                        />
                        {search && (
                            <button
                                onClick={() => handleSearch('')}
                                style={{ position: 'absolute', right: '0.7rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '1rem', lineHeight: 1 }}
                            >
                                ×
                            </button>
                        )}
                    </div>
                )}

                {/* States */}
                {loading && (
                    <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '4rem', fontSize: '0.9rem', letterSpacing: '2px' }}>
                        Ładowanie rankingu...
                    </div>
                )}
                {error && (
                    <div style={{ textAlign: 'center', color: 'var(--physical-color)', padding: '4rem', fontSize: '0.9rem' }}>
                        Błąd połączenia z serwerem.
                    </div>
                )}
                {!loading && !error && rows.length === 0 && (
                    <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '4rem', fontSize: '0.9rem' }}>
                        Brak graczy w bazie.
                    </div>
                )}
                {!loading && !error && rows.length > 0 && filtered.length === 0 && (
                    <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '3rem', fontSize: '0.9rem' }}>
                        Nie znaleziono gracza „{search}".
                    </div>
                )}

                {/* Table */}
                {!loading && !error && visible.length > 0 && (
                    <div className="glass-panel" style={{ padding: 0, overflow: 'hidden' }}>
                        {/* Column headers */}
                        <div style={{ display: 'grid', gridTemplateColumns: col, padding: '0.6rem 1.2rem', borderBottom: '1px solid rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.03)' }}>
                            {['#', 'Gracz', 'Power Lvl', 'W / L', 'Streak', 'Best'].map(h => (
                                <span key={h} style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '2px', textAlign: h === '#' ? 'center' : 'left' }}>
                                    {h}
                                </span>
                            ))}
                        </div>

                        {visible.map((row, localI) => {
                            const gi      = row.globalRank;
                            const isMe    = row.name === playerName;
                            const rank    = getRankForScore(row.score);
                            const rankColor = RANK_COLOR[rank] ?? '#6b7280';
                            const total   = row.wins + row.losses;
                            const winPct  = total > 0 ? Math.round((row.wins / total) * 100) : null;

                            return (
                                <div
                                    key={gi}
                                    style={{
                                        display: 'grid',
                                        gridTemplateColumns: col,
                                        padding: '0.8rem 1.2rem',
                                        alignItems: 'center',
                                        borderBottom: localI < visible.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
                                        background: isMe
                                            ? 'linear-gradient(90deg, rgba(56,189,248,0.08) 0%, transparent 100%)'
                                            : localI % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.015)',
                                        transition: 'background 0.15s',
                                    }}
                                >
                                    {/* Position — always global */}
                                    <span style={{ textAlign: 'center', fontSize: gi < 3 ? '1.2rem' : '0.85rem', color: gi < 3 ? undefined : 'var(--text-muted)', fontFamily: "'Orbitron', sans-serif", fontWeight: 700 }}>
                                        {MEDAL[gi] ?? `${gi + 1}`}
                                    </span>

                                    {/* Name + rank */}
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.1rem' }}>
                                        <span style={{ fontWeight: 700, fontSize: '0.9rem', color: isMe ? 'var(--neon-cyan)' : 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                            {isMe && <span style={{ fontSize: '0.6rem', background: 'var(--neon-cyan)', color: '#020817', borderRadius: '3px', padding: '1px 5px', fontWeight: 900, letterSpacing: '1px' }}>TY</span>}
                                            {row.name}
                                        </span>
                                        <span style={{ fontSize: '0.65rem', color: rankColor, fontWeight: 600 }}>{rank}</span>
                                    </div>

                                    {/* Score */}
                                    <span style={{ fontFamily: "'Orbitron', sans-serif", fontWeight: 800, fontSize: '0.95rem', color: gi === 0 ? 'var(--neon-gold)' : gi === 1 ? '#cbd5e1' : gi === 2 ? '#cd7f32' : 'var(--text-main)' }}>
                                        {row.score.toLocaleString()}
                                    </span>

                                    {/* W / L */}
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.05rem' }}>
                                        <span style={{ fontSize: '0.82rem', color: 'var(--text-main)' }}>
                                            <span style={{ color: '#22c55e', fontWeight: 700 }}>{row.wins}</span>
                                            <span style={{ color: 'var(--text-muted)' }}> / </span>
                                            <span style={{ color: '#ef4444', fontWeight: 700 }}>{row.losses}</span>
                                        </span>
                                        {winPct !== null && (
                                            <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>{winPct}% winrate</span>
                                        )}
                                    </div>

                                    {/* Current streak */}
                                    <span style={{ fontSize: '0.85rem', color: row.winStreak > 0 ? '#f97316' : 'var(--text-muted)', fontWeight: row.winStreak > 0 ? 700 : 400 }}>
                                        {row.winStreak > 0 ? `🔥 ${row.winStreak}` : '—'}
                                    </span>

                                    {/* Best streak */}
                                    <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                        {row.bestStreak > 0 ? row.bestStreak : '—'}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* Pagination */}
                {!loading && !error && totalPages > 1 && (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem', marginTop: '1.25rem' }}>
                        <button
                            onClick={() => setPage(p => Math.max(1, p - 1))}
                            disabled={safePage === 1}
                            style={{
                                background: 'transparent',
                                border: '1px solid rgba(56,189,248,0.25)',
                                color: safePage === 1 ? 'var(--text-muted)' : 'var(--neon-cyan)',
                                borderRadius: '4px',
                                padding: '0.4rem 0.9rem',
                                fontFamily: "'Orbitron', sans-serif",
                                fontSize: '0.7rem',
                                letterSpacing: '2px',
                                cursor: safePage === 1 ? 'not-allowed' : 'pointer',
                                opacity: safePage === 1 ? 0.4 : 1,
                                transition: 'all 0.2s',
                            }}
                        >
                            ‹ PREV
                        </button>

                        {/* Page numbers */}
                        {Array.from({ length: totalPages }, (_, i) => i + 1)
                            .filter(p => Math.abs(p - safePage) <= 2 || p === 1 || p === totalPages)
                            .reduce<(number | '…')[]>((acc, p, idx, arr) => {
                                if (idx > 0 && p - (arr[idx - 1] as number) > 1) acc.push('…');
                                acc.push(p);
                                return acc;
                            }, [])
                            .map((item, idx) =>
                                item === '…' ? (
                                    <span key={`ellipsis-${idx}`} style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>…</span>
                                ) : (
                                    <button
                                        key={item}
                                        onClick={() => setPage(item as number)}
                                        style={{
                                            minWidth: '2rem',
                                            padding: '0.4rem 0.5rem',
                                            background: item === safePage ? 'rgba(56,189,248,0.15)' : 'transparent',
                                            border: `1px solid ${item === safePage ? 'rgba(56,189,248,0.6)' : 'rgba(56,189,248,0.15)'}`,
                                            borderRadius: '4px',
                                            color: item === safePage ? 'var(--neon-cyan)' : 'var(--text-muted)',
                                            fontFamily: "'Orbitron', sans-serif",
                                            fontSize: '0.7rem',
                                            cursor: 'pointer',
                                            transition: 'all 0.2s',
                                            boxShadow: item === safePage ? '0 0 8px rgba(56,189,248,0.2)' : 'none',
                                        }}
                                    >
                                        {item}
                                    </button>
                                )
                            )
                        }

                        <button
                            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                            disabled={safePage === totalPages}
                            style={{
                                background: 'transparent',
                                border: '1px solid rgba(56,189,248,0.25)',
                                color: safePage === totalPages ? 'var(--text-muted)' : 'var(--neon-cyan)',
                                borderRadius: '4px',
                                padding: '0.4rem 0.9rem',
                                fontFamily: "'Orbitron', sans-serif",
                                fontSize: '0.7rem',
                                letterSpacing: '2px',
                                cursor: safePage === totalPages ? 'not-allowed' : 'pointer',
                                opacity: safePage === totalPages ? 0.4 : 1,
                                transition: 'all 0.2s',
                            }}
                        >
                            NEXT ›
                        </button>
                    </div>
                )}

                {/* Footer */}
                {!loading && !error && (
                    <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.7rem', marginTop: '1rem', letterSpacing: '1px' }}>
                        {search
                            ? `${filtered.length} wyników · strona ${safePage} / ${totalPages}`
                            : `${rows.length} zarejestrowanych graczy · sortowanie: Power Level`
                        }
                    </p>
                )}
            </div>
        </div>
    );
};
