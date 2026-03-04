import React from 'react';
import { motion } from 'framer-motion';

interface CharacterAnimationProps {
    children: React.ReactNode;
    isAttacking?: boolean;
    isHit?: boolean;
    isDead?: boolean;
    isPlayer?: boolean; // Determines direction of dash
    isActive?: boolean;
}

export const CharacterAnimation: React.FC<CharacterAnimationProps> = ({
    children,
    isAttacking,
    isHit,
    isDead,
    isPlayer,
    isActive
}) => {

    const dashVariants = {
        idle: { x: 0, scale: 1, filter: isActive ? 'brightness(1.2) drop-shadow(0 0 10px rgba(255,255,255,0.5))' : 'brightness(1) drop-shadow(0 0 0px rgba(255,255,255,0))' },
        attacking: {
            x: isPlayer ? [0, 150, 0] : [0, -150, 0],
            scale: [1, 1.1, 1],
            transition: { duration: 0.4, times: [0, 0.5, 1], ease: "easeInOut" }
        },
        hit: {
            x: isPlayer ? [0, -20, 15, -10, 5, 0] : [0, 20, -15, 10, -5, 0],
            filter: ['brightness(1)', 'brightness(2) hue-rotate(90deg)', 'brightness(1)'],
            transition: { duration: 0.3 }
        },
        dead: {
            opacity: 0,
            scale: 0.8,
            filter: 'grayscale(100%) blur(5px)',
            transition: { duration: 1, ease: "easeOut" }
        }
    };

    let currentState = 'idle';
    if (isDead) currentState = 'dead';
    else if (isHit) currentState = 'hit';
    else if (isAttacking) currentState = 'attacking';

    return (
        <motion.div
            variants={dashVariants}
            initial="idle"
            animate={currentState}
            style={{ position: 'relative', width: '100%', height: '100%' }}
        >
            {children}
        </motion.div>
    );
};
