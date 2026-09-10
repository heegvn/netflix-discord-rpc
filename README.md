# Netflix Discord Rich Presence

A lightweight browser extension and local companion bridge to display your current Netflix playback on Discord in real-time.

Built in TypeScript with a custom zero-dependency Discord IPC implementation.

---

## Features

- Real-time video detection (movie/show title, season, episode, timeline).
- Automatic play/pause status and playback progress.
- Native Discord IPC integration via local named pipes (no external RPC library).
- Runs locally on port 7777 (`ws://127.0.0.1:7777`).
- Minimal Manifest V3 browser extension with popup toggle.

---

## Prerequisites

- [Node.js](https://nodejs.org) 18 or later
- [Discord Desktop](https://discord.com) running on your computer

---

## Getting Started

### 1. Install and Build

```bash
git clone https://github.com/heegvn/netflix-discord-rpc.git
cd netflix-discord-rpc

npm --prefix bridge install
npm --prefix extension install
npm run build
```

### 2. Run the Bridge

```bash
npm run start
```

*On Windows, you can also double-click `start-bridge.bat`.*

### 3. Load the Browser Extension

1. Open your browser extensions page (`chrome://extensions` or `edge://extensions`).
2. Enable **Developer mode**.
3. Click **Load unpacked** and select the `extension` folder.
4. Navigate to Netflix and play a video.

---

## Project Structure

```
netflix-rpc/
├── bridge/          # Local bridge server (Node.js, TypeScript, native IPC)
│   └── src/
│       ├── discord-ipc.ts
│       ├── discord.ts
│       ├── index.ts
│       └── types.ts
└── extension/       # Browser extension (Manifest V3)
    ├── popup/
    └── src/
```

## Commands

| Command | Description |
| --- | --- |
| `npm run build` | Build both extension and bridge TypeScript projects |
| `npm run build:bridge` | Build bridge TypeScript files only |
| `npm run build:extension` | Build extension TypeScript files only |
| `npm run start` | Start the local bridge |
| `npm run dev:bridge` | Start the bridge in development mode with auto-reload |

---

## Configuration

The default setup includes pre-configured Netflix Discord application assets. To use your own Discord Application ID, see [DISCORD_APP_SETUP.md](DISCORD_APP_SETUP.md).

---

## License

[MIT](LICENSE)
