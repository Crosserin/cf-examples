interface Env { DB: D1Database; AI: any; }

export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const body: any = await context.request.json();
    const query: string = (body?.query || '').toString().trim();
    if (!query) return json({ error: 'query field required' }, 400);
    if (query.length > 500) return json({ error: 'query too long (> 500 chars)' }, 400);

    // 1. Embed the query with bge-base-en-v1.5
    const embedResp: any = await context.env.AI.run('@cf/baai/bge-base-en-v1.5', { text: [query] });
    const queryVec: number[] = embedResp?.data?.[0];
    if (!queryVec || queryVec.length !== 768) {
      return json({ error: 'embedding failed', got: queryVec?.length }, 500);
    }

    // 2. Fetch corpus (small — OK to pull all)
    const rs = await context.env.DB.prepare('SELECT id, title, body, embedding FROM corpus').all();
    const rows = (rs.results || []) as any[];
    if (rows.length === 0) {
      return json({ error: 'corpus empty — POST /machine/ghost/api/seed first' }, 503);
    }

    // 3. Score by cosine similarity
    const scored = rows.map(r => ({
      id: r.id, title: r.title, body: r.body,
      score: cosine(queryVec, decodeEmbedding(r.embedding)),
    })).sort((a, b) => b.score - a.score).slice(0, 3);

    // 4. Build RAG prompt
    const contextStr = scored.map((s, i) => `[Source ${i + 1}: ${s.title}]\n${s.body}`).join('\n\n');
    const messages = [
      {
        role: 'system',
        content: `You are a concise technical assistant. Answer the user's question using ONLY the information in the provided sources. If the sources do not contain the answer, say so plainly. Keep answers to 2-4 sentences unless the user asks for more. Cite sources inline as [1], [2], or [3].\n\nSources:\n${contextStr}`,
      },
      { role: 'user', content: query },
    ];

    // 5. Call Llama with streaming
    const llmStream: ReadableStream = await context.env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
      messages, stream: true, max_tokens: 350,
    });

    // 6. Prepend a sources event to the stream
    const encoder = new TextEncoder();
    const sourcesEvent = encoder.encode(
      'data: ' + JSON.stringify({
        type: 'sources',
        sources: scored.map(s => ({ title: s.title, score: s.score, excerpt: s.body.slice(0, 160) })),
      }) + '\n\n'
    );

    const combined = new ReadableStream({
      async start(controller) {
        controller.enqueue(sourcesEvent);
        const reader = llmStream.getReader();
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            controller.enqueue(value);
          }
        } finally {
          controller.close();
        }
      },
    });

    return new Response(combined, {
      headers: {
        'content-type': 'text/event-stream; charset=utf-8',
        'cache-control': 'no-cache, no-transform',
        'x-content-type-options': 'nosniff',
      },
    });
  } catch (err: any) {
    return json({ error: String(err?.message || err) }, 500);
  }
};

function cosine(a: number[] | Float32Array, b: number[] | Float32Array): number {
  let dot = 0, ma = 0, mb = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) { dot += a[i] * b[i]; ma += a[i] * a[i]; mb += b[i] * b[i]; }
  const denom = Math.sqrt(ma) * Math.sqrt(mb);
  return denom === 0 ? 0 : dot / denom;
}

function decodeEmbedding(blob: any): Float32Array {
  let buf: ArrayBuffer;
  if (blob instanceof ArrayBuffer) buf = blob;
  else if (blob instanceof Uint8Array) buf = blob.buffer.slice(blob.byteOffset, blob.byteOffset + blob.byteLength);
  else if (Array.isArray(blob)) { const u = new Uint8Array(blob); buf = u.buffer; }
  else throw new Error('unknown embedding blob type: ' + typeof blob);
  return new Float32Array(buf);
}

function json(body: any, status = 200) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}