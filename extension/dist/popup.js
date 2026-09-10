class PopupController {
    rpcToggle = document.getElementById('rpcToggle');
    bridgeStatus = document.getElementById('bridgeStatus');
    discordStatus = document.getElementById('discordStatus');
    mediaTitle = document.getElementById('mediaTitle');
    mediaSubtitle = document.getElementById('mediaSubtitle');
    helpSection = document.getElementById('helpSection');
    refreshBtn = document.getElementById('refreshBtn');
    pollTimer = null;
    constructor() {
        this.initListeners();
        this.loadState();
        this.checkBridgeStatus();
        this.startPolling();
    }
    initListeners() {
        this.rpcToggle?.addEventListener('change', () => {
            const enabled = this.rpcToggle?.checked ?? true;
            chrome.storage.local.set({ rpcEnabled: enabled });
            if (!enabled) {
                fetch('http://127.0.0.1:7777/clear', { method: 'POST' }).catch(() => { });
            }
        });
        this.refreshBtn?.addEventListener('click', () => {
            this.checkBridgeStatus();
        });
    }
    loadState() {
        chrome.storage.local.get(['rpcEnabled', 'currentMedia'], (result) => {
            if (this.rpcToggle) {
                this.rpcToggle.checked = result.rpcEnabled !== false;
            }
            if (result.currentMedia) {
                this.renderMedia(result.currentMedia);
            }
        });
    }
    startPolling() {
        this.pollTimer = window.setInterval(() => {
            this.checkBridgeStatus();
        }, 2000);
    }
    async checkBridgeStatus() {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 1500);
            const res = await fetch('http://127.0.0.1:7777/status', {
                signal: controller.signal
            });
            clearTimeout(timeoutId);
            if (res.ok) {
                const data = await res.json();
                this.setBridgeConnected(true);
                this.setDiscordConnected(data.discordConnected === true);
                if (data.currentMedia) {
                    this.renderMedia(data.currentMedia);
                }
                else {
                    chrome.storage.local.get(['currentMedia'], (res) => {
                        if (res.currentMedia) {
                            this.renderMedia(res.currentMedia);
                        }
                    });
                }
            }
            else {
                this.setBridgeConnected(false);
            }
        }
        catch {
            this.setBridgeConnected(false);
        }
    }
    renderMedia(media) {
        if (!this.mediaTitle || !this.mediaSubtitle)
            return;
        if (!media || media.status === 'IDLE') {
            this.mediaTitle.textContent = 'No video playing';
            this.mediaSubtitle.textContent = 'Browse Netflix to start watching';
            return;
        }
        this.mediaTitle.textContent = media.title;
        let sub = '';
        if (media.season && media.episode) {
            sub = `Season ${media.season}: Episode ${media.episode}`;
            if (media.episodeTitle)
                sub += ` - ${media.episodeTitle}`;
        }
        else if (media.episode) {
            sub = `Episode ${media.episode}`;
            if (media.episodeTitle)
                sub += ` - ${media.episodeTitle}`;
        }
        else if (media.episodeTitle) {
            sub = media.episodeTitle;
        }
        else {
            sub = media.status === 'PLAYING' ? 'Playing' : 'Paused';
        }
        this.mediaSubtitle.textContent = sub;
    }
    setBridgeConnected(connected) {
        if (!this.bridgeStatus)
            return;
        if (connected) {
            this.bridgeStatus.className = 'status-pill status-connected';
            this.bridgeStatus.innerHTML = '<span class="dot"></span><span class="text">Connected</span>';
            this.helpSection?.classList.remove('visible');
        }
        else {
            this.bridgeStatus.className = 'status-pill status-disconnected';
            this.bridgeStatus.innerHTML = '<span class="dot"></span><span class="text">Disconnected</span>';
            this.discordStatus?.setAttribute('class', 'status-pill status-disconnected');
            if (this.discordStatus) {
                this.discordStatus.innerHTML = '<span class="dot"></span><span class="text">Disconnected</span>';
            }
            this.helpSection?.classList.add('visible');
        }
    }
    setDiscordConnected(connected) {
        if (!this.discordStatus)
            return;
        if (connected) {
            this.discordStatus.className = 'status-pill status-connected';
            this.discordStatus.innerHTML = '<span class="dot"></span><span class="text">Connected</span>';
        }
        else {
            this.discordStatus.className = 'status-pill status-disconnected';
            this.discordStatus.innerHTML = '<span class="dot"></span><span class="text">Waiting</span>';
        }
    }
}
document.addEventListener('DOMContentLoaded', () => {
    new PopupController();
});
export {};
