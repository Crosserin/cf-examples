interface Env {}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { request } = context;
  const cf = (request as any).cf || {};
  const ip = request.headers.get('cf-connecting-ip') || null;

  const dossier = {
    ip,
    country:         cf.country         ?? null,
    region:          cf.region          ?? null,
    city:            cf.city            ?? null,
    postalCode:      cf.postalCode      ?? null,
    continent:       cf.continent       ?? null,
    timezone:        cf.timezone        ?? null,
    latitude:        cf.latitude        ?? null,
    longitude:       cf.longitude       ?? null,
    colo:            cf.colo            ?? null,
    asn:             cf.asn             ?? null,
    asOrganization:  cf.asOrganization  ?? null,
    httpProtocol:    cf.httpProtocol    ?? null,
    tlsVersion:      cf.tlsVersion      ?? null,
    tlsCipher:       cf.tlsCipher       ?? null,
    requestPriority: cf.requestPriority ?? null,
  };

  return new Response(JSON.stringify(dossier, null, 2), {
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  });
};