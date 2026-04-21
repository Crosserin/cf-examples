// functions/api/status.ts
// GET /api/status  →  returns current homelab status from KV
//
// The actual probing happens in a scheduled Worker (see example 28) that
// writes results to KV under `homelab:status`. This endpoint is a read-through.

interface Env {
  KV: KVNamespace;
}

interface ServiceStatus {
  id: string;
  name: string;
  category: "compute" | "storage" | "network" | "services";
  status: "ok" | "warn" | "fail" | "unknown";
  latency_ms: number | null;
  last_check: number;
  note?: string;
}

interface HomelabStatus {
  updated_at: number;
  services: ServiceStatus[];
}

// ——— fallback data for when KV is empty (e.g., first deploy, local dev) ———
const FALLBACK: HomelabStatus = {
  updated_at: Math.floor(Date.now() / 1000) - 60,
  services: [
    // compute
    { id: "proxmox",    name: "Proxmox · T340",       category: "compute",  status: "ok",   latency_ms: 3,   last_check: 0, note: "Xeon E-2146G · 32GB" },
    { id: "ct109",      name: "CT109 · Jellyfin",     category: "compute",  status: "ok",   latency_ms: 12,  last_check: 0 },
    { id: "ct110",      name: "CT110 · media-stack",  category: "compute",  status: "ok",   latency_ms: 18,  last_check: 0 },
    { id: "ct100",      name: "CT100 · Pi-hole",      category: "compute",  status: "warn", latency_ms: null, last_check: 0, note: "Disabled for maintenance" },
    // storage
    { id: "sierra",     name: "Synology · SIERRA",    category: "storage",  status: "ok",   latency_ms: 5,   last_check: 0, note: "10.0.0.187" },
    { id: "external",   name: "External media · sdd1", category: "storage", status: "ok",   latency_ms: 2,   last_check: 0, note: "931GB · ~42% used" },
    { id: "bravo",      name: "BRAVO · cold backup",  category: "storage",  status: "unknown", latency_ms: null, last_check: 0, note: "Offline by design" },
    // network
    { id: "router",     name: "Edge router",          category: "network",  status: "ok",   latency_ms: 1,   last_check: 0 },
    { id: "tailscale",  name: "Tailscale mesh",       category: "network",  status: "ok",   latency_ms: 8,   last_check: 0 },
    // services
    { id: "jellyfin",   name: "Jellyfin",             category: "services", status: "ok",   latency_ms: 45,  last_check: 0 },
    { id: "prowlarr",   name: "Prowlarr",             category: "services", status: "ok",   latency_ms: 28,  last_check: 0 },
    { id: "readarr",    name: "Readarr",              category: "services", status: "ok",   latency_ms: 34,  last_check: 0 },
    { id: "calibre",    name: "Calibre-Web",          category: "services", status: "ok",   latency_ms: 22,  last_check: 0 },
  ],
};

export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  let status: HomelabStatus;

  try {
    const stored = await env.KV.get("homelab:status", "json");
    status = (stored as HomelabStatus) ?? FALLBACK;
  } catch {
    status = FALLBACK;
  }

  // fill in last_check for fallback
  const now = Math.floor(Date.now() / 1000);
  status.services = status.services.map((s) => ({
    ...s,
    last_check: s.last_check || now - 60,
  }));

  return Response.json(status, {
    headers: {
      "cache-control": "public, max-age=10",
      "content-type": "application/json",
    },
  });
};
