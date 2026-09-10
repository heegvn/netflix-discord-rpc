import { BridgeStatusResponse } from './types.js';

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
    this.checkBridgeStatus();
  }

  private initListeners() {
    this.rpcToggle?.addEventListener('change', () => {
      const enabled = this.rpcToggle?.checked ?? true;
      chrome.storage.local.set({ rpcEnabled: enabled }, () => {
        console.log('[Popup] Rich presence enabled:', enabled);
      });
    });

    this.refreshBtn?.addEventListener('click', () => {
      this.checkBridgeStatus();
    });
  }

  private loadState() {
    chrome.storage.local.get(['rpcEnabled'], (result) => {
      if (this.rpcToggle) {
        this.rpcToggle.checked = result.rpcEnabled !== false;
      }
    });
  }

  private async checkBridgeStatus() {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);

      const res = await fetch('http://127.0.0.1:7777/status', {
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = (await res.json()) as BridgeStatusResponse;
        this.setBridgeConnected(true);
        this.setDiscordConnected(data.discordConnected);
      } else {
        this.setBridgeConnected(false);
      }
    } catch {
      this.setBridgeConnected(false);
    }
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
