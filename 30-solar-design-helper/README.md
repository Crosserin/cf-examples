# 30-solar-design-helper

> NEC-compliant string sizing for PV arrays. From actual consulting work.

## What it does

Calculates series/parallel string configurations for a photovoltaic array, respecting:

- **NEC 690.7** — cold-adjusted Voc must not exceed inverter max DC voltage
- **NEC 690.8(A)(1)** — continuous current × 1.25 factor
- **Inverter MPPT window** — hot-adjusted Vmp must stay above MPPT low
- **Physical module count** — valid partitions of the array

Inputs: module spec-sheet values (Voc, Vmp, Isc, temp coefficient, count), inverter DC limits, and ASHRAE-style design temperatures. Outputs: recommended series count, all valid series/parallel combinations, cold-Voc and hot-Vmp per module, and warnings for likely code issues.

This is the prototype of the math layer for a bigger project I've been scoping: a CSV-in/DWG-out pipeline that generates NEC-compliant AutoCAD drawings from inspection data. The math has to be right before the drawing generation is worth building.

## Cloudflare features used

- [x] Pages (static hosting)
- [x] Pages Functions (`/api/string-size`)

Could easily grow to use D1 (save projects), R2 (store generated DWGs), and Workers AI (ingest spec sheet PDFs, extract panel specs). Intentionally kept focused for the example.

## Files

```
30-solar-design-helper/
├── README.md
├── index.html                      ← form + results UI
└── functions/
    └── api/
        └── string-size.ts          ← POST /api/string-size
```

## Running locally

```bash
wrangler pages dev .
```

No secrets, no external services. The default form values are for a typical 400W residential module (LG NeON 2 or similar) and a SolarEdge-class single-phase inverter; submit as-is to see results.

## The math

- **Voc at cold temperature** — `Voc_STC × (1 + tc × (T_min − 25))`. TC is negative for crystalline silicon, so cold pushes voltage up, which is the ceiling you bump against.
- **Vmp at hot temperature** — same formula, different direction; hot drops voltage, and the MPPT low end is the floor.
- **String current** — `parallel × Isc × 1.25`. The 1.25 multiplier is NEC 690.8(A)(1) for continuous current under 125% irradiance conditions.
- **Max series** — `floor(inverter_max_V / Voc_cold_per_module)`. Never exceed.
- **Min series** — `ceil(MPPT_min / Vmp_hot_per_module)`. Below this, the inverter won't track on the hottest day.

## Gotchas

- **The Vmp temp coefficient is different from Voc's** in real datasheets, usually slightly more negative. This tool uses Voc's TC for both as an approximation — fine for a feasibility check, not fine for permit-ready math.
- **Design temperatures are climate-dependent.** ASHRAE 2% design temps are a reasonable default; some jurisdictions require extreme-minimum from NREL or the local code. Always pull from the actual site.
- **Module tolerance.** Real production lets modules vary ±3% from nameplate. Design to the worse end if you're near a limit.
- **This doesn't size the DC disconnect, the combiner, the OCPD, or the EGC** — those are the other half of NEC Article 690.
- **AHJ quirks.** Some jurisdictions require assumptions more conservative than NEC minimum. Tool outputs are a starting point, not a deliverable.

## What I'd do differently at scale

- **Panel library in D1.** Pre-load common modules (REC, Qcells, Canadian Solar, LG, Silfab, etc.) so the user picks "REC Alpha Pure 400W" and the specs autofill. Same for inverters.
- **Spec-sheet ingest via Workers AI.** Upload a manufacturer PDF, vision model extracts the values, writes them to D1. Ties back to example 27 (workers-ai-image-tag).
- **Project save/load.** Keyed by a client-generated UUID in D1, each project contains the inputs and the accepted combination.
- **DWG generation.** This is the real prize. Given an accepted string configuration plus roof data (azimuth, pitch, dimensions, fire setbacks), generate a one-line diagram and a layout plan as a `.dwg` via a Python orchestrator → MCP → AutoCAD pipeline. R2 stores the output, a signed URL delivers it.
- **Wire sizing.** NEC 310.15(B) table lookups for conductor ampacity, voltage drop calculation across the DC run. Extends naturally from the current output of the string sizer.
- **Reverse design.** Given a target system size in kW and a roof area, suggest module/inverter combinations that hit the target within NEC limits. "You have 420 sq ft south-facing, aim for 8kW, here are three options."
