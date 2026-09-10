class NetflixScraper {
    isEnabled = true;
    lastStatus = 'IDLE';
    checkInterval = null;
    videoElement = null;
    showInfoCache = new Map();
    constructor() {
        console.log('[Netflix RPC] Extension content script initialized on Netflix!');
        this.initSettings();
        this.startWatcher();
    }
    initSettings() {
        chrome.storage.local.get(['rpcEnabled'], (result) => {
            this.isEnabled = result.rpcEnabled !== false;
        });
        chrome.storage.onChanged.addListener((changes, area) => {
            if (area === 'local' && changes.rpcEnabled !== undefined) {
                this.isEnabled = changes.rpcEnabled.newValue !== false;
                if (!this.isEnabled) {
                    this.sendClearPresence();
                }
                else {
                    this.checkPlayback();
                }
            }
        });
    }
    async postToBridge(path, body) {
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
            }
            catch { }
        }
        return false;
    }
    sendMessage(msg) {
        if (msg.type === 'UPDATE_PRESENCE' && msg.data) {
            console.log('[Netflix RPC] Sending presence:', msg.data.title, msg.data.status);
            this.postToBridge('/activity', msg.data);
            chrome.storage.local.set({
                currentMedia: msg.data,
                bridgeConnected: true
            });
        }
        else if (msg.type === 'CLEAR_PRESENCE') {
            this.postToBridge('/clear');
            chrome.storage.local.set({ currentMedia: null });
        }
    }
    sendClearPresence() {
        this.sendMessage({ type: 'CLEAR_PRESENCE' });
        this.lastStatus = 'IDLE';
    }
    startWatcher() {
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
    onUrlChanged() {
        if (!this.isWatchUrl()) {
            this.sendClearPresence();
        }
        else {
            setTimeout(() => this.checkPlayback(), 1000);
        }
    }
    isWatchUrl() {
        return window.location.pathname.startsWith('/watch');
    }
    attachVideoListeners() {
        const video = document.querySelector('video');
        if (video && video !== this.videoElement) {
            this.videoElement = video;
            console.log('[Netflix RPC] Video element found!');
            video.addEventListener('play', () => this.checkPlayback());
            video.addEventListener('pause', () => this.checkPlayback());
            video.addEventListener('ended', () => this.sendClearPresence());
            video.addEventListener('seeked', () => this.checkPlayback());
        }
    }
    parseMediaInfo() {
        const watchKey = window.location.pathname;
        let rawTitle = '';
        let rawEpisodeDetail = '';
        const titleContainer = document.querySelector('[data-uia="video-title"]');
        if (titleContainer) {
            const h4 = titleContainer.querySelector('h4');
            const spans = titleContainer.querySelectorAll('span');
            if (h4 && h4.textContent) {
                rawTitle = h4.textContent.trim();
                const spanTexts = [];
                spans.forEach(s => {
                    if (s.textContent?.trim())
                        spanTexts.push(s.textContent.trim());
                });
                rawEpisodeDetail = spanTexts.join(' - ');
            }
            else if (titleContainer.textContent) {
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
            return this.showInfoCache.get(watchKey);
        }
        if (!rawTitle) {
            rawTitle = 'Netflix Video';
        }
        let mainTitle = rawTitle;
        let season = undefined;
        let episode = undefined;
        let episodeTitle = undefined;
        const fullText = (rawEpisodeDetail ? `${rawTitle} ${rawEpisodeDetail}` : rawTitle).trim();
        const seMatch = fullText.match(/(.*?)\s+S(?:eason|aison)?\s*(\d+)[:\s]*E(?:pisode)?\s*(\d+)\s*(.*)/i);
        if (seMatch) {
            if (seMatch[1]?.trim())
                mainTitle = seMatch[1].trim();
            season = parseInt(seMatch[2], 10);
            episode = parseInt(seMatch[3], 10);
            if (seMatch[4]?.trim())
                episodeTitle = seMatch[4].trim().replace(/^[-:]\s*/, '');
        }
        else {
            const eMatch = fullText.match(/(.*?)\s+E(?:pisode|p)?\s*(\d+)\s*(.*)/i);
            if (eMatch) {
                if (eMatch[1]?.trim())
                    mainTitle = eMatch[1].trim();
                episode = parseInt(eMatch[2], 10);
                if (eMatch[3]?.trim())
                    episodeTitle = eMatch[3].trim().replace(/^[-:]\s*/, '');
            }
        }
        if (rawEpisodeDetail && !episodeTitle) {
            episodeTitle = rawEpisodeDetail;
        }
        const info = {
            title: mainTitle,
            season,
            episode,
            episodeTitle
        };
        if (mainTitle !== 'Netflix Video') {
            this.showInfoCache.set(watchKey, info);
        }
        return info;
    }
    checkPlayback() {
        if (!this.isEnabled) {
            return;
        }
        if (!this.isWatchUrl()) {
            if (this.lastStatus !== 'IDLE') {
                this.sendClearPresence();
            }
            return;
        }
        const video = document.querySelector('video');
        if (!video) {
            return;
        }
        const isPaused = video.paused || video.ended;
        const status = isPaused ? 'PAUSED' : 'PLAYING';
        const info = this.parseMediaInfo();
        const data = {
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
        this.sendMessage({
            type: 'UPDATE_PRESENCE',
            data
        });
    }
}
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => new NetflixScraper());
}
else {
    new NetflixScraper();
}
export {};
