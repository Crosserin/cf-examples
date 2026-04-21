interface Env {}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { request } = context;
  const url = new URL(request.url);
  const cf = (request as any).cf || {};

  let lat = parseFloat(url.searchParams.get('lat') || '');
  let lon = parseFloat(url.searchParams.get('lon') || '');
  let source = 'override';

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    lat = parseFloat(cf.latitude);
    lon = parseFloat(cf.longitude);
    source = 'edge';
  }
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    lat = 45.5152; lon = -122.6784;
    source = 'fallback';
  }

  const fields = [
    'temperature_2m', 'relative_humidity_2m', 'pressure_msl',
    'wind_speed_10m', 'wind_direction_10m', 'cloud_cover',
  ].join(',');

  const upstreamUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=${fields}&wind_speed_unit=kmh&temperature_unit=celsius`;

  const upstream = await fetch(upstreamUrl, {
    headers: { 'user-agent': 'cf-examples/signal (https://cf-examples.pages.dev)' },
    cf: { cacheTtl: 300, cacheEverything: true },
  });

  if (!upstream.ok) {
    return new Response(JSON.stringify({ error: 'upstream failed', status: upstream.status }), {
      status: 502,
      headers: { 'content-type': 'application/json' },
    });
  }

  const data = await upstream.json() as any;

  const payload = {
    resolved_location: {
      latitude: lat, longitude: lon, source,
      city: cf.city ?? null, region: cf.region ?? null, country: cf.country ?? null,
    },
    current: data.current,
    units: data.current_units,
    generated_at: new Date().toISOString(),
  };

  return new Response(JSON.stringify(payload, null, 2), {
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'public, max-age=180',
    },
  });
};