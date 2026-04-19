# HVAC CRM API (MongoDB Atlas + JWT)

## English — quick start

1. `cd server && npm install`
2. Copy `.env.example` → `.env` and set:
   - **`MONGO_URI`** — your Atlas SRV string. Use database name **`hvac-crm`** in the path (same cluster as easy-wedding is fine; different DB name keeps data separate).
   - **`JWT_SECRET`** — long random string (16+ chars).
   - **`PORT`** — default `5050`.
3. Create first user: `npm run setup` (or `npm run seed:user -- admin YourPassword`)
4. Run API: `npm run dev`
5. Health check: `GET http://localhost:5050/api/health`
6. From repo root, run **API + web together**: `npm run dev:all`

**Frontend:** set `VITE_API_URL=http://localhost:5050/api` in `technician-crm-he/.env` (or rely on dev default in `Root.tsx`). After login, the app loads/saves workspace JSON to Mongo via this API.

**Verify DB:** `npm run ping:db`

---

## עברית (מקור)

1. `cd server && npm install`
2. העתק `.env.example` ל־`.env` ומלא `MONGO_URI`, `JWT_SECRET`, `PORT`.
3. `npm run setup` או `npm run seed:user -- admin הסיסמה`
4. `npm run dev`

**אבטחה:** אל תעלה `.env` ל-git. אם סיסמת Atlas דלפה — החלף ב-Atlas.
