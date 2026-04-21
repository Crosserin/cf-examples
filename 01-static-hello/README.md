# 01-static-hello

> One HTML file, deployed to the edge. The baseline.

## What it does

Proves the deploy pipeline works. If this page loads, Cloudflare Pages is wired up to the GitHub repo, the build completed, and the file is being served from the edge.

## Cloudflare features used

- [x] Pages (static hosting)

## Files

```
01-static-hello/
├── README.md
└── index.html    ← everything, including inline styles
```

## Running locally

```bash
wrangler pages dev .
```

Or just open `index.html` in a browser. It's that simple — no dependencies.

## Gotchas

None. That's the point of this one.

## What I'd do differently at scale

Split the CSS into its own file once there's more than ~100 lines. For a one-pager like this, inline is fine and saves a round trip.
