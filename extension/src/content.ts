import { BridgeMessage, NetflixPresenceData, PlaybackStatus } from './types.js';

interface CachedShowInfo {
  title: string;
  season?: number;
  episode?: number;
  episodeTitle?: string;
  imageUrl?: string;
}

class NetflixScraper {
  private isEnabled: boolean = true;
  private lastStatus: PlaybackStatus = 'IDLE';
  private checkInterval: number | null = null;
  private videoElement: HTMLVideoElement | null = null;
  private showInfoCache: Map<string, CachedShowInfo> = new Map();
  private fetchingId: string | null = null;

  constructor() {
    console.log('[Netflix RPC] Extension content script initialized on Netflix!');
    this.initSettings();
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

  private async postToBridge(path: string, body?: any) {
    const urls = [
      `http://127.0.0.1:7777${path}`,
      `http://localhost:7777${path}`
    ];

    for (const url of urls) {
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: body ? JSON.stringify(body) : undefined
        });
        if (res.ok) {
          return true;
        }
      } catch {}
    }
    return false;
  }

  private sendMessage(msg: BridgeMessage) {
    try {
      chrome.runtime.sendMessage(msg, () => {
        if (chrome.runtime.lastError) {}
      });
    } catch {}

    if (msg.type === 'UPDATE_PRESENCE' && msg.data) {
      this.postToBridge('/activity', msg.data);

      chrome.storage.local.set({
        currentMedia: msg.data,
        bridgeConnected: true
      });
    } else if (msg.type === 'CLEAR_PRESENCE') {
      this.postToBridge('/clear');
      chrome.storage.local.set({ currentMedia: null });
    }
  }

  private sendClearPresence() {
    this.sendMessage({ type: 'CLEAR_PRESENCE' });
    this.lastStatus = 'IDLE';
  }

  private startWatcher() {
    this.checkInterval = window.setInterval(() => {
      this.checkPlayback();
    }, 2000);

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
      setTimeout(() => this.checkPlayback(), 500);
    }
  }

  private isWatchUrl(): boolean {
    return window.location.pathname.startsWith('/watch');
  }

  private getMediaId(): string | null {
    const match = window.location.pathname.match(/\/watch\/(\d+)/);
    return match ? match[1] : null;
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

  private async fetchNetflixMetadata(mediaId: string): Promise<Partial<CachedShowInfo>> {
    try {
      const res = await fetch(`https://www.netflix.com/nq/website/memberapi/release/metadata?movieid=${mediaId}`);
      if (res.ok) {
        const json = await res.json();
        const video = json?.video;
        if (!video) return {};

        const title = video.title || '';
        let seasonNum: number | undefined;
        let epNum: number | undefined;
        let epTitle: string | undefined;
        let imageUrl: string | undefined = video.boxart?.[0]?.url || video.storyart?.[0]?.url;

        if (video.type === 'show' && video.seasons) {
          const currentEpId = video.currentEpisode;
          const currentSeason = video.seasons.find((s: any) =>
            s.episodes?.some((e: any) => e.episodeId === currentEpId)
          );
          if (currentSeason) {
            seasonNum = currentSeason.seq;
            const currentEp = currentSeason.episodes?.find((e: any) => e.episodeId === currentEpId);
            if (currentEp) {
              epNum = currentEp.seq;
              epTitle = currentEp.title;
              if (!imageUrl && currentEp.thumbs?.[0]?.url) {
                imageUrl = currentEp.thumbs[0].url;
              }
            }
          }
        }

        if (!imageUrl) {
          const og = document.querySelector('meta[property="og:image"]')?.getAttribute('content');
          if (og && og.startsWith('http')) {
            imageUrl = og;
          }
        }

        return {
          title,
          season: seasonNum,
          episode: epNum,
          episodeTitle: epTitle,
          imageUrl
        };
      }
    } catch {}
    return {};
  }

  private parseMediaInfoFromDom(): CachedShowInfo {
    const watchKey = window.location.pathname;

    let rawTitle = '';
    let rawEpisodeDetail = '';

    const titleContainer = document.querySelector('[data-uia="video-title"]') as HTMLElement | null;
    if (titleContainer) {
      const h4 = titleContainer.querySelector('h4');
      const spans = titleContainer.querySelectorAll('span');

      if (h4 && h4.textContent) {
        rawTitle = h4.textContent.trim();
        const spanTexts: string[] = [];
        spans.forEach(s => {
          if (s.textContent?.trim()) spanTexts.push(s.textContent.trim());
        });
        rawEpisodeDetail = spanTexts.join(' - ');
      } else if (titleContainer.textContent) {
        rawTitle = titleContainer.textContent.trim();
      }
    }

    if (!rawTitle) {
      const altTitle = document.querySelector('.video-title, .ellipsize-text, [class*="VideoTitle"], [class*="video-title"]');
      if (altTitle && altTitle.textContent) {
        rawTitle = altTitle.textContent.trim();
      }
    }

    if (!rawTitle) {
      const docTitle = document.title || '';
      const cleaned = docTitle.replace(/\s*[-|•]\s*Netflix.*$/i, '').replace(/^Netflix\s*[-|•]\s*/i, '').trim();
      if (cleaned) {
        rawTitle = cleaned;
      }
    }

    if (!rawTitle && this.showInfoCache.has(watchKey)) {
      return this.showInfoCache.get(watchKey)!;
    }

    if (!rawTitle) {
      rawTitle = 'Netflix Video';
    }

    let mainTitle = rawTitle;
    let season: number | undefined = undefined;
    let episode: number | undefined = undefined;
    let episodeTitle: string | undefined = undefined;

    const fullText = (rawEpisodeDetail ? `${rawTitle} ${rawEpisodeDetail}` : rawTitle).trim();

    const seMatch = fullText.match(/(.*?)\s+S(?:eason|aison)?\s*(\d+)[:\s]*E(?:pisode)?\s*(\d+)\s*(.*)/i);
    if (seMatch) {
      if (seMatch[1]?.trim()) mainTitle = seMatch[1].trim();
      season = parseInt(seMatch[2], 10);
      episode = parseInt(seMatch[3], 10);
      if (seMatch[4]?.trim()) episodeTitle = seMatch[4].trim().replace(/^[-:]\s*/, '');
    } else {
      const eMatch = fullText.match(/(.*?)\s+E(?:pisode|p)?\s*(\d+)\s*(.*)/i);
      if (eMatch) {
        if (eMatch[1]?.trim()) mainTitle = eMatch[1].trim();
        episode = parseInt(eMatch[2], 10);
        if (eMatch[3]?.trim()) episodeTitle = eMatch[3].trim().replace(/^[-:]\s*/, '');
      }
    }

    if (rawEpisodeDetail && !episodeTitle) {
      episodeTitle = rawEpisodeDetail;
    }

    let imageUrl: string | undefined = undefined;
    const og = document.querySelector('meta[property="og:image"]')?.getAttribute('content');
    if (og && og.startsWith('http')) {
      imageUrl = og;
    }

    return {
      title: mainTitle,
      season,
      episode,
      episodeTitle,
      imageUrl
    };
  }

  private async checkPlayback() {
    if (!this.isEnabled || !this.isWatchUrl()) {
      if (this.lastStatus !== 'IDLE') {
        this.sendClearPresence();
      }
      return;
    }

    const video = document.querySelector('video') as HTMLVideoElement | null;
    if (!video) {
      return;
    }

    const watchKey = window.location.pathname;
    const mediaId = this.getMediaId();

    if (mediaId && !this.showInfoCache.has(watchKey) && this.fetchingId !== mediaId) {
      this.fetchingId = mediaId;
      this.fetchNetflixMetadata(mediaId).then((meta) => {
        if (meta && meta.title) {
          const merged: CachedShowInfo = {
            title: meta.title,
            season: meta.season,
            episode: meta.episode,
            episodeTitle: meta.episodeTitle,
            imageUrl: meta.imageUrl
          };
          this.showInfoCache.set(watchKey, merged);
          this.checkPlayback();
        }
      });
    }

    let info = this.showInfoCache.get(watchKey);
    if (!info) {
      info = this.parseMediaInfoFromDom();
      if (info.title !== 'Netflix Video') {
        this.showInfoCache.set(watchKey, info);
      }
    }

    const isPaused = video.paused || video.ended;
    const status: PlaybackStatus = isPaused ? 'PAUSED' : 'PLAYING';

    const data: NetflixPresenceData = {
      status,
      title: info.title,
      season: info.season,
      episode: info.episode,
      episodeTitle: info.episodeTitle,
      imageUrl: info.imageUrl,
      currentTime: video.currentTime || 0,
      duration: isFinite(video.duration) ? video.duration : 0,
      url: window.location.href,
      updatedAt: Date.now()
    };

    this.lastStatus = status;
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
