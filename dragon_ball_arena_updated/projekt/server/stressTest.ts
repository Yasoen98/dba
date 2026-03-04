/**
 * Stress test – 200 botów symulujących matchmaking → draft → walkę
 * Status: 1 wiersz aktualizowany co 500 ms
 */
import { io, Socket } from 'socket.io-client';
import { INITIAL_CHARACTERS } from './src/characters';
import type { Character, BattleCharacter, PlayerEnergy, ActionCost } from './src/types';

const SERVER_URL = 'http://localhost:3005';
const NUM_BOTS   = 200;
const REJOIN_DELAY_MS    = 800;   // pauza po gameOver przed ponownym wejściem do kolejki
const CONNECT_STAGGER_MS = 25;    // opóźnienie co 10 botów (anty-thundering-herd)

// ─── typy lokalne ───────────────────────────────────────────────────────────

type Phase = 'connecting' | 'matchmaking' | 'draft' | 'battle' | 'gameOver';

interface SideData {
    roster: BattleCharacter[];
    energy: PlayerEnergy;
    activeIndex: number;
    actionsUsed: Record<number, boolean>;
}

interface BattleData {
    phase: string;
    whoseTurn: 'player1' | 'player2';
    winner: string | null;
    p1: SideData;
    p2: SideData;
}

interface DraftData {
    player1Roster: string[];
    player2Roster: string[];
    nextTurn: 'player1' | 'player2';
}

interface BotState {
    id: number;
    socket: Socket;
    role: 'player1' | 'player2' | null;
    phase: Phase;
    matchesPlayed: number;
}

// ─── globalne liczniki ───────────────────────────────────────────────────────

const bots: BotState[] = [];
let totalMatchesFinished = 0;   // każdy bot zlicza 1× przy gameOver → dzielimy przez 2

// ─── helper: czy bota stać na koszt techniki ────────────────────────────────

function canAfford(energy: PlayerEnergy, cost: ActionCost): boolean {
    let u  = energy.universal || 0;
    let ki = energy.ki        || 0;
    let ph = energy.physical  || 0;
    let sp = energy.special   || 0;

    // Odejmujemy od universal najpierw, potem od puli specyficznej
    const pay = (needed: number, pool: number): [number, number] => {
        const fromU = Math.min(u, needed);
        u      -= fromU;
        needed -= fromU;
        const fromPool = Math.min(pool, needed);
        needed -= fromPool;
        pool   -= fromPool;
        return [needed, pool];
    };

    let rem: number;
    [rem, ki] = pay(cost.ki       || 0, ki);
    if (rem > 0) return false;
    [rem, ph] = pay(cost.physical || 0, ph);
    if (rem > 0) return false;
    [rem, sp] = pay(cost.special  || 0, sp);
    if (rem > 0) return false;

    return (u + ki + ph + sp) >= (cost.any || 0);
}

// ─── logika bota podczas draftu ─────────────────────────────────────────────

function handleDraft(bot: BotState, data: DraftData): void {
    if (data.nextTurn !== bot.role) return;     // nie nasza tura

    const myRoster = bot.role === 'player1' ? data.player1Roster : data.player2Roster;
    if (myRoster.length >= 3) return;            // drużyna już kompletna

    // Tylko tier-1 (łączny koszt 3 ≤ limit 6), bez duplikatów
    const available = INITIAL_CHARACTERS.filter(
        (c: Character) => c.tier === 1 && !myRoster.includes(c.id),
    );
    if (available.length === 0) return;

    const pick = available[Math.floor(Math.random() * available.length)];

    // Losowy delay symuluje czas reakcji gracza
    setTimeout(() => {
        if (bot.socket.connected) {
            bot.socket.emit('selectCharacter', { charId: pick.id });
        }
    }, 50 + Math.random() * 150);
}

// ─── logika bota podczas walki ───────────────────────────────────────────────

