# Discord Application Setup (Optional)

By default, the application uses a pre-configured Netflix client ID (`925761358986801192`).

If you want to use your own custom Discord application:

## 1. Create Application
1. Go to the [Discord Developer Portal](https://discord.com/developers/applications).
2. Click **New Application** and name it `Netflix`.

## 2. Copy Application ID
1. Navigate to **General Information**.
2. Copy the **Application ID**.

## 3. Upload Assets
1. Go to **Rich Presence** > **Art Assets**.
2. Add the following assets under **Rich Presence Assets**:
   - `netflix`: Large image logo
   - `play`: Small play icon
   - `pause`: Small pause icon
3. Save changes.

## 4. Configure Bridge
Create a `.env` file in `bridge/`:
```env
PORT=7777
DISCORD_CLIENT_ID=YOUR_APPLICATION_ID_HERE
```
Restart the bridge (`npm run start`).
