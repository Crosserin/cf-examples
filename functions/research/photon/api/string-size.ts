// functions/research/photon/api/string-size.ts
// POST /research/photon/api/string-size
// NEC-compliant PV string sizing calculator.

interface Env {}

interface Input {
  panel_voc: number; panel_vmp: number; panel_isc: number;
  panel_voc_tc: number; panel_count: number;
  inverter_mppt_min: number; inverter_mppt_max: number;
  inverter_max_voltage: number; inverter_max_current: number;
  design_temp_min: number; design_temp_max: number;
}

const atTemp = (v: number, tc: number, t: number) => v * (1 + (tc / 100) * (t - 25));

export const onRequestPost: PagesFunction<Env> = async ({ request }) => {
  let input: Input;
  try { input = await request.json(); } catch { return Response.json({ error: "invalid json" }, { status: 400 }); }

  const required = ["panel_voc","panel_vmp","panel_isc","panel_voc_tc","panel_count",
    "inverter_mppt_min","inverter_mppt_max","inverter_max_voltage","inverter_max_current",
    "design_temp_min","design_temp_max"] as const;
  for (const k of required) {
    if (typeof input[k] !== "number" || !Number.isFinite(input[k])) {
      return Response.json({ error: `${k} must be a number` }, { status: 400 });
    }
  }

  const warnings: string[] = [];
  const notes: string[] = [];
  const voc_cold = atTemp(input.panel_voc, input.panel_voc_tc, input.design_temp_min);
  const vmp_hot  = atTemp(input.panel_vmp, input.panel_voc_tc, input.design_temp_max);
  const max_series = Math.floor(input.inverter_max_voltage / voc_cold);
  const min_series = Math.ceil(input.inverter_mppt_min / vmp_hot);

  if (max_series < min_series) {
    warnings.push(`Max series (${max_series}) is less than min series (${min_series}). Incompatible panel/inverter for this climate.`);
  }

  const target = input.inverter_mppt_min + (input.inverter_mppt_max - input.inverter_mppt_min) * 0.7;
  const recommended_series = Math.max(min_series, Math.min(max_series, Math.round(target / vmp_hot)));

  const combinations: any[] = [];
  for (let s = Math.max(1, min_series); s <= max_series; s++) {
    for (let p = 1; p * s <= input.panel_count; p++) {
      const total = s * p;
      const ampacity = p * input.panel_isc * 1.25;
      const voc_string = s * voc_cold;
      const fits = ampacity <= input.inverter_max_current && voc_string <= input.inverter_max_voltage;
      if (total === input.panel_count || (total >= input.panel_count * 0.9 && total <= input.panel_count)) {
        combinations.push({
          series: s, parallel: p, total_modules: total,
          string_current: Math.round(ampacity * 100) / 100,
          voc_cold_string: Math.round(voc_string * 100) / 100,
          fits_inverter: fits,
        });
      }
    }
  }
  combinations.sort((a, b) => {
    const ea = a.total_modules === input.panel_count ? 0 : 1;
    const eb = b.total_modules === input.panel_count ? 0 : 1;
    return ea !== eb ? ea - eb : b.series - a.series;
  });

  if (voc_cold > input.inverter_max_voltage * 0.95) {
    warnings.push("Voc at cold is within 5% of inverter max. Verify local extreme low ambient.");
  }
  if (combinations.filter(c => c.fits_inverter).length === 0) {
    warnings.push("No combinations fit within inverter current limits. Consider multiple MPPTs or a larger inverter.");
  }

  notes.push(`Voc at ${input.design_temp_min}°C: ${voc_cold.toFixed(2)}V per module.`);
  notes.push(`Vmp at ${input.design_temp_max}°C: ${vmp_hot.toFixed(2)}V per module.`);
  notes.push("String current includes NEC 690.8(A)(1) 125% continuous-current factor.");
  notes.push("Design-assist only. Permit-ready work requires a licensed PE and AHJ review.");

  return Response.json({
    max_series, min_series, recommended_series,
    voc_cold: Math.round(voc_cold * 100) / 100,
    vmp_hot: Math.round(vmp_hot * 100) / 100,
    combinations: combinations.slice(0, 8),
    warnings, notes,
  });
};
