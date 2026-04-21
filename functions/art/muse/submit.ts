// Art/muse submit — vision model reads sketch, Flux generates, R2 stores
interface Env {
  AI: any;
  R2: R2Bucket;
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const t0 = Date.now();
  try {
    const body: any = await context.request.json();
    const { sketch, prompt } = body;
    if (!sketch || !prompt) return json({ error: 'sketch and prompt required' }, 400);
    if (typeof sketch !== 'string' || !sketch.startsWith('data:image/')) {
      return json({ error: 'sketch must be a data URL' }, 400);
    }
    if (prompt.length > 600) return json({ error: 'prompt too long' }, 400);

    // Decode sketch data URL -> bytes
    const sketchB64 = sketch.split(',')[1];
    const sketchBytes = Uint8Array.from(atob(sketchB64), c => c.charCodeAt(0));

    // Stage 1: vision model reads the sketch
    // uform-gen2-qwen-500m takes an image and returns a description
    let visionDescription = 'a sketch';
    try {
      const visionResult: any = await context.env.AI.run('@cf/unum/uform-gen2-qwen-500m', {
        image: [...sketchBytes],
        prompt: 'Describe this hand-drawn sketch in one short sentence. Focus on the main subject and composition.',
        max_tokens: 80,
      });
      visionDescription = (visionResult.description || visionResult.response || '').trim();
      if (!visionDescription) visionDescription = 'an abstract sketch';
    } catch (e: any) {
      visionDescription = `(vision model failed: ${e.message})`;
    }

    // Stage 2: combine vision + user prompt, generate with Flux
    const fullPrompt = `${prompt}. Visual reference: ${visionDescription}`.slice(0, 600);

    const imageResult: any = await context.env.AI.run(
      '@cf/black-forest-labs/flux-1-schnell',
      { prompt: fullPrompt, num_steps: 4 }
    );

    // flux-1-schnell returns { image: base64string }
    if (!imageResult?.image) {
      return json({ error: 'image generation failed', detail: JSON.stringify(imageResult).slice(0, 300) }, 502);
    }

    const imageBytes = Uint8Array.from(atob(imageResult.image), c => c.charCodeAt(0));

    // Store both in R2 for portfolio archival
    const stamp = Date.now();
    const rand = Math.random().toString(36).slice(2, 8);
    const generatedKey = `muse/${stamp}-${rand}.jpg`;
    const sketchKey = `muse/${stamp}-${rand}-sketch.png`;

    await Promise.all([
      context.env.R2.put(generatedKey, imageBytes, {
        httpMetadata: { contentType: 'image/jpeg' },
        customMetadata: { prompt: prompt.slice(0, 500), vision: visionDescription.slice(0, 500) },
      }),
      context.env.R2.put(sketchKey, sketchBytes, {
        httpMetadata: { contentType: 'image/png' },
      }),
    ]);

    return json({
      vision_description: visionDescription,
      full_prompt_used: fullPrompt,
      generated_key: `${stamp}-${rand}.jpg`,
      timing_ms: Date.now() - t0,
    });
  } catch (e: any) {
    return json({ error: 'pipeline failure', detail: e.message }, 500);
  }
};

function json(body: any, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}