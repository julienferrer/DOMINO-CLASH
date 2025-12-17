
import { Character, Difficulty } from './types';

export const CHARACTERS: Record<Difficulty, Character> = {
  [Difficulty.EASY]: {
    name: 'Yosu',
    difficulty: Difficulty.EASY,
    description: 'Une petite fille calme et mignonne tout en rose.',
    personality: 'Extremely sweet, calm, uses "uwu" and "owo" occasionally. She is peaceful and supportive. Soft-spoken and loves pink.',
    avatar: 'https://api.dicebear.com/9.x/fun-emoji/svg?seed=uwu&backgroundColor=ffb6c1',
    color: 'border-pink-300 shadow-sm bg-pink-50',
    tileStyle: 'uwu-style'
  },
  [Difficulty.MEDIUM]: {
    name: 'Bomba',
    difficulty: Difficulty.MEDIUM,
    description: 'Un gribouillis en colère qui crie tout le temps !',
    personality: 'Aggressive, raging, impatient, arrogant. He acts like a spoiled kid who hates losing. Lots of caps and trash talk.',
    avatar: 'https://api.dicebear.com/9.x/fun-emoji/svg?seed=bomba&backgroundColor=ffdfbf',
    color: 'border-orange-400 shadow-sm bg-white',
    tileStyle: 'bomba-style'
  },
  [Difficulty.HARD]: {
    name: 'Claat',
    difficulty: Difficulty.HARD,
    description: 'Un démon cornu sorti tout droit d\'un dessin cauchemardesque.',
    personality: 'Sinister, cold, demonic monster. He treats the game like a dark ritual. Creepy, dark, and very strategic.',
    avatar: 'https://api.dicebear.com/9.x/fun-emoji/svg?seed=evil&backgroundColor=d4adfc',
    color: 'border-purple-900 shadow-sm bg-slate-900 text-white',
    tileStyle: 'claat-style'
  }
};

export const MAX_SCORE = 100;
