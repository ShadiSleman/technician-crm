# Deploy the API so the APK (and web) can use MongoDB from anywhere

Your **PC at home is not on the public internet**. The **Android app** only talks to your **HTTPS API**; the API talks to **MongoDB Atlas**.

## Option A — Render (recommended; blueprint included)

1. Push this repo to GitHub (never commit `.env` or `.env.production`).
2. [Render](https://render.com) → **New +** → **Blueprint** → select the repo → confirm (uses `render.yaml` at repo root).
3. Open the created **Web Service** → **Environment** → set:
   - **`MONGO_URI`** — Atlas connection string (same idea as `server/.env.example`)
   - **`JWT_SECRET`** — long random string (16+ characters)
4. Wait for deploy → copy the service URL, e.g. `https://technician-crm-api.onrender.com`
5. **API base for the app** = that URL + **`/api`**, e.g. `https://technician-crm-api.onrender.com/api`

### Point the mobile/web build at the API

1. Copy `.env.production.example` → `.env.production` in the **repo root**.
2. Set `VITE_API_URL` to your API base (must include `/api`), e.g.  
   `VITE_API_URL=https://technician-crm-api.onrender.com/api`
3. From repo root: `npm run build:mobile` then `npm run android:apk` (or Android Studio → Build APK).

Alternatively, set `"apiBase"` in `public/app-config.json` to the same URL and run `npm run build:mobile` (no `.env.production`).

### Manual Render setup (no Blueprint)

**New +** → **Web Service** → connect repo → **Docker** → **Dockerfile path:** `server/Dockerfile`, **Docker build context:** `server`. Add the same env vars as above.

**Node (no Docker)** — pick **one** of these:

1. **Root Directory = `server`:** Build `npm install` · Start `npm start`
2. **Root Directory empty (repo root):** Build `npm install --prefix server` · Start `npm start`  
   (Root `package.json` has `"start": "npm start --prefix server"` so the API still starts.)

## Option B — Fly.io, Railway, VPS

Run `node src/index.js` or Docker from `server/`, set `PORT` from the host, pass `MONGO_URI` and `JWT_SECRET`.

## After deploy

1. Seed a user once (from your machine, with server env or against prod):  
   `cd server && npm run seed:user -- admin YourSecurePassword`
2. Build and install the APK as above. Users log in; data flows **phone → API → Atlas**.

## Security

- Use **HTTPS** in production (`https://...`).
- Rotate MongoDB password if it was ever exposed.
- `TRUST_PROXY=1` is set in Docker for correct IP behind reverse proxies.
