# cf-examples

A choose-your-own-adventure portfolio showcasing what the Cloudflare edge can actually do. Built by Erin Cross for [X = Consulting](https://xconsultingwork.com).

Live: https://cf-examples.pages.dev

## The architecture

This is a narrative portfolio, not a linear feature list. Visitors land on a Matrix-framed choice (red pill / blue pill), and from there explore three paths:

```
/                    landing — choose your reality
/red/                the three paths reveal
  /art/              path i  — HTML & CSS craft, motion, typography
  /machine/          path ii — AI running at the edge (Workers AI)
  /research/         path iii — applied engineering tools
```

Each path contains three "works" (examples). One per path is live at each deploy; the others unlock over time.

## Current state (chapter one)

**Landing / hub:** `/`, `/blue/`, `/red/` — all live

**The art path:**
- `cityscape/` — Pure-CSS night skyline with parallax, drifting clouds, a crossing plane, animated windows. No images, no SVG, no canvas. ✓

**The machine path:**
- `oracle/` — Streaming chat with Llama 3.1 8B on Cloudflare Workers AI. No external API. ✓

**The research path:**
- `photon/` — NEC-compliant PV string sizing calculator. ✓

## Stack

- Cloudflare Pages (static hosting + edge)
- Cloudflare Pages Functions (serverless, colocated with the page)
- Cloudflare Workers AI — `@cf/meta/llama-3.1-8b-instruct` streaming
- Cloudflare KV, D1, R2 (wired, used as examples unlock)

## Structure

```
/functions/                       all Pages Functions at repo root
  /machine/oracle/api/chat.ts     POST /machine/oracle/api/chat
  /research/photon/api/string-size.ts

/machine/oracle/                  frontend for the Oracle
/research/photon/                 frontend for Photon
...
```

Pages Functions mirror the URL path from the `functions/` root. So `functions/machine/oracle/api/chat.ts` serves `/machine/oracle/api/chat`.

## Local dev

```bash
wrangler pages dev .
```

## Deploy

Connected to this GitHub repo via Cloudflare Pages. Every push to `main` auto-deploys.

Manual deploy:

```bash
wrangler pages deploy . --project-name=cf-examples --branch=main
```

## License

MIT.
