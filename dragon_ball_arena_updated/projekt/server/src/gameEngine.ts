import { Server, Socket } from 'socket.io';
import { INITIAL_CHARACTERS } from './characters';
import { BattleCharacter, PlayerEnergy, CombatLogEntry, Character, EffectType, ActionCost } from './types';
import type { QueueEntry } from './matchmaking';

interface MatchState {
  id: string;
  p1: {
    socketId: string;
    socket: Socket;
    playerName: string;
    score: number;
    rosterIds: string[];
    roster: BattleCharacter[];
    energy: PlayerEnergy;
    activeIndex: number;
    actionsUsed: Record<number, boolean>;
    ready: boolean;
  };
  p2: {
    socketId: string;
    socket: Socket;
    playerName: string;
    score: number;
    rosterIds: string[];
    roster: BattleCharacter[];
    energy: PlayerEnergy;
    activeIndex: number;
    actionsUsed: Record<number, boolean>;
    ready: boolean;
  };
  phase: 'draft' | 'battle' | 'gameOver';
  turnNumber: number;
  whoseTurn: 'player1' | 'player2';
  winner: 'player1' | 'player2' | 'draw' | null;
  combatLogs: CombatLogEntry[];
  isRanked: boolean;
}

const matches = new Map<string, MatchState>();

export function createMatch(id: string, p1: QueueEntry, p2: QueueEntry, isRanked: boolean = true) {
  matches.set(id, {
    id,
    p1: { ...p1, rosterIds: [], roster: [], energy: { ki: 0, physical: 0, special: 0, universal: 0 }, activeIndex: 0, actionsUsed: {}, ready: false },
    p2: { ...p2, rosterIds: [], roster: [], energy: { ki: 0, physical: 0, special: 0, universal: 0 }, activeIndex: 0, actionsUsed: {}, ready: false },
    phase: 'draft',
    turnNumber: 1,
    whoseTurn: 'player1',
    winner: null,
    combatLogs: [],
    isRanked
  });
}

export function getMatchBySocketId(socketId: string): MatchState | undefined {
  for (const match of matches.values()) {
    if (match.p1.socketId === socketId || match.p2.socketId === socketId) return match;
  }
  return undefined;
}

export function handleDisconnect(io: Server, socketId: string) {
  const match = getMatchBySocketId(socketId);
  if (!match) return;

  const winner = match.p1.socketId === socketId ? 'player2' : 'player1';
  match.winner = winner;
  match.phase = 'gameOver';

  io.to(match.id).emit('battleUpdate', sanitizeMatchState(match));
  io.to(match.id).emit('gameOver', { winner: match.winner, reason: 'disconnect' });
  
  import('./matchmaking').then(m => m.onMatchEnd(io, match.p1.playerName, match.p2.playerName, match.winner, match.isRanked));
  matches.delete(match.id);
}

export function handleSurrender(io: Server, socket: Socket) {
  const match = getMatchBySocketId(socket.id);
  if (!match) return;

  const winner = match.p1.socketId === socket.id ? 'player2' : 'player1';
  match.winner = winner;
  match.phase = 'gameOver';

  io.to(match.id).emit('battleUpdate', sanitizeMatchState(match));
  io.to(match.id).emit('gameOver', { winner: match.winner, reason: 'surrender' });
  
  import('./matchmaking').then(m => m.onMatchEnd(io, match.p1.playerName, match.p2.playerName, match.winner, match.isRanked));
  matches.delete(match.id);
}

export function handleDraftPick(io: Server, socket: Socket, charId: string) {
  const match = getMatchBySocketId(socket.id);
  if (!match || match.phase !== 'draft') return;

  const role = match.p1.socketId === socket.id ? 'p1' : 'p2';
  const player = match[role];

  if (player.rosterIds.length < 3) {
    player.rosterIds.push(charId);
    
    io.to(match.id).emit('draftUpdate', {
      player1Roster: match.p1.rosterIds,
      player2Roster: match.p2.rosterIds,
      nextTurn: match.p1.rosterIds.length > match.p2.rosterIds.length ? 'player2' : 'player1'
    });

    if (match.p1.rosterIds.length === 3 && match.p2.rosterIds.length === 3) {
      startBattle(io, match);
    }
  }
}

