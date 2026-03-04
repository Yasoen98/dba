import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

interface ScreenShakeProps {
    children: React.ReactNode;
    trigger: number; // Increment to trigger a shake
}

export const ScreenShake: React.FC<ScreenShakeProps> = ({ children, trigger }) => {
    const [shake, setShake] = useState(false);

    useEffect(() => {
        if (trigger > 0) {
            requestAnimationFrame(() => {
                setShake(true);
                const timer = setTimeout(() => setShake(false), 400); // match duration
                return () => clearTimeout(timer);
            });
        }
    }, [trigger]);

    const shakeVariants = {
        idle: { x: 0, y: 0 },
        shaking: {
            x: [0, -10, 10, -10, 10, 0],
            y: [0, 10, -10, 10, -10, 0],
            transition: { duration: 0.4, ease: "easeInOut" }
        }
    };

    return (
        <motion.div
            variants={shakeVariants}
            initial="idle"
            animate={shake ? "shaking" : "idle"}
            style={{ width: '100%', height: '100%', position: 'relative' }}
        >
            {children}
        </motion.div>
    );
};
