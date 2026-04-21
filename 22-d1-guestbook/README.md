# 22-d1-guestbook

> SQLite at the edge. Paginated, sanitized, country-tagged.

## What it does

A classic guestbook. Users leave a name + message; entries get written to a D1 database and served back on page load. Pagination is cursor-based (not offset), messages are sanitized, and each entry gets tagged with the country of origin from `request.cf.country`.

Shows the full pattern: D1 schema with migrations, a `GET` and `POST` handler sharing a single route file, client-side rendering with escaping, and a sensible pagination API.

## Cloudflare features used

- [x] Pages (static hosting)
- [x] Pages Functions
- [x] D1 (SQLite database)

## Files

```
22-d1-guestbook/
├── README.md
├── index.html                      ← form + entries list
├── functions/
│   └── api/
│       └── entries.ts              ← GET (list) + POST (create)
└── migrations/
    └── 0001_init.sql               ← schema
```

## Running locally

```bash
# 1. create the D1 database
wrangler d1 create cf-examples-db

# copy the database_id it prints into wrangler.toml under [[d1_databases]]

# 2. apply the migration locally
wrangler d1 migrations apply cf-examples-db --local

# 3. run it
wrangler pages dev .
```

For production, drop the `--local` flag when applying migrations. D1 is the real thing — `wrangler d1 execute cf-examples-db --command "SELECT * FROM entries LIMIT 5"` works against prod too.

## Key files to read

**`functions/api/entries.ts`** — one file, both verbs. `onRequestGet` for listing, `onRequestPost` for creating. Pages Functions dispatches to these by method automatically.

The interesting bits:

- **Cursor pagination** instead of `LIMIT/OFFSET` — using `WHERE id < ?` with `ORDER BY id DESC` is O(log n) vs. offset which is O(offset). Cheap to do right, expensive to fix later.
- **`?1`, `?2` parameter binding** — D1 requires positional parameters. Never concatenate user input into SQL strings, ever.
- **`slice()` after `trim()`** — truncates to max length as a defense-in-depth measure even though the frontend enforces `maxlength`.
- **`request.cf?.country`** — optional chaining because `cf` is undefined in local dev.

## Gotchas

- **D1 is eventually consistent across regions** on reads from replicas. For a guestbook this is fine — you'll see your entry within a second or two. For anything with strict read-your-writes requirements, either read from the primary region or use a Durable Object.
- **`meta.last_row_id`** comes back as a bigint-style number. For AUTOINCREMENT primary keys this is fine, but don't assume all D1 result meta is JSON-safe.
- **`Response.json()`** is a newer standard method and works in Workers runtime. It's not yet universal in Node.
- **Never trust the client's timestamp.** Set `created_at` server-side, always.

## What I'd do differently at scale

- Add a **basic rate limit** per IP using KV — 5 entries per hour would stop the obvious abuse. Real abuse needs Turnstile.
- **Sanitize on render, not just write.** The current code escapes on the client which is fine for this demo, but if any other surface reads from the DB, it needs to escape too. Defense in depth.
- **Add a `hidden` boolean column** for soft-deletion rather than hard-deleting. You'll want the audit trail the first time someone posts something regrettable.
- For high write volumes, batch inserts via **`env.DB.batch()`** — D1 will pipeline them.
- Consider **Drizzle ORM** once there are 3+ tables. For a single-table example like this, raw SQL is clearer.
