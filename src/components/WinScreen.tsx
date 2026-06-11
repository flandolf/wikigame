interface PathEntry {
  title: string;
}

interface WinScreenProps {
  startTitle: string;
  goalTitle: string;
  clicks: number;
  time: number;
  path: PathEntry[];
  onPlayAgain: () => void;
  onHome: () => void;
  formatTime: (seconds: number) => string;
}

export default function WinScreen({
  startTitle,
  goalTitle,
  clicks,
  time,
  path,
  onPlayAgain,
  onHome,
  formatTime,
}: WinScreenProps) {
  return (
    <div className="win-overlay">
      <div className="win-card">
        <div className="win-icon">🎉</div>
        <h1 className="win-title">You Reached the Goal!</h1>
        <p className="win-path-label">
          {startTitle} → {goalTitle}
        </p>

        <div className="win-stats">
          <div className="win-stat">
            <span className="win-stat-icon">⏱️</span>
            <div className="win-stat-info">
              <span className="win-stat-value">{formatTime(time)}</span>
              <span className="win-stat-label">Time</span>
            </div>
          </div>
          <div className="win-stat">
            <span className="win-stat-icon">🖱️</span>
            <div className="win-stat-info">
              <span className="win-stat-value">{clicks}</span>
              <span className="win-stat-label">Clicks</span>
            </div>
          </div>
          <div className="win-stat">
            <span className="win-stat-icon">📄</span>
            <div className="win-stat-info">
              <span className="win-stat-value">{path.length}</span>
              <span className="win-stat-label">Pages visited</span>
            </div>
          </div>
        </div>

        <div className="win-path">
          <h3 className="win-path-heading">Your Path</h3>
          <div className="win-path-list">
            {path.map((entry, i) => (
              <div key={i} className="win-path-step">
                <div className="win-path-dot" />
                <span className="win-path-name">{entry.title}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="win-actions">
          <button className="play-again-button" onClick={onPlayAgain}>
            Play Again
          </button>
          <button className="home-button" onClick={onHome}>
            Home
          </button>
        </div>
      </div>
    </div>
  );
}
