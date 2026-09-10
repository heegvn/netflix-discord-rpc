import { DiscordIPCClient, DiscordActivityPayload } from './discord-ipc.js';
import { NetflixPresenceData } from './types.js';

// ID d'application Discord par défaut (Netflix)
const DEFAULT_CLIENT_ID = '925761358986801192';

/**
 * Gestionnaire de présence Netflix pour Discord
 */
export class DiscordBridge {
  private client: DiscordIPCClient;
  private lastData: NetflixPresenceData | null = null;
  private clientId: string;

  constructor(clientId?: string) {
    this.clientId = clientId || process.env.DISCORD_CLIENT_ID || DEFAULT_CLIENT_ID;
    this.client = new DiscordIPCClient(this.clientId);
    this.setupEvents();
  }

  private setupEvents() {
    this.client.on('ready', (user) => {
      console.log(`[Discord] Connecté avec succès au compte Discord : ${user?.username || 'Utilisateur'} (App: ${this.clientId})`);
      if (this.lastData) {
        this.updatePresence(this.lastData);
      }
    });

    this.client.on('disconnected', () => {
      console.warn('[Discord] Déconnecté du client Discord Desktop. Reconnexion automatique programmée...');
    });

    this.client.on('error', (err) => {
      // Affichage sobre des erreurs courantes sans spam de stack traces
      if (err?.code !== 'ENOENT') {
        console.warn(`[Discord] Signal IPC: ${err?.message || err}`);
      }
    });
  }

  public async connect(): Promise<boolean> {
    const success = await this.client.connect();
    if (!success) {
      console.warn('[Discord] Discord Desktop n\'est pas encore détecté. Le pont réessayera automatiquement.');
    }
    return success;
  }

  public async updatePresence(data: NetflixPresenceData): Promise<void> {
    this.lastData = data;

    if (!this.client.connected) {
      return;
    }

    try {
      if (data.status === 'IDLE') {
        await this.clearPresence();
        return;
      }

      // Construction des textes d'activité
      let detailsText = data.title;
      let stateText = '';

      if (data.season && data.episode) {
        stateText = `Saison ${data.season}: Épisode ${data.episode}`;
        if (data.episodeTitle) {
          stateText += ` - ${data.episodeTitle}`;
        }
      } else if (data.episodeTitle) {
        stateText = data.episodeTitle;
      } else {
        stateText = data.status === 'PLAYING' ? 'En cours de visionnage' : 'En pause';
      }

      if (data.status === 'PAUSED') {
        stateText += ' (En pause)';
      }

      const now = Date.now();
      const isPlaying = data.status === 'PLAYING';

      // Calcul des timestamps pour la barre de progression dynamique
      let startTimestamp: number | undefined = undefined;
      let endTimestamp: number | undefined = undefined;

      if (isPlaying && data.duration > 0 && data.currentTime >= 0) {
        const remainingSeconds = Math.max(0, data.duration - data.currentTime);
        startTimestamp = Math.floor(now - (data.currentTime * 1000));
        endTimestamp = Math.floor(now + (remainingSeconds * 1000));
      }

      const activity: DiscordActivityPayload = {
        details: detailsText.slice(0, 128),
        state: stateText.slice(0, 128),
        assets: {
          large_image: 'netflix',
          large_text: 'Netflix',
          small_image: isPlaying ? 'play' : 'pause',
          small_text: isPlaying ? 'Lecture en cours' : 'En pause'
        },
        instance: false
      };

      if (startTimestamp && endTimestamp) {
        activity.timestamps = {
          start: startTimestamp,
          end: endTimestamp
        };
      }

      // Bouton direct pour regarder sur Netflix (si URL valide)
      if (data.url && (data.url.startsWith('http://') || data.url.startsWith('https://'))) {
        activity.buttons = [
          {
            label: 'Regarder sur Netflix',
            url: data.url
          }
        ];
      }

      await this.client.setActivity(activity);
      console.log(`[Presence] ${detailsText} | ${stateText} [${data.status}]`);
    } catch (err: any) {
      console.error('[Presence] Erreur lors de la mise à jour:', err?.message || err);
    }
  }

  public async clearPresence(): Promise<void> {
    this.lastData = null;
    if (this.client.connected) {
      try {
        await this.client.clearActivity();
        console.log('[Presence] Statut Discord effacé.');
      } catch (err: any) {
        console.error('[Presence] Erreur lors de l\'effacement:', err?.message || err);
      }
    }
  }

  public getStatus(): { isConnected: boolean; hasActivePresence: boolean; clientId: string } {
    return {
      isConnected: this.client.connected,
      hasActivePresence: this.lastData !== null && this.lastData.status !== 'IDLE',
      clientId: this.clientId
    };
  }

  public async destroy(): Promise<void> {
    await this.clearPresence();
    this.client.destroy();
  }
}
