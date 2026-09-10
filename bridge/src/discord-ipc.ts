import net from 'node:net';
import crypto from 'node:crypto';
import EventEmitter from 'node:events';

/**
 * Codes d'opération du protocole Discord IPC
 */
export enum DiscordOpCode {
  HANDSHAKE = 0,
  FRAME = 1,
  CLOSE = 2,
  PING = 3,
  PONG = 4
}

export interface DiscordButton {
  label: string;
  url: string;
}

export interface DiscordTimestamps {
  start?: number;
  end?: number;
}

export interface DiscordAssets {
  large_image?: string;
  large_text?: string;
  small_image?: string;
  small_text?: string;
}

export interface DiscordActivityPayload {
  state?: string;
  details?: string;
  timestamps?: DiscordTimestamps;
  assets?: DiscordAssets;
  buttons?: DiscordButton[];
  instance?: boolean;
}

/**
 * Client Discord IPC natif (sans dépendance externe)
 * Communique directement avec le Named Pipe de Discord Desktop via le module 'net' de Node.js
 */
export class DiscordIPCClient extends EventEmitter {
  private socket: net.Socket | null = null;
  private clientId: string;
  private isConnected: boolean = false;
  private receiveBuffer: Buffer = Buffer.alloc(0);
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private autoReconnect: boolean = true;

  constructor(clientId: string) {
    super();
    this.clientId = clientId;
  }

  /**
   * Obtient le chemin du Named Pipe ou Unix Socket selon le système d'exploitation
   */
  private getPipePath(id: number): string {
    if (process.platform === 'win32') {
      return `\\\\?\\pipe\\discord-ipc-${id}`;
    }

    const { env } = process;
    const prefix = env.XDG_RUNTIME_DIR || env.TMPDIR || env.TMP || env.TEMP || '/tmp';
    return `${prefix.replace(/\/$/, '')}/discord-ipc-${id}`;
  }

  /**
   * Tente de se connecter au premier pipe Discord disponible (0 à 9)
   */
  public async connect(): Promise<boolean> {
    if (this.isConnected) return true;

    for (let i = 0; i < 10; i++) {
      const pipePath = this.getPipePath(i);
      const connected = await this.tryConnectPipe(pipePath);
      if (connected) {
        return true;
      }
    }

    this.scheduleReconnect();
    return false;
  }

  private tryConnectPipe(pipePath: string): Promise<boolean> {
    return new Promise((resolve) => {
      const socket = net.createConnection(pipePath);

      const onConnect = () => {
        cleanup();
        this.socket = socket;
        this.setupSocketHandlers();
        this.sendHandshake();
        resolve(true);
      };

      const onError = () => {
        cleanup();
        socket.destroy();
        resolve(false);
      };

      const cleanup = () => {
        socket.removeListener('connect', onConnect);
        socket.removeListener('error', onError);
      };

      socket.once('connect', onConnect);
      socket.once('error', onError);
    });
  }

  private setupSocketHandlers() {
    if (!this.socket) return;

    this.socket.on('data', (chunk: Buffer) => {
      this.receiveBuffer = Buffer.concat([this.receiveBuffer, chunk]);
      this.processBuffer();
    });

    this.socket.on('close', () => {
      this.handleDisconnect();
    });

    this.socket.on('error', (err) => {
      this.emit('error', err);
    });
  }

  private sendHandshake() {
    const payload = {
      v: 1,
      client_id: this.clientId
    };
    this.sendPacket(DiscordOpCode.HANDSHAKE, payload);
  }

  private sendPacket(op: DiscordOpCode, data: any) {
    if (!this.socket || this.socket.destroyed) return;

    const json = JSON.stringify(data);
    const byteLength = Buffer.byteLength(json, 'utf8');
    const packet = Buffer.alloc(8 + byteLength);

    packet.writeInt32LE(op, 0);
    packet.writeInt32LE(byteLength, 4);
    packet.write(json, 8, byteLength, 'utf8');

    this.socket.write(packet);
  }

  private processBuffer() {
    while (this.receiveBuffer.length >= 8) {
      const op = this.receiveBuffer.readInt32LE(0);
      const length = this.receiveBuffer.readInt32LE(4);

      if (this.receiveBuffer.length < 8 + length) {
        // Le paquet complet n'est pas encore arrivé
        break;
      }

      const payloadBuf = this.receiveBuffer.subarray(8, 8 + length);
      this.receiveBuffer = this.receiveBuffer.subarray(8 + length);

      try {
        const payload = JSON.parse(payloadBuf.toString('utf8'));
        this.handleMessage(op, payload);
      } catch (err) {
        this.emit('error', new Error(`Échec du décodage du paquet IPC: ${err}`));
      }
    }
  }

  private handleMessage(op: DiscordOpCode, payload: any) {
    switch (op) {
      case DiscordOpCode.FRAME:
        if (payload.cmd === 'DISPATCH' && payload.evt === 'READY') {
          this.isConnected = true;
          this.emit('ready', payload.data);
        }
        break;

      case DiscordOpCode.CLOSE:
        this.emit('close', payload);
        this.handleDisconnect();
        break;

      case DiscordOpCode.PING:
        this.sendPacket(DiscordOpCode.PONG, payload);
        break;

      default:
        break;
    }
  }

  private handleDisconnect() {
    const wasConnected = this.isConnected;
    this.isConnected = false;
    if (this.socket) {
      this.socket.destroy();
      this.socket = null;
    }
    this.receiveBuffer = Buffer.alloc(0);

    if (wasConnected) {
      this.emit('disconnected');
    }

    if (this.autoReconnect) {
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimeout) return;
    this.reconnectTimeout = setTimeout(async () => {
      this.reconnectTimeout = null;
      if (!this.isConnected) {
        await this.connect();
      }
    }, 10000);
  }

  /**
   * Envoie une mise à jour d'activité Rich Presence
   */
  public async setActivity(activity: DiscordActivityPayload): Promise<void> {
    if (!this.isConnected || !this.socket) {
      return;
    }

    const payload = {
      cmd: 'SET_ACTIVITY',
      args: {
        pid: process.pid,
        activity
      },
      nonce: crypto.randomUUID()
    };

    this.sendPacket(DiscordOpCode.FRAME, payload);
  }

  /**
   * Efface le statut Rich Presence
   */
  public async clearActivity(): Promise<void> {
    if (!this.isConnected || !this.socket) {
      return;
    }

    const payload = {
      cmd: 'SET_ACTIVITY',
      args: {
        pid: process.pid,
        activity: null
      },
      nonce: crypto.randomUUID()
    };

    this.sendPacket(DiscordOpCode.FRAME, payload);
  }

  public get connected(): boolean {
    return this.isConnected;
  }

  public destroy() {
    this.autoReconnect = false;
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    if (this.socket) {
      this.socket.destroy();
      this.socket = null;
    }
    this.isConnected = false;
  }
}
