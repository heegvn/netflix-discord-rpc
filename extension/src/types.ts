export type PlaybackStatus = 'PLAYING' | 'PAUSED' | 'IDLE';

export interface NetflixPresenceData {
  status: PlaybackStatus;
  title: string;
  season?: number;
  episode?: number;
  episodeTitle?: string;
  currentTime: number; // in seconds
  duration: number; // in seconds
  url?: string;
  updatedAt: number; // timestamp ms
}

export interface BridgeMessage {
  type: 'UPDATE_PRESENCE' | 'CLEAR_PRESENCE' | 'PING';
  data?: NetflixPresenceData;
}

export interface BridgeStatusResponse {
  type: 'STATUS' | 'PONG';
  discordConnected: boolean;
  activePresence: boolean;
  clientCount?: number;
}