function handleBattle(bot: BotState, data: BattleData): void {
    if (data.phase !== 'battle' || data.winner) return;
    bot.phase = 'battle';
    if (data.whoseTurn !== bot.role) return;    // nie nasza tura

    const mySide = bot.role === 'player1' ? data.p1 : data.p2;
    const { activeIndex, energy, actionsUsed, roster } = mySide;

    // Aktywna postać martwa → przełącz na żywą
    if (roster[activeIndex]?.currentHp <= 0) {
        const nextIdx = roster.findIndex(c => c.currentHp > 0);
        if (nextIdx !== -1) {
            bot.socket.emit('selectAction', { actionType: 'switchCharacter', actionId: String(nextIdx) });
        }
        return;
    }

    // Postać już wykonała akcję w tej turze → pass
    if (actionsUsed[activeIndex]) {
        setTimeout(() => {
            if (bot.socket.connected) bot.socket.emit('selectAction', { actionType: 'pass' });
        }, 20 + Math.random() * 80);
        return;
    }

    const char = roster[activeIndex];
    if (!char) {
        bot.socket.emit('selectAction', { actionType: 'pass' });
        return;
    }

    // Ogłuszony → jedyna opcja to pass (serwer odrzuca techniki bez odpowiedzi)
    const isStunned = char.statusEffects?.some(se => se.effect === 'stun');
    if (isStunned) {
        setTimeout(() => {
            if (bot.socket.connected) bot.socket.emit('selectAction', { actionType: 'pass' });
        }, 20 + Math.random() * 80);
        return;
    }

    // Techniki dostępne: bez cooldownu i wystarczająca energia
    const cds = (char.cooldowns as Record<string, number>) || {};
    const usable = char.techniques.filter(t => (cds[t.id] || 0) === 0 && canAfford(energy, t.cost));

    setTimeout(() => {
        if (!bot.socket.connected) return;
        // 85% szans na atak, 15% na pass
        if (usable.length > 0 && Math.random() > 0.15) {
            const tech = usable[Math.floor(Math.random() * usable.length)];
            bot.socket.emit('selectAction', { actionType: 'technique', actionId: tech.id });
        } else {
            bot.socket.emit('selectAction', { actionType: 'pass' });
        }
    }, 20 + Math.random() * 120);
}

// ─── tworzenie i konfiguracja bota ──────────────────────────────────────────

function createBot(id: number): BotState {
    const socket = io(SERVER_URL, {
        reconnection: false,
        forceNew: true,
        transports: ['websocket'],
    });

    const bot: BotState = { id, socket, role: null, phase: 'connecting', matchesPlayed: 0 };

    socket.on('connect', () => {
        bot.phase = 'matchmaking';
        socket.emit('findMatch', { playerName: `Bot_${id}`, playerScore: 1000, isRanked: true });
    });

    socket.on('matchFound', (data: { role: 'player1' | 'player2' }) => {
        bot.role  = data.role;
        bot.phase = 'draft';
    });

    socket.on('draftUpdate', (data: DraftData) => {
        handleDraft(bot, data);
    });

    socket.on('battleUpdate', (data: BattleData) => {
        handleBattle(bot, data);
    });

    socket.on('gameOver', () => {
        bot.phase = 'gameOver';
        bot.matchesPlayed++;
        totalMatchesFinished++;

        setTimeout(() => {
            if (socket.connected) {
                bot.phase = 'matchmaking';
                bot.role  = null;
                socket.emit('findMatch', { playerName: `Bot_${id}`, playerScore: 1000, isRanked: true });
            }
        }, REJOIN_DELAY_MS + Math.random() * 500);
    });

    socket.on('disconnect',    () => { bot.phase = 'connecting'; });
    socket.on('connect_error', () => { bot.phase = 'connecting'; });

    return bot;
}

// ─── pętla statusu (1 wiersz) ───────────────────────────────────────────────

function startStatusLoop(): void {
    setInterval(() => {
        const c: Record<Phase, number> = {
            connecting: 0, matchmaking: 0, draft: 0, battle: 0, gameOver: 0,
        };
        for (const b of bots) c[b.phase]++;

        const matches = Math.floor(totalMatchesFinished / 2);

        process.stdout.write(
            `\r[${NUM_BOTS} botow] ` +
            `Conn: ${c.connecting} | ` +
            `Queue: ${c.matchmaking} | ` +
            `Draft: ${c.draft} | ` +
            `Battle: ${c.battle} | ` +
            `Done: ${c.gameOver} | ` +
            `Mecze: ${matches}    `,
        );
    }, 500);
}

// ─── start ───────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
    console.log(`Stress test: ${NUM_BOTS} botow -> ${SERVER_URL}`);
    console.log('Laczenie (stagger co 10 botow)...\n');

    for (let i = 0; i < NUM_BOTS; i++) {
        bots.push(createBot(i));
        if (i % 10 === 9) {
            await new Promise<void>(r => setTimeout(r, CONNECT_STAGGER_MS));
        }
    }

    startStatusLoop();
}

main().catch(console.error);
