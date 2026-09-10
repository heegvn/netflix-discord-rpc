class BackgroundService {
    ws = null;
    isConnected = false;
    reconnectTimer = null;
    lastPresenceData = null;
    constructor() {
        this.initWebSocket();
        this.initMessageListener();
    }
    initWebSocket() {
        if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
            return;
        }
        try {
            this.ws = new WebSocket('ws://127.0.0.1:7777');
            this.ws.onopen = () => {
                this.isConnected = true;
                chrome.storage.local.set({ bridgeConnected: true });
                if (this.lastPresenceData) {
                    this.sendToBridge({ type: 'UPDATE_PRESENCE', data: this.lastPresenceData });
                }
            };
            this.ws.onmessage = (event) => {
                try {
                    const res = JSON.parse(event.data);
                    if (res.type === 'STATUS' || res.type === 'PONG') {
                        chrome.storage.local.set({
                            bridgeConnected: true,
                            discordConnected: res.discordConnected
                        });
                    }
                }
                catch { }
            };
            this.ws.onclose = () => {
                this.isConnected = false;
                this.ws = null;
                chrome.storage.local.set({ bridgeConnected: false, discordConnected: false });
                this.scheduleReconnect();
            };
            this.ws.onerror = () => {
                if (this.ws)
                    this.ws.close();
            };
        }
        catch {
            this.scheduleReconnect();
        }
    }
    scheduleReconnect() {
        if (this.reconnectTimer)
            return;
        this.reconnectTimer = setTimeout(() => {
            this.reconnectTimer = null;
            this.initWebSocket();
        }, 4000);
    }
    sendToBridge(msg) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(msg));
        }
    }
    initMessageListener() {
        chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
            if (message.type === 'UPDATE_PRESENCE') {
                this.lastPresenceData = message.data || null;
                chrome.storage.local.set({ currentMedia: message.data || null });
                this.sendToBridge(message);
                sendResponse({ success: true });
            }
            else if (message.type === 'CLEAR_PRESENCE') {
                this.lastPresenceData = null;
                chrome.storage.local.set({ currentMedia: null });
                this.sendToBridge(message);
                sendResponse({ success: true });
            }
            else if (message.type === 'PING') {
                if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                    this.ws.send(JSON.stringify({ type: 'PING' }));
                }
                else {
                    this.initWebSocket();
                }
                sendResponse({ success: true, connected: this.isConnected });
            }
            return true;
        });
    }
}
new BackgroundService();
export {};
