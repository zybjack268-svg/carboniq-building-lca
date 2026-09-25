const finiteNonnegative = (value) => value !== "" && value !== null && value !== undefined && Number.isFinite(Number(value)) && Number(value) >= 0;
const finitePositive = (value) => finiteNonnegative(value) && Number(value) > 0;

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

export function calculateOperation({ annualElectricity, electricityFactor, annualGas, gasFactor, years }) {
  const electricityReady = finiteNonnegative(annualElectricity) && finitePositive(electricityFactor);
  const gasProvided = annualGas !== "" && annualGas !== null && annualGas !== undefined;
  const gasReady = gasProvided && finiteNonnegative(annualGas) && finitePositive(gasFactor);
  const electricityKg = electricityReady ? Number(annualElectricity) * Number(electricityFactor) : null;
  const gasKg = gasReady ? Number(annualGas) * Number(gasFactor) : null;
  const annualKg = electricityKg === null && gasKg === null ? null : (electricityKg ?? 0) + (gasKg ?? 0);
  const horizon = finitePositive(years) ? Number(years) : null;
  return {
    electricityKg,
    gasKg,
    annualKg,
    years: horizon,
    horizonKg: annualKg !== null && horizon !== null ? annualKg * horizon : null,
    gasIncomplete: gasProvided && !gasReady,
  };
}

export function calculateSite(siteRows) {
  const rows = siteRows.filter((row) =>
    [row.activity, row.energy, row.unit, row.factorUnit, row.source].every((value) => String(value ?? "").trim())
    && finitePositive(row.quantity) && finitePositive(row.factor))
    .map((row) => ({ ...row, kg: Number(row.quantity) * Number(row.factor) }));
  return { rows, incomplete: siteRows.length - rows.length, kg: rows.reduce((sum, row) => sum + row.kg, 0), hasData: rows.length > 0 };
}
