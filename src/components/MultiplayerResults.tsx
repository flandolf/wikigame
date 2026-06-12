import ScreenFrame from './ScreenFrame';
import type { ThemeMode } from './ThemeToggle';

interface PlayerResultData {
  name: string;
  clicks: number;
  time: number;
  path: { title: string }[];
  won: boolean;
}

interface MultiplayerResultsProps {
  myResult: PlayerResultData;
  opponentResult: PlayerResultData | null;
  goalTitle: string;
  isHost: boolean;
  onNewRound: () => void;
  onLeave: () => void;
  formatTime: (s: number) => string;
  theme: ThemeMode;
  onToggleTheme: () => void;
}

export default function MultiplayerResults({
  myResult,
  opponentResult,
  goalTitle,
  isHost,
  onNewRound,
  onLeave,
  formatTime,
  theme,
  onToggleTheme,
}: MultiplayerResultsProps) {
  const opponent = opponentResult;
  const bothFinished = opponent !== null;

  const myWon = myResult.won;
  const oppWon = opponent?.won ?? false;
  const iWon = bothFinished && myWon && !oppWon;
  const tie = bothFinished && myWon === oppWon;

  const winnerName = bothFinished
    ? iWon
      ? myResult.name
      : tie
        ? 'Tie'
        : opponent!.name
    : null;

  return (
    <ScreenFrame className="win-overlay" theme={theme} onToggleTheme={onToggleTheme}>
      <div className="results-card">
        <p className="lobby-kicker">{bothFinished ? 'Round archived' : 'Opponent still navigating'}</p>
        <h1 className="results-title">
          {bothFinished
            ? iWon
              ? 'You Win!'
              : tie
                ? "It's a Tie!"
                : `${opponent!.name} Wins!`
            : 'Waiting for opponent...'}
        </h1>
        <p className="win-path-label">Goal: {goalTitle}</p>

        {winnerName && (
          <div className="results-winner-badge">
            {winnerName === 'Tie' ? "It's a Tie!" : `${winnerName} wins this round!`}
          </div>
        )}

        <div className="results-comparison">
          {/* My Results */}
          <div className={`results-player ${iWon ? 'winner' : ''} ${myResult.won ? '' : 'dnf'}`}>
            <div className="results-player-header">
              <span className="results-player-name">{myResult.name}</span>
              <span className="results-player-badge">
                {myResult.won ? (iWon ? 'Winner' : 'Finished') : 'DNF'}
              </span>
            </div>
            <div className="results-player-stats">
              <div className="rp-stat">
                <span className="rp-stat-value">{formatTime(myResult.time)}</span>
                <span className="rp-stat-label">Time</span>
              </div>
              <div className="rp-stat">
                <span className="rp-stat-value">{myResult.clicks}</span>
                <span className="rp-stat-label">Clicks</span>
              </div>
              <div className="rp-stat">
                <span className="rp-stat-value">{myResult.path.length}</span>
                <span className="rp-stat-label">Steps</span>
              </div>
            </div>
          </div>

          {/* VS */}
          <div className="results-vs">VS</div>

          {/* Opponent Results */}
          {opponent ? (
            <div className={`results-player ${!iWon && oppWon ? 'winner' : ''} ${opponent.won ? '' : 'dnf'}`}>
              <div className="results-player-header">
                <span className="results-player-name">{opponent.name}</span>
                <span className="results-player-badge">
                  {opponent.won ? (!iWon && oppWon ? 'Winner' : 'Finished') : 'DNF'}
                </span>
              </div>
              <div className="results-player-stats">
                <div className="rp-stat">
                  <span className="rp-stat-value">{formatTime(opponent.time)}</span>
                  <span className="rp-stat-label">Time</span>
                </div>
                <div className="rp-stat">
                  <span className="rp-stat-value">{opponent.clicks}</span>
                  <span className="rp-stat-label">Clicks</span>
                </div>
                <div className="rp-stat">
                  <span className="rp-stat-value">{opponent.path.length}</span>
                  <span className="rp-stat-label">Steps</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="results-player waiting">
              <div className="results-player-header">
                <span className="results-player-name">Opponent</span>
              </div>
              <div className="results-player-stats waiting-stats">
                <div className="loading-spinner" />
                <span className="waiting-text">Still playing...</span>
              </div>
            </div>
          )}
        </div>

        <div className="results-actions">
          {isHost && bothFinished && (
            <button className="start-button" onClick={onNewRound}>
              New Round
            </button>
          )}
          <button className="results-leave" onClick={onLeave}>
            Leave
          </button>
        </div>
      </div>
    </ScreenFrame>
  );
}
