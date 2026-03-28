# FleetLog PDF Renderer Worker

Separater Cloudflare Worker für HTML→PDF Rendering der bestehenden Invoice-Druckansicht.

## 1) Install

```bash
cd renderer-worker
npm install
```

## 2) Secrets setzen

```bash
npx wrangler secret put RENDERER_TOKEN
# z. B. openssl rand -hex 32

npx wrangler secret put ALLOWED_APP_ORIGINS
# z. B. https://fleetlog.ribadov.workers.dev
```

## 3) Deploy

```bash
npm run deploy
```

Beispiel-URL danach:

```text
https://fleetlog-pdf-renderer.<subdomain>.workers.dev/render-invoice
```

## 4) FleetLog verbinden

Im Hauptprojekt:

```bash
npx wrangler secret put PDF_RENDERER_URL
# https://fleetlog-pdf-renderer.<subdomain>.workers.dev/render-invoice

npx wrangler secret put PDF_RENDERER_TOKEN
# derselbe Token wie RENDERER_TOKEN

npm run deploy
```

## 5) Test

```bash
curl https://fleetlog-pdf-renderer.<subdomain>.workers.dev/health
```
