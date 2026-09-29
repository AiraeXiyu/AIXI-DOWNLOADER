# AIXI Downloader

Mobile-first Next.js downloader UI powered by the provided `@coflyn/scrapr` engine.

## Run locally

```bash
npm install
npm run dev
```

Open http://localhost:3000.

## Deploy

Import this folder/repository into Vercel. The scraper API uses the Node.js runtime.

## Notes

- Each platform has its own route and UI.
- `/api/download` tries the configured scraper methods as fallbacks.
- The server returns direct media URLs; it does not proxy/store large media files.
- Some upstream scraper providers may change or rate-limit independently of this app.
