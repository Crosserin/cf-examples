# 17-geo-greeting

> Personalized content from `request.cf` — country, colo, timezone.

## What it does

On page load, the frontend fetches `/api/geo`, which is a Pages Function that reads `request.cf` and returns a JSON blob with the requester's country, city, the edge data center that handled the request (colo), their ASN, and more.

Cloudflare attaches this metadata to every request. No MaxMind licensing, no third-party IP lookup service, no latency overhead — it's already in the request object.

## Cloudflare features used

- [x] Pages (static hosting)
- [x] Pages Functions (`/functions/api/geo.ts`)

## Files

```
17-geo-greeting/
├── README.md
├── index.html                  ← frontend
└── functions/
    └── api/
        └── geo.ts              ← GET /api/geo handler
```

## Running locally

```bash
wrangler pages dev .
```

In local dev, `request.cf` is `undefined`, so the function returns a `local: true` shape with placeholder values. The frontend shows "Hello from localhost." Good enough to develop against.

## Key files to read

`functions/api/geo.ts` — the whole backend is about 25 lines. The important bits:

- `context.request.cf` is typed by `@cloudflare/workers-types`. In TS, install as a dev dep.
- `Response.json()` is a convenience method on the global `Response` — newer standard, works in Workers.
- `cache-control: no-store` because per-user geo is not cacheable.

## Gotchas

- **Cache the wrong thing and you'll leak geo data.** If you put a geo-aware page in Cloudflare Cache without `Vary: CF-IPCountry` or similar, users from different countries will see each other's cached content.
- **TypeScript types for `cf`** come from `@cloudflare/workers-types`. Without them, TS will complain `cf` doesn't exist on `Request`.
- **Some fields are enterprise-only** (like `cf.continent`, `cf.postalCode`, `cf.metroCode`) — they'll just be `undefined` on the free plan. The code here uses `??` fallbacks to handle that.

## What I'd do differently at scale

- Don't call `/api/geo` from the client at all. **Render the geo-personalized content server-side** by using the Function as the HTML response, not a JSON API. Saves a round-trip and avoids the "flash of wrong content" on load.
- For anything user-facing, consider **Turnstile** on the personalization — geo-gating shouldn't leak which endpoints exist.
- Log ASN + colo to a D1 analytics table for traffic pattern observation. Cheaper than GA for infrastructure decisions.
