import { createMatch, handleDraftPick, handleAction, getMatchBySocketId } from '../src/gameEngine';
import { Server } from 'socket.io';
import { INITIAL_CHARACTERS } from '../src/characters';
import type { QueueEntry } from '../src/matchmaking';

// Mock Socket
const mockSocket = (id: string) => ({
    id,
    join: jest.fn(),
    emit: jest.fn()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
} as any);

const mockIo = {
    to: jest.fn().mockReturnValue({ emit: jest.fn() }),
} as unknown as Server;

describe('Game Engine Core Logic', () => {
    let p1: QueueEntry;
    let p2: QueueEntry;
    const matchId = 'test-match-1';

    beforeEach(() => {
        p1 = { socketId: 's1', socket: mockSocket('s1'), playerName: 'Player 1', score: 1000, joinTime: Date.now(), isRanked: true };
        p2 = { socketId: 's2', socket: mockSocket('s2'), playerName: 'Player 2', score: 1000, joinTime: Date.now(), isRanked: true };
        createMatch(matchId, p1, p2);
    });

    test('creates match correctly in draft phase', () => {
        const match = getMatchBySocketId('s1');
        expect(match).toBeDefined();
        expect(match?.phase).toBe('draft');
        expect(match?.turnNumber).toBe(1);
    });

    test('handles draft picks and transitions to battle', () => {
        const c1 = INITIAL_CHARACTERS[0].id;
        const c2 = INITIAL_CHARACTERS[1].id;

        handleDraftPick(mockIo, p1.socket, c1);
        handleDraftPick(mockIo, p2.socket, c2);
        
        // Pick 2 more each
        handleDraftPick(mockIo, p1.socket, INITIAL_CHARACTERS[2].id);
        handleDraftPick(mockIo, p1.socket, INITIAL_CHARACTERS[3].id);
        
        handleDraftPick(mockIo, p2.socket, INITIAL_CHARACTERS[4].id);
        handleDraftPick(mockIo, p2.socket, INITIAL_CHARACTERS[5].id);

        const match = getMatchBySocketId('s1');
        expect(match?.phase).toBe('battle');
        expect(match?.p1.roster.length).toBe(3);
        expect(match?.p2.roster.length).toBe(3);
        expect(match?.p1.energy.ki).toBe(1); // Starting energy
    });

    test('handles passing turn correctly', () => {
        // Fast-forward draft
        for(let i=0; i<3; i++) handleDraftPick(mockIo, p1.socket, INITIAL_CHARACTERS[i].id);
        for(let i=0; i<3; i++) handleDraftPick(mockIo, p2.socket, INITIAL_CHARACTERS[i+3].id);

        const match = getMatchBySocketId('s1');
        expect(match?.whoseTurn).toBe('player1');

        handleAction(mockIo, p1.socket, { actionType: 'pass' });

        expect(match?.whoseTurn).toBe('player2');
        expect(match?.turnNumber).toBe(1);

        handleAction(mockIo, p2.socket, { actionType: 'pass' });
        
        expect(match?.whoseTurn).toBe('player1');
        expect(match?.turnNumber).toBe(2); // new round
        // Check energy regen (starting is 1, round 2 should be 2)
        expect(match?.p1.energy.ki).toBe(2);
    });

    test('handles technique attack correctly', () => {
        // Fast-forward draft
        for(let i=0; i<3; i++) handleDraftPick(mockIo, p1.socket, INITIAL_CHARACTERS[i].id);
        for(let i=0; i<3; i++) handleDraftPick(mockIo, p2.socket, INITIAL_CHARACTERS[i+3].id);

        const match = getMatchBySocketId('s1');
        if (!match) throw new Error("Match not found");
        
        const p1Char = match.p1.roster[0];
        const p2Char = match.p2.roster[0];
        const p2InitialHp = p2Char.currentHp;
        
        // Find a technique player 1 can afford
        // For simplicity, just give player 1 a lot of energy
        match.p1.energy = { ki: 10, physical: 10, special: 10, universal: 10 };
        const techId = p1Char.techniques[0].id;

        handleAction(mockIo, p1.socket, { actionType: 'technique', actionId: techId });

        expect(match.whoseTurn).toBe('player2');
        expect(match.p2.roster[0].currentHp).toBeLessThan(p2InitialHp);
    });
});
