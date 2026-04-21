# 26-workers-ai-chat

> Streaming chat UI backed by Llama 3.1 8B running on Cloudflare's GPU network.

## What it does

A full chat interface. Type a message, send it, watch tokens stream back in real time. The model is `@cf/meta/llama-3.1-8b-instruct`, served by Workers AI — no OpenAI key, no Anthropic key, no external API dependency. Pay-per-request, billed against the Cloudflare plan.

The interesting part is the streaming. The Function returns the raw `ReadableStream` from `env.AI.run()`, the client parses Server-Sent Events, and the UI updates token-by-token with a blinking cursor. This is the same UX you get from ChatGPT, done in ~60 lines of client code.

## Cloudflare features used

- [x] Pages (static hosting)
- [x] Pages Functions
- [x] Workers AI (`@cf/meta/llama-3.1-8b-instruct`)

## Files

```
26-workers-ai-chat/
├── README.md
├── index.html                      ← chat UI + SSE parser
└── functions/
    └── api/
        └── chat.ts                 ← POST /api/chat
```

## Running locally

```bash
# the AI binding works locally too — requests are proxied to the real models
wrangler pages dev . --ai AI
```

Workers AI in local dev costs the same as in production (it's running the real model either way). Don't leave a hot reload loop spamming it.

## Key files to read

**`functions/api/chat.ts`** — the whole backend, about 40 lines:

- **System prompt injected server-side**, not client-side. This is the prompt-injection defense: the client can send whatever history it wants, but the real system prompt always wins.
- **`stream: true`** flips the return type from JSON to a `ReadableStream`.
- **`max_tokens: 512`** caps the response. Without this, a runaway prompt could burn budget.
- **History clamping** — `slice(-MAX_MESSAGES)` keeps the context window bounded. 20 turns is plenty for a demo and keeps token costs predictable.
- **Role filtering** — only `user` and `assistant` roles survive sanitization. The client can't sneak a second `system` message in.

**`index.html`** — the SSE parsing loop is the only non-obvious bit:

```js
const reader = res.body.getReader();
const decoder = new TextDecoder();
let buffer = '';

while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  buffer += decoder.decode(value, { stream: true });
  const lines = buffer.split('\n');
  buffer = lines.pop() || '';  // keep incomplete last line
  for (const line of lines) {
    if (line.startsWith('data: ')) { /* parse JSON chunk */ }
  }
}
```

The `buffer.split('\n')` + `lines.pop()` pattern handles chunks that arrive mid-line. Forgetting this gives you parse errors on slow connections.

## Gotchas

- **Workers AI models are pay-per-neuron.** Each request bills against your plan. In the free tier you get a daily allocation, after that it's metered. Worth knowing before you embed this on a high-traffic page.
- **The `ai` binding is not a URL**, it's a capability binding. No API key management, no endpoint config — Cloudflare routes the call internally.
- **Llama 3.1 8B has a small context window** compared to GPT-4. Don't expect 128k-token reasoning. Use the bigger models (`@cf/meta/llama-3.3-70b-instruct-fp8-fast` etc.) when it's worth the cost.
- **Local dev still costs money** because `wrangler pages dev --ai` proxies to real Cloudflare infrastructure. No local model simulation.
- **SSE keepalives**: Cloudflare will hold the connection open for a while, but don't design around multi-minute streams. Break long responses into pagination or polling.

## What I'd do differently at scale

- **Store conversations in D1** keyed by a client-generated UUID. Lets users come back to a conversation and enables simple moderation/audit trails.
- **Rate-limit per IP** via KV before hitting the AI binding. AI costs money; HTTP requests don't. Reject bad requests cheaply.
- **Add Turnstile** on the first message of a session to keep scrapers off the endpoint.
- **Abstract the model** behind a config — swap `@cf/meta/llama-3.1-8b-instruct` for `@cf/mistral/mistral-7b-instruct-v0.1` or the 70B Llama variant based on a plan tier.
- **Prompt caching**: if you have a long system prompt, prepend it once per session rather than sending it on every request. Workers AI doesn't have prompt caching yet the way Anthropic's API does, but keeping history short helps.
- **Consider streaming-over-WebSocket** via a Durable Object (see example 24) if you need bidirectional updates — e.g., interrupting generation, or live-updating tool-use UI.
