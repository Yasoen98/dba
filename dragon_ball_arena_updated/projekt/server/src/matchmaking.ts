import { Server, Socket } from 'socket.io';
import { v4 as uuidv4 } from 'uuid';
import { createMatch } from './gameEngine';
import { getUserByName, updateUser } from './db';
import { updateRatings } from './elo';

export interface QueueEntry {
  socketId: string;
  playerName: string;
  score: number;
  socket: Socket;
  joinTime: number;
  isRanked: boolean;
}

let queue: QueueEntry[] = [];
let matchmakingInterval: NodeJS.Timeout | null = null;

export function handleFindMatch(io: Server, socket: Socket, playerName: string, score: number, isRanked: boolean = true) {
  // Prevent duplicate queue entries for the same socket
  if (queue.find(q => q.socketId === socket.id)) return;

  queue.push({ socketId: socket.id, playerName, score, socket, joinTime: Date.now(), isRanked });
  console.log(`Player ${playerName} (ELO: ${score}, Ranked: ${isRanked}) joined queue. Total: ${queue.length}`);

  // Próbuj dopasować od razu – eliminuje opóźnienie ticku przy rejoin
  tryMatchmaking(io);

  if (!matchmakingInterval) {
    matchmakingInterval = setInterval(() => tryMatchmaking(io), 2000);
  }
}

export function clearQueue(): { removed: number; names: string[] } {
  const names = queue.map(q => q.playerName);
  queue.forEach(q => q.socket.emit('queueCleared', { reason: 'admin' }));
  queue = [];
  if (matchmakingInterval) {
    clearInterval(matchmakingInterval);
    matchmakingInterval = null;
  }
  console.log(`[ADMIN] Queue cleared: ${names.length} players removed.`);
  return { removed: names.length, names };
}

export function getQueueState() {
  return queue.map(q => ({ name: q.playerName, score: q.score, isRanked: q.isRanked, waitMs: Date.now() - q.joinTime }));
}

export function handleDisconnect(socketId: string) {
  queue = queue.filter(q => q.socketId !== socketId);
  if (queue.length === 0 && matchmakingInterval) {
      clearInterval(matchmakingInterval);
      matchmakingInterval = null;
  }
}

function tryMatchmaking(io: Server) {
  if (queue.length < 2) return;

  const matched = new Set<string>();

  for (let i = 0; i < queue.length; i++) {
    const p1 = queue[i];
    if (matched.has(p1.socketId)) continue;

    for (let j = i + 1; j < queue.length; j++) {
      const p2 = queue[j];
      if (matched.has(p2.socketId)) continue;

      // Must both be either ranked or unranked (keeping this to separate queues, but ignoring ELO)
      if (p1.isRanked !== p2.isRanked) continue;

      // Don't match against self (by socket ID)
      if (p1.socketId === p2.socketId) continue;

      // ELO CHECK DISABLED FOR TESTING PHASE
      // Match immediately if two players are in the same queue type
      matchPlayers(io, p1, p2, matched);
      break;
    }
  }

  // Remove matched players from queue
  queue = queue.filter(q => !matched.has(q.socketId));
}
function matchPlayers(io: Server, p1: QueueEntry, p2: QueueEntry, matched: Set<string>) {
    matched.add(p1.socketId);
    matched.add(p2.socketId);

    const matchId = uuidv4();
    console.log(`Match created (${p1.isRanked ? 'RANKED' : 'UNRANKED'}): ${matchId} (${p1.playerName} vs ${p2.playerName})`);

    p1.socket.join(matchId);
    p2.socket.join(matchId);

    createMatch(matchId, p1, p2, p1.isRanked);

    p1.socket.emit('matchFound', { matchId, role: 'player1', opponentName: p2.playerName });
    p2.socket.emit('matchFound', { matchId, role: 'player2', opponentName: p1.playerName });

    // Wyślij początkowy stan draftu – player1 zawsze zaczyna
    io.to(matchId).emit('draftUpdate', {
        player1Roster: [],
        player2Roster: [],
        nextTurn: 'player1',
    });
}

export function onMatchEnd(io: Server, p1Name: string, p2Name: string, winnerRole: 'player1' | 'player2' | 'draw' | null, isRanked: boolean) {
    if (!isRanked || winnerRole === 'draw' || winnerRole === null) return;

    const u1 = getUserByName(p1Name);
    const u2 = getUserByName(p2Name);

    if (u1 && u2) {
        const p1Won = winnerRole === 'player1';
        const winner = p1Won ? u1 : u2;
        const loser = p1Won ? u2 : u1;

        const { newWinnerElo, newLoserElo } = updateRatings(winner.score, loser.score);

        const wWinStreak = (winner.winStreak || 0) + 1;
        const wBestStreak = Math.max(winner.bestStreak || 0, wWinStreak);

        updateUser(winner.id, {
            score: newWinnerElo,
            wins: (winner.wins || 0) + 1,
            winStreak: wWinStreak,
            bestStreak: wBestStreak
        });

        updateUser(loser.id, {
            score: newLoserElo,
            losses: (loser.losses || 0) + 1,
            winStreak: 0
        });

        console.log(`Elo Updated: ${winner.name} ${winner.score}->${newWinnerElo} | ${loser.name} ${loser.score}->${newLoserElo}`);
    }
}
