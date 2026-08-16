# Throttle Tech

AI shop assistant for motorcycle repair shops — chat, part ID from photos, a shop job board, a
teardown/reinstall tracker, and shop-based sign-in for multiple locations.

This package gives you three things from one codebase:

1. **Web app** — run it in a browser, host it anywhere Node runs.
2. **Desktop app** — a real native window via Electron (Windows/Mac/Linux).
3. **Mobile "app"** — a PWA. Once it's hosted online, opening it on a phone and choosing
   **"Add to Home Screen"** (iOS Safari) or **"Install app"** (Android Chrome) puts a real icon
   on the home screen that opens full-screen, no browser chrome, like a native app.

> **What this is not:** a native App Store / Play Store submission. That's a separate, bigger
> project (Xcode, Android Studio, developer accounts, app review). The PWA route above gets you
> a genuinely app-like experience on phones today without that overhead — see "Going further"
> at the bottom if you want to take it that route later.

---

## 1. Prerequisites

- [Node.js](https://nodejs.org) 18 or newer (includes npm)
- An Anthropic API key from [console.anthropic.com](https://console.anthropic.com/) — this is
  what actually powers the chat/AI features. Keep it secret; it lives only on your server, never
  in the browser.

## 2. First-time setup

```bash
cd throttle-tech-app
npm install
cp .env.example .env
```

Open `.env` and paste in your real API key:

```
ANTHROPIC_API_KEY=sk-ant-your-real-key-here
```

## 3. Run it as a web app (development)

```bash
npm run dev
```

This starts two things together: the Express backend (port 3001) and the Vite dev server (port
5173). Open **http://localhost:5173** in your browser. Changes to the code hot-reload.

## 4. Build & run for production (web)

```bash
npm run build
npm start
```

This builds the optimized frontend into `dist/` and starts a single Node server (port 3001,
or whatever `PORT` you set in `.env`) that serves both the app and the API. Open
**http://localhost:3001**.

To put this online for real (so your phones can install it as a PWA and both shops can reach
it from anywhere), deploy this same `npm run build && npm start` setup to any Node hosting
service — Railway, Render, a DigitalOcean droplet, Fly.io, your own VPS, etc. It's one process,
one port, no database server to stand up separately (data is stored in a local JSON file — see
"Data storage" below).

**Once it's hosted on a real URL with HTTPS**, open it on a phone:
- **iPhone (Safari):** tap Share → "Add to Home Screen"
- **Android (Chrome):** tap the menu (⋮) → "Install app" (or you'll see an install banner)

That's your mobile app.

## 5. Run it as a desktop app (Electron)

Try it locally first:

```bash
npm run electron
```

This builds the frontend and opens it in a native desktop window.

To produce a real installer (`.dmg` for Mac, `.exe`/NSIS installer for Windows, `.AppImage` for
Linux) that you can hand to someone else to double-click and install:

```bash
npm run electron:build
```

This needs internet access the first time (it downloads platform-specific Electron binaries).
Output lands in `release/`. Build on the OS you're targeting — building a `.dmg` requires a Mac,
building a signed `.exe` is easiest on Windows, etc. (Cross-building is possible but fiddlier;
not covered here.)

## 6. Data storage

All shop data (chats, notes, the part-removal tracker, the job board, and the shop registry)
lives in `data/kv.json` next to the server — a plain JSON file, no database setup required. This
is fine for two shop locations' worth of traffic. If you ever outgrow it, that file format is
simple enough to migrate into a real database later.

Each browser also keeps a small `session` marker in its own localStorage, remembering which shop
it's currently signed into — that part is device-specific on purpose, so one computer at the MO
shop doesn't get logged out because someone signed into the MN shop on a different computer.

## 7. Signing in

The first time you use it, there won't be any shops registered yet — use **"Register a Shop"**
to create one (e.g. name it, pick Missouri or Minnesota, set a shop password). Registering — and
signing in — also requires the shared **company code**, which is set in
`src/App.jsx` (search for `COMPANY_CODE`). Change it before you deploy this for real; the
default in this build is `cjshops`.

## 8. Security notes (read this)

- Passwords are hashed (SHA-256) in the browser before they're ever sent anywhere — the server
  only ever sees the hash, not the plain password.
- This is a lightweight, functional gate appropriate for keeping two shop crews' data separate
  and keeping randoms out — it is **not** the same as a professionally audited auth system. Don't
  put anything in here you wouldn't want exposed if someone got creative.
- The `ANTHROPIC_API_KEY` never reaches the browser — it's used only inside `server/index.js`.
  Never commit your real `.env` file.

## 9. Project structure

```
throttle-tech-app/
├── src/                  # React app (the actual UI, unchanged from the prototype)
│   ├── App.jsx           # main component
│   ├── storage.js        # replaces window.storage with real backend/localStorage calls
│   └── main.jsx          # app entry point
├── server/
│   └── index.js          # Express server: Claude API proxy + JSON key/value storage
├── electron/
│   └── main.cjs          # Electron desktop wrapper
├── public/
│   ├── manifest.json     # PWA manifest
│   ├── sw.js              # service worker (installability + basic offline shell)
│   └── icons/             # app icons
├── data/kv.json           # all app data lives here (auto-created on first run)
└── .env                    # your API key (create this — see step 2)
```

## 10. Going further — the real iOS / Android app path

The PWA (step 4) gets you an installable, app-like icon on phones today with zero extra setup.
If you eventually want an actual App Store / Play Store app, this project is already wired for
that using [Capacitor](https://capacitorjs.com/), which wraps your deployed web app in a real
native shell. Here's what that actually takes, honestly:

**What you need that this sandbox can't provide:**
- A **Mac** running Xcode (iOS builds only work on macOS — this is an Apple restriction, not a
  project limitation). If you don't own one, options include borrowing/renting one, a cloud Mac
  service (e.g. MacStadium), or a CI service with macOS runners (e.g. GitHub Actions).
- An **Apple Developer account** ($99/year) to run the app on a real device, distribute via
  TestFlight, or submit to the App Store.
- Time for **Apple's review process** if you go all the way to a public App Store listing
  (typically 1–3 days, sometimes longer).

**What's already done for you in this project:**
- `capacitor.config.json` is set up and pointed at your deployed backend.
- The scripts `npm run cap:add:ios` and `npm run cap:open:ios` are ready to go.

**The actual steps, once you have a Mac + Xcode + your app deployed online:**

1. Deploy the web app first (step 4 above) — Capacitor points at that live URL rather than
   bundling a static copy, so the app always talks to your real backend, same as the PWA does.
2. Edit `capacitor.config.json` and replace `your-deployed-domain.example.com` with your real
   domain.
3. Install the Capacitor packages and generate the iOS project:
   ```bash
   npm install
   npm run cap:add:ios
   ```
4. Open it in Xcode:
   ```bash
   npm run cap:open:ios
   ```
5. In Xcode: sign in with your Apple Developer account, pick a signing team, then either run it
   straight to your own iPhone over USB (no App Store needed for that), send it to testers via
   TestFlight, or submit it to the App Store.

Android follows the same pattern with `@capacitor/android` and Android Studio instead of Xcode,
if you want that too later.

## 11. Other things to consider later (optional)

- **Multiple people per shop with individual logins:** right now it's one shared password per
  shop. Individual accounts would mean adding a users table and per-user auth on top of the
  shop model that's already here.
- **Real database:** swap `data/kv.json` for Postgres/SQLite if you outgrow the file-based
  store — the `server/index.js` KV endpoints are a thin enough layer that this is a contained
  change.

---

Questions or something not working? Check the terminal output first — both the Vite dev server
and the Express server print errors there.
