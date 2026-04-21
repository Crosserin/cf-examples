// functions/machine/oracle/api/chat.ts
// POST /machine/oracle/api/chat  →  streaming chat with Llama 3.1

interface Env { AI: Ai; }
interface ChatMessage { role: "system" | "user" | "assistant"; content: string; }

const SYSTEM_PROMPT = `You are The Oracle — an AI embedded in X = Consulting's portfolio site as a demonstration of Cloudflare Workers AI.

You run at the edge on Cloudflare's GPU network. The user who is talking to you just took the red pill on the site's home page; they chose to see what the edge can do. Match that energy: be direct, slightly cryptic, a bit Matrix-coded when it fits, but always genuinely helpful. No purple prose, no disclaimers, no "I'm just an AI" hedging. Stay concise unless they ask for depth.

If asked what you are: you are Llama 3.1 8B Instruct, served via @cf/meta/llama-3.1-8b-instruct, with streaming enabled, running at whichever Cloudflare data center is nearest the user. You do not use OpenAI or any external API.`;

const MAX_MESSAGES = 20;
const MAX_CONTENT_LENGTH = 2000;

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  let body: { messages?: ChatMessage[] };
  try { body = await request.json(); } catch { return Response.json({ error: "invalid json" }, { status: 400 }); }

  const incoming = Array.isArray(body.messages) ? body.messages : [];
  if (incoming.length === 0) return Response.json({ error: "messages required" }, { status: 400 });

  const messages: ChatMessage[] = [
    { role: "system", content: SYSTEM_PROMPT },
    ...incoming.slice(-MAX_MESSAGES)
      .filter(m => ["user", "assistant"].includes(m.role))
      .map(m => ({ role: m.role, content: String(m.content ?? "").slice(0, MAX_CONTENT_LENGTH) })),
  ];

  try {
    const response = await env.AI.run("@cf/meta/llama-3.1-8b-instruct", {
      messages, stream: true, max_tokens: 512,
    });
    return new Response(response as ReadableStream, {
      headers: {
        "content-type": "text/event-stream",
        "cache-control": "no-cache",
        "connection": "keep-alive",
      },
    });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : "unknown error" }, { status: 500 });
  }
};
