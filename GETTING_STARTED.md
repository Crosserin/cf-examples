# Getting started

Everything you need to go from zero to a live deploy on Cloudflare Pages, connected to this GitHub repo.

## One-time setup

### 1. Push to GitHub

Create an empty public repo on github.com (don't initialize with README/gitignore/license — this repo already has them).

```bash
cd cf-examples
git init
git add .
git commit -m "Initial commit: landing page + example scaffolds"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/cf-examples.git
git push -u origin main
```

### 2. Connect Cloudflare Pages to the repo

In the Cloudflare dashboard → **Workers & Pages** → **Create** → **Pages** tab → **Connect to Git**:

- Authorize GitHub access (first time only)
- Pick `cf-examples`
- Production branch: `main`
- Framework preset: **None**
- Build command: *blank*
- Build output directory: `/`
- **Save and Deploy**

Every push to `main` auto-deploys. PRs get preview URLs.

### 3. Create Cloudflare resources

```bash
npm install -g wrangler
wrangler login

wrangler kv namespace create KV
wrangler d1 create cf-examples-db
wrangler r2 bucket create cf-examples-uploads
```

Copy the KV namespace ID and D1 database ID into `wrangler.toml` where noted.

### 4. Attach bindings in the dashboard

Pages project → **Settings** → **Functions** → **Bindings**:

| Binding type     | Variable name | Value                    | Used by examples |
| ---------------- | ------------- | ------------------------ | ---------------- |
| KV namespace     | `KV`          | the namespace from above | 21, 29           |
| D1 database      | `DB`          | `cf-examples-db`         | 22, 28           |
| R2 bucket        | `R2`          | `cf-examples-uploads`    | 23, 27           |
| Workers AI       | `AI`          | *(no value, just bind)*  | 26, 27           |

Redeploy (Deployments → latest → Retry deployment) so the bindings apply.

### 5. Apply D1 migrations

```bash
wrangler d1 migrations apply cf-examples-db --remote
```

Drop `--remote` to apply to your local dev DB instead.

### 6. Set secrets (as you need them)

```bash
# Example 16 — contact form
wrangler pages secret put TURNSTILE_SECRET --project-name cf-examples
wrangler pages secret put CONTACT_TO        --project-name cf-examples
wrangler pages secret put CONTACT_FROM      --project-name cf-examples

# Example 19 — auth gate
wrangler pages secret put AUTH_SECRET       --project-name cf-examples
```

## Local development

From the repo root:

```bash
wrangler pages dev .
```

Visit http://localhost:8788. Functions work locally, KV/D1/R2 get local shadow copies, Workers AI proxies to the real thing.

For a specific example with its own `wrangler.toml`:

```bash
cd 22-d1-guestbook
wrangler pages dev .
```

## Deploy manually (if you need to)

```bash
wrangler pages deploy .
```

Normally you'd just `git push` and let the GitHub integration handle it.

## Branching workflow

Recommended:

```bash
# new example
git checkout -b add/21-kv-visit-counter
# ... build it ...
git add .
git commit -m "Add 21: KV-backed visit counter"
git push -u origin add/21-kv-visit-counter
# open PR on GitHub → gets a preview URL automatically
# merge when happy → auto-deploys to prod
```

The PR URLs are good interview material — you can show the literal "here's me building this feature, here's the preview deploy, here's the merge" trail.

## Tagging milestones

```bash
git tag -a v0.10-foundations -m "Examples 1–10 complete"
git push origin v0.10-foundations
```

Tags show up on the GitHub repo page as releases. Good way to mark the "it works" snapshots.

## Troubleshooting

- **"Function invocation failed"** on a freshly deployed example — 95% of the time it's a missing binding. Dashboard → Settings → Functions → Bindings, confirm the binding name matches what the code expects (`KV`, `DB`, `R2`, `AI`).
- **D1 query works locally but not in prod** — you forgot `--remote` on the migration. Run `wrangler d1 migrations apply cf-examples-db --remote`.
- **TypeScript `Property 'cf' does not exist on type 'Request'`** — install `@cloudflare/workers-types` as a dev dep, or add `/// <reference types="@cloudflare/workers-types" />` at the top of the `.ts` file.
- **Turnstile fails even with the right secret** — check the site key in the HTML matches the secret's site, and that the domain is registered on that Turnstile site.
- **Local `wrangler pages dev` can't find bindings** — local bindings aren't auto-created from dashboard config. Either copy the bindings into `wrangler.toml` under the right sections or run `wrangler pages dev . --kv KV --d1 DB --r2 R2 --ai AI`.
