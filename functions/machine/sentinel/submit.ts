// Machine/sentinel submit — AI triage + D1 storage
interface Env {
  AI: any;
  DB: D1Database;
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const t0 = Date.now();
  try {
    const body: any = await context.request.json();
    const name = String(body.name || '').trim().slice(0, 120);
    const email = String(body.email || '').trim().slice(0, 200);
    const company = String(body.company || '').trim().slice(0, 200) || null;
    const message = String(body.message || '').trim().slice(0, 4000);

    if (!name || !email || !message) return json({ error: 'name, email, message required' }, 400);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: 'invalid email' }, 400);
    if (message.length < 10) return json({ error: 'message too short' }, 400);

    const cf = (context.request as any).cf || {};
    const userAgent = context.request.headers.get('user-agent') || '';
    const country = cf.country || '';

    // Stage 1: classify in parallel with draft reply generation for speed
    const classifyPrompt = [
      {
        role: 'system',
        content: `You are a contact-form triage system for a solo IT consultant. Classify incoming messages. Respond with ONLY valid compact JSON, no markdown, no preamble. Shape:
{"category": "sales"|"support"|"partnership"|"spam"|"other", "urgency": "low"|"medium"|"high", "key_topics": ["...", "..."], "reasoning": "one sentence explanation"}

Category rules:
- sales: prospects interested in hiring, asking about pricing, services, availability
- support: existing client issues, bug reports, help requests
- partnership: other vendors, referral partners, agencies proposing collaboration
- spam: obvious spam, SEO pitches, generic outreach, marketing proposals to the consultant
- other: anything else (recruiter messages, job inquiries, press, etc.)

Urgency rules:
- high: production outages, legal/billing disputes, active deals with deadlines
- medium: active sales opportunities, non-urgent client issues
- low: informational, general inquiries, spam, partnerships

Return at most 4 key_topics, each 1-3 words.`,
      },
      {
        role: 'user',
        content: `Name: ${name}\nCompany: ${company || '(not given)'}\nMessage:\n${message}`,
      },
    ];

    const draftPrompt = [
      {
        role: 'system',
        content: `You are Erin, a solo IT consultant at X=Consulting. Draft a brief, warm, professional reply to this contact form message. Rules:
- 2 to 3 sentences, maximum 80 words
- Acknowledge their specific ask; do not invent details you don't have
- Professional but warm tone, not stiff, not cheesy
- Close with "— Erin"
- Return ONLY the reply body, no subject line, no preamble`,
      },
      {
        role: 'user',
        content: `Name: ${name}\nCompany: ${company || '(not given)'}\nMessage:\n${message}`,
      },
    ];

    const [classifyResult, draftResult] = await Promise.allSettled([
      context.env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
        messages: classifyPrompt,
        max_tokens: 200,
        temperature: 0.2,
      }),
      context.env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
        messages: draftPrompt,
        max_tokens: 160,
        temperature: 0.6,
      }),
    ]);

    // Parse classification
    let category = 'other', urgency = 'low', keyTopics: string[] = [], reasoning = '';
    if (classifyResult.status === 'fulfilled') {
      const raw = (classifyResult.value?.response || '').trim();
      const match = raw.match(/\{[\s\S]*\}/);
      if (match) {
        try {
          const parsed = JSON.parse(match[0]);
          category = String(parsed.category || 'other').toLowerCase();
          urgency = String(parsed.urgency || 'low').toLowerCase();
          keyTopics = Array.isArray(parsed.key_topics) ? parsed.key_topics.slice(0, 4).map((t: any) => String(t)) : [];
          reasoning = String(parsed.reasoning || '');
          if (!['sales', 'support', 'partnership', 'spam', 'other'].includes(category)) category = 'other';
          if (!['low', 'medium', 'high'].includes(urgency)) urgency = 'low';
        } catch {}
      }
    }

    // Parse draft
    let draftReply = '';
    if (draftResult.status === 'fulfilled') {
      draftReply = (draftResult.value?.response || '').trim();
    }

    // Store in D1
    const insert = await context.env.DB.prepare(
      `INSERT INTO contacts (name, email, company, message, category, urgency, key_topics, reasoning, draft_reply, user_agent, country)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       RETURNING id, created_at`
    ).bind(
      name, email, company, message, category, urgency,
      JSON.stringify(keyTopics), reasoning, draftReply, userAgent, country
    ).first();

    return json({
      id: insert?.id,
      created_at: insert?.created_at,
      category,
      urgency,
      key_topics: keyTopics,
      reasoning,
      draft_reply: draftReply,
      timing_ms: Date.now() - t0,
    });
  } catch (e: any) {
    return json({ error: 'triage failure', detail: e.message }, 500);
  }
};

function json(body: any, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}