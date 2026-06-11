import { useState, useCallback, useRef, useEffect } from 'react';
import {
  getRandomArticles,
  getArticleContent,
  extractArticleTitleFromHref,
  isSameArticle,
} from './lib/wikipedia';
import {
  MultiplayerManager,
  generateLobbyCode,
  type GameConfig,
  type PlayerResult,
  type ConnectionStatus,
  type Message,
} from './lib/multiplayer';
import { recordGame } from './lib/leaderboard';
import StartScreen from './components/StartScreen';
import GameBoard from './components/GameBoard';
import WinScreen from './components/WinScreen';
import LobbyScreen from './components/LobbyScreen';
import WaitingScreen from './components/WaitingScreen';
import MultiplayerResults from './components/MultiplayerResults';
import Leaderboard from './components/Leaderboard';
import './App.css';

interface ArticleInfo {
  title: string;
  html: string;
}

interface PathEntry {
  title: string;
}

type Screen =
  | { type: 'start' }
  | { type: 'solo_loading' }
  | { type: 'solo_playing' }
  | { type: 'solo_won' }
  | { type: 'lobby' }
  | { type: 'waiting'; role: 'host' | 'joiner'; lobbyCode?: string }
  | { type: 'mp_playing' }
  | { type: 'mp_ended' }
  | { type: 'leaderboard' };

interface MyResultData {
  name: string;
  clicks: number;
  time: number;
  path: { title: string }[];
  won: boolean;
}

async function fetchGamePair(): Promise<{ start: { title: string }; goal: { title: string }; startContent: ArticleInfo }> {
  const pages = await getRandomArticles(2);
  if (pages.length < 2) throw new Error('Could not find enough random articles');

  let [start, goal] = pages;
  if (isSameArticle(start.title, goal.title)) {
    const morePages = await getRandomArticles(1);
    if (morePages.length > 0) goal = morePages[0];
  }

  const startContent = await getArticleContent(start.title);
  return { start, goal, startContent };
}