function startBattle(io: Server, match: MatchState) {
  match.phase = 'battle';
  
  const initRoster = (ids: string[]): BattleCharacter[] => {
    return ids.map(id => {
      const base = INITIAL_CHARACTERS.find(c => c.id === id) as Character;
      return {
        ...base,
        currentHp: base.maxHp,
        cooldowns: {},
        statusEffects: []
      };
    });
  };

  match.p1.roster = initRoster(match.p1.rosterIds);
  match.p2.roster = initRoster(match.p2.rosterIds);

  match.p1.energy = { ki: 1, physical: 1, special: 1, universal: 0 };
  match.p2.energy = { ki: 1, physical: 1, special: 1, universal: 0 };

  match.combatLogs.push({
    id: Date.now(),
    turn: 1,
    playerName: 'System',
    characterName: '',
    action: 'Battle Start',
    details: 'The battle begins!',
    isOpponent: false
  });

  io.to(match.id).emit('battleUpdate', sanitizeMatchState(match));
}

// Basic cost check
function canAfford(energy: PlayerEnergy, cost: ActionCost): boolean {
  let u = energy.universal || 0;
  let ki = energy.ki || 0;
  let ph = energy.physical || 0;
  let sp = energy.special || 0;

  const pay = (needed: number, available: number) => {
    // Use Universal first as requested
    const fromU = Math.min(u, needed);
    u -= fromU;
    needed -= fromU;
    
    // Use specific energy if needed remains
    const fromSpecific = Math.min(available, needed);
    needed -= fromSpecific;
    return { needed, remaining: available - fromSpecific };
  };

  const resKi = pay(cost.ki || 0, ki);
  if (resKi.needed > 0) return false;

  const resPh = pay(cost.physical || 0, ph);
  if (resPh.needed > 0) return false;

  const resSp = pay(cost.special || 0, sp);
  if (resSp.needed > 0) return false;

  const totalAnyAvailable = u + resKi.remaining + resPh.remaining + resSp.remaining;
  if (totalAnyAvailable < (cost.any || 0)) return false;

  return true;
}

function payCost(energy: PlayerEnergy, cost: ActionCost) {
  const deduct = (needed: number, type: keyof PlayerEnergy) => {
    // Deduct from Universal first
    const fromU = Math.min(energy.universal || 0, needed);
    energy.universal = (energy.universal || 0) - fromU;
    needed -= fromU;
    
    // Deduct remaining from specific type
    if (needed > 0) {
      energy[type] -= needed;
    }
  };

  deduct(cost.ki || 0, 'ki');
  deduct(cost.physical || 0, 'physical');
  deduct(cost.special || 0, 'special');

  let anyAmount = cost.any || 0;
  // Use Universal first for 'any'
  const fromU = Math.min(energy.universal || 0, anyAmount);
  energy.universal = (energy.universal || 0) - fromU;
  anyAmount -= fromU;

  // Then use Ki, Physical, Special in order for remaining 'any'
  const types: (keyof PlayerEnergy)[] = ['ki', 'physical', 'special'];
  for (const t of types) {
    if (anyAmount <= 0) break;
    const fromType = Math.min(energy[t] || 0, anyAmount);
    energy[t] = (energy[t] || 0) - fromType;
    anyAmount -= fromType;
  }
}

