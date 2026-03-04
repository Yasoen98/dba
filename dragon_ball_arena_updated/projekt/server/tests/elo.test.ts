import { calculateExpectedScore, updateRatings, getRankByElo } from '../src/elo';

describe('ELO System', () => {
    test('calculateExpectedScore returns correct probabilities', () => {
        expect(calculateExpectedScore(1000, 1000)).toBe(0.5);
        expect(calculateExpectedScore(1200, 1000)).toBeGreaterThan(0.5);
        expect(calculateExpectedScore(1000, 1200)).toBeLessThan(0.5);
    });

    test('updateRatings calculates new ELO properly', () => {
        const { newWinnerElo, newLoserElo } = updateRatings(1000, 1000);
        expect(newWinnerElo).toBe(1016); // 1000 + 32 * (1 - 0.5)
        expect(newLoserElo).toBe(984);  // 1000 + 32 * (0 - 0.5)
    });

    test('updateRatings handles upset correctly', () => {
        // Lower rated player beats higher rated player
        const { newWinnerElo, newLoserElo } = updateRatings(1000, 1200);
        expect(newWinnerElo).toBeGreaterThan(1016); // Should gain more than 16 points
        expect(newLoserElo).toBeLessThan(1184); // Should lose more than 16 points
    });

    test('getRankByElo assigns correct leagues', () => {
        expect(getRankByElo(500)).toBe('Bronze');
        expect(getRankByElo(999)).toBe('Bronze');
        expect(getRankByElo(1000)).toBe('Silver');
        expect(getRankByElo(1499)).toBe('Silver');
        expect(getRankByElo(1500)).toBe('Gold');
        expect(getRankByElo(1999)).toBe('Gold');
        expect(getRankByElo(2000)).toBe('Diamond');
        expect(getRankByElo(2500)).toBe('Diamond');
    });
});
