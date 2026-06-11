interface StartScreenProps {
  onStart: () => void;
  onMultiplayer: () => void;
  onLeaderboard: () => void;
  error: string;
  onDismissError: () => void;
}

export default function StartScreen({ onStart, onMultiplayer, onLeaderboard, error, onDismissError }: StartScreenProps) {
  return (
    <div className="start-screen">
      <div className="start-content">
        <div className="start-icon">🌐</div>
        <h1 className="start-title">WikiGame</h1>
        <p className="start-subtitle">
          Navigate from one Wikipedia article to another using only the links within each page.
          Race against the clock and find the shortest path!
        </p>

        <div className="start-rules">
          <div className="rule">
            <span className="rule-icon">🎯</span>
            <span>Reach the target article</span>
          </div>
          <div className="rule">
            <span className="rule-icon">🔗</span>
            <span>Click links within articles to navigate</span>
          </div>
          <div className="rule">
            <span className="rule-icon">⏱️</span>
            <span>Complete in the fewest clicks and fastest time</span>
          </div>
        </div>

        {error && (
          <div className="error-banner">
            <span>{error}</span>
            <button className="error-dismiss" onClick={onDismissError}>&times;</button>
          </div>
        )}

        <div className="start-actions">
          <button className="start-btn primary" onClick={onStart}>
            <span className="start-btn-icon">🧭</span>
            <span className="start-btn-label-wrap">
              <span className="start-btn-text">Solo Game</span>
              <span className="start-btn-desc">Race against the clock</span>
            </span>
          </button>
          <button className="start-btn secondary" onClick={onMultiplayer}>
            <span className="start-btn-icon">👥</span>
            <span className="start-btn-label-wrap">
              <span className="start-btn-text">Multiplayer</span>
              <span className="start-btn-desc">Challenge a friend</span>
            </span>
          </button>
          <button className="start-btn secondary" onClick={onLeaderboard}>
            <span className="start-btn-icon">🏆</span>
            <span className="start-btn-label-wrap">
              <span className="start-btn-text">Leaderboard</span>
              <span className="start-btn-desc">View rankings</span>
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
