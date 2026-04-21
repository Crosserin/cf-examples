// functions/api/chat.ts
// POST /api/chat  →  streams a chat completion from Workers AI (Llama 3.1 8B)

interface Env {
  AI: Ai;
}

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

const SYSTEM_PROMPT = `You are a helpful assistant embedded in a demo of Cloudflare Workers AI.
You run at the edge, on Cloudflare's GPUs, with sub-second cold starts.
Be concise, friendly, and technical when appropriate. If the user asks what you are,
you are Llama 3.1 8B Instruct, served by @cf/meta/llama-3.1-8b-instruct.`;

const MAX_MESSAGES = 20;           // keep context window bounded
const MAX_CONTENT_LENGTH = 2000;   // per-message guardrail

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  let body: { messages?: ChatMessage[] };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid json" }, { status: 400 });
  }

  const incoming = Array.isArray(body.messages) ? body.messages : [];
  if (incoming.length === 0) {
    return Response.json({ error: "messages required" }, { status: 400 });
  }

  // sanitize + clamp history
  const messages: ChatMessage[] = [
    { role: "system", content: SYSTEM_PROMPT },
    ...incoming
      .slice(-MAX_MESSAGES)
      .filter((m) => ["user", "assistant"].includes(m.role))
      .map((m) => ({
        role: m.role,
        content: String(m.content ?? "").slice(0, MAX_CONTENT_LENGTH),
      })),
  ];

  try {
    // stream: true returns a ReadableStream of SSE-formatted chunks
    const response = await env.AI.run("@cf/meta/llama-3.1-8b-instruct", {
      messages,
      stream: true,
      max_tokens: 512,
    });

    return new Response(response as ReadableStream, {
      headers: {
        "content-type": "text/event-stream",
        "cache-control": "no-cache",
        "connection": "keep-alive",
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown error";
    return Response.json({ error: msg }, { status: 500 });
  }
};
