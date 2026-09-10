class PopupController {
  private rpcToggle = document.getElementById('rpcToggle') as HTMLInputElement | null;
  private bridgeStatus = document.getElementById('bridgeStatus') as HTMLElement | null;
  private discordStatus = document.getElementById('discordStatus') as HTMLElement | null;
  private mediaTitle = document.getElementById('mediaTitle') as HTMLElement | null;
  private mediaSubtitle = document.getElementById('mediaSubtitle') as HTMLElement | null;
  private helpSection = document.getElementById('helpSection') as HTMLElement | null;
  private refreshBtn = document.getElementById('refreshBtn') as HTMLButtonElement | null;
  private pollTimer: number | null = null;

  constructor() {
    this.initListeners();
    this.loadState();
    this.checkBridgeStatus();
    this.startPolling();
  }

  private initListeners() {
    this.rpcToggle?.addEventListener('change', () => {
      const enabled = this.rpcToggle?.checked ?? true;
      chrome.storage.local.set({ rpcEnabled: enabled });
      if (!enabled) {
        this.fetchWithFallback('/clear', { method: 'POST' }).catch(() => {});
      }
    });

    this.refreshBtn?.addEventListener('click', () => {
      this.checkBridgeStatus();
    });
  }

  private loadState() {
    chrome.storage.local.get(['rpcEnabled', 'currentMedia'], (result) => {
      if (this.rpcToggle) {
        this.rpcToggle.checked = result.rpcEnabled !== false;
      }
      if (result.currentMedia) {
        this.renderMedia(result.currentMedia as NetflixPresenceData);
      }
    });
  }

  private startPolling() {
    this.pollTimer = window.setInterval(() => {
      this.checkBridgeStatus();
    }, 2500);
  }

  private async fetchWithFallback(path: string, options?: RequestInit): Promise<Response | null> {
    const urls = [
      `http://127.0.0.1:7777${path}`,
      `http://localhost:7777${path}`
    ];

    for (const url of urls) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3500);
        const res = await fetch(url, { ...options, signal: controller.signal });
        clearTimeout(timeoutId);
        if (res.ok) {
          return res;
        }
      } catch (err) {
        console.warn(`[Popup] Failed to fetch ${url}:`, err);
      }
    }
    return null;
  }

  private async checkBridgeStatus() {
    try {
      chrome.runtime.sendMessage({ type: 'PING' }, (res) => {
        if (!chrome.runtime.lastError && res && res.connected) {
          this.setBridgeConnected(true);
          if (res.data?.discordConnected !== undefined) {
            this.setDiscordConnected(res.data.discordConnected === true);
          }
          if (res.data?.currentMedia) {
            this.renderMedia(res.data.currentMedia);
          }
        }
      });

      const res = await this.fetchWithFallback('/status');

      if (res && res.ok) {
        const data = await res.json();
        this.setBridgeConnected(true);
        this.setDiscordConnected(data.discordConnected === true);

        if (data.currentMedia) {
          this.renderMedia(data.currentMedia as NetflixPresenceData);
        } else {
          chrome.storage.local.get(['currentMedia'], (stored) => {
            if (stored.currentMedia) {
              this.renderMedia(stored.currentMedia as NetflixPresenceData);
            }
          });
        }
      } else {
        chrome.storage.local.get(['bridgeConnected', 'discordConnected', 'currentMedia'], (stored) => {
          if (stored.bridgeConnected) {
            this.setBridgeConnected(true);
            this.setDiscordConnected(stored.discordConnected === true);
            if (stored.currentMedia) {
              this.renderMedia(stored.currentMedia as NetflixPresenceData);
            }
          } else {
            this.setBridgeConnected(false);
          }
        });
      }
    } catch (err) {
      chrome.storage.local.get(['bridgeConnected', 'discordConnected', 'currentMedia'], (stored) => {
        if (stored.bridgeConnected) {
          this.setBridgeConnected(true);
          this.setDiscordConnected(stored.discordConnected === true);
          if (stored.currentMedia) {
            this.renderMedia(stored.currentMedia as NetflixPresenceData);
          }
        } else {
          this.setBridgeConnected(false);
        }
      });
    }
  }

  private renderMedia(media: NetflixPresenceData | null) {
    if (!this.mediaTitle || !this.mediaSubtitle) return;

    if (!media || media.status === 'IDLE') {
      this.mediaTitle.textContent = 'No video playing';
      this.mediaSubtitle.textContent = 'Browse Netflix to start watching';
      return;
    }

    this.mediaTitle.textContent = media.title;

    let sub = '';
    if (media.season && media.episode) {
      sub = `Season ${media.season}: Episode ${media.episode}`;
      if (media.episodeTitle) sub += ` - ${media.episodeTitle}`;
    } else if (media.episode) {
      sub = `Episode ${media.episode}`;
      if (media.episodeTitle) sub += ` - ${media.episodeTitle}`;
    } else if (media.episodeTitle) {
      sub = media.episodeTitle;
    } else {
      sub = media.status === 'PLAYING' ? 'Playing' : 'Paused';
    }

    this.mediaSubtitle.textContent = sub;
  }

  private setBridgeConnected(connected: boolean) {
    if (!this.bridgeStatus) return;

    if (connected) {
      this.bridgeStatus.className = 'status-pill status-connected';
      this.bridgeStatus.innerHTML = '<span class="dot"></span><span class="text">Connected</span>';
      this.helpSection?.classList.remove('visible');
    } else {
      this.bridgeStatus.className = 'status-pill status-disconnected';
      this.bridgeStatus.innerHTML = '<span class="dot"></span><span class="text">Disconnected</span>';
      this.discordStatus?.setAttribute('class', 'status-pill status-disconnected');
      if (this.discordStatus) {
        this.discordStatus.innerHTML = '<span class="dot"></span><span class="text">Disconnected</span>';
      }
      this.helpSection?.classList.add('visible');
    }
  }

  private setDiscordConnected(connected: boolean) {
    if (!this.discordStatus) return;

    if (connected) {
      this.discordStatus.className = 'status-pill status-connected';
      this.discordStatus.innerHTML = '<span class="dot"></span><span class="text">Connected</span>';
    } else {
      this.discordStatus.className = 'status-pill status-disconnected';
      this.discordStatus.innerHTML = '<span class="dot"></span><span class="text">Waiting</span>';
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new PopupController();
});