export function handleAction(io: Server, socket: Socket, data: { actionType: 'technique' | 'dodge' | 'pass' | 'switchCharacter' | 'changeTarget', actionId?: string }) {
  const match = getMatchBySocketId(socket.id);
  if (!match || match.phase !== 'battle') return;

  const role = match.p1.socketId === socket.id ? 'player1' : 'player2';
  
  const player = match[role === 'player1' ? 'p1' : 'p2'];
  const opponent = match[role === 'player1' ? 'p2' : 'p1'];

  // A player can change their target at any point, even if it's not their turn
  if (data.actionType === 'changeTarget') {
     const newIndex = parseInt(data.actionId || '0', 10);
     if (!isNaN(newIndex) && opponent.roster[newIndex] && opponent.roster[newIndex].currentHp > 0) {
         opponent.activeIndex = newIndex;
         io.to(match.id).emit('battleUpdate', sanitizeMatchState(match));
     }
     return;
  }

  // But for actual actions, it MUST be their turn
  if (match.whoseTurn !== role) return;

  if (data.actionType === 'switchCharacter') {
     const newIndex = parseInt(data.actionId || '0', 10);
     if (!isNaN(newIndex) && player.roster[newIndex] && player.roster[newIndex].currentHp > 0) {
         player.activeIndex = newIndex;
         io.to(match.id).emit('battleUpdate', sanitizeMatchState(match));
     }
     return;
  }

  const activeIdx = player.activeIndex;
  const pChar = player.roster[activeIdx];
  const oChar = opponent.roster[opponent.activeIndex];

  // Check if character is stunned
  const isStunned = pChar.statusEffects.some(e => e.effect === 'stun');
  if (isStunned && data.actionType !== 'pass') {
      return; // Stunned character can only pass (or wait for automatic pass)
  }

  if (data.actionType === 'pass') {
    // End the turn completely for this player
    // Apply end-of-turn effects (poison, bleed, regen)
    player.roster.forEach(c => {
        if (c.currentHp <= 0) return;
        
        c.statusEffects.forEach(se => {
            if (se.effect === 'poison') {
                const dmgValue = Math.floor(c.maxHp * 0.05);
                c.currentHp = Math.max(0, c.currentHp - dmgValue);
            } else if (se.effect === 'bleed') {
                const dmgValue = Math.floor(c.maxHp * 0.07);
                c.currentHp = Math.max(0, c.currentHp - dmgValue);
            } else if (se.effect === 'regen') {
                const heal = Math.floor(c.maxHp * 0.06);
                c.currentHp = Math.min(c.maxHp, c.currentHp + heal);
            }
        });

        // Decrement status effect durations
        c.statusEffects = c.statusEffects.map(se => ({ ...se, duration: se.duration - 1 })).filter(se => se.duration > 0);
        
        // Decrement cooldowns
        Object.keys(c.cooldowns).forEach(key => {
            if (c.cooldowns[key] > 0) c.cooldowns[key]--;
        });
    });

    match.whoseTurn = role === 'player1' ? 'player2' : 'player1';
    
    // Reset player actions used
    player.actionsUsed = {};

    if (match.whoseTurn === 'player1') {
      match.turnNumber++;
      // Add energy for new round
      ['ki', 'physical', 'special'].forEach(type => {
          if (match.p1.energy[type as keyof PlayerEnergy] < 5) match.p1.energy[type as keyof PlayerEnergy]++;
          if (match.p2.energy[type as keyof PlayerEnergy] < 5) match.p2.energy[type as keyof PlayerEnergy]++;
      });

      // Check max turns limit
      if (match.turnNumber > 20) {
        match.winner = 'draw';
        match.phase = 'gameOver';
        io.to(match.id).emit('battleUpdate', sanitizeMatchState(match));
        io.to(match.id).emit('gameOver', { winner: 'draw', reason: 'turn_limit' });
        matches.delete(match.id);
        return;
      }
    }
    
    io.to(match.id).emit('battleUpdate', sanitizeMatchState(match));
    return;
  } 
  
  if (player.actionsUsed[activeIdx]) {
      // Character already acted this turn
      return;
  }

  if (data.actionType === 'technique') {
     const tech = pChar.techniques.find(t => t.id === data.actionId);
     const cdValue = pChar.cooldowns[tech?.id || ''] || 0;

     if (tech && cdValue === 0 && canAfford(player.energy, tech.cost)) {
        payCost(player.energy, tech.cost);
        player.actionsUsed[activeIdx] = true;
        if (tech.cooldown > 0) pChar.cooldowns[tech.id] = tech.cooldown;
        
        let dmgCalculated = 0;
        const actionName = tech.name;
        let logDetail = '';

        if (tech.effect === 'heal') {
            const healAmt = Math.max(1, Math.floor(pChar.maxHp * 0.25));
            pChar.currentHp = Math.min(pChar.maxHp, pChar.currentHp + healAmt);
            logDetail = `${pChar.name} used ${actionName}. Heals for ${healAmt} HP!`;
        } else if (tech.effect === 'healAll') {
            let totalHeal = 0;
            player.roster.forEach((c) => {
                if (c.currentHp > 0) {
                    const healAmt = Math.max(1, Math.floor(c.maxHp * 0.20));
                    totalHeal += healAmt;
                    c.currentHp = Math.min(c.maxHp, c.currentHp + healAmt);
                }
            });
            logDetail = `${pChar.name} used ${actionName}. Heals all allies for ${totalHeal} total HP!`;
        } else if (tech.effect === 'clear') {
            const before = pChar.statusEffects.length;
            pChar.statusEffects = pChar.statusEffects.filter(
                se => !['poison', 'bleed', 'weaken', 'stun'].includes(se.effect),
            );
            const cleared = before - pChar.statusEffects.length;
            logDetail = cleared > 0 ? `${pChar.name} used ${actionName}. Cleared ${cleared} negative effect(s)!` : `${pChar.name} used ${actionName}. Nothing to clear.`;
        } else if (tech.effect === 'energy') {
            player.energy.universal += 2;
            logDetail = `${pChar.name} used ${actionName}. Gained energy boost!`;
        } else if (tech.effect === 'senzu') {
            const durValue = tech.effectDuration ?? 1;
            pChar.statusEffects.push({ effect: 'senzu', duration: durValue });
            logDetail = `${pChar.name} used ${actionName}. Gains a damage boost for ${durValue} turn(s)!`;
        } else if (tech.effect === 'buff' || tech.effect === 'regen') {
            const durValue = tech.effectDuration ?? 1;
            pChar.statusEffects.push({ effect: tech.effect as EffectType, duration: durValue });
            logDetail = tech.effect === 'buff' ? `${pChar.name} is BUFFED!` : `${pChar.name} will regenerate HP.`;
        } else {
            // Attack logic against opponent
            // Calculate base damage
            if (tech.effect === 'pierce') {
                dmgCalculated = tech.damage;
            } else {
                dmgCalculated = Math.floor(tech.damage * (pChar.stats.attack / oChar.stats.defense));
            }

            // Passive modifiers
            if (pChar.passive?.id === 'first_strike' && (pChar.passiveStacks || 0) === 0) {
                pChar.passiveStacks = 1;
                dmgCalculated = Math.floor(dmgCalculated * 1.5);
            }
            if (pChar.passive?.id === 'low_class_fury' && pChar.currentHp < pChar.maxHp * 0.3) {
                dmgCalculated = Math.floor(dmgCalculated * 1.4);
            }

            if (tech.effect === 'drain') {
                if (pChar.passive?.id === 'monster_transform') dmgCalculated = Math.floor(dmgCalculated * 1.25);
                oChar.currentHp = Math.max(0, oChar.currentHp - dmgCalculated);
                const healVal = Math.floor(dmgCalculated * 0.5);
                pChar.currentHp = Math.min(pChar.maxHp, pChar.currentHp + healVal);
                logDetail = `${pChar.name} used ${actionName}. Deals ${dmgCalculated} damage and drains ${healVal} HP!`;
            } else if (tech.effect === 'aoe') {
                let totalDeals = 0;
                if (pChar.passive?.id === 'ghost_army') dmgCalculated = Math.floor(dmgCalculated * 1.20);
                opponent.roster.forEach(c => {
                    if (c.currentHp > 0) {
                        c.currentHp = Math.max(0, c.currentHp - dmgCalculated);
                        totalDeals += dmgCalculated;
                    }
                });
                logDetail = `${pChar.name} used ${actionName}. Deals ${totalDeals} total damage to all opponents!`;
            } else {
                oChar.currentHp = Math.max(0, oChar.currentHp - dmgCalculated);
                logDetail = `${pChar.name} used ${actionName}. Deals ${dmgCalculated} damage!`;
                
                // Status effects
                const durValue = tech.effectDuration ?? 1;
                if (['weaken', 'poison', 'bleed', 'stun'].includes(tech.effect)) {
                    oChar.statusEffects.push({ effect: tech.effect as EffectType, duration: durValue });
                    logDetail += ` ${oChar.name} is ${tech.effect.toUpperCase()}ED!`;
                }
            }
        }
        
        match.combatLogs.push({
            id: Date.now(),
            turn: match.turnNumber,
            playerName: player.playerName,
            characterName: pChar.name,
            action: tech.name,
            details: logDetail,
            isOpponent: role === 'player2'
        });
     } else {
        return; 
     }
  } else if (data.actionType === 'dodge') {
      const cdValue = pChar.cooldowns['dodge'] || 0;
      if (cdValue === 0 && canAfford(player.energy, pChar.dodge.cost)) {
          payCost(player.energy, pChar.dodge.cost);
          player.actionsUsed[activeIdx] = true;
          pChar.cooldowns['dodge'] = pChar.dodge.cooldown;
          
          match.combatLogs.push({
              id: Date.now(),
              turn: match.turnNumber,
              playerName: player.playerName,
              characterName: pChar.name,
              action: 'Dodge Preparation',
              details: 'Prepared to dodge next attack.',
              isOpponent: role === 'player2'
          });
      } else {
          return;
      }
  }

  // Check win condition
  if (opponent.roster.every(c => c.currentHp <= 0)) {
    match.winner = role;
    match.phase = 'gameOver';
    io.to(match.id).emit('battleUpdate', sanitizeMatchState(match));
    io.to(match.id).emit('gameOver', { winner: match.winner, reason: 'defeat' });
    
    import('./matchmaking').then(m => m.onMatchEnd(io, match.p1.playerName, match.p2.playerName, match.winner, match.isRanked));
    matches.delete(match.id);
    return;
  }

  // Check next char if current dead
  if (opponent.roster[opponent.activeIndex].currentHp <= 0) {
    const nextActiveIndex = opponent.roster.findIndex(c => c.currentHp > 0);
    if (nextActiveIndex !== -1) {
        opponent.activeIndex = nextActiveIndex;
    }
  }

  io.to(match.id).emit('battleUpdate', sanitizeMatchState(match));
}

function sanitizeMatchState(match: MatchState) {
  return {
    id: match.id,
    phase: match.phase,
    turnNumber: match.turnNumber,
    whoseTurn: match.whoseTurn,
    winner: match.winner,
    combatLogs: match.combatLogs,
    isRanked: match.isRanked,
    p1: {
      playerName: match.p1.playerName,
      score: match.p1.score,
      roster: match.p1.roster,
      energy: match.p1.energy,
      activeIndex: match.p1.activeIndex,
      actionsUsed: match.p1.actionsUsed
    },
    p2: {
      playerName: match.p2.playerName,
      score: match.p2.score,
      roster: match.p2.roster,
      energy: match.p2.energy,
      activeIndex: match.p2.activeIndex,
      actionsUsed: match.p2.actionsUsed
    }
  };
}
