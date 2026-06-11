const STORAGE_KEY = 'wikigame_leaderboard';

export interface LeaderboardEntry {
  id: string;
  name: string;
  wins: number;
  losses: number;
  totalGames: number;
  bestTime: number;
  bestClicks: number;
  totalTime: number;
  totalClicks: number;
  lastPlayed: number;
}

let leaderboard: LeaderboardEntry[] = [];

function load(): void {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      leaderboard = JSON.parse(stored);
    }
  } catch {
    leaderboard = [];
  }
}

function save(): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(leaderboard));
  } catch {
    // Storage full or unavailable
  }
}

export function getLeaderboard(): LeaderboardEntry[] {
  load();
  return [...leaderboard].sort((a, b) => b.wins - a.wins || (a.losses - b.losses));
}

export function recordGame(
  name: string,
  won: boolean,
  clicks: number,
  time: number
): void {
  load();

  const id = name.toLowerCase().trim();
  let entry = leaderboard.find((e) => e.id === id);

  if (!entry) {
    entry = {
      id,
      name: name.trim(),
      wins: 0,
      losses: 0,
      totalGames: 0,
      bestTime: Infinity,
      bestClicks: Infinity,
      totalTime: 0,
      totalClicks: 0,
      lastPlayed: Date.now(),
    };
    leaderboard.push(entry);
  }

  entry.totalGames++;
  if (won) entry.wins++;
  else entry.losses++;
  entry.totalTime += time;
  entry.totalClicks += clicks;
  if (time < entry.bestTime) entry.bestTime = time;
  if (clicks < entry.bestClicks) entry.bestClicks = clicks;
  entry.lastPlayed = Date.now();
  entry.name = name.trim();

  save();
}

export function formatLeaderboardTime(seconds: number): string {
  if (seconds === Infinity || seconds === 0) return '-';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}
