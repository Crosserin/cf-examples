// functions/api/geo.ts
// GET /api/geo  →  returns the edge's view of the requester

interface Env {}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const cf = context.request.cf;

  if (!cf) {
    // local dev — cf is undefined
    return Response.json({
      country: "XX",
      city: "Localhost",
      colo: "DEV",
      timezone: "UTC",
      asn: 0,
      local: true,
    });
  }

  return Response.json(
    {
      country: cf.country ?? "??",
      city: cf.city ?? "Unknown city",
      region: cf.region ?? null,
      colo: cf.colo ?? "???",
      timezone: cf.timezone ?? "UTC",
      asn: cf.asn ?? 0,
      asOrganization: cf.asOrganization ?? null,
      httpProtocol: cf.httpProtocol ?? null,
      tlsVersion: cf.tlsVersion ?? null,
      local: false,
    },
    {
      headers: {
        "cache-control": "no-store",
        "content-type": "application/json; charset=utf-8",
      },
    }
  );
};
