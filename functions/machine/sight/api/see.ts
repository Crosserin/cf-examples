interface Env {
  R2: R2Bucket;
  AI: any;
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const formData = await context.request.formData();
    const file = formData.get('image') as File | null;
    if (!file) {
      return json({ error: 'no file provided in "image" field' }, 400);
    }

    const ct = file.type || 'image/jpeg';
    if (!ct.startsWith('image/')) {
      return json({ error: 'not an image: ' + ct }, 400);
    }
    if (file.size > 4 * 1024 * 1024) {
      return json({ error: 'file too large (> 4 MB)' }, 413);
    }

    const bytes = new Uint8Array(await file.arrayBuffer());

    // Store in R2 (namespaced under sight/)
    const ext = (ct.split('/')[1] || 'jpg').replace(/[^a-z0-9]/gi, '').slice(0, 8) || 'jpg';
    const key = `sight/${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${ext}`;
    await context.env.R2.put(key, bytes, { httpMetadata: { contentType: ct } });

    // Classification (ResNet-50) — expects number[] image
    const imageArr = Array.from(bytes);
    const clsResp = await context.env.AI.run('@cf/microsoft/resnet-50', { image: imageArr });
    const tags = Array.isArray(clsResp)
      ? clsResp.slice(0, 5).map((t: any) => ({ label: String(t.label || '').replace(/_/g, ' '), score: Number(t.score) || 0 }))
      : [];

    // Caption (uform-gen2-qwen)
    let caption = '';
    try {
      const capResp: any = await context.env.AI.run('@cf/unum/uform-gen2-qwen-500m', {
        image: imageArr,
        prompt: 'Describe this image in one concise sentence.',
        max_tokens: 64,
      });
      caption = (capResp?.description || capResp?.response || '').trim();
    } catch (e) {
      caption = '(caption model unavailable)';
    }

    return json({
      r2_key: key,
      content_type: ct,
      bytes: bytes.length,
      caption,
      tags,
    });
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