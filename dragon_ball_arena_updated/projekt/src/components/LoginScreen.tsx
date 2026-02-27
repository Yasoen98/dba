import React, { useState } from 'react';
import { useGameState } from '../stores/rootStore';

export const LoginScreen: React.FC = () => {
    const [isRegistering, setIsRegistering] = useState(false);
    const [name, setName] = useState('');
    const [password, setPassword] = useState('');

    const { login, register, loginError } = useGameState();

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (name.trim().length >= 3 && password.trim().length >= 3) {
            if (isRegistering) {
                register(name.trim(), password.trim());
            } else {
                login(name.trim(), password.trim());
            }
        }
    };

    return (
        <div className="glass-panel" style={{ padding: '3rem', maxWidth: '400px', margin: '20vh auto', textAlign: 'center' }}>
            <h2 style={{ color: 'var(--accent)', fontSize: '2rem', marginBottom: '1rem' }}>
                {isRegistering ? 'Create Profile' : 'Enter the Arena'}
            </h2>
            <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
                {isRegistering
                    ? 'Register an account to save your progress.'
                    : 'Log in to track your rank and battle statistics.'}
            </p>

            {loginError && (
                <div style={{
                    color: 'var(--physical-color)',
                    marginBottom: '1rem',
                    background: 'rgba(239, 68, 68, 0.1)',
                    padding: '0.5rem',
                    borderRadius: '4px',
                }}>
                    {loginError}
                </div>
            )}

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Username"
                    style={{
                        padding: '1rem', borderRadius: '8px',
                        border: '1px solid var(--panel-border)',
                        background: 'rgba(0, 0, 0, 0.2)',
                        color: 'white', fontSize: '1.2rem',
                        textAlign: 'center', outline: 'none',
                    }}
                    autoFocus
                />
                <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Password"
                    style={{
                        padding: '1rem', borderRadius: '8px',
                        border: '1px solid var(--panel-border)',
                        background: 'rgba(0, 0, 0, 0.2)',
                        color: 'white', fontSize: '1.2rem',
                        textAlign: 'center', outline: 'none',
                    }}
                />
                <button
                    type="submit"
                    className="btn"
                    disabled={name.trim().length < 3 || password.trim().length < 3}
                    style={{ padding: '1rem', fontSize: '1.2rem', marginTop: '1rem' }}
                >
                    {isRegistering ? 'Register & Play' : 'Login'}
                </button>
            </form>

            <div style={{ marginTop: '1.5rem', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                {isRegistering ? 'Already have an account? ' : "Don't have an account? "}
                <button
                    onClick={() => setIsRegistering(!isRegistering)}
                    style={{
                        background: 'none', border: 'none',
                        color: 'var(--accent)', cursor: 'pointer',
                        textDecoration: 'underline', padding: 0,
                    }}
                >
                    {isRegistering ? 'Log in here' : 'Register here'}
                </button>
            </div>
        </div>
    );
};
