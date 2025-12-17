
import { Character, Difficulty } from './types';

export const CHARACTERS: Record<Difficulty, Character> = {
  [Difficulty.EASY]: {
    name: 'uwu',
    difficulty: Difficulty.EASY,
    description: 'Une petite fille calme et mignonne.',
    personality: 'Extremely sweet, calm, uses "uwu" and "owo" occasionally. She is peaceful and supportive. Soft-spoken and loves pink.',
    avatar: 'https://api.dicebear.com/9.x/fun-emoji/svg?seed=uwu&backgroundColor=ffb6c1',
    color: 'border-pink-300 shadow-sm bg-pink-50',
    nameColor: 'text-pink-500',
    tileStyle: 'uwu-style'
  },
  [Difficulty.MEDIUM]: {
    name: 'Bomba',
    difficulty: Difficulty.MEDIUM,
    description: 'Un gribouillis en colère qui crie !',
    personality: 'Aggressive, raging, impatient, arrogant. He acts like a spoiled kid who hates losing. Lots of caps and trash talk.',
    avatar: 'https://api.dicebear.com/9.x/fun-emoji/svg?seed=bomba&backgroundColor=ffdfbf',
    color: 'border-orange-400 shadow-sm bg-white',
    nameColor: 'text-orange-600',
    tileStyle: 'bomba-style'
  },
  [Difficulty.HARD]: {
    name: 'Claat',
    difficulty: Difficulty.HARD,
    description: 'Un démon cauchemardesque.',
    personality: 'Sinister, cold, demonic monster. He treats the game like a dark ritual. Creepy, dark, and very strategic.',
    avatar: 'https://api.dicebear.com/9.x/fun-emoji/svg?seed=evil&backgroundColor=4c1d95',
    color: 'border-purple-900 shadow-xl bg-slate-900 text-white',
    nameColor: 'text-purple-900', // Plus sombre pour plus de contraste sur fond blanc/gris
    tileStyle: 'claat-style'
  }
};

export const MAX_SCORE = 100;
