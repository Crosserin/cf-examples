// Serves a generated image from R2. Key is the UUID portion.
interface Env { R2: R2Bucket }

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const key = String(context.params.key || '');
  if (!key || key.includes('..') || key.includes('/')) {
    return new Response('bad key', { status: 400 });
  }
  const obj = await context.env.R2.get(`muse/${key}`);
  if (!obj) return new Response('not found', { status: 404 });
  return new Response(obj.body, {
    headers: {
      'content-type': obj.httpMetadata?.contentType || 'image/jpeg',
      'cache-control': 'public, max-age=31536000, immutable',
    },
  });
};