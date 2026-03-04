export function calculateExpectedScore(ratingA: number, ratingB: number): number {
  return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
}

export function calculateNewRating(rating: number, actualScore: number, expectedScore: number, kFactor: number = 32): number {
  return Math.round(rating + kFactor * (actualScore - expectedScore));
}

export function updateRatings(winnerElo: number, loserElo: number, kFactor: number = 32) {
  const expectedWinner = calculateExpectedScore(winnerElo, loserElo);
  const expectedLoser = calculateExpectedScore(loserElo, winnerElo);

  const newWinnerElo = calculateNewRating(winnerElo, 1, expectedWinner, kFactor);
  const newLoserElo = calculateNewRating(loserElo, 0, expectedLoser, kFactor);

  return { newWinnerElo, newLoserElo };
}

export function getRankByElo(elo: number): string {
    if (elo < 1000) return 'Bronze';
    if (elo < 1500) return 'Silver';
    if (elo < 2000) return 'Gold';
    return 'Diamond';
}
