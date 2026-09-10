import { NetflixPresenceData } from './types.js';

class PopupController {
  private rpcToggle = document.getElementById('rpcToggle') as HTMLInputElement | null;
  private bridgeStatus = document.getElementById('bridgeStatus') as HTMLElement | null;
  private discordStatus = document.getElementById('discordStatus') as HTMLElement | null;
  private mediaTitle = document.getElementById('mediaTitle') as HTMLElement | null;
  private mediaSubtitle = document.getElementById('mediaSubtitle') as HTMLElement | null;
  private helpSection = document.getElementById('helpSection') as HTMLElement | null;
  private refreshBtn = document.getElementById('refreshBtn') as HTMLButtonElement | null;

  constructor() {
    this.initListeners();
    this.loadState();
    this.pingBackground();
  }

  private initListeners() {
    this.rpcToggle?.addEventListener('change', () => {
      const enabled = this.rpcToggle?.checked ?? true;
      chrome.storage.local.set({ rpcEnabled: enabled });
    });

    this.refreshBtn?.addEventListener('click', () => {
      this.pingBackground();
    });

    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === 'local') {
        if (changes.bridgeConnected !== undefined) {
          this.setBridgeConnected(changes.bridgeConnected.newValue === true);
        }
        if (changes.discordConnected !== undefined) {
          this.setDiscordConnected(changes.discordConnected.newValue === true);
        }
        if (changes.currentMedia !== undefined) {
          this.renderMedia(changes.currentMedia.newValue as NetflixPresenceData | null);
        }
      }
    });
  }

  private loadState() {
    chrome.storage.local.get(['rpcEnabled', 'bridgeConnected', 'discordConnected', 'currentMedia'], (result) => {
      if (this.rpcToggle) {
        this.rpcToggle.checked = result.rpcEnabled !== false;
      }
      this.setBridgeConnected(result.bridgeConnected === true);
      this.setDiscordConnected(result.discordConnected === true);
      this.renderMedia(result.currentMedia as NetflixPresenceData | null);
    });
  }

  private pingBackground() {
    try {
      chrome.runtime.sendMessage({ type: 'PING' }, (response) => {
        if (chrome.runtime.lastError) {
          this.setBridgeConnected(false);
          return;
        }
        if (response && response.connected !== undefined) {
          this.setBridgeConnected(response.connected === true);
        }
      });
    } catch {
      this.setBridgeConnected(false);
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
