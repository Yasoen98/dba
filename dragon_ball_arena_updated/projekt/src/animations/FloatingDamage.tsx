import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface FloatingNumberProps {
    id: number;
    value: number | string;
    type: 'damage' | 'heal' | 'energy';
    onComplete?: () => void;
}

export const FloatingNumber: React.FC<FloatingNumberProps> = ({ value, type, onComplete }) => {
    const color = type === 'heal' ? '#22c55e' : type === 'energy' ? '#eab308' : '#ef4444';
    const textShadow = `0 0 10px ${color}, 0 0 20px ${color}`;

    useEffect(() => {
        const timer = setTimeout(() => {
            if (onComplete) onComplete();
        }, 1000);
        return () => clearTimeout(timer);
    }, [onComplete]);

    return (
        <motion.div
            initial={{ opacity: 0, y: 0, scale: 0.5 }}
            animate={{ opacity: 1, y: -50, scale: 1.2 }}
            exit={{ opacity: 0, y: -80, scale: 0.8 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            style={{
                position: 'absolute',
                top: '20%',
                left: '50%',
                transform: 'translateX(-50%)',
                color: '#fff',
                fontWeight: 900,
                fontSize: '2rem',
                fontFamily: "'Orbitron', sans-serif",
                textShadow,
                pointerEvents: 'none',
                zIndex: 100,
            }}
        >
            {type === 'damage' ? `-${value}` : `+${value}`}
        </motion.div>
    );
};

export const FloatingDamageContainer: React.FC<{ floats: FloatingNumberProps[] }> = ({ floats }) => {
    return (
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
            <AnimatePresence>
                {floats.map(f => (
                    <FloatingNumber key={f.id} {...f} />
                ))}
            </AnimatePresence>
        </div>
    );
};
