
export type Tile = [number, number];

export enum Difficulty {
  EASY = 'facile',
  MEDIUM = 'moyen',
  HARD = 'difficile'
}

export interface Character {
  name: string;
  difficulty: Difficulty;
  description: string;
  personality: string;
  avatar: string;
  color: string;
  tileStyle: string;
}

export interface GameState {
  playerHand: Tile[];
  aiHand: Tile[];
  board: Tile[]; 
  boneyard: Tile[];
  currentPlayer: 'player' | 'ai';
  playerScore: number;
  aiScore: number;
  targetScore: number;
  isGameOver: boolean;
  winner: 'player' | 'ai' | null;
  actions: string[];
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}
