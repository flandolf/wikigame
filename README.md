# WikiGame 🌐

Navigate from one Wikipedia article to another using only the links within each page. Race solo against the clock or challenge a friend in real-time P2P multiplayer!

Built with **React**, **TypeScript**, **Vite**, and **PeerJS** for WebRTC-based multiplayer.

## Features

- **Solo Mode** — Race against the clock to reach a target article in as few clicks as possible
- **P2P Multiplayer** — Host a room with a 4-character lobby code, challenge a friend via direct WebRTC connection (no server needed)
- **New Rounds** — Play multiple rounds against the same opponent with fresh articles each time
- **Leaderboard** — Track wins, losses, best times, and best clicks across all your multiplayer sessions
- **Large Articles** — Start and goal articles are filtered to be substantial pages (5KB+) with plenty of links to navigate through
- **Dark/Light Mode** — Automatically adapts to your system color scheme
- **Path Viewer** — Expandable panel showing your full navigation history

## How to Play

1. You're given a **start article** and a **goal article**
2. Click links within the article to navigate — each click takes you to a new Wikipedia page
3. Reach the goal article to win!
4. In multiplayer, both players race on the same pair of articles — fastest wins

## Getting Started

### Prerequisites

- [Bun](https://bun.sh/) (preferred) or Node.js

### Install

```bash
bun install
```

### Development

```bash
bun run dev
```

Open the URL shown in terminal (default: `http://localhost:5173`).

### Build

```bash
bun run build
```

Preview the production build with:

```bash
bun run preview
```

## How Multiplayer Works

1. **Host** clicks "Multiplayer" → "Host Game" → gets a **4-character lobby code**
2. **Joiner** clicks "Multiplayer" → "Join Game" → enters the code
3. **PeerJS** establishes a direct WebRTC connection between browsers — no backend server needed
4. The host generates the article pair and sends it to both players
5. Both players navigate independently, seeing each other's click count
6. When both finish, results are compared side by side
7. The host can start a **new round** with the same opponent

## Tech Stack

| Technology | Purpose |
|---|---|
| [React 19](https://react.dev/) | UI framework |
| [TypeScript](https://www.typescriptlang.org/) | Type safety |
| [Vite](https://vite.dev/) | Build tool |
| [PeerJS](https://peerjs.com/) | WebRTC P2P connections |
| [Wikipedia API](https://www.mediawiki.org/wiki/API:Main_page) | Article content and search |

## Project Structure

```
src/
├── lib/
│   ├── wikipedia.ts      # Wikipedia API client
│   ├── multiplayer.ts     # PeerJS connection manager
│   └── leaderboard.ts     # localStorage leaderboard
├── components/
│   ├── StartScreen.tsx    # Main menu (solo/multiplayer/leaderboard)
│   ├── LobbyScreen.tsx    # Host/join lobby
│   ├── WaitingScreen.tsx  # Connection waiting screen
│   ├── GameBoard.tsx      # Article viewer + game HUD
│   ├── WinScreen.tsx      # Solo win screen
│   ├── MultiplayerResults.tsx  # Side-by-side results
│   └── Leaderboard.tsx    # Rankings table
├── App.tsx                # State machine and game logic
├── App.css                # All game styles
└── index.css              # Global styles and theme
```
