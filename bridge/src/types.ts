export type PlaybackStatus = 'PLAYING' | 'PAUSED' | 'IDLE';

export interface NetflixPresenceData {
  status: PlaybackStatus;
  title: string;
  season?: number;
  episode?: number;
  episodeTitle?: string;
  currentTime: number; // current video position in seconds
  duration: number; // total duration in seconds
  url?: string;
  updatedAt: number; // timestamp in milliseconds
}

export interface BridgeMessage {
  type: 'UPDATE_PRESENCE' | 'CLEAR_PRESENCE' | 'PING';
  data?: NetflixPresenceData;
}

export interface BridgeStatusResponse {
  type: 'STATUS';
  discordConnected: boolean;
  activePresence: boolean;
  clientCount: number;
}
