"use strict";
class BackgroundService {
    ws = null;
    isConnected = false;
    reconnectTimer = null;
    lastPresenceData = null;
    constructor() {
        this.initWebSocket();
        this.initMessageListener();
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
                    chrome.storage.local.set({ bridgeConnected: true });
                    return true;
                }
            }
            catch { }
        }
        return false;
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
            if (message.type === 'UPDATE_PRESENCE' && message.data) {
                this.lastPresenceData = message.data;
                chrome.storage.local.set({ currentMedia: message.data });
                this.postToBridge('/activity', message.data);
                this.sendToBridge(message);
                sendResponse({ success: true });
            }
            else if (message.type === 'CLEAR_PRESENCE') {
                this.lastPresenceData = null;
                chrome.storage.local.set({ currentMedia: null });
                this.postToBridge('/clear');
                this.sendToBridge(message);
                sendResponse({ success: true });
            }
            else if (message.type === 'PING') {
                fetch('http://127.0.0.1:7777/status')
                    .then(res => res.json())
                    .then(data => {
                    chrome.storage.local.set({
                        bridgeConnected: true,
                        discordConnected: data.discordConnected
                    });
                    sendResponse({ success: true, connected: true });
                })
                    .catch(() => {
                    sendResponse({ success: true, connected: false });
                });
                return true;
            }
            return true;
        });
    }
}
new BackgroundService();
