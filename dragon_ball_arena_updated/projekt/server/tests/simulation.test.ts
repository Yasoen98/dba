import { updateRatings } from '../src/elo';

describe('Season Simulation', () => {
    test('simulate 1000 games to ensure ELO stays balanced without inflation exploits', () => {
        const players = Array.from({ length: 100 }, (_, i) => ({ id: i, elo: 1000, wins: 0, losses: 0 }));

        for (let i = 0; i < 1000; i++) {
            // Pick two random players
            const p1Idx = Math.floor(Math.random() * players.length);
            let p2Idx = Math.floor(Math.random() * players.length);
            while (p1Idx === p2Idx) p2Idx = Math.floor(Math.random() * players.length);

            const p1 = players[p1Idx];
            const p2 = players[p2Idx];

            // Higher ELO has higher chance to win, but add some randomness
            const p1WinChance = 1 / (1 + Math.pow(10, (p2.elo - p1.elo) / 400));
            const p1Wins = Math.random() < p1WinChance;

            if (p1Wins) {
                const { newWinnerElo, newLoserElo } = updateRatings(p1.elo, p2.elo);
                p1.elo = newWinnerElo;
                p2.elo = newLoserElo;
                p1.wins++;
                p2.losses++;
            } else {
                const { newWinnerElo, newLoserElo } = updateRatings(p2.elo, p1.elo);
                p2.elo = newWinnerElo;
                p1.elo = newLoserElo;
                p2.wins++;
                p1.losses++;
            }
        }

        players.sort((a, b) => b.elo - a.elo);

        // Check that the average ELO is still roughly 1000 (no runaway inflation)
        const avgElo = players.reduce((sum, p) => sum + p.elo, 0) / players.length;
        expect(avgElo).toBeGreaterThan(990);
        expect(avgElo).toBeLessThan(1010);

        // Top player should have more wins than losses and high ELO
        expect(players[0].elo).toBeGreaterThan(1000);
        expect(players[0].wins).toBeGreaterThanOrEqual(players[0].losses);
    });
});
