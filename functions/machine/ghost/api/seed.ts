interface Env { DB: D1Database; AI: any; }

const CORPUS: { title: string; body: string }[] = [
  {
    title: 'Cloudflare Workers',
    body: "Cloudflare Workers are serverless functions that run on V8 isolates in every Cloudflare data center. Each request starts in under a millisecond with no cold start. Workers handle HTTP requests, scheduled cron triggers, queue consumers, and Durable Object coordination. The runtime is Web Standards-first: fetch, Request, Response, ReadableStream, crypto.subtle.",
  },
  {
    title: 'Cloudflare Pages',
    body: "Cloudflare Pages is a git-integrated static site host with optional serverless Functions. Pages builds from a git repository or accepts direct uploads via wrangler. Pages Functions live in a functions/ directory at the repo root; the filesystem path maps 1:1 to the URL path, so functions/api/foo.ts serves at /api/foo.",
  },
  {
    title: 'Pages Functions Routing',
    body: "A Pages Function at functions/api/foo.ts handles every HTTP method at /api/foo by default. Exported handlers like onRequestGet and onRequestPost filter by method. Each handler receives a context object containing request, env (with all bindings), waitUntil for background work, next for middleware chaining, and a params object for dynamic segments.",
  },
  {
    title: 'Workers KV',
    body: "Workers KV is an eventually consistent, globally distributed key-value store. Reads are fast at the edge (millisecond latency after first cache), but writes may take up to 60 seconds to propagate globally. KV is ideal for configuration, feature flags, session data, and read-heavy cached content. Keys are up to 512 bytes, values up to 25 MB.",
  },
  {
    title: 'D1 Database',
    body: "D1 is Cloudflare's managed serverless SQLite database. Each D1 database is an isolated SQLite instance with read replicas and session-consistent queries. Access it from a Worker via env.DB.prepare(sql).bind(args).all(), .first(), or .run(). D1 supports batch queries and transactions. Storage and reads are billed, with a generous free tier.",
  },
  {
    title: 'R2 Object Storage',
    body: "R2 is S3-compatible object storage with zero egress fees. Access R2 from a Worker via env.BUCKET.put(key, body), .get(key), .list(), .delete(key), and .head(key). R2 can also be accessed over the S3 API from outside Cloudflare, or served publicly via r2.dev URLs. It's ideal for media, backups, static assets, and data lakes.",
  },
  {
    title: 'Workers AI',
    body: "Workers AI runs open-source machine-learning models on Cloudflare's GPU fleet. Bind AI in wrangler.toml and call env.AI.run(model, input). The catalog covers text generation (Llama, Mistral, Gemma), embeddings (bge), image classification (ResNet), image captioning (LLaVA, uform), speech recognition (Whisper), and image generation (Stable Diffusion, Flux).",
  },
  {
    title: 'Vectorize',
    body: "Vectorize is Cloudflare's managed vector database for semantic search and retrieval-augmented generation. Create an index with a fixed dimensionality and distance metric (cosine, euclidean, or dot), insert vectors with arbitrary metadata, and query by nearest-neighbor similarity. A cheaper alternative for tiny corpora is to store Float32Array embeddings as BLOBs in D1 and compute cosine similarity in the Worker.",
  },
  {
    title: 'Durable Objects',
    body: "Durable Objects provide strongly consistent, stateful compute at the edge. Each instance is addressable by a unique ID, single-threaded, and co-located with its own transactional SQLite storage. They are ideal for coordination primitives: counters, game rooms, chat hubs, WebSocket brokers, leader election, and anything that needs a single source of truth per entity.",
  },
  {
    title: 'Edge Runtime',
    body: "Workers do not run Node.js. The runtime is V8 isolates with a curated subset of Node built-ins (opt-in via the nodejs_compat compatibility flag) and full Web Standards APIs — fetch, Request, Response, ReadableStream, TransformStream, TextEncoder, crypto.subtle, URL, URLPattern, structuredClone. Isolates boot in microseconds, which is why Workers have no cold-start penalty.",
  },
  {
    title: 'cf Request Properties',
    body: "Every request reaching the Cloudflare network is annotated with a request.cf object containing geographic data (country, city, postal code, timezone, latitude, longitude, colo airport code), network data (ASN, ISP, HTTP protocol, TLS version, cipher), and bot-detection scores. All of this is resolved server-side before your Worker or Pages Function ever runs, with no browser permissions required.",
  },
  {
    title: 'Cache API',
    body: "The Cache API (caches.default) is the low-level cache interface available inside Workers. Responses cached here persist across requests within the same data center. For cross-data-center caching, use standard Cache-Control headers on fetch responses — Cloudflare's edge cache will honor them. The Cache API is synchronous-feeling but deeply integrated with the request lifecycle via ctx.waitUntil.",
  },
];

export const onRequest: PagesFunction<Env> = async (context) => {
  if (context.request.method !== 'POST') {
    return json({ error: 'POST to seed' }, 405);
  }

  try {
    // 1. Ensure table exists
    await context.env.DB.prepare(`CREATE TABLE IF NOT EXISTS corpus (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      embedding BLOB NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )`).run();

    // 2. Check if already seeded (idempotent)
    const countRow: any = await context.env.DB.prepare('SELECT COUNT(*) AS c FROM corpus').first();
    if (countRow && countRow.c >= CORPUS.length) {
      return json({ status: 'already seeded', count: countRow.c });
    }

    // 3. Embed all entries in one batch call
    const texts = CORPUS.map(e => `${e.title}. ${e.body}`);
    const embedResp: any = await context.env.AI.run('@cf/baai/bge-base-en-v1.5', { text: texts });
    const vectors: number[][] = embedResp?.data;
    if (!Array.isArray(vectors) || vectors.length !== CORPUS.length) {
      return json({ error: 'embedding batch returned wrong shape', got: vectors?.length }, 500);
    }

    // 4. Wipe and reseed
    await context.env.DB.prepare('DELETE FROM corpus').run();

    const stmts = CORPUS.map((e, i) => {
      const buf = new Float32Array(vectors[i]).buffer;
      return context.env.DB
        .prepare('INSERT INTO corpus (title, body, embedding) VALUES (?, ?, ?)')
        .bind(e.title, e.body, buf);
    });
    await context.env.DB.batch(stmts);

    return json({ status: 'seeded', count: CORPUS.length, embedding_dims: vectors[0].length });
  } catch (err: any) {
    return json({ error: String(err?.message || err) }, 500);
  }
};

function json(body: any, status = 200) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}