# 🍿 Netflix Discord Rich Presence

<div align="center">

![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)
![Netflix](https://img.shields.io/badge/Netflix-E50914?style=for-the-badge&logo=netflix&logoColor=white)
![Discord](https://img.shields.io/badge/Discord-5865F2?style=for-the-badge&logo=discord&logoColor=white)
![Manifest V3](https://img.shields.io/badge/Chrome%20MV3-4285F4?style=for-the-badge&logo=googlechrome&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)

**Affichez en temps réel ce que vous regardez sur Netflix dans votre statut Discord.**  
*Titre du contenu, saison & épisode, temps dynamique, pause/lecture automatique et bouton cliquable.*

</div>

---

## ✨ Points forts

- ⚡ **100% TypeScript** : Code typé, modulaire, propre et performant.
- 🛠️ **Protocole Discord IPC fait maison** : Aucune dépendance externe de type `discord-rpc`. Le pont communique directement avec le Named Pipe natif de Discord (`\\.\pipe\discord-ipc-0` sous Windows ou sockets Unix).
- 🔌 **Port 7777** : Communication locale rapide via WebSocket et endpoint HTTP de santé (`ws://127.0.0.1:7777` & `http://127.0.0.1:7777/status`).
- 🎬 **Détection Netflix temps réel** :
  - Nom du film ou de la série
  - Numéro de saison et d'épisode avec sous-titre
  - Synchronisation de la barre de temps Discord (calcul dynamique de la fin)
  - Détection automatique de la mise en pause
  - Bouton interactif pour rediriger vers le média
- 🎨 **Interface Popup moderne** : Interrupteur rapide ON/OFF, indicateurs d'état du pont et de Discord.

---

## 🏗️ Architecture

```
netflix-rpc/
├── package.json              # Scripts npm globaux (build, start, dev)
├── start-bridge.bat          # Lanceur Windows en un double-clic
├── DISCORD_APP_SETUP.md      # Guide pour créer sa propre app Discord personnalisée
├── LICENSE                   # Licence MIT
│
├── bridge/                   # Pont local (Node.js + TypeScript)
│   ├── src/
│   │   ├── discord-ipc.ts    # ⭐ Implémentation native du protocole Discord IPC (zéro dépendance)
│   │   ├── discord.ts        # Gestionnaire de Rich Presence Netflix
│   │   ├── index.ts          # Serveur WebSocket et HTTP sur le port 7777
│   │   └── types.ts          # Types partagés
│   ├── package.json
│   └── tsconfig.json
│
└── extension/                # Extension Navigateur (Manifest V3)
    ├── manifest.json         # Déclaration des permissions et scripts Chrome/Edge
    ├── assets/               # Icônes HD (16x16, 48x48, 128x128)
    ├── popup/                # Interface de l'extension (HTML/CSS)
    │   ├── popup.html
    │   └── popup.css
    ├── src/
    │   ├── content.ts        # Scraper Netflix injecté en temps réel
    │   ├── popup.ts          # Contrôleur TypeScript de la popup
    │   └── types.ts
    └── dist/                 # Fichiers JavaScript générés après compilation
```

---

## 🚀 Installation & Démarrage

### Prérequis
- [Node.js](https://nodejs.org) (v18 ou supérieur)
- L'application [Discord Desktop](https://discord.com) installée et ouverte sur votre PC.

---

### 1. Cloner et compiler

```bash
git clone https://github.com/votre-compte/netflix-discord-rpc.git
cd netflix-discord-rpc

# Installer les dépendances
npm --prefix bridge install
npm --prefix extension install

# Compiler l'ensemble du projet en TypeScript
npm run build
```

---

### 2. Démarrer le pont local

```bash
npm run start
```
*(Ou faites un double-clic sur le fichier Windows [`start-bridge.bat`](file:///c:/Users/Administrator/Desktop/netflix%20rpc/start-bridge.bat))*

Le terminal affichera :
```text
🚀 Pont Netflix Discord RPC démarré sur http://127.0.0.1:7777
📡 WebSocket local en écoute sur ws://127.0.0.1:7777
[Discord] Connecté avec succès au compte Discord !
```

---

### 3. Installer l'extension dans le navigateur

1. Ouvrez votre navigateur basé sur Chromium :
   - **Google Chrome / Brave** : `chrome://extensions`
   - **Microsoft Edge** : `edge://extensions`
   - **Opera** : `opera://extensions`
2. Activez le **"Mode développeur"** (en haut à droite).
3. Cliquez sur **"Charger l'extension non empaquetée"** (*Load unpacked*).
4. Sélectionnez le dossier `extension` de ce dépôt.
5. L'icône de l'extension apparaît dans votre barre de navigation.

---

### 4. Lancer une vidéo sur Netflix !

Ouvrez [Netflix](https://www.netflix.com) et lancez votre film ou épisode préféré. Votre statut Discord reflète automatiquement ce que vous regardez en direct !

---

## ⚙️ Personnalisation de l'Application Discord

Par défaut, l'application utilise un identifiant préconfiguré avec les logos officiels Netflix.  
Pour utiliser **votre propre nom d'application et vos propres visuels**, consultez notre guide dédié :  
👉 **[Guide de Configuration Discord Application](file:///c:/Users/Administrator/Desktop/netflix%20rpc/DISCORD_APP_SETUP.md)**.

---

## 💻 Commandes de développement

| Commande | Description |
| :--- | :--- |
| `npm run build` | Compile l'extension et le pont en TypeScript |
| `npm run build:bridge` | Compile uniquement le code du pont local |
| `npm run build:extension` | Compile uniquement le code de l'extension |
| `npm run start` | Lance le pont local en production |
| `npm run dev:bridge` | Lance le pont avec rechargement automatique en direct (`tsx watch`) |

---

## 📜 Licence

Projet distribué sous licence [MIT](file:///c:/Users/Administrator/Desktop/netflix%20rpc/LICENSE).
