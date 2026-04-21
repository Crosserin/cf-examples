// functions/api/entries.ts
// GET  /api/entries?cursor=123&limit=20  →  paginated list
// POST /api/entries                      →  create new entry

interface Env {
  DB: D1Database;
}

interface Entry {
  id: number;
  name: string;
  message: string;
  country: string | null;
  created_at: number;
}

const MAX_NAME = 50;
const MAX_MESSAGE = 500;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

// ——— GET: list entries with cursor pagination ———
export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const url = new URL(request.url);
  const cursor = parseInt(url.searchParams.get("cursor") ?? "", 10);
  const limit = Math.min(
    parseInt(url.searchParams.get("limit") ?? String(DEFAULT_LIMIT), 10) || DEFAULT_LIMIT,
    MAX_LIMIT
  );

  let stmt;
  if (Number.isFinite(cursor) && cursor > 0) {
    stmt = env.DB
      .prepare("SELECT * FROM entries WHERE id < ?1 ORDER BY id DESC LIMIT ?2")
      .bind(cursor, limit);
  } else {
    stmt = env.DB
      .prepare("SELECT * FROM entries ORDER BY id DESC LIMIT ?1")
      .bind(limit);
  }

  const { results } = await stmt.all<Entry>();
  const nextCursor = results.length === limit ? results[results.length - 1].id : null;

  return Response.json(
    { entries: results, nextCursor },
    { headers: { "cache-control": "no-store" } }
  );
};

// ——— POST: create an entry ———
export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  let body: { name?: string; message?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid json" }, { status: 400 });
  }

  const name = (body.name ?? "").toString().trim().slice(0, MAX_NAME);
  const message = (body.message ?? "").toString().trim().slice(0, MAX_MESSAGE);

  if (!name) return Response.json({ error: "name required" }, { status: 400 });
  if (!message) return Response.json({ error: "message required" }, { status: 400 });

  const country = request.cf?.country ?? null;
  const now = Math.floor(Date.now() / 1000);

  const { meta } = await env.DB
    .prepare("INSERT INTO entries (name, message, country, created_at) VALUES (?1, ?2, ?3, ?4)")
    .bind(name, message, country, now)
    .run();

  return Response.json(
    {
      entry: {
        id: meta.last_row_id,
        name,
        message,
        country,
        created_at: now,
      },
    },
    { status: 201 }
  );
};
