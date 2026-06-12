export type GameModeId = 'classic' | 'sprint' | 'expert';

export interface GameMode {
  id: GameModeId;
  name: string;
  label: string;
  description: string;
  detail: string;
}

export interface PresetPair {
  start: string;
  goal: string;
}

export const GAME_MODES: GameMode[] = [
  {
    id: 'classic',
    name: 'Classic',
    label: 'Balanced',
    description: 'Random articles with enough links to keep the route fair.',
    detail: 'Best first run',
  },
  {
    id: 'sprint',
    name: 'Sprint',
    label: 'Curated',
    description: 'Familiar start and target pairs for quick, readable races.',
    detail: 'Fastest starts',
  },
  {
    id: 'expert',
    name: 'Deep Cut',
    label: 'Harder',
    description: 'A wider random draw for stranger article combinations.',
    detail: 'Unpredictable',
  },
];

export const PRESET_PAIRS: PresetPair[] = [
  { start: 'Solar System', goal: 'Mars' },
  { start: 'World War II', goal: 'Winston Churchill' },
  { start: 'Apple Inc.', goal: 'Steve Jobs' },
  { start: 'Internet', goal: 'World Wide Web' },
  { start: 'Ancient Rome', goal: 'Julius Caesar' },
  { start: 'Association football', goal: 'FIFA World Cup' },
  { start: 'Film', goal: 'Academy Awards' },
  { start: 'Computer', goal: 'Artificial intelligence' },
];

export function getGameMode(id: GameModeId): GameMode {
  return GAME_MODES.find((mode) => mode.id === id) ?? GAME_MODES[0];
}

export function getRandomPresetPair(): PresetPair {
  return PRESET_PAIRS[Math.floor(Math.random() * PRESET_PAIRS.length)];
}
