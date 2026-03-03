import React, { useState } from 'react';
import { useGameState } from '../stores/rootStore';

type Tab = 'login' | 'register' | 'guest';

const inputStyle: React.CSSProperties = {
    padding: '0.85rem 1rem',
    borderRadius: '8px',
    border: '1px solid var(--panel-border)',
    background: 'rgba(0, 0, 0, 0.3)',
    color: 'white',
    fontSize: '1rem',
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box',
    transition: 'border-color 0.2s',
};

export const LoginScreen: React.FC = () => {
    const [tab, setTab] = useState<Tab>('login');
    const [name, setName] = useState('');
    const [password, setPassword] = useState('');

    const { login, register, loginAsGuest, loginError, loginLoading } = useGameState();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (tab === 'login') {
            await login(name.trim(), password.trim());
        } else if (tab === 'register') {
            await register(name.trim(), password.trim());
        }
    };

    const isFormValid = name.trim().length >= 3 && password.trim().length >= 3;

    const tabs: { id: Tab; label: string }[] = [
        { id: 'login', label: 'Zaloguj' },
        { id: 'register', label: 'Rejestracja' },
        { id: 'guest', label: 'Gość' },
    ];

    return (
        <div style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'radial-gradient(ellipse at 50% -10%, #0a1628 0%, #020817 60%)',
            position: 'relative',
            overflow: 'hidden',
        }}>
            {/* Background grid */}
            <div style={{
                position: 'absolute',
                inset: 0,
                backgroundImage: 'linear-gradient(rgba(56,189,248,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(56,189,248,0.04) 1px, transparent 1px)',
                backgroundSize: '60px 60px',
                maskImage: 'radial-gradient(ellipse at center, black 30%, transparent 80%)',
                pointerEvents: 'none',
            }} />

            <div className="glass-panel" style={{
                padding: '2.5rem 2rem',
                maxWidth: '420px',
                width: '90%',
                textAlign: 'center',
                animation: 'fadeInUp 0.5s ease both',
                position: 'relative',
            }}>
                {/* Logo */}
                <div style={{ marginBottom: '1.75rem' }}>
                    <div style={{
                        fontFamily: "'Orbitron', sans-serif",
                        fontSize: '0.6rem',
                        letterSpacing: '6px',
                        color: 'var(--neon-cyan)',
                        textTransform: 'uppercase',
                        opacity: 0.7,
                        marginBottom: '0.5rem',
                    }}>
                        Dragon Ball
                    </div>
                    <h1 style={{
                        fontFamily: "'Orbitron', sans-serif",
                        fontSize: '1.8rem',
                        fontWeight: 900,
                        letterSpacing: '3px',
                        textTransform: 'uppercase',
                        margin: 0,
                        background: 'linear-gradient(135deg, #ffffff 0%, var(--neon-cyan) 50%, var(--neon-gold) 100%)',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                        backgroundClip: 'text',
                    }}>
                        ARENA
                    </h1>
                </div>

                {/* Tab switcher */}
                <div style={{
                    display: 'flex',
                    background: 'rgba(0,0,0,0.3)',
                    borderRadius: '10px',
                    padding: '4px',
                    marginBottom: '1.75rem',
                    border: '1px solid rgba(56,189,248,0.1)',
                }}>
                    {tabs.map(t => (
                        <button
                            key={t.id}
                            onClick={() => { setTab(t.id); }}
                            style={{
                                flex: 1,
                                padding: '0.55rem 0',
                                border: 'none',
                                borderRadius: '7px',
                                cursor: 'pointer',
                                fontFamily: "'Orbitron', sans-serif",
                                fontSize: '0.62rem',
                                fontWeight: 700,
                                letterSpacing: '1.5px',
                                textTransform: 'uppercase',
                                transition: 'all 0.2s',
                                background: tab === t.id
                                    ? t.id === 'guest'
                                        ? 'rgba(168,85,247,0.25)'
                                        : 'rgba(56,189,248,0.2)'
                                    : 'transparent',
                                color: tab === t.id
                                    ? t.id === 'guest' ? 'var(--special-color)' : 'var(--neon-cyan)'
                                    : 'var(--text-muted)',
                                boxShadow: tab === t.id ? '0 0 12px rgba(56,189,248,0.15)' : 'none',
                            }}
                        >
                            {t.label}
                        </button>
                    ))}
                </div>

                {/* Error message */}
                {loginError && (
                    <div style={{
                        color: 'var(--physical-color)',
                        marginBottom: '1rem',
                        background: 'rgba(239,68,68,0.1)',
                        border: '1px solid rgba(239,68,68,0.25)',
                        padding: '0.6rem 0.75rem',
                        borderRadius: '8px',
                        fontSize: '0.85rem',
                    }}>
                        {loginError}
                    </div>
                )}

                {/* Login / Register forms */}
                {(tab === 'login' || tab === 'register') && (
                    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                        <div style={{ textAlign: 'left' }}>
                            <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)', letterSpacing: '1px', textTransform: 'uppercase', display: 'block', marginBottom: '0.35rem' }}>
                                Nazwa użytkownika
                            </label>
                            <input
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="min. 3 znaki"
                                style={inputStyle}
                                autoFocus
                                autoComplete="username"
                            />
                        </div>

                        <div style={{ textAlign: 'left' }}>
                            <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)', letterSpacing: '1px', textTransform: 'uppercase', display: 'block', marginBottom: '0.35rem' }}>
                                Hasło
                            </label>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="min. 3 znaki"
                                style={inputStyle}
                                autoComplete={tab === 'register' ? 'new-password' : 'current-password'}
                            />
                        </div>

                        <button
                            type="submit"
                            className="btn"
                            disabled={!isFormValid || loginLoading}
                            style={{
                                padding: '0.9rem',
                                fontSize: '0.9rem',
                                marginTop: '0.5rem',
                                fontFamily: "'Orbitron', sans-serif",
                                letterSpacing: '2px',
                                textTransform: 'uppercase',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '0.5rem',
                            }}
                        >
                            {loginLoading ? (
                                <>
                                    <span style={{
                                        display: 'inline-block',
                                        width: '14px', height: '14px',
                                        border: '2px solid rgba(255,255,255,0.3)',
                                        borderTopColor: 'white',
                                        borderRadius: '50%',
                                        animation: 'rotateSlow 0.7s linear infinite',
                                    }} />
                                    Łączenie...
                                </>
                            ) : tab === 'login' ? 'Zaloguj się' : 'Zarejestruj'}
                        </button>
                    </form>
                )}

                {/* Guest tab */}
                {tab === 'guest' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', alignItems: 'center' }}>
                        <div style={{
                            fontSize: '3rem',
                            marginBottom: '0.25rem',
                            filter: 'drop-shadow(0 0 12px rgba(168,85,247,0.5))',
                        }}>
                            👤
                        </div>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', margin: 0, lineHeight: 1.6 }}>
                            Graj bez konta — postęp <strong style={{ color: 'var(--special-color)' }}>nie będzie zapisany</strong>.
                        </p>
                        <button
                            className="btn"
                            onClick={loginAsGuest}
                            style={{
                                padding: '0.9rem 2rem',
                                fontSize: '0.9rem',
                                fontFamily: "'Orbitron', sans-serif",
                                letterSpacing: '2px',
                                textTransform: 'uppercase',
                                background: 'rgba(168,85,247,0.25)',
                                boxShadow: '0 4px 12px rgba(168,85,247,0.25)',
                                border: '1px solid rgba(168,85,247,0.4)',
                                width: '100%',
                            }}
                        >
                            Graj jako Gość
                        </button>
                    </div>
                )}

                {/* Footer note */}
                {(tab === 'login' || tab === 'register') && (
                    <p style={{ marginTop: '1.25rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {tab === 'login'
                            ? <>Nie masz konta? <button onClick={() => setTab('register')} style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', padding: 0, textDecoration: 'underline', fontSize: '0.75rem' }}>Zarejestruj się</button></>
                            : <>Masz już konto? <button onClick={() => setTab('login')} style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', padding: 0, textDecoration: 'underline', fontSize: '0.75rem' }}>Zaloguj się</button></>
                        }
                    </p>
                )}
            </div>
        </div>
    );
};
