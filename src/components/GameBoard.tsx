import { useRef, useEffect, useState, useCallback } from 'react';
import { extractArticleTitleFromHref } from '../lib/wikipedia';
import type { OpponentState } from '../lib/multiplayer';

interface ArticleInfo {
  title: string;
  html: string;
}

interface PathEntry {
  title: string;
}

interface GameBoardProps {
  currentArticle: ArticleInfo | null;
  goalTitle: string;
  clicks: number;
  elapsedSeconds: number;
  path: PathEntry[];
  formatTime: (seconds: number) => string;
  onLinkClick: (href: string) => void;
  isNavigating: boolean;
  errorMessage: string;
  // Multiplayer props
  opponent?: OpponentState | null;
  playerName?: string;
}

export default function GameBoard({
  currentArticle,
  goalTitle,
  clicks,
  elapsedSeconds,
  path,
  formatTime,
  onLinkClick,
  isNavigating,
  errorMessage,
  opponent,
  playerName,
}: GameBoardProps) {
  const articleRef = useRef<HTMLDivElement>(null);
  const [showPath, setShowPath] = useState(false);

  // Scroll to top when article changes
  useEffect(() => {
    if (articleRef.current) {
      articleRef.current.scrollTop = 0;
    }
  }, [currentArticle?.title, currentArticle?.html]);

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      const target = e.target as HTMLElement;
      const link = target.closest('a');
      if (!link) return;

      const href = link.getAttribute('href');
      if (!href) return;

      const articleTitle = extractArticleTitleFromHref(href);
      if (articleTitle) {
        e.preventDefault();
        onLinkClick(href);
        return;
      }
    },
    [onLinkClick]
  );

  return (
    <div className="game-container">
      {/* Multiplayer Opponent Bar */}
      {opponent && (
        <div className="opponent-bar">
          <div className="opponent-bar-inner">
            <div className="opponent-info">
              <span className="opponent-name">{opponent.name}</span>
              <span className="opponent-sep">•</span>
              <span className="opponent-clicks">{opponent.clicks} clicks</span>
            </div>
            {opponent.finished ? (
              <span className="opponent-status finished">✅ Finished</span>
            ) : (
              <span className="opponent-status playing">🔍 Playing...</span>
            )}
          </div>
        </div>
      )}

      {/* Top Bar */}
      <header className="game-header">
        <div className="header-left">
          {playerName && (
            <div className="header-stat">
              <span className="stat-label">{playerName}</span>
              <span className="stat-value">{formatTime(elapsedSeconds)}</span>
            </div>
          )}
          <div className="header-stat">
            <span className="stat-label">{playerName ? 'Clicks' : 'Time'}</span>
            <span className="stat-value">{playerName ? clicks : formatTime(elapsedSeconds)}</span>
          </div>
          {!playerName && (
            <div className="header-stat">
              <span className="stat-label">Clicks</span>
              <span className="stat-value">{clicks}</span>
            </div>
          )}
          <div className="header-stat goal-stat">
            <span className="stat-label">Goal</span>
            <span className="stat-value goal-title" title={goalTitle}>
              {goalTitle.length > 35 ? goalTitle.slice(0, 32) + '...' : goalTitle}
            </span>
          </div>
        </div>
        <div className="header-right">
          <div className="current-page-title" title={currentArticle?.title}>
            {currentArticle?.title ?? ''}
          </div>
          <button
            className={`path-toggle ${showPath ? 'active' : ''}`}
            onClick={() => setShowPath(!showPath)}
            title="Show navigation path"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <circle cx="3" cy="3" r="2" stroke="currentColor" strokeWidth="1.5" />
              <circle cx="13" cy="8" r="2" stroke="currentColor" strokeWidth="1.5" />
              <circle cx="3" cy="13" r="2" stroke="currentColor" strokeWidth="1.5" />
              <line x1="4.5" y1="3.5" x2="11.5" y2="7.5" stroke="currentColor" strokeWidth="1.5" />
              <line x1="11.5" y1="8.5" x2="4.5" y2="12.5" stroke="currentColor" strokeWidth="1.5" />
            </svg>
            Path
          </button>
        </div>
      </header>

      {/* Navigation Path Panel */}
      {showPath && (
        <div className="path-panel">
          <div className="path-list">
            {path.map((entry, i) => (
              <div key={i} className="path-entry">
                <div className="path-dot-wrap">
                  <div className={`path-dot ${i === 0 ? 'start' : i === path.length - 1 ? 'current' : ''}`} />
                  {i < path.length - 1 && <div className="path-line" />}
                </div>
                <span className="path-title">
                  {entry.title}
                  {i === 0 && <span className="path-badge start-badge">Start</span>}
                  {i === path.length - 1 && currentArticle && entry.title === currentArticle.title && (
                    <span className="path-badge current-badge">Current</span>
                  )}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Error banner */}
      {errorMessage && (
        <div className="game-error-banner">
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Article Content */}
      <main className="article-container" ref={articleRef} onClick={handleClick}>
        {isNavigating && (
          <div className="article-loading">
            <div className="loading-spinner" />
            <span>Loading...</span>
          </div>
        )}
        {currentArticle && (
          <div
            className={`article-content ${isNavigating ? 'loading' : ''}`}
            dangerouslySetInnerHTML={{ __html: currentArticle.html }}
          />
        )}
      </main>
    </div>
  );
}
