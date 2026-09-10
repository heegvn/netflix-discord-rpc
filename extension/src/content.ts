import { BridgeMessage, NetflixPresenceData, PlaybackStatus } from './types.js';

class NetflixScraper {
  private ws: WebSocket | null = null;
  private isEnabled: boolean = true;
  private lastStatus: PlaybackStatus = 'IDLE';
  private lastUrl: string = '';
  private checkInterval: number | null = null;
  private reconnectTimer: number | null = null;
  private videoElement: HTMLVideoElement | null = null;

  constructor() {
    this.initSettings();
    this.initWebSocket();
    this.startWatcher();
  }

  private initSettings() {
    chrome.storage.local.get(['rpcEnabled'], (result) => {
      this.isEnabled = result.rpcEnabled !== false;
    });

    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === 'local' && changes.rpcEnabled !== undefined) {
        this.isEnabled = changes.rpcEnabled.newValue !== false;
        if (!this.isEnabled) {
          this.sendClearPresence();
        } else {
          this.checkPlayback();
        }
      }
    });
  }

  private initWebSocket() {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    try {
      this.ws = new WebSocket('ws://127.0.0.1:7777');

      this.ws.onopen = () => {
        console.log('[Netflix RPC] Connected to local bridge ws://127.0.0.1:7777');
        this.checkPlayback();
      };

      this.ws.onclose = () => {
        this.ws = null;
        this.scheduleReconnect();
      };

      this.ws.onerror = () => {
        if (this.ws) {
          this.ws.close();
        }
      };
    } catch {
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) return;
    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null;
      this.initWebSocket();
    }, 4000);
  }

  private sendMessage(msg: BridgeMessage) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  private sendClearPresence() {
    this.sendMessage({ type: 'CLEAR_PRESENCE' });
    this.lastStatus = 'IDLE';
  }

  private startWatcher() {
    this.checkInterval = window.setInterval(() => {
      this.checkPlayback();
    }, 2500);

    let currentHref = location.href;
    const observer = new MutationObserver(() => {
      if (location.href !== currentHref) {
        currentHref = location.href;
        this.onUrlChanged();
      }
      this.attachVideoListeners();
    });

    observer.observe(document.body || document.documentElement, {
      childList: true,
      subtree: true
    });
  }

  private onUrlChanged() {
    if (!this.isWatchUrl()) {
      this.sendClearPresence();
    } else {
      setTimeout(() => this.checkPlayback(), 1000);
    }
  }

  private isWatchUrl(): boolean {
    return window.location.pathname.startsWith('/watch');
  }

  private attachVideoListeners() {
    const video = document.querySelector('video') as HTMLVideoElement | null;
    if (video && video !== this.videoElement) {
      this.videoElement = video;
      video.addEventListener('play', () => this.checkPlayback());
      video.addEventListener('pause', () => this.checkPlayback());
      video.addEventListener('ended', () => this.sendClearPresence());
      video.addEventListener('seeked', () => this.checkPlayback());
    }
  }

  private parseMediaInfo(): { title: string; season?: number; episode?: number; episodeTitle?: string } {
    let mainTitle = '';
    let episodeDetail = '';

    const titleContainer = document.querySelector('[data-uia="video-title"]') as HTMLElement | null;
    if (titleContainer) {
      const h4 = titleContainer.querySelector('h4');
      const spans = titleContainer.querySelectorAll('span');

      if (h4 && h4.textContent) {
        mainTitle = h4.textContent.trim();
        const spanTexts: string[] = [];
        spans.forEach(s => {
          if (s.textContent?.trim()) spanTexts.push(s.textContent.trim());
        });
        episodeDetail = spanTexts.join(' - ');
      } else if (titleContainer.textContent) {
        mainTitle = titleContainer.textContent.trim();
      }
    }

    if (!mainTitle) {
      const altTitle = document.querySelector('.video-title, .ellipsize-text');
      if (altTitle && altTitle.textContent) {
        mainTitle = altTitle.textContent.trim();
      }
    }

    if (!mainTitle) {
      const docTitle = document.title || '';
      const cleaned = docTitle.replace(/\s*[-|]\s*Netflix.*$/i, '').trim();
      if (cleaned) {
        mainTitle = cleaned;
      }
    }

    if (!mainTitle) {
      mainTitle = 'Netflix Video';
    }

    let season: number | undefined = undefined;
    let episode: number | undefined = undefined;
    let episodeTitle: string | undefined = undefined;

    const parseSource = (episodeDetail || mainTitle);

    const seMatch = parseSource.match(/S(?:eason|aison)?\s*(\d+)[:\s]*E(?:pisode)?\s*(\d+)/i);
    if (seMatch) {
      season = parseInt(seMatch[1], 10);
      episode = parseInt(seMatch[2], 10);
    } else {
      const epMatch = parseSource.match(/E(?:pisode|p)?\s*(\d+)/i);
      if (epMatch) {
        episode = parseInt(epMatch[1], 10);
      }
    }

    if (episodeDetail) {
      const cleanedEp = episodeDetail.replace(/S(?:eason|aison)?\s*\d+[:\s]*E(?:pisode)?\s*\d+/i, '').replace(/^[-\s:]+/, '').trim();
      if (cleanedEp) {
        episodeTitle = cleanedEp;
      }
    }

    return {
      title: mainTitle,
      season,
      episode,
      episodeTitle
    };
  }

  private checkPlayback() {
    if (!this.isEnabled) {
      return;
    }

    if (!this.isWatchUrl()) {
      if (this.lastStatus !== 'IDLE') {
        this.sendClearPresence();
      }
      return;
    }

    const video = document.querySelector('video') as HTMLVideoElement | null;
    if (!video) {
      return;
    }

    const isPlaying = !video.paused && !video.ended && video.readyState > 2;
    const status: PlaybackStatus = isPlaying ? 'PLAYING' : 'PAUSED';

    const info = this.parseMediaInfo();

    const data: NetflixPresenceData = {
      status,
      title: info.title,
      season: info.season,
      episode: info.episode,
      episodeTitle: info.episodeTitle,
      currentTime: video.currentTime || 0,
      duration: isFinite(video.duration) ? video.duration : 0,
      url: window.location.href,
      updatedAt: Date.now()
    };

    this.lastStatus = status;
    this.lastUrl = window.location.href;

    this.sendMessage({
      type: 'UPDATE_PRESENCE',
      data
    });
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => new NetflixScraper());
} else {
  new NetflixScraper();
}
