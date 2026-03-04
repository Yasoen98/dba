import { Howl } from 'howler';

export type SoundKey = 'menu' | 'battle' | 'attack' | 'hit' | 'death' | 'win' | 'ui_hover';

class AudioManager {
    private sounds: Partial<Record<SoundKey, Howl>> = {};
    private isMuted: boolean = false;
    private masterVolume: number = 0.5;

    constructor() {
        this.loadSounds();
    }

    private loadSounds() {
        const soundConfigs: Record<SoundKey, { src: string; loop?: boolean }> = {
            menu:     { src: '/assets/audio/menu.mp3', loop: true },
            battle:   { src: '/assets/audio/battle.mp3', loop: true },
            attack:   { src: '/assets/audio/attack.wav' },
            hit:      { src: '/assets/audio/hit.wav' },
            death:    { src: '/assets/audio/death.wav' },
            win:      { src: '/assets/audio/win.wav' },
            ui_hover: { src: '/assets/audio/ui_hover.wav' },
        };

        (Object.keys(soundConfigs) as SoundKey[]).forEach(key => {
            const config = soundConfigs[key];
            this.sounds[key] = new Howl({
                src: [config.src],
                loop: config.loop || false,
                volume: this.masterVolume,
                mute: this.isMuted,
                preload: true,
                onloaderror: (id, err) => {
                    console.warn(`AudioManager: Failed to load sound ${key} from ${config.src}`, err);
                }
            });
        });
    }

    public play(key: SoundKey) {
        const sound = this.sounds[key];
        if (sound) {
            // If it's BGM and already playing, don't restart
            if ((key === 'menu' || key === 'battle') && sound.playing()) {
                return;
            }
            // Stop other BGM if playing one
            if (key === 'menu') this.stop('battle');
            if (key === 'battle') this.stop('menu');

            sound.play();
        }
    }

    public stop(key: SoundKey) {
        this.sounds[key]?.stop();
    }

    public setMute(mute: boolean) {
        this.isMuted = mute;
        (Object.values(this.sounds) as Howl[]).forEach(s => s.mute(mute));
    }

    public setVolume(volume: number) {
        this.masterVolume = volume;
        (Object.values(this.sounds) as Howl[]).forEach(s => s.volume(volume));
    }

    public getIsMuted() { return this.isMuted; }
    public getVolume() { return this.masterVolume; }
}

export const audioManager = new AudioManager();
