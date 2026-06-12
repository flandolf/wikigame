import ScreenFrame from './ScreenFrame';
import type { ThemeMode } from './ThemeToggle';
import { GAME_MODES, getGameMode, type GameModeId } from '../lib/gameModes';

interface StartScreenProps {
  onStart: () => void;
  onMultiplayer: () => void;
  onLeaderboard: () => void;
  selectedMode: GameModeId;
  onSelectMode: (mode: GameModeId) => void;
  error: string;
  onDismissError: () => void;
  theme: ThemeMode;
  onToggleTheme: () => void;
}

export default function StartScreen({
  onStart,
  onMultiplayer,
  onLeaderboard,
  selectedMode,
  onSelectMode,
  error,
  onDismissError,
  theme,
  onToggleTheme,
}: StartScreenProps) {
  const activeMode = getGameMode(selectedMode);

  return (
    <ScreenFrame className="start-screen" theme={theme} onToggleTheme={onToggleTheme}>
      <div className="start-content">
        <section className="start-hero" aria-labelledby="home-title">
          <p className="start-kicker">The free encyclopedia becomes a racecourse</p>
          <h1 id="home-title" className="start-title">WikiGame</h1>
          <p className="start-subtitle">
            Navigate from one Wikipedia article to another using only the links within each page.
            Race against the clock and find the shortest path.
          </p>
        </section>

        <section className="mode-section" aria-labelledby="mode-heading">
          <div className="mode-options" role="radiogroup" aria-label="Game mode">
            {GAME_MODES.map((mode) => (
              <button
                key={mode.id}
                type="button"
                className={`mode-chip ${selectedMode === mode.id ? 'selected' : ''}`}
                onClick={() => onSelectMode(mode.id)}
                role="radio"
                aria-checked={selectedMode === mode.id}
              >
                {mode.name}
              </button>
            ))}
          </div>
          <p className="mode-description" id="mode-heading">
            {activeMode.description}
          </p>
        </section>

        {error && (
          <div className="error-banner">
            <span>{error}</span>
            <button className="error-dismiss" onClick={onDismissError}>&times;</button>
          </div>
        )}

        <div className="start-actions">
          <button className="start-action primary" onClick={onStart}>
            <span className="action-label">Solo Game</span>
            <span className="action-desc">Race against the clock</span>
          </button>
          <button className="start-action secondary" onClick={onMultiplayer}>
            <span className="action-label">Multiplayer</span>
            <span className="action-desc">Challenge a friend</span>
          </button>
          <button className="start-action secondary" onClick={onLeaderboard}>
            <span className="action-label">Leaderboard</span>
            <span className="action-desc">View rankings</span>
          </button>
        </div>

        <div className="start-rules">
          <div className="rule">
            <span className="rule-num">01</span>
            <span className="rule-text">Reach the target article</span>
          </div>
          <div className="rule">
            <span className="rule-num">02</span>
            <span className="rule-text">Only use links inside the article</span>
          </div>
          <div className="rule">
            <span className="rule-num">03</span>
            <span className="rule-text">Win with fewer clicks and a faster time</span>
          </div>
        </div>
      </div>
    </ScreenFrame>
  );
}
