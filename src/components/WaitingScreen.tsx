import ScreenFrame from './ScreenFrame';
import type { ThemeMode } from './ThemeToggle';

interface WaitingScreenProps {
  mode: 'host' | 'joiner';
  lobbyCode?: string;
  playerName: string;
  opponentName?: string;
  status: string;
  onCancel: () => void;
  theme: ThemeMode;
  onToggleTheme: () => void;
}

export default function WaitingScreen({
  mode,
  lobbyCode,
  playerName,
  opponentName,
  status,
  onCancel,
  theme,
  onToggleTheme,
}: WaitingScreenProps) {
  return (
    <ScreenFrame className="lobby-screen" theme={theme} onToggleTheme={onToggleTheme}>
      <div className="lobby-content waiting-content">
        {mode === 'host' ? (
          <>
            <p className="lobby-kicker">Room opened</p>
            <h2 className="waiting-title">Your Room</h2>
            <div className="lobby-code-display">
              <span className="lobby-code-label">Share this code:</span>
              <span className="lobby-code-value">{lobbyCode}</span>
            </div>
            <p className="waiting-player">Playing as <strong>{playerName}</strong></p>

            {opponentName ? (
              <div className="opponent-joined">
                <div className="opponent-joined-icon">✅</div>
                <p><strong>{opponentName}</strong> joined!</p>
              </div>
            ) : (
              <div className="waiting-spinner-section">
                <div className="loading-spinner" />
                <p className="waiting-status">Waiting for opponent to join...</p>
              </div>
            )}
          </>
        ) : (
          <>
            <p className="lobby-kicker">Finding the archive desk</p>
            <h2 className="waiting-title">Joining Room</h2>
            <div className="waiting-spinner-section">
              <div className="loading-spinner" />
              <p className="waiting-status">{status}</p>
            </div>
            {opponentName && (
              <p className="waiting-player">Connected to <strong>{opponentName}</strong></p>
            )}
          </>
        )}

        <button className="lobby-cancel cancel-waiting" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </ScreenFrame>
  );
}
