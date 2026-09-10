class NetflixScraper {
    ws = null;
    isEnabled = true;
    lastStatus = 'IDLE';
    lastUrl = '';
    checkInterval = null;
    reconnectTimer = null;
    videoElement = null;
    constructor() {
        this.initSettings();
        this.initWebSocket();
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
    initWebSocket() {
        if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
            return;
        }
        try {
            this.ws = new WebSocket('ws://127.0.0.1:7777');
            this.ws.onopen = () => {
                console.log('[Netflix RPC] Connecté au pont local ws://127.0.0.1:7777');
                this.checkPlayback();
            };
            this.ws.onclose = () => {
                this.ws = null;
                this.scheduleReconnect();
            };
            this.ws.onerror = () => {
                // En cas d'erreur de connexion, fermer et attendre
                if (this.ws) {
                    this.ws.close();
                }
            };
        }
        catch {
            this.scheduleReconnect();
        }
    }
    scheduleReconnect() {
        if (this.reconnectTimer)
            return;
        this.reconnectTimer = window.setTimeout(() => {
            this.reconnectTimer = null;
            this.initWebSocket();
        }, 4000);
    }
    sendMessage(msg) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(msg));
        }
    }
    sendClearPresence() {
        this.sendMessage({ type: 'CLEAR_PRESENCE' });
        this.lastStatus = 'IDLE';
    }
    startWatcher() {
        // Vérification périodique toutes les 2.5 secondes
        this.checkInterval = window.setInterval(() => {
            this.checkPlayback();
        }, 2500);
        // Écoute des navigations SPA de Netflix (URL change)
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
        let mainTitle = '';
        let episodeDetail = '';
        // Sélecteur standard Netflix pour le titre en cours de lecture
        const titleContainer = document.querySelector('[data-uia="video-title"]');
        if (titleContainer) {
            const h4 = titleContainer.querySelector('h4');
            const spans = titleContainer.querySelectorAll('span');
            if (h4 && h4.textContent) {
                mainTitle = h4.textContent.trim();
                const spanTexts = [];
                spans.forEach(s => {
                    if (s.textContent?.trim())
                        spanTexts.push(s.textContent.trim());
                });
                episodeDetail = spanTexts.join(' - ');
            }
            else if (titleContainer.textContent) {
                mainTitle = titleContainer.textContent.trim();
            }
        }
        // Fallback 1: sélecteur alternatif de classes
        if (!mainTitle) {
            const altTitle = document.querySelector('.video-title, .ellipsize-text');
            if (altTitle && altTitle.textContent) {
                mainTitle = altTitle.textContent.trim();
            }
        }
        // Fallback 2: Balise <title> de la page
        if (!mainTitle) {
            const docTitle = document.title || '';
            // Ex: "Stranger Things | Netflix" ou "Breaking Bad: S1:E1 - Netflix"
            const cleaned = docTitle.replace(/\s*[-|]\s*Netflix.*$/i, '').trim();
            if (cleaned) {
                mainTitle = cleaned;
            }
        }
        if (!mainTitle) {
            mainTitle = 'Contenu Netflix';
        }
        // Analyse des numéros de saison et d'épisode
        let season = undefined;
        let episode = undefined;
        let episodeTitle = undefined;
        const parseSource = (episodeDetail || mainTitle);
        // Recherche "S1:E3" ou "S1 : E3" ou "Saison 1 Épisode 3"
        const seMatch = parseSource.match(/S(?:aison\s*)?(\d+)[:\s]*E(?:pisode\s*)?(\d+)/i);
        if (seMatch) {
            season = parseInt(seMatch[1], 10);
            episode = parseInt(seMatch[2], 10);
        }
        else {
            // Recherche uniquement épisode (ex: Épisode 4)
            const epMatch = parseSource.match(/É?E?pisode\s*(\d+)/i);
            if (epMatch) {
                episode = parseInt(epMatch[1], 10);
            }
        }
        if (episodeDetail) {
            // Nettoyer le détail pour obtenir le nom de l'épisode s'il existe
            const cleanedEp = episodeDetail.replace(/S(?:aison\s*)?\d+[:\s]*E(?:pisode\s*)?\d+/i, '').replace(/^[-\s:]+/, '').trim();
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
        this.lastUrl = window.location.href;
        this.sendMessage({
            type: 'UPDATE_PRESENCE',
            data
        });
    }
}
// Initialisation dès que le document est prêt
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => new NetflixScraper());
}
else {
    new NetflixScraper();
}
export {};
