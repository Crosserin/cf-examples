// functions/api/count.ts
// GET /api/count  →  increments the visit counter in KV, returns the new count.
//
// This is the "hello world" of Workers KV. It writes on every read, which
// would be a terrible pattern at scale — see the README for the correct
// high-traffic approach.

interface Env {
  KV: KVNamespace;
}

const KEY = "visits:total";

export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  const current = parseInt((await env.KV.get(KEY)) ?? "0", 10);
  const next = current + 1;

  // fire-and-forget write; we don't make the user wait
  await env.KV.put(KEY, String(next));

  return Response.json(
    { count: next },
    { headers: { "cache-control": "no-store" } }
  );
};
