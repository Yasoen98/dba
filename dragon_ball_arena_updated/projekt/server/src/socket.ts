import { Server, Socket } from 'socket.io';
import { handleFindMatch, handleDisconnect as matchmakingDisconnect } from './matchmaking';
import { handleAction, handleDraftPick, handleSurrender, handleDisconnect as gameDisconnect } from './gameEngine';

export function initSocket(io: Server) {
  io.on('connection', (socket: Socket) => {
    console.log(`Socket connected: ${socket.id}`);

    // Matchmaking
    socket.on('findMatch', (data: { playerName: string, playerScore: number, isRanked?: boolean }) => {
      handleFindMatch(io, socket, data.playerName, data.playerScore, data.isRanked ?? true);
    });

    // Draft Phase
    socket.on('selectCharacter', (data: { charId: string }) => {
      handleDraftPick(io, socket, data.charId);
    });

    // Battle Actions
    socket.on('selectAction', (data: { actionType: 'technique' | 'dodge' | 'pass', actionId?: string }) => {
      handleAction(io, socket, data);
    });

    socket.on('surrender', () => {
      handleSurrender(io, socket);
    });

    // Disconnect
    socket.on('disconnect', () => {
      console.log(`Socket disconnected: ${socket.id}`);
      matchmakingDisconnect(socket.id);
      gameDisconnect(io, socket.id);
    });
  });
}
