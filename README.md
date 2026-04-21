# cf-examples

Thirty self-contained examples built on Cloudflare Pages and Workers, progressing from pure HTML/CSS to stateful edge applications. Built by [Erin Cross](https://xconsultingwork.com) as a working portfolio.

**Live site:** `https://cf-examples.pages.dev` (or your custom domain)
**Source:** this repo

## Why this exists

I spend my days in IT/managed services — Intune packaging, Proxmox homelabs, automation glue code, the occasional 2am "why is Samba broken" session. This repo is the public-facing version of that work: thirty focused examples that show what the Cloudflare edge platform can actually do, from a static HTML page to a Workers AI chat endpoint backed by D1.

Each example is small enough to read in one sitting and opinionated enough to be useful as a starting point.

## Structure

```
cf-examples/
├── README.md                  ← you are here
├── index.html                 ← landing page linking all 30 examples
├── wrangler.toml              ← root config; per-example overrides as needed
├── functions/                 ← Pages Functions (shared helpers)
└── NN-example-name/
    ├── README.md              ← what it demonstrates, how to run
    ├── index.html
    └── functions/             ← example-specific backend, where applicable
```

## The 30 examples

### Foundations (pure HTML/CSS)
1. **static-hello** — the baseline. One HTML file, deployed to the edge.
2. **css-grid-layout** — responsive dashboard layout, no media queries (grid + `minmax` + `auto-fit`).
3. **dark-mode-toggle** — `prefers-color-scheme` + CSS custom properties, zero JS.
4. **css-only-accordion** — `<details>` / `:target` tricks.
5. **responsive-gallery** — intrinsic sizing, `aspect-ratio`, lazy loading.
6. **css-art-rack** — an illustrated server rack in pure CSS. Nod to the homelab.
7. **print-stylesheet** — a resume page that prints beautifully. Dual-purpose: it's my resume.
8. **scroll-driven-animation** — `animation-timeline: scroll()` where supported, graceful fallback.
9. **container-queries** — a card component that reflows based on its container, not the viewport.
10. **form-styling** — accessible, styled form inputs without a framework.

### + Vanilla JS (still no backend)
11. **todo-localstorage** — classic, but clean. Keyboard-first.
12. **api-fetch-demo** — public API call, loading/error states done right.
13. **clipboard-and-share** — Web Share API with clipboard fallback.
14. **intersection-observer** — lazy-reveal sections, animated counters.
15. **web-components** — a reusable `<status-badge>` element. No framework.

### Pages Functions (the edge, finally)
16. **contact-form** — POST handler, Turnstile CAPTCHA, sends via Resend or MailChannels.
17. **geo-greeting** — personalized content from `request.cf` (country, colo, timezone).
18. **api-proxy** — rate-limited proxy to a third-party API, hiding the key server-side.
19. **auth-gate** — cookie-based auth with a shared secret, `hono` middleware pattern.
20. **headers-and-redirects** — `_headers` and `_redirects` files, security headers, SPA fallback.

### Stateful edge (KV, D1, R2, DO)
21. **kv-visit-counter** — per-page view counter in Workers KV.
22. **d1-guestbook** — SQLite-at-the-edge guestbook with pagination.
23. **r2-image-upload** — presigned uploads, R2-backed gallery, image transforms.
24. **durable-object-chat** — real-time chat room over WebSockets, one DO per room.
25. **queue-job-processor** — enqueue from a form, process in the background.

### Advanced / show-off
26. **workers-ai-chat** — streaming chat UI backed by `@cf/meta/llama-3.1-8b-instruct`.
27. **workers-ai-image-tag** — upload an image, get classification tags back.
28. **cron-status-page** — scheduled Worker pings endpoints, writes uptime to D1, renders a status page.
29. **homelab-dashboard** — my actual homelab status board (public read-only version).
30. **solar-design-helper** — CSV in, NEC-compliant string sizing suggestions out. Applied example from consulting work.

## Local development

```bash
# install wrangler if you haven't
npm install -g wrangler

# from repo root
wrangler pages dev .

# or for a specific example with its own wrangler.toml
cd 22-d1-guestbook && wrangler pages dev .
```

## Deployment

Connected to Cloudflare Pages via GitHub integration. Every push to `main` deploys to production; PRs get preview deploys automatically.

```bash
# manual deploy if needed
wrangler pages deploy .
```

## Stack notes

- **No framework on the frontend** unless an example is specifically about one. HTML, CSS, vanilla JS.
- **Hono** for Functions that get complex (auth, routing).
- **Drizzle** for D1 schema where it earns its keep.
- **TypeScript** for any Function longer than ~30 lines.

## Tagged milestones

- `v0.10-foundations` — examples 1–10 complete
- `v0.15-interactive` — examples 11–15 complete
- `v0.20-functions` — examples 16–20 complete
- `v0.25-stateful` — examples 21–25 complete
- `v0.30-complete` — all 30 done

## About

Built by Erin Cross. Portland, OR. Background in IT/managed services, Proxmox homelabs, Intune deployments, and the occasional solar design automation side quest. Consulting at [xconsultingwork.com](https://xconsultingwork.com).

## License

MIT. Fork it, learn from it, ship your own.
