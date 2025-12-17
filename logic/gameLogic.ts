
import { Tile, Difficulty } from '../types';

export const createDeck = (): Tile[] => {
  const deck: Tile[] = [];
  for (let i = 0; i <= 6; i++) {
    for (let j = i; j <= 6; j++) {
      deck.push([i, j]);
    }
  }
  return deck;
};

export const shuffle = (deck: Tile[]): Tile[] => {
  const newDeck = [...deck];
  for (let i = newDeck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newDeck[i], newDeck[j]] = [newDeck[j], newDeck[i]];
  }
  return newDeck;
};

export const getPossiblePlacements = (tile: Tile, board: Tile[]): ('start' | 'end')[] => {
  if (board.length === 0) return ['start'];
  
  const results: ('start' | 'end')[] = [];
  const startVal = board[0][0];
  const endVal = board[board.length - 1][1];

  // Vérifier si le domino peut aller au début
  if (tile[0] === startVal || tile[1] === startVal) results.push('start');
  // Vérifier si le domino peut aller à la fin
  if (tile[0] === endVal || tile[1] === endVal) results.push('end');
  
  return Array.from(new Set(results));
};

export const canPlay = (tile: Tile, board: Tile[]): 'start' | 'end' | null => {
  const placements = getPossiblePlacements(tile, board);
  return placements.length > 0 ? placements[0] : null;
};

export const getValidMoves = (hand: Tile[], board: Tile[]): { tile: Tile, position: 'start' | 'end' }[] => {
  const moves: { tile: Tile, position: 'start' | 'end' }[] = [];
  hand.forEach(tile => {
    const placements = getPossiblePlacements(tile, board);
    placements.forEach(pos => {
      moves.push({ tile, position: pos });
    });
  });
  return moves;
};

export const calculateScore = (hand: Tile[]): number => {
  return hand.reduce((sum, tile) => sum + tile[0] + tile[1], 0);
};

export const findStartingInfo = (playerHand: Tile[], aiHand: Tile[], aiName: string): { player: 'player' | 'ai', message: string, startingTile: Tile } => {
  for (let i = 6; i >= 0; i--) {
    const pDouble = playerHand.find(t => t[0] === i && t[1] === i);
    if (pDouble) return { player: 'player', message: i === 6 ? "Tu as le Double 6, tu commences !" : `Personne n'a de Double plus haut, tu commences avec le Double ${i} !`, startingTile: pDouble };
    
    const aDouble = aiHand.find(t => t[0] === i && t[1] === i);
    if (aDouble) return { player: 'ai', message: i === 6 ? `${aiName} a le Double 6 et commence.` : `Personne n'a de Double plus haut, ${aiName} commence avec le Double ${i}.`, startingTile: aDouble };
  }

  const getHighTile = (hand: Tile[]) => {
    return [...hand].sort((a, b) => {
      const sumA = a[0] + a[1];
      const sumB = b[0] + b[1];
      if (sumA !== sumB) return sumB - sumA;
      return Math.max(b[0], b[1]) - Math.max(a[0], a[1]);
    })[0];
  };

  const pHigh = getHighTile(playerHand);
  const aHigh = getHighTile(aiHand);

  const sumP = pHigh[0] + pHigh[1];
  const sumA = aHigh[0] + aHigh[1];

  if (sumP > sumA || (sumP === sumA && Math.max(pHigh[0], pHigh[1]) > Math.max(aHigh[0], aHigh[1]))) {
    return { player: 'player', message: `Pas de doubles ! Tu commences avec ton plus gros domino (${pHigh[0]}-${pHigh[1]}).`, startingTile: pHigh };
  } else {
    return { player: 'ai', message: `Pas de doubles ! ${aiName} commence avec son plus gros domino (${aHigh[0]}-${aHigh[1]}).`, startingTile: aHigh };
  }
};

export const getAIMove = (hand: Tile[], board: Tile[], difficulty: Difficulty): { tile: Tile, position: 'start' | 'end' } | null => {
  const validMoves = getValidMoves(hand, board);
  if (validMoves.length === 0) return null;

  if (difficulty === Difficulty.EASY) {
    return validMoves[Math.floor(Math.random() * validMoves.length)];
  }

  if (difficulty === Difficulty.MEDIUM) {
    // Jouer le plus gros score
    return validMoves.sort((a, b) => (b.tile[0] + b.tile[1]) - (a.tile[0] + a.tile[1]))[0];
  }

  if (difficulty === Difficulty.HARD) {
    // Stratégie de contrôle des extrémités
    const doubles = validMoves.filter(m => m.tile[0] === m.tile[1]);
    if (doubles.length > 0) return doubles.sort((a, b) => (b.tile[0] + b.tile[1]) - (a.tile[0] + a.tile[1]))[0];

    const counts: Record<number, number> = {};
    hand.forEach(t => {
      counts[t[0]] = (counts[t[0]] || 0) + 1;
      counts[t[1]] = (counts[t[1]] || 0) + 1;
    });

    return validMoves.sort((a, b) => {
      const startVal = board.length > 0 ? board[0][0] : -1;
      const endVal = board.length > 0 ? board[board.length - 1][1] : -1;

      const getRemainingVal = (m: {tile: Tile, position: 'start' | 'end'}) => {
        if (m.position === 'start') return m.tile[0] === startVal ? m.tile[1] : m.tile[0];
        return m.tile[0] === endVal ? m.tile[1] : m.tile[0];
      };

      const scoreA = (counts[getRemainingVal(a)] || 0) + (a.tile[0] + a.tile[1]) / 20;
      const scoreB = (counts[getRemainingVal(b)] || 0) + (b.tile[0] + b.tile[1]) / 20;

      return scoreB - scoreA;
    })[0];
  }

  return validMoves[0];
};
