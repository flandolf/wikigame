import { useState } from 'react';
import { getLeaderboard, formatLeaderboardTime } from '../lib/leaderboard';
import type { LeaderboardEntry } from '../lib/leaderboard';

interface LeaderboardProps {
  onBack: () => void;
}

export default function Leaderboard({ onBack }: LeaderboardProps) {
  const [entries] = useState(() => getLeaderboard());

  return (
    <div className="lobby-screen">
      <div className="lobby-content">
        <button className="lobby-back" onClick={onBack}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M10 12L6 8L10 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Back
        </button>

        <div className="leaderboard-icon">🏆</div>
        <h1 className="lobby-title">Leaderboard</h1>

        {entries.length === 0 ? (
          <div className="leaderboard-empty">
            <p>No games played yet.</p>
            <p className="leaderboard-empty-sub">Play a multiplayer game to appear here!</p>
          </div>
        ) : (
          <div className="leaderboard-table-wrap">
            <table className="leaderboard-table">
              <thead>
                <tr>
                  <th className="lb-rank">#</th>
                  <th className="lb-name">Player</th>
                  <th className="lb-num">Wins</th>
                  <th className="lb-num">Games</th>
                  <th className="lb-num">Win %</th>
                  <th className="lb-num">Best Time</th>
                  <th className="lb-num">Best Clicks</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry: LeaderboardEntry, i: number) => (
                  <tr key={entry.id} className={`lb-row ${i < 3 ? `lb-top-${i + 1}` : ''}`}>
                    <td className="lb-rank">
                      {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`}
                    </td>
                    <td className="lb-name">{entry.name}</td>
                    <td className="lb-num">{entry.wins}</td>
                    <td className="lb-num">{entry.totalGames}</td>
                    <td className="lb-num">
                      {Math.round((entry.wins / entry.totalGames) * 100)}%
                    </td>
                    <td className="lb-num">{formatLeaderboardTime(entry.bestTime)}</td>
                    <td className="lb-num">
                      {entry.bestClicks === Infinity ? '-' : entry.bestClicks}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
