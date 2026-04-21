# 29-homelab-dashboard

> A public read-only status board for my actual homelab.

## What it does

Shows the real-time status of the infrastructure in the other room:
- **Compute:** Proxmox host (T340, Xeon E-2146G, 32GB), LXC containers for Jellyfin, the media stack, Pi-hole
- **Storage:** Synology NAS (SIERRA, 10.0.0.187), external media drive, cold backup disk
- **Network:** Edge router, Tailscale mesh
- **Services:** Jellyfin, Prowlarr, Readarr, Calibre-Web, and whatever else is currently running

A scheduled Worker (see example 28) probes each service every minute, writes a status snapshot to KV, and this page reads it back on load and every 30s thereafter. The dashboard itself is a static HTML file plus a single read-only Pages Function.

This is the pattern I actually use. The public page is a sanitized version — internal URLs, auth tokens, and anything that could help an attacker reconnoiter is stripped on the probing Worker before it writes to KV.

## Cloudflare features used

- [x] Pages (static hosting)
- [x] Pages Functions (`/api/status` — reads from KV)
- [x] KV (persisted status snapshot)
- [x] Scheduled Workers (writes to KV — see example 28)

## Files

```
29-homelab-dashboard/
├── README.md
├── index.html                      ← dashboard UI
└── functions/
    └── api/
        └── status.ts               ← GET /api/status (reads KV)
```

## Architecture

```
┌──────────────────────┐
│ Scheduled Worker     │  every minute
│ (example 28)         │─────────┐
│ probes services      │         │
└──────────────────────┘         ▼
                          ┌──────────────┐
                          │  KV          │
                          │  homelab:    │
                          │  status      │
                          └──────┬───────┘
                                 │ read-through
                                 ▼
┌──────────────────────┐  ┌──────────────┐
│ Browser              │◀─│  Pages Fn    │
│ auto-refresh 30s     │  │  /api/status │
└──────────────────────┘  └──────────────┘
```

The split between "probing Worker" and "dashboard Function" matters:

- The **probing Worker** has secrets (API keys, Tailscale auth tokens, internal hostnames). It runs on a cron trigger and never faces the public internet.
- The **dashboard Function** has zero secrets. It only reads a sanitized snapshot from KV. If someone finds a way to abuse it, the blast radius is "they can see whether my Jellyfin is up," which they could figure out by trying to stream from it anyway.

## Running locally

```bash
# KV works locally — wrangler creates a local namespace automatically
wrangler pages dev .
```

In local dev (or when the KV key is empty), the Function returns a hardcoded `FALLBACK` dataset so the UI always has something to render. This is deliberate — first deploys shouldn't show a blank page.

## Key files to read

**`functions/api/status.ts`** — the whole backend is about 30 lines:

- `env.KV.get("homelab:status", "json")` — the `"json"` type hint parses it for you. Saves a `JSON.parse` and associated error handling.
- `cache-control: public, max-age=10` — clients and the CDN can cache for 10s. With a 30s client refresh interval and a 60s probe interval, this is the right knob. Any tighter and you're hammering KV for nothing.
- The `FALLBACK` data structure is also the **type documentation** for what the probing Worker needs to write. Keeps the contract in one place.

## Gotchas

- **KV is eventually consistent** — it can take up to 60s for a write in one region to be visible in another. For a minute-interval dashboard this is invisible; for sub-second consistency you'd need Durable Objects.
- **KV has a read quota.** 100k reads/day free, plenty for this. If the dashboard got popular, add an edge cache in front (already done here via `cache-control`).
- **Don't probe from the dashboard Function.** Tempting to do "if KV is empty, probe live." Don't — now every visitor triggers internal network probes. Keep the probe path and the read path separate.
- **Secrets in the probing Worker** go in via `wrangler secret put`, not `wrangler.toml`. The `wrangler.toml` is committed; secrets are not.

## What I'd do differently at scale

- **Per-service history in D1.** KV holds the current snapshot; D1 holds the time-series. Then the dashboard can render uptime bars ("99.2% over 30 days") the same way a real status page does.
- **Incident log.** When a service transitions from `ok` to `fail`, write an incident row. When it transitions back, close it. Public post-mortem link optional.
- **Webhook notifications.** The probing Worker can POST to Discord/Slack/ntfy on state changes. Easy win, costs nothing.
- **Authenticated admin view** at `/admin` with the full unsanitized data — internal IPs, version numbers, disk SMART status. Gated behind example 19's auth pattern.
- **Alertmanager compatibility.** Expose a `/api/metrics` endpoint in Prometheus text format. Now the dashboard is also a metrics source for a local Grafana.
