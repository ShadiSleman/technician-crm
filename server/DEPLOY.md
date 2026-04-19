# Deploy the API so friends can use the APK (any network)

Your **PC at home is not on the public internet**. Friends on another Wi‑Fi cannot call `http://YOUR-PC:5050`.  
**MongoDB Atlas is already public** — you only need to run this **Node API** on a host with a **public HTTPS URL**.

## Option A — Render (simple)

1. Push `technician-crm-he` to GitHub (do **not** commit `.env`).
2. [Render](https://render.com) → **New +** → **Web Service** → connect the repo.
3. **Root Directory:** `technician-crm-he/server`
4. **Runtime:** Docker (uses `Dockerfile`) **or** Native:
   - Build: `npm install`
   - Start: `npm start`
5. **Environment variables** (same values as local `.env`):
   - `MONGO_URI` — Atlas connection string (database e.g. `hvac-crm`)
   - `JWT_SECRET` — long random string (16+ chars)
6. Deploy. Copy the URL, e.g. `https://hvac-crm-api-xxxx.onrender.com`
7. **API base for the app:** `https://hvac-crm-api-xxxx.onrender.com/api`  
   - Put that into `technician-crm-he/public/app-config.json` as `apiBase`, **or** set `VITE_API_URL` before `npm run build`, **or** your friend types it on the login screen once.

## Option B — Fly.io, Railway, VPS

Same idea: run `node src/index.js` (or Docker), set `PORT` from host if required, pass `MONGO_URI` and `JWT_SECRET`.

## After deploy

1. Run once (SSH or local with prod URI): `npm run seed:user -- admin YourSecurePassword`
2. Build APK: edit `public/app-config.json` → `"apiBase": "https://your-service.../api"` →  
   `npm run build && npx cap sync`
3. Share the APK. Friends log in; data goes to **Atlas** through your hosted API.

## Security

- Use **HTTPS** in production (`https://...`).
- Rotate MongoDB password if it was ever exposed.
- `TRUST_PROXY=1` is set in Docker for correct IP behind reverse proxies.
