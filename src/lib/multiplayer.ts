import Peer from 'peerjs';
import type { DataConnection } from 'peerjs';

export interface PlayerResult {
  name: string;
  clicks: number;
  time: number;
  path: { title: string }[];
  won: boolean;
}

export interface GameConfig {
  startTitle: string;
  startHtml: string;
  goalTitle: string;
}

export interface OpponentState {
  name: string;
  articleTitle: string;
  clicks: number;
  finished: boolean;
  connected: boolean;
}

export type ConnectionRole = 'host' | 'joiner' | null;

export type Message =
  | { type: 'join'; name: string }
  | { type: 'accepted'; name: string }
  | { type: 'game_config'; config: GameConfig }
  | { type: 'progress'; clicks: number; articleTitle: string }
  | { type: 'finished'; result: PlayerResult }
  | { type: 'new_round'; config: GameConfig }
  | { type: 'opponent_ready' }
  | { type: 'leave' };

export type ConnectionStatus =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'error';

export interface MultiplayerCallbacks {
  onStatusChange: (status: ConnectionStatus, error?: string) => void;
  onMessage: (message: Message) => void;
  onPeerConnected: (name: string) => void;
  onPeerDisconnected: () => void;
}

const LOBBY_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function generateLobbyCode(): string {
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += LOBBY_CHARS[Math.floor(Math.random() * LOBBY_CHARS.length)];
  }
  return code;
}

export class MultiplayerManager {
  private peer: Peer | null = null;
  private conn: DataConnection | null = null;
  private callbacks: MultiplayerCallbacks;
  private _role: ConnectionRole = null;
  private _peerId: string = '';
  private _connectedName: string = '';
  private _joinResolve: (() => void) | null = null;

  constructor() {
    this.callbacks = {
      onStatusChange: () => {},
      onMessage: () => {},
      onPeerConnected: () => {},
      onPeerDisconnected: () => {},
    };
  }

  setCallbacks(cbs: Partial<MultiplayerCallbacks>): void {
    this.callbacks = { ...this.callbacks, ...cbs };
  }

  get role(): ConnectionRole {
    return this._role;
  }

  get peerId(): string {
    return this._peerId;
  }

  get connectedName(): string {
    return this._connectedName;
  }

  get isConnected(): boolean {
    return this.peer !== null && this.conn !== null && this.conn.open;
  }

  async host(lobbyCode: string): Promise<void> {
    this._role = 'host';
    this._peerId = lobbyCode;
    this.callbacks.onStatusChange('connecting');

    return new Promise((resolve, reject) => {
      try {
        this.peer = new Peer(lobbyCode);

        this.peer.on('open', () => {
          this.callbacks.onStatusChange('connected');
          resolve();
        });

        this.peer.on('connection', (conn: DataConnection) => {
          this.conn = conn;
          this.setupConnection(conn);
        });

        this.peer.on('error', (err) => {
          if (err.type === 'unavailable-id') {
            this.callbacks.onStatusChange('error', 'Lobby code already in use. Try again.');
          } else {
            this.callbacks.onStatusChange('error', `Connection error: ${err.message}`);
          }
          reject(err);
        });

        this.peer.on('disconnected', () => {
          this.handleDisconnect();
        });
      } catch (err) {
        this.callbacks.onStatusChange('error', 'Failed to create peer');
        reject(err);
      }
    });
  }

  async join(lobbyCode: string, playerName: string): Promise<void> {
    this._role = 'joiner';
    this._peerId = lobbyCode;
    this.callbacks.onStatusChange('connecting');

    return new Promise((resolve, reject) => {
      try {
        this.peer = new Peer();

        this.peer.on('open', () => {
          const conn = this.peer!.connect(lobbyCode);
          this.conn = conn;
          this.setupConnection(conn);

          conn.on('open', () => {
            this.send({ type: 'join', name: playerName });
          });

          // Timeout for connection
          setTimeout(() => {
            if (!this.isConnected && this._joinResolve === null) {
              this.callbacks.onStatusChange('error', 'Could not connect to host. Check the code.');
              reject(new Error('Connection timeout'));
            }
          }, 10000);
        });

        this.peer.on('error', (err) => {
          this.callbacks.onStatusChange('error', `Connection error: ${err.message}`);
          reject(err);
        });

        this.peer.on('disconnected', () => {
          this.handleDisconnect();
        });

        this._joinResolve = resolve;
      } catch (err) {
        this.callbacks.onStatusChange('error', 'Failed to create peer');
        reject(err);
      }
    });
  }

  resolveJoin(msg: Message): void {
    if (msg.type === 'accepted' && this._role === 'joiner') {
      this.callbacks.onMessage(msg);
      if (this._joinResolve) {
        this._joinResolve();
        this._joinResolve = null;
      }
    }
  }

  private setupConnection(conn: DataConnection) {
    conn.on('data', (data: unknown) => {
      const msg = data as Message;

      // Host-specific: handle join messages
      if (this._role === 'host' && msg.type === 'join') {
        this._connectedName = msg.name;
        this.callbacks.onPeerConnected(msg.name);
        this.send({ type: 'accepted', name: this._connectedName });
      }

      // Joiner-specific: resolve the initial connection promise
      if (this._role === 'joiner' && msg.type === 'accepted') {
        this.resolveJoin(msg);
        return; // resolveJoin already calls onMessage
      }

      this.callbacks.onMessage(msg);
    });

    conn.on('close', () => {
      this.handleDisconnect();
    });

    conn.on('error', (err) => {
      this.callbacks.onStatusChange('error', `Connection lost: ${err.message}`);
    });
  }

  private handleDisconnect() {
    this.conn = null;
    this.callbacks.onPeerDisconnected();
    this.callbacks.onStatusChange('disconnected');
  }

  send(message: Message): void {
    if (this.conn && this.conn.open) {
      this.conn.send(message);
    }
  }

  disconnect(): void {
    if (this.conn) {
      this.conn.close();
      this.conn = null;
    }
    if (this.peer) {
      this.peer.destroy();
      this.peer = null;
    }
    this._role = null;
    this._peerId = '';
    this._connectedName = '';
    this._joinResolve = null;
    this.callbacks.onStatusChange('disconnected');
  }
}
