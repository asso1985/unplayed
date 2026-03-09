# 🎵 Unplayed

Push notification reminders for your liked YouTube Music albums.

**Stack:** Node.js · Express · TypeScript · Railway  
**No external API library** — one inline function calls YTM directly.

---

## How it works

1. A Railway cron job runs every 6 hours
2. It pulls your liked albums from YT Music using your saved browser session
3. New albums get added to the db
4. Any albums past their reminder threshold get a push notification
5. You open the notification → taps into the official YT Music app

## Reminder actions (from the notification)
- **Open in YT Music** — launches the album
- **Snooze 3 days** — skips reminders for 3 days
- **Stop reminding** — silences this album forever

---

## Deploy to Railway

### 1. Create a Google OAuth client

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. New project → **APIs & Services** → **Enable APIs** → enable **YouTube Data API v3**
3. **Credentials** → **Create Credentials** → **OAuth client ID**
4. Application type: **TV and Limited Input devices**
5. Copy the **Client ID** and **Client Secret**

### 2. Generate VAPID keys
```bash
npx web-push generate-vapid-keys
```

### 3. Push to GitHub
```bash
git init && git add . && git commit -m "init"
gh repo create unplayed --private --push
```

### 3. New Railway project
Railway dashboard → New Project → Deploy from GitHub → select your repo

Railway reads `railway.toml` and creates two services:
- `unplayed-web` — Express server (always on)
- `unplayed-cron` — runs `npm run cron` every 6 hours

### 4. Environment variables (set on BOTH services)

| Key | Value |
|---|---|
| `GOOGLE_CLIENT_ID` | from Google Cloud Console |
| `GOOGLE_CLIENT_SECRET` | from Google Cloud Console |
| `VAPID_PUBLIC_KEY` | from `npx web-push generate-vapid-keys` |
| `VAPID_PRIVATE_KEY` | from `npx web-push generate-vapid-keys` |
| `VAPID_EMAIL` | `mailto:you@example.com` |
| `DATA_DIR` | `/data` |

### 5. Shared volume
Railway → `unplayed-web` → Volumes → Add → mount path `/data`  
Then attach the same volume to `unplayed-cron` at `/data`

Both services share `data.json`, `push_subscriptions.json`, and `auth.json`.

---

## First-time setup (in the app)

1. Open your Railway app URL
2. Click **Get login code** — you'll see an 8-character code
3. Open [google.com/device](https://google.com/device) on any device and enter the code
4. Sign in with your Google account (the one with your YT Music library)
5. The app auto-detects approval and connects — no more cookie pasting, ever
6. On iPhone: tap Share → **Add to Home Screen**
4. Open the installed app → tap **Enable notifications**
5. Done — the next cron run will sync your library

---

## Settings

Tap ⚙ Settings in the app to change the reminder schedule.  
Default: day 3, day 7, day 30. Set any days you like.

## Adjusting cron frequency

Edit `railway.toml`:
```toml
cronSchedule = "0 */6 * * *"   # every 6h (default)
cronSchedule = "0 9 * * *"     # daily at 9am UTC
```
