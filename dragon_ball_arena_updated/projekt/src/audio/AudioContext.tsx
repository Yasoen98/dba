import React, { createContext, useContext, useState, useCallback } from 'react';
import { audioManager } from './AudioManager';
import type { SoundKey } from './AudioManager';

interface AudioContextType {
    isMuted: boolean;
    volume: number;
    toggleMute: () => void;
    changeVolume: (v: number) => void;
    playSound: (key: SoundKey) => void;
}

const AudioContext = createContext<AudioContextType | undefined>(undefined);

export const AudioProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [isMuted, setIsMuted] = useState(audioManager.getIsMuted());
    const [volume, setVolume] = useState(audioManager.getVolume());

    const toggleMute = useCallback(() => {
        const newMute = !audioManager.getIsMuted();
        audioManager.setMute(newMute);
        setIsMuted(newMute);
    }, []);

    const changeVolume = useCallback((v: number) => {
        audioManager.setVolume(v);
        setVolume(v);
    }, []);

    const playSound = useCallback((key: SoundKey) => {
        audioManager.play(key);
    }, []);

    return (
        <AudioContext.Provider value={{ isMuted, volume, toggleMute, changeVolume, playSound }}>
            {children}
        </AudioContext.Provider>
    );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useAudio = () => {
    const context = useContext(AudioContext);
    if (!context) throw new Error('useAudio must be used within an AudioProvider');
    return context;
};