function App() {
  const [screen, setScreen] = useState<Screen>({ type: 'start' });

  // Solo game state
  const [startArticle, setStartArticle] = useState<ArticleInfo | null>(null);
  const [goalTitle, setGoalTitle] = useState<string>('');
  const [currentArticle, setCurrentArticle] = useState<ArticleInfo | null>(null);
  const [clicks, setClicks] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [path, setPath] = useState<PathEntry[]>([]);
  const [errorMessage, setErrorMessage] = useState('');
  const [isNavigating, setIsNavigating] = useState(false);

  // Multiplayer state
  const [playerName, setPlayerName] = useState(() => localStorage.getItem('wikigame_name') || '');
  const [lobbyCode, setLobbyCode] = useState('');
  const [opponent, setOpponent] = useState<{ name: string; articleTitle: string; clicks: number; finished: boolean; connected: boolean } | null>(null);
  const [mpStatus, setMpStatus] = useState('Connecting...');
  const [myResult, setMyResult] = useState<MyResultData | null>(null);
  const [opponentResult, setOpponentResult] = useState<PlayerResult | null>(null);

  // Timer refs
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);
  const goalRef = useRef<string>('');

  // Guards
  const gameStartedRef = useRef(false);

  // MP manager - stable reference
  const mpManagerRef = useRef<MultiplayerManager | null>(null);
  if (!mpManagerRef.current) {
    mpManagerRef.current = new MultiplayerManager();
  }
  const mpManager = mpManagerRef.current;

  // Keep goalRef in sync
  useEffect(() => {
    goalRef.current = goalTitle;
  }, [goalTitle]);

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      mpManager.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startTimer = useCallback(() => {
    startTimeRef.current = Date.now();
    timerRef.current = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - startTimeRef.current) / 1000));
    }, 1000);
  }, []);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const resetTimer = useCallback(() => {
    stopTimer();
    setElapsedSeconds(0);
  }, [stopTimer]);

  const formatTime = (seconds: number): string => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  // Message handler ref for latest version
  const handleMessageRef = useRef<(msg: Message) => void>(() => {});

  // ======================== SOLO ========================

  const startSoloGame = useCallback(async () => {
    setScreen({ type: 'solo_loading' });
    setErrorMessage('');

    try {
      const { goal, startContent } = await fetchGamePair();
      setStartArticle(startContent);
      setGoalTitle(goal.title);
      goalRef.current = goal.title;
      setCurrentArticle(startContent);
      setClicks(0);
      setElapsedSeconds(0);
      setPath([{ title: startContent.title }]);
      setIsNavigating(false);
      setScreen({ type: 'solo_playing' });
      startTimer();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to start game');
      setScreen({ type: 'start' });
    }
  }, [startTimer]);

  const navigateToSolo = useCallback(async (title: string) => {
    if (screen.type !== 'solo_playing' || isNavigating) return;
    setErrorMessage('');
    setIsNavigating(true);

    try {
      const content = await getArticleContent(title);
      setClicks((prev) => prev + 1);
      setCurrentArticle(content);
      setPath((prev) => [...prev, { title: content.title }]);
      setIsNavigating(false);

      if (isSameArticle(content.title, goalRef.current)) {
        stopTimer();
        setElapsedSeconds(Math.floor((Date.now() - startTimeRef.current) / 1000));
        setTimeout(() => setScreen({ type: 'solo_won' }), 100);
      }
    } catch (err) {
      console.error('Navigation failed:', err);
      setErrorMessage('Failed to load article. Please try again.');
      setIsNavigating(false);
    }
  }, [screen.type, isNavigating, stopTimer]);

  const handleSoloClick = useCallback((href: string) => {
    if (isNavigating) return;
    const title = extractArticleTitleFromHref(href);
    if (title && currentArticle && !isSameArticle(title, currentArticle.title)) {
      navigateToSolo(title);
    }
  }, [currentArticle, navigateToSolo, isNavigating]);

  // ======================== MULTIPLAYER SETUP ========================

  // Set up callbacks once
  useEffect(() => {
    mpManager.setCallbacks({
      onStatusChange: (status: ConnectionStatus, error?: string) => {
        setMpStatus(status === 'connected' ? 'Connected!' : error || 'Connecting...');
      },
      onMessage: (msg: Message) => handleMessageRef.current(msg),
      onPeerConnected: (name: string) => {
        setScreen({ type: 'waiting', role: 'host', lobbyCode: lobbyCode });
        setOpponent({ name, articleTitle: '', clicks: 0, finished: false, connected: true });
        setMpStatus('Connected!');
      },
      onPeerDisconnected: () => {
        setOpponent((prev) => prev ? { ...prev, connected: false } : null);
        setErrorMessage('Opponent disconnected');
      },
    });
  }, [mpManager, lobbyCode]);

  // The actual message handler (updated on each render via ref)
  const handleMessage = useCallback((msg: Message) => {
    switch (msg.type) {
      case 'accepted':
        setOpponent({ name: msg.name, articleTitle: '', clicks: 0, finished: false, connected: true });
        break;

      case 'game_config': {
        const cfg = msg.config;
        setGoalTitle(cfg.goalTitle);
        goalRef.current = cfg.goalTitle;
        setCurrentArticle({ title: cfg.startTitle, html: cfg.startHtml });
        setStartArticle({ title: cfg.startTitle, html: cfg.startHtml });
        setClicks(0);
        setElapsedSeconds(0);
        setPath([{ title: cfg.startTitle }]);
        setIsNavigating(false);
        mpManager.send({ type: 'opponent_ready' });
        setScreen({ type: 'mp_playing' });
        startTimer();
        break;
      }

      case 'opponent_ready':
        setScreen({ type: 'mp_playing' });
        startTimer();
        break;

      case 'progress':
        setOpponent((prev) => prev ? { ...prev, clicks: msg.clicks, articleTitle: msg.articleTitle } : null);
        break;

      case 'finished':
        setOpponentResult(msg.result);
        break;

      case 'new_round': {
        gameStartedRef.current = false;
        const cfg = msg.config;
        setGoalTitle(cfg.goalTitle);
        goalRef.current = cfg.goalTitle;
        setStartArticle({ title: cfg.startTitle, html: cfg.startHtml });
        setCurrentArticle({ title: cfg.startTitle, html: cfg.startHtml });
        setClicks(0);
        setElapsedSeconds(0);
        setPath([{ title: cfg.startTitle }]);
        setIsNavigating(false);
        setMyResult(null);
        setOpponentResult(null);
        mpManager.send({ type: 'opponent_ready' });
        setScreen({ type: 'mp_playing' });
        startTimer();
        break;
      }

      case 'leave':
        setErrorMessage('Opponent left the game');
        setScreen({ type: 'start' });
        break;
    }
  }, [startTimer, mpManager]);

  handleMessageRef.current = handleMessage;

  const handleHost = useCallback(async (name: string) => {
    setPlayerName(name);
    const code = generateLobbyCode();
    setLobbyCode(code);
    setScreen({ type: 'waiting', role: 'host', lobbyCode: code });
    setErrorMessage('');
    gameStartedRef.current = false;

    try {
      await mpManager.host(code);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to create room');
      setScreen({ type: 'lobby' });
    }
  }, [mpManager]);

  const handleJoin = useCallback(async (name: string, code: string) => {
    setPlayerName(name);
    setLobbyCode(code);
    setScreen({ type: 'waiting', role: 'joiner' });
    setErrorMessage('');

    try {
      await mpManager.join(code, name);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to join room');
      setScreen({ type: 'lobby' });
    }
  }, [mpManager]);

  const cancelWaiting = useCallback(() => {
    mpManager.disconnect();
    setOpponent(null);
    setScreen({ type: 'lobby' });
  }, [mpManager]);

  // Host starts the game when opponent connects
  const startMultiplayerGame = useCallback(async () => {
    if (gameStartedRef.current) return;
    gameStartedRef.current = true;
    setErrorMessage('');

    try {
      const { goal, startContent } = await fetchGamePair();
      const config: GameConfig = {
        startTitle: startContent.title,
        startHtml: startContent.html,
        goalTitle: goal.title,
      };

      setStartArticle(startContent);
      setGoalTitle(goal.title);
      goalRef.current = goal.title;
      setCurrentArticle(startContent);
      setClicks(0);
      setElapsedSeconds(0);
      setPath([{ title: startContent.title }]);
      setIsNavigating(false);

      mpManager.send({ type: 'game_config', config });
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to generate game');
      gameStartedRef.current = false;
    }
  }, [mpManager]);

  // Trigger game start when host sees opponent connected
  useEffect(() => {
    if (screen.type === 'waiting' && screen.role === 'host' && opponent?.connected && !gameStartedRef.current) {
      startMultiplayerGame();
    }
  }, [screen, opponent?.connected, startMultiplayerGame]);

  // ======================== MULTIPLAYER NAVIGATION ========================

  const navigateToMp = useCallback(async (title: string) => {
    if (screen.type !== 'mp_playing' || isNavigating) return;
    setErrorMessage('');
    setIsNavigating(true);

    try {
      const content = await getArticleContent(title);
      const newClicks = clicks + 1;
      setClicks(newClicks);
      setCurrentArticle(content);
      setPath((prev) => [...prev, { title: content.title }]);

      // Send progress to opponent
      mpManager.send({ type: 'progress', clicks: newClicks, articleTitle: content.title });

      setIsNavigating(false);

      // Check if we reached the goal
      if (isSameArticle(content.title, goalRef.current)) {
        stopTimer();
        const finalTime = Math.floor((Date.now() - startTimeRef.current) / 1000);
        setElapsedSeconds(finalTime);
        const updatedPath = [...path, { title: content.title }];

        const result: PlayerResult = {
          name: playerName,
          clicks: newClicks,
          time: finalTime,
          path: updatedPath,
          won: true,
        };

        setMyResult({ ...result, won: true });

        // Send finished to opponent
        mpManager.send({ type: 'finished', result });
        setScreen({ type: 'mp_ended' });
      }
    } catch (err) {
      console.error('Navigation failed:', err);
      setErrorMessage('Failed to load article');
      setIsNavigating(false);
    }
  }, [screen.type, isNavigating, clicks, path, stopTimer, mpManager, playerName]);

  // Record leaderboard when both finished
  useEffect(() => {
    if (screen.type === 'mp_ended' && myResult && opponentResult) {
      const iWon = myResult.won && !opponentResult.won;
      const tie = myResult.won && opponentResult.won;
      if (tie) {
        recordGame(playerName, true, myResult.clicks, myResult.time);
        recordGame(opponentResult.name, true, opponentResult.clicks, opponentResult.time);
      } else {
        recordGame(playerName, iWon, myResult.clicks, myResult.time);
        recordGame(opponentResult.name, !iWon, opponentResult.clicks, opponentResult.time);
      }
    }
  }, [screen.type, myResult, opponentResult, playerName]);

  const newMultiplayerRound = useCallback(async () => {
    gameStartedRef.current = false;
    setErrorMessage('');

    try {
      const { goal, startContent } = await fetchGamePair();
      const config: GameConfig = {
        startTitle: startContent.title,
        startHtml: startContent.html,
        goalTitle: goal.title,
      };

      setStartArticle(startContent);
      setGoalTitle(goal.title);
      goalRef.current = goal.title;
      setCurrentArticle(startContent);
      setClicks(0);
      setElapsedSeconds(0);
      setPath([{ title: startContent.title }]);
      setIsNavigating(false);
      setMyResult(null);
      setOpponentResult(null);

      mpManager.send({ type: 'new_round', config });
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to generate new round');
    }
  }, [mpManager]);

  const leaveMultiplayer = useCallback(() => {
    mpManager.send({ type: 'leave' });
    mpManager.disconnect();
    setOpponent(null);
    setOpponentResult(null);
    setMyResult(null);
    gameStartedRef.current = false;
    resetTimer();
    setScreen({ type: 'start' });
  }, [mpManager, resetTimer]);

  // ======================== RENDER ========================

  switch (screen.type) {
    case 'start':
      return (
        <StartScreen
          onStart={startSoloGame}
          onMultiplayer={() => setScreen({ type: 'lobby' })}
          onLeaderboard={() => setScreen({ type: 'leaderboard' })}
          error={errorMessage}
          onDismissError={() => setErrorMessage('')}
        />
      );

    case 'solo_loading':
      return (
        <div className="loading-screen">
          <div className="loading-spinner" />
          <p className="loading-text">Finding articles...</p>
        </div>
      );

    case 'solo_won':
      return (
        <WinScreen
          startTitle={startArticle?.title ?? ''}
          goalTitle={goalTitle}
          clicks={clicks}
          time={elapsedSeconds}
          path={path}
          onPlayAgain={startSoloGame}
          onHome={() => { resetTimer(); setScreen({ type: 'start' }); }}
          formatTime={formatTime}
        />
      );

    case 'lobby':
      return (
        <LobbyScreen
          onHost={handleHost}
          onJoin={handleJoin}
          onBack={() => setScreen({ type: 'start' })}
          error={errorMessage}
        />
      );

    case 'waiting':
      return (
        <WaitingScreen
          mode={screen.role}
          lobbyCode={screen.lobbyCode}
          playerName={playerName}
          opponentName={opponent?.name}
          status={mpStatus}
          onCancel={cancelWaiting}
        />
      );

    case 'mp_ended':
      return (
        <MultiplayerResults
          myResult={myResult || { name: playerName, clicks: 0, time: 0, path: [], won: false }}
          opponentResult={opponentResult}
          goalTitle={goalTitle}
          isHost={mpManager.role === 'host'}
          onNewRound={newMultiplayerRound}
          onLeave={leaveMultiplayer}
          formatTime={formatTime}
        />
      );

    case 'leaderboard':
      return (
        <Leaderboard
          onBack={() => setScreen({ type: 'start' })}
        />
      );

    case 'solo_playing':
      return (
        <GameBoard
          currentArticle={currentArticle}
          goalTitle={goalTitle}
          clicks={clicks}
          elapsedSeconds={elapsedSeconds}
          path={path}
          formatTime={formatTime}
          onLinkClick={handleSoloClick}
          isNavigating={isNavigating}
          errorMessage={errorMessage}
        />
      );

    case 'mp_playing':
      return (
        <GameBoard
          currentArticle={currentArticle}
          goalTitle={goalTitle}
          clicks={clicks}
          elapsedSeconds={elapsedSeconds}
          path={path}
          formatTime={formatTime}
          onLinkClick={(href: string) => {
            if (isNavigating) return;
            const title = extractArticleTitleFromHref(href);
            if (title && currentArticle && !isSameArticle(title, currentArticle.title)) {
              navigateToMp(title);
            }
          }}
          isNavigating={isNavigating}
          errorMessage={errorMessage}
          opponent={opponent}
          playerName={playerName}
        />
      );

    default:
      return null;
  }
}

export default App;
