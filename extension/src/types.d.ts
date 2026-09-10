type PlaybackStatus = 'PLAYING' | 'PAUSED' | 'IDLE';

interface NetflixPresenceData {
  status: PlaybackStatus;
  title: string;
  season?: number;
  episode?: number;
  episodeTitle?: string;
  currentTime: number;
  duration: number;
  url?: string;
  imageUrl?: string;
  updatedAt: number;
}

interface BridgeMessage {
  type: 'UPDATE_PRESENCE' | 'CLEAR_PRESENCE' | 'PING';
  data?: NetflixPresenceData;
}

interface BridgeStatusResponse {
  type: 'STATUS' | 'PONG';
  discordConnected: boolean;
  activePresence: boolean;
  clientCount?: number;
}
