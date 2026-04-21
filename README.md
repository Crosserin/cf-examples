# cf-examples 🔴

> Nine live examples running on Cloudflare's edge. Pure CSS art, edge AI, RAG, solar engineering, atmospheric data. One repo, one deploy, no servers to babysit.

**→ [cf-examples.pages.dev](https://cf-examples.pages.dev)** — pick a pill.

---

## 👋 Who made this

I'm **Erin Cross** — IT consultant, ex-telecom, ex-SEO-manager, currently running **[X = Consulting](https://xconsultingwork.com)** out of Portland, Oregon. I build at the seam between hands-on hardware and cloud-native: I'll rack a server in the morning, debug an Intune policy at lunch, and ship a Cloudflare Worker by dinner.

This repo is my answer to the question *"so what do you actually do?"* Every example here is a real pattern I'd reach for on a client problem. The site is meant to be three things at once:

- 🎯 A **portfolio** — real code, not slide decks
- 📚 A **reference** — when someone asks "can we do X at the edge?" I point them here
- 🧪 A **sandbox** — where ideas go to prove they work before they become client projects

Feel free to fork, steal patterns, or just poke around.

---

## 🧭 The three paths

The site is split into three "paths" because I don't fit neatly into one bucket, and neither do the problems I solve.

### 🎨 Art — pure front-end craft
CSS and vanilla JS pushed to their edges, zero frameworks. For when the brief is *make it feel good.*

| Work | What it demonstrates |
|------|---------------------|
| **Cityscape, 3am** | A night skyline with drifting clouds, animated windows, and a plane crossing the horizon. Every pixel is a `<div>`. |
| **Trace** | A digital harmonograph — four coupled damped oscillators drawing their own conversation. Six presets, seven live dials, oscilloscope graticule, infinite curves. |
| **Field of particles** | ~220 canvas particles flocking toward your cursor with live sliders for attract / damping / trail. No libraries. |

### 🤖 Machine — edge AI
Llama, embeddings, vision models, RAG. All on Workers AI, all on Cloudflare's GPUs, all without a single call to an external API.

| Work | What it demonstrates |
|------|---------------------|
| **The Oracle** | Streaming chat with Llama 3.1 8B over server-sent events. Tokens arrive as the model generates them. |
| **Sight** | Drop an image → Pages Function stores it in R2 → runs ResNet-50 for classification and uform-gen2 for a caption → returns tags with confidence bars, caption, and R2 key. |
| **Ghost in the corpus** | RAG over a 12-passage knowledge base. Embeds your query with BGE, cosine-matches against Float32Array vectors stored as BLOBs in D1, and streams a Llama synthesis citing the top 3 sources inline. |

### 🧭 Research — applied tools
Real client problems, stripped of specifics, made public.

| Work | What it demonstrates |
|------|---------------------|
| **Photon** | Photovoltaic string sizing calculator. NEC 690.7 / 690.8 compliant. Plug in module specs and design temperatures; get max-cold-Voc and min-hot-Vmp math with valid series/parallel combinations. |
| **Geo-forensics** | What Cloudflare's edge already knows about a visitor before any JavaScript runs. Country, city, TLS version, ASN, data-center airport code — all read from `request.cf` server-side. |
| **Signal** | Live atmospheric readings — temperature, pressure, humidity, wind vector — pulled from Open-Meteo through a Pages Function so the browser never hits the upstream directly. |

---

## 🛠️ Stack

| Layer | Tech |
|-------|------|
| **Hosting** | Cloudflare Pages |
| **Backend** | Pages Functions (TypeScript) |
| **AI** | Workers AI — Llama 3.1 8B, BGE-base-en-v1.5, ResNet-50, uform-gen2-qwen-500m |
| **Data** | D1 (SQLite, corpus + embeddings) · R2 (image uploads) · KV (bound, reserved) |
| **Fonts** | Inter · JetBrains Mono · Fraunces |
| **Frontend** | Hand-written HTML / CSS / JS. No framework. No build step. No transpilation. |

**Cost to run:** effectively $0/mo on Cloudflare's free tier. This whole thing can handle millions of requests before anything becomes metered.

---

## 🏗️ Architecture

```
Browser
   │
   ▼
Cloudflare Pages  (static HTML + CSS + JS)
   │
   ├── /machine/oracle/api/chat         → Workers AI (Llama 3.1 8B, streaming)
   ├── /machine/sight/api/see           → R2 (store)  +  Workers AI (ResNet + uform)
   ├── /machine/ghost/api/ask           → Workers AI (BGE) → D1 (cosine) → Llama stream
   ├── /research/photon/api/string-size → Pure math (NEC 690.7 / 690.8)
   ├── /research/geo/api/whoami         → request.cf edge properties
   └── /research/signal/api/atmosphere  → fetch → Open-Meteo (cached 5 min)
```

Every function sits at `functions/<path>/api/<name>.ts`. Filesystem mirrors URL path. No route config, no server setup.

---

## 🏃 Run it yourself

```bash
git clone https://github.com/Crosserin/cf-examples.git
cd cf-examples
npx wrangler pages dev .
```

Most pages work locally without any bindings. The examples that touch D1 / KV / R2 / AI need a `wrangler.toml` with your own namespace IDs, or the `--local` flag to use Miniflare's in-memory simulators. See `wrangler.toml` for the shape.

To populate the ghost RAG corpus after deploy:

```bash
curl -X POST https://cf-examples.pages.dev/machine/ghost/api/seed
```

---

## 🔗 Reach me

- 🌐 **[xconsultingwork.com](https://xconsultingwork.com)** — consulting, full-stack builds, homelab design, IT strategy
- 🐙 **GitHub** — [@Crosserin](https://github.com/Crosserin)

*Build. Launch. Grow.*