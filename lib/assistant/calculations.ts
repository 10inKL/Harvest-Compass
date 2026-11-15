export function expectedProduction(acres: number, yieldBuPerAcre: number) {
  if (!Number.isFinite(acres) || acres <= 0 || !Number.isFinite(yieldBuPerAcre) || yieldBuPerAcre <= 0) throw new Error("Positive acreage and yield assumption required.");
  return Math.round(acres * yieldBuPerAcre);
}

export function equipmentScenario(acres: number, rateAcresPerHour: number, delayHours: number, costPerHour: number) {
  if (![acres, rateAcresPerHour, delayHours, costPerHour].every(Number.isFinite) || acres <= 0 || rateAcresPerHour <= 0 || delayHours < 0 || costPerHour < 0) throw new Error("Invalid scenario assumptions.");
  const baseHarvestHours = +(acres / rateAcresPerHour).toFixed(1);
  return { baseHarvestHours, delayedCompletionHours: +(acres / rateAcresPerHour + delayHours).toFixed(1), delayCostEstimate: +(delayHours * costPerHour).toFixed(2) };
}
