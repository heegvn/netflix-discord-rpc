# 🎮 Guide de Configuration Discord Application (Optionnel)

Par défaut, l'application est **déjà configurée avec un ID public Netflix prêt à l'emploi** (`925761358986801192`). Vous n'avez aucune configuration obligatoire à faire pour que cela fonctionne !

Si vous préférez créer votre **propre application Discord dédiée** avec vos propres logos personnalisés, suivez ce guide simple (durée : 2 minutes) :

---

## Étape 1 : Créer l'application sur le portail Discord

1. Rendez-vous sur le **[Portail Développeur Discord](https://discord.com/developers/applications)** et connectez-vous avec votre compte Discord.
2. Cliquez sur le bouton bleu **"New Application"** (en haut à droite).
3. Nommez-la : `Netflix` (ce nom apparaîtra en haut de votre statut Discord : *"Joue à Netflix"*).
4. Cochez les conditions et cliquez sur **Create**.

---

## Étape 2 : Récupérer le Client ID

1. Dans le menu de gauche, restez sur **General Information**.
2. Copiez la valeur **APPLICATION ID** (une suite de chiffres, ex: `123456789012345678`).

---

## Étape 3 : Ajouter les icônes (Art Assets)

1. Dans le menu de gauche, cliquez sur **Rich Presence** > **Art Assets**.
2. Dans la section **Rich Presence Assets**, cliquez sur **Add Image(s)** :
   - Ajoutez le logo Netflix et nommez la clé : `netflix` (en minuscules).
   - Ajoutez une icône Play et nommez la clé : `play`.
   - Ajoutez une icône Pause et nommez la clé : `pause`.
3. Cliquez sur **Save Changes** en bas de la page.

---

## Étape 4 : Configurer le Pont Local

1. Dans le dossier `bridge/`, créez ou modifiez le fichier `.env` :
   ```env
   PORT=7777
   DISCORD_CLIENT_ID=VOTRE_APPLICATION_ID_ICI
   ```
2. Redémarrez le pont local (`npm run start` ou double-clic sur `start-bridge.bat`).

C'est tout ! Votre statut utilisera désormais votre propre application Discord.
