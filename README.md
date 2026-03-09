# 🎵 Unplayed

Push notification reminders for your liked YouTube Music albums.

**Stack:** React · Vite · Express · SQLite · TypeScript · Railway

---

## How it works

1. An in-process cron job runs every 6 hours
2. It pulls each user's liked albums from YT Music via Google OAuth
3. New albums get added to the SQLite database
4. Any albums past their reminder threshold get a push notification
5. You open the notification → taps into the official YT Music app

## Reminder actions (from the notification)
- **Open in YT Music** — launches the album
- **Snooze 3 days** — skips reminders for 3 days
- **Stop reminding** — silences this album forever

---

## Project structure

```
unplayed/
├── client/             # React + Vite frontend
│   ├── src/
│   ├── public/         # PWA assets (manifest, service worker, icons)
│   ├── package.json
│   └── vite.config.ts
├── server/             # Express + SQLite backend
│   ├── src/
│   ├── package.json
│   └── tsconfig.json
├── client-dist/        # Vite build output (gitignored)
├── railway.json        # Railway deployment config
└── Procfile
```

---

## Local development

### 1. Install dependencies

```bash
cd server && npm install
cd ../client && npm install
```

### 2. Create `server/.env`

```env
DATA_DIR="."
GOOGLE_CLIENT_ID="your-client-id"
GOOGLE_CLIENT_SECRET="your-client-secret"
VAPID_PUBLIC_KEY="your-vapid-public-key"
VAPID_PRIVATE_KEY="your-vapid-private-key"
VAPID_EMAIL="mailto:you@example.com"
PORT="3000"
```

### 3. Run both servers

```bash
# Terminal 1 — Express API
cd server && npm run dev

# Terminal 2 — Vite dev server (proxies /api to :3000)
cd client && npm run dev
```

Open `http://localhost:5173` in your browser.

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

### 4. New Railway project

Railway dashboard → New Project → Deploy from GitHub → select your repo.

Railway reads `railway.json` for build/start commands. Single service — no separate cron needed (runs in-process via `node-cron`).

### 5. Environment variables

| Key | Value |
|---|---|
| `GOOGLE_CLIENT_ID` | from Google Cloud Console |
| `GOOGLE_CLIENT_SECRET` | from Google Cloud Console |
| `VAPID_PUBLIC_KEY` | from `npx web-push generate-vapid-keys` |
| `VAPID_PRIVATE_KEY` | from `npx web-push generate-vapid-keys` |
| `VAPID_EMAIL` | `mailto:you@example.com` |
| `DATA_DIR` | `/data` |

### 6. Persistent volume

Railway → your service → Volumes → Add → mount path `/data`

The SQLite database (`unplayed.db`) lives on this volume.

---

## First-time setup (in the app)

1. Open your Railway app URL
2. Click **Get login code** — you'll see an 8-character code
3. Open [google.com/device](https://google.com/device) on any device and enter the code
4. Sign in with your Google account (the one with your YT Music library)
5. The app auto-detects approval and connects
6. On iPhone: tap Share → **Add to Home Screen**
7. Open the installed app → tap **Enable notifications**
8. Done — the next cron run will sync your library

---

## Migrating from JSON to SQLite

If upgrading from an older version that used JSON files:

```bash
DATA_DIR=/data node server/dist/scripts/migrate-json.js
```

This imports `data.json`, `auth.json`, and `push_subscriptions.json` into SQLite. Safe to re-run — skips if users already exist.

---

## Settings

Tap ⚙ Settings in the app to configure:
- **Reminder schedule** — default: day 3, day 7, day 30
- **Track types** — Albums, EPs, Singles
- **Notification time** — Morning, Afternoon, or Evening
