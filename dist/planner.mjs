export function validateInputs(input) {
  const limits = { onHand: [0, 1e5], onOrder: [0, 1e5], backorders: [0, 1e5], lead: [1, 14], review: [1, 7], buffer: [0, 7], stress: [50, 150] };
  const errors = [];
  for (const [key, [min, max]] of Object.entries(limits)) if (!Number.isFinite(input[key]) || !Number.isInteger(input[key]) || input[key] < min || input[key] > max) errors.push(`${key} must be a whole number from ${min} to ${max}.`);
  return errors;
}
export function plan(baseForecast, input, includeOrder = true) {
  const errors = validateInputs(input);
  if (errors.length) throw new RangeError(errors.join(" "));
  if (baseForecast.length < 28 || baseForecast.some((v) => !Number.isFinite(v) || v < 0)) throw new RangeError("A finite nonnegative 28-day forecast is required.");
  const demand = baseForecast.slice(0, 28).map((x) => x * input.stress / 100);
  const protection = input.lead + input.review + input.buffer;
  const target = Math.ceil(demand.slice(0, protection).reduce((a, b) => a + b, 0));
  const position = input.onHand + input.onOrder - input.backorders;
  const order = Math.max(0, target - position);
  let balance = input.onHand - input.backorders;
  const rows = demand.map((units, i) => {
    const arrival = i + 1 === input.lead ? input.onOrder + (includeOrder ? order : 0) : 0;
    balance += arrival - units;
    return { day: i + 1, demand: units, arrival, balance };
  });
  return {
    target,
    position,
    order,
    protection,
    rows,
    firstShortage: rows.find((r) => r.balance < -1e-6)?.day ?? null,
    beforeArrival: rows.some((r) => r.day < input.lead && r.balance < -1e-6),
    endBalance: balance,
    shortageDays: rows.filter((r) => r.balance < -1e-6).length,
    totalDemand: demand.reduce((a, b) => a + b, 0)
  };
}
export function csv(rows) {
  return rows.map((r) => r.map((v) => '"' + String(v ?? "").replaceAll('"', '""') + '"').join(",")).join("\r\n") + "\r\n";
}
