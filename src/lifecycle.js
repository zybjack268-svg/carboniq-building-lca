const finiteNonnegative = (value) => value !== "" && value !== null && value !== undefined && Number.isFinite(Number(value)) && Number(value) >= 0;
const finitePositive = (value) => finiteNonnegative(value) && Number(value) > 0;

function normalizeEnergyUnit(value) {
  const unit = String(value ?? "").trim().toLowerCase().replace(/[\s()（）]/g, "").replace(/³/g, "3").replace(/kw[·.]?h/g, "kwh");
  return ({ "千瓦时": "kwh", "度": "kwh", "千克": "kg", "公斤": "kg", "吨": "t", "升": "l", "立方米": "m3", "吉焦": "gj" })[unit] || unit;
}

export function siteUnitCompatible(unit, factorUnit) {
  const denominator = String(factorUnit ?? "").split(/[\/／]|每/).at(-1);
  return denominator !== factorUnit && normalizeEnergyUnit(unit) !== ""
    && normalizeEnergyUnit(unit) === normalizeEnergyUnit(denominator);
}

export function calculateTransport(routes) {
  const complete = routes.filter((route) =>
    [route.material, route.origin, route.destination, route.source].every((value) => String(value ?? "").trim())
    && finitePositive(route.mass) && finitePositive(route.distance) && finitePositive(route.factor));
  const incomplete = routes.length - complete.length;
  const rows = complete.map((route) => ({
    ...route,
    tonneKilometres: Number(route.mass) * Number(route.distance),
    kg: Number(route.mass) * Number(route.distance) * Number(route.factor),
  }));
  return { rows, incomplete, kg: rows.reduce((sum, row) => sum + row.kg, 0), hasData: rows.length > 0 };
}

export function calculateOperation({ annualElectricity, electricityFactor, annualGas, gasFactor, annualHeat, heatFactor, years }) {
  const electricityReady = finiteNonnegative(annualElectricity) && finitePositive(electricityFactor);
  const gasProvided = annualGas !== "" && annualGas !== null && annualGas !== undefined;
  const gasReady = gasProvided && finiteNonnegative(annualGas) && finitePositive(gasFactor);
  const electricityKg = electricityReady ? Number(annualElectricity) * Number(electricityFactor) : null;
  const gasKg = gasReady ? Number(annualGas) * Number(gasFactor) : null;
  // 外购市政热力为可选第三种能源；有量无因子时不当作零排放。
  const heatProvided = annualHeat !== "" && annualHeat !== null && annualHeat !== undefined;
  const heatReady = heatProvided && finiteNonnegative(annualHeat) && finitePositive(heatFactor);
  const heatKg = heatReady ? Number(annualHeat) * Number(heatFactor) : null;
  const annualKg = electricityKg === null && gasKg === null && heatKg === null ? null : (electricityKg ?? 0) + (gasKg ?? 0) + (heatKg ?? 0);
  const horizon = finitePositive(years) ? Number(years) : null;
  return {
    electricityKg,
    gasKg,
    heatKg,
    annualKg,
    years: horizon,
    horizonKg: annualKg !== null && horizon !== null ? annualKg * horizon : null,
    gasIncomplete: gasProvided && !gasReady,
    heatIncomplete: heatProvided && !heatReady,
  };
}

export function calculateSite(siteRows) {
  const rows = siteRows.filter((row) =>
    [row.activity, row.energy, row.unit, row.factorUnit, row.source].every((value) => String(value ?? "").trim())
    && finitePositive(row.quantity) && finitePositive(row.factor)
    && siteUnitCompatible(row.unit, row.factorUnit))
    .map((row) => ({ ...row, kg: Number(row.quantity) * Number(row.factor) }));
  return { rows, incomplete: siteRows.length - rows.length, kg: rows.reduce((sum, row) => sum + row.kg, 0), hasData: rows.length > 0 };
}
