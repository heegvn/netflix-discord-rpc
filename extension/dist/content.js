class NetflixScraper {
    isEnabled = true;
    lastStatus = 'IDLE';
    checkInterval = null;
    videoElement = null;
    constructor() {
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
    sendMessage(msg) {
        try {
            chrome.runtime.sendMessage(msg);
        }
        catch { }
    }
    sendClearPresence() {
        this.sendMessage({ type: 'CLEAR_PRESENCE' });
        this.lastStatus = 'IDLE';
    }
    startWatcher() {
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
            video.addEventListener('play', () => this.checkPlayback());
            video.addEventListener('pause', () => this.checkPlayback());
            video.addEventListener('ended', () => this.sendClearPresence());
            video.addEventListener('seeked', () => this.checkPlayback());
        }
    }
    parseMediaInfo() {
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
            const altTitle = document.querySelector('.video-title, .ellipsize-text');
            if (altTitle && altTitle.textContent) {
                rawTitle = altTitle.textContent.trim();
            }
        }
        if (!rawTitle) {
            const docTitle = document.title || '';
            const cleaned = docTitle.replace(/\s*[-|]\s*Netflix.*$/i, '').trim();
            if (cleaned) {
                rawTitle = cleaned;
            }
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
        return {
            title: mainTitle,
            season,
            episode,
            episodeTitle
        };
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
        const isPlaying = !video.paused && !video.ended && video.readyState > 2;
        const status = isPlaying ? 'PLAYING' : 'PAUSED';
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
