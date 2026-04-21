// functions/api/string-size.ts
// POST /api/string-size  →  NEC-compliant string sizing suggestions
//
// Input: panel specs, inverter MPPT window, design temperatures
// Output: min/max series count per string, series parallel combinations,
//         flags for likely code issues

interface Env {}

interface StringSizeRequest {
  panel_voc: number;            // open-circuit voltage, STC (V)
  panel_vmp: number;            // max power voltage, STC (V)
  panel_isc: number;            // short-circuit current, STC (A)
  panel_voc_tc: number;         // Voc temp coefficient (%/°C, typically negative)
  panel_count: number;          // total modules in array
  inverter_mppt_min: number;    // inverter MPPT low voltage (V)
  inverter_mppt_max: number;    // inverter MPPT high voltage (V)
  inverter_max_voltage: number; // absolute max DC input (V)
  inverter_max_current: number; // max DC input current per MPPT (A)
  design_temp_min: number;      // record low ambient (°C) — ASHRAE 2% or similar
  design_temp_max: number;      // record high ambient (°C)
}

interface StringSizeResult {
  max_series: number;
  min_series: number;
  recommended_series: number;
  voc_cold: number;            // adjusted Voc at cold
  vmp_hot: number;             // adjusted Vmp at hot
  combinations: Array<{
    series: number;
    parallel: number;
    total_modules: number;
    string_current: number;
    voc_cold_string: number;
    fits_inverter: boolean;
  }>;
  warnings: string[];
  notes: string[];
}

// NEC temperature coefficient application — cold temp raises Voc
function vocAtTemp(voc_stc: number, coeff_pct_per_c: number, temp_c: number): number {
  const delta = temp_c - 25;              // STC is 25°C
  return voc_stc * (1 + (coeff_pct_per_c / 100) * delta);
}

function vmpAtTemp(vmp_stc: number, coeff_pct_per_c: number, temp_c: number): number {
  // approximation — Vmp coefficient is usually similar to Voc's but slightly more negative.
  // For simplicity, use Voc coefficient. Real designs should use actual Vmp coefficient.
  const delta = temp_c - 25;
  return vmp_stc * (1 + (coeff_pct_per_c / 100) * delta);
}

export const onRequestPost: PagesFunction<Env> = async ({ request }) => {
  let input: StringSizeRequest;
  try {
    input = await request.json();
  } catch {
    return Response.json({ error: "invalid json" }, { status: 400 });
  }

  // basic validation
  const required = [
    "panel_voc", "panel_vmp", "panel_isc", "panel_voc_tc", "panel_count",
    "inverter_mppt_min", "inverter_mppt_max", "inverter_max_voltage", "inverter_max_current",
    "design_temp_min", "design_temp_max",
  ] as const;
  for (const k of required) {
    if (typeof input[k] !== "number" || !Number.isFinite(input[k])) {
      return Response.json({ error: `${k} must be a number` }, { status: 400 });
    }
  }

  const warnings: string[] = [];
  const notes: string[] = [];

  // Cold-adjusted Voc — this is what NEC 690.7 cares about
  const voc_cold = vocAtTemp(input.panel_voc, input.panel_voc_tc, input.design_temp_min);
  // Hot-adjusted Vmp — this is what the inverter's low-end MPPT cares about
  const vmp_hot  = vmpAtTemp(input.panel_vmp, input.panel_voc_tc, input.design_temp_max);

  // Max modules in series — limited by inverter max DC voltage
  const max_series = Math.floor(input.inverter_max_voltage / voc_cold);
  // Min modules in series — need Vmp at hottest day to exceed MPPT min
  const min_series = Math.ceil(input.inverter_mppt_min / vmp_hot);

  if (max_series < min_series) {
    warnings.push(
      `Max series (${max_series}) is less than min series (${min_series}). ` +
      `The panel/inverter combination is incompatible with this climate.`
    );
  }

  // Recommended: aim for upper third of MPPT window at hot day for efficiency,
  // without exceeding cold-Voc ceiling.
  const target_vmp = input.inverter_mppt_min + (input.inverter_mppt_max - input.inverter_mppt_min) * 0.7;
  const recommended_series = Math.max(
    min_series,
    Math.min(max_series, Math.round(target_vmp / vmp_hot))
  );

  // Find all valid series/parallel combinations that fit panel_count
  const combinations: StringSizeResult["combinations"] = [];
  for (let series = min_series; series <= max_series; series++) {
    for (let parallel = 1; parallel * series <= input.panel_count; parallel++) {
      if (parallel * series === input.panel_count || parallel * series <= input.panel_count) {
        const total = series * parallel;
        const string_current = parallel * input.panel_isc * 1.25; // NEC 690.8 — 125% for continuous + irradiance
        const voc_cold_string = series * voc_cold;
        const fits = string_current <= input.inverter_max_current &&
                     voc_cold_string <= input.inverter_max_voltage;
        if (total === input.panel_count || (total >= input.panel_count * 0.9 && total <= input.panel_count)) {
          combinations.push({
            series,
            parallel,
            total_modules: total,
            string_current: Math.round(string_current * 100) / 100,
            voc_cold_string: Math.round(voc_cold_string * 100) / 100,
            fits_inverter: fits,
          });
        }
      }
    }
  }

  // sort: exact matches first, then by efficiency (higher series = better)
  combinations.sort((a, b) => {
    const a_exact = a.total_modules === input.panel_count ? 0 : 1;
    const b_exact = b.total_modules === input.panel_count ? 0 : 1;
    if (a_exact !== b_exact) return a_exact - b_exact;
    return b.series - a.series;
  });

  // warnings
  if (voc_cold > input.inverter_max_voltage * 0.95) {
    warnings.push(`Voc at cold is within 5% of inverter max. Verify local extreme low ambient.`);
  }
  if (combinations.filter(c => c.fits_inverter).length === 0) {
    warnings.push(`No combinations fit within inverter current limits. Consider multiple MPPTs or a larger inverter.`);
  }

  notes.push(`Voc calculated at ${input.design_temp_min}°C: ${voc_cold.toFixed(2)}V per module.`);
  notes.push(`Vmp calculated at ${input.design_temp_max}°C: ${vmp_hot.toFixed(2)}V per module.`);
  notes.push(`String current includes NEC 690.8(A)(1) 125% continuous current factor.`);
  notes.push(`This tool is a starting point, not a stamped engineering document. Verify locally before permit.`);

  const result: StringSizeResult = {
    max_series,
    min_series,
    recommended_series,
    voc_cold: Math.round(voc_cold * 100) / 100,
    vmp_hot: Math.round(vmp_hot * 100) / 100,
    combinations: combinations.slice(0, 8),
    warnings,
    notes,
  };

  return Response.json(result);
};
