import { useState } from 'react';

interface LobbyScreenProps {
  onHost: (name: string) => void;
  onJoin: (name: string, code: string) => void;
  onBack: () => void;
  error: string;
}

export default function LobbyScreen({ onHost, onJoin, onBack, error }: LobbyScreenProps) {
  const [mode, setMode] = useState<'select' | 'host' | 'join'>('select');
  const [name, setName] = useState(() => localStorage.getItem('wikigame_name') || '');
  const [code, setCode] = useState('');

  const handleNameChange = (v: string) => {
    setName(v);
    localStorage.setItem('wikigame_name', v);
  };

  const handleJoin = () => {
    if (!code.trim()) return;
    onJoin(name || 'Player', code.trim().toUpperCase());
  };

  const handleHost = () => {
    onHost(name || 'Player');
  };

  return (
    <div className="lobby-screen">
      <div className="lobby-content">
        <button className="lobby-back" onClick={onBack}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M10 12L6 8L10 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Back
        </button>

        <div className="lobby-icon">🎮</div>
        <h1 className="lobby-title">Multiplayer</h1>

        <div className="lobby-name-input">
          <label className="lobby-label">Your Name</label>
          <input
            type="text"
            className="lobby-input"
            placeholder="Enter your name"
            value={name}
            onChange={(e) => handleNameChange(e.target.value)}
            maxLength={20}
          />
        </div>

        {error && (
          <div className="error-banner">
            <span>{error}</span>
          </div>
        )}

        {mode === 'select' && (
          <div className="lobby-actions">
            <button
              className="lobby-btn host-btn"
              onClick={() => setMode('host')}
              disabled={!name.trim()}
            >
              <span className="lobby-btn-icon">🏠</span>
              <span className="lobby-btn-label">Host Game</span>
              <span className="lobby-btn-desc">Create a room and share the code</span>
            </button>
            <button
              className="lobby-btn join-btn"
              onClick={() => setMode('join')}
              disabled={!name.trim()}
            >
              <span className="lobby-btn-icon">🔗</span>
              <span className="lobby-btn-label">Join Game</span>
              <span className="lobby-btn-desc">Enter a room code to play</span>
            </button>
          </div>
        )}

        {mode === 'host' && (
          <div className="lobby-host-section">
            <p className="lobby-host-info">
              You'll get a lobby code to share with your opponent.
            </p>
            <button className="start-button" onClick={handleHost}>
              Create Room
            </button>
            <button className="lobby-cancel" onClick={() => setMode('select')}>
              Cancel
            </button>
          </div>
        )}

        {mode === 'join' && (
          <div className="lobby-join-section">
            <div className="lobby-code-input">
              <label className="lobby-label">Room Code</label>
              <input
                type="text"
                className="lobby-input code-input"
                placeholder="Enter code"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, 4))}
                maxLength={4}
                autoFocus
              />
            </div>
            <button
              className="start-button"
              onClick={handleJoin}
              disabled={code.length < 4}
            >
              Join Room
            </button>
            <button className="lobby-cancel" onClick={() => setMode('select')}>
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
