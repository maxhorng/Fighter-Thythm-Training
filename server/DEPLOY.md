# Frame Beat Trainer - Online Combo Library Deployment Guide

This Worker powers the Online Combo Library using Cloudflare Workers and D1 (SQLite) only. It runs on the Cloudflare Free Tier with no R2 bucket and no credit card required.

Approved combo JSON downloads (`/files/<id>.json`) are served directly from D1 (`combos.body`) and cached at the edge with `Cache-Control: public, max-age=300`.

## Prerequisites
- Cloudflare Free Tier account (Workers + D1; no credit card required)
- Node.js 18+
- A Discord account to create an OAuth2 application

## 1. Install & Authenticate Wrangler
```powershell
cd server
npm install
npx wrangler login
```

## 2. Create the D1 Database & Apply Schema
```powershell
npx wrangler d1 create fbt-combos
```
Copy the printed `database_id` into `server/wrangler.toml` under `[[d1_databases]]`:
```toml
database_id = "<YOUR_D1_DATABASE_ID>"
```
Apply the schema to remote (and optionally local for `wrangler dev`):
```powershell
npm run db:init:remote
npm run db:init:local
```

## 3. Configure Discord OAuth2 Application
1. Go to the Discord Developer Portal (`https://discord.com/developers/applications`) and create a New Application (e.g. `Frame Beat Trainer`).
2. Under **OAuth2 -> General**:
   - Copy the **Client ID** and reset/copy the **Client Secret**.
   - Add the Redirect URI matching your Worker URL:
     `https://fbt-combos.<your-subdomain>.workers.dev/auth/discord/callback`
   - For local testing with `wrangler dev`, also add:
     `http://127.0.0.1:8787/auth/discord/callback`
3. Update `server/wrangler.toml` under `[vars]`:
   - `DISCORD_CLIENT_ID`: your Discord Client ID
   - `DISCORD_REDIRECT_URI`: your production Worker callback URL
   - `AUTO_APPROVE`: `"false"` (require admin review) or `"true"` (publish immediately)
   - `MIN_ACCOUNT_AGE_DAYS`: `"7"` (minimum Discord account age to log in)

## 4. Set Worker Secrets
Generate strong random strings (32+ chars) for `SESSION_SECRET` and `ADMIN_TOKEN`, then store all secrets with Wrangler (never commit them):
```powershell
npx wrangler secret put DISCORD_CLIENT_SECRET
npx wrangler secret put SESSION_SECRET
npx wrangler secret put ADMIN_TOKEN
# Optional: Discord webhook URL notified on new uploads
npx wrangler secret put DISCORD_WEBHOOK_URL
```

## 5. Deploy & Verify
```powershell
npm run deploy
```
Verify the deployment:
```powershell
curl https://fbt-combos.<your-subdomain>.workers.dev/health
```
Expected response: `{"ok":true,"schemaVersion":1}`.

## 6. Connect the Desktop App
Set the deployed Worker URL in `src/config/online.ts` (`ONLINE_API_BASE_DEFAULT`), or pass `VITE_FBT_API_BASE` at build time:
```powershell
$env:VITE_FBT_API_BASE = "https://fbt-combos.<your-subdomain>.workers.dev"
npm run build
```
For local testing against `npm run dev` (`http://127.0.0.1:8787`), you can override the URL at runtime in DevTools:
```js
localStorage.setItem('fbt_online_api_base', 'http://127.0.0.1:8787');
```

## Rate Limits & Anti-Abuse
- Uploads: 3 per hour per Discord account, 10 per day per Discord account, 20 per day per IP hash (every authenticated attempt counts).
- Minimum Discord account age: 7 days by default (`MIN_ACCOUNT_AGE_DAYS`).
- Strict schema validation (`src/schema/comboSchema.ts`) runs on client upload, server upload, and client download.
- Downloads are deduped per IP per combo per UTC day.

## Admin Moderation API
Pass `Authorization: Bearer <ADMIN_TOKEN>` to manage pending uploads when `AUTO_APPROVE = "false"`:
- `GET /api/admin/pending` - List pending combos with full JSON body
- `POST /api/admin/combos/:id/approve` - Mark approved (immediately served via `/files/:id.json` from D1 with 300s edge cache)
- `POST /api/admin/combos/:id/reject` - Reject with optional JSON body `{"reason": "..."}` and evict edge cache
- `DELETE /api/admin/combos/:id` - Delete combo and evict edge cache
- `POST /api/admin/users/:userId/ban` / `unban` - Ban or unban a Discord user ID
