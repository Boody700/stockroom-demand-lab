import { plan, csv, validateInputs } from "./planner.mjs";
const $ = (id) => document.getElementById(id), sum = (a) => a.reduce((x, y) => x + y, 0), num = (n, d = 0) => new Intl.NumberFormat("en-US", { maximumFractionDigits: d }).format(n), pct = (n) => n === null ? "—" : num(n * 100, 1) + "%", esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
let data;
const state = { page: "forecast", sku: "FOODS_3_090", range: 84, period: "future", comparison: "none", includeOrder: true, category: "ALL", input: null, draft: null, dirty: false };
const current = () => data.series.find((s) => s.id === state.sku), r = () => data.report;
const date = (d) => (/* @__PURE__ */ new Date(d + "T00:00:00Z")).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
const intro = (kicker, title, copy, stamp) => `<section class="intro"><div><div class="eyebrow">${kicker}</div><h1>${title}</h1></div><div class="intro-copy"><strong>${stamp}</strong>${copy}</div></section>`;
function options(selected = state.sku) {
  return data.series.map((s) => `<option value="${s.id}" ${s.id === selected ? "selected" : ""}>${s.id.replaceAll("_", " ")} / CA 1</option>`).join("");
}
function download(name, text, type = "text/csv") {
  const a = document.createElement("a"), url = URL.createObjectURL(new Blob([text], { type }));
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1e3);
  $("status").textContent = "Export prepared: " + name;
}
function stats(items) {
  return `<div class="stats-strip">${items.map(([label, value, note]) => `<div class="strip-item"><span class="label">${label}</span><strong>${value}</strong><small>${note}</small></div>`).join("")}</div>`;
}
function baseline(s, name, origin) {
  const h = s.history.slice(0, origin);
  for (let i = 0; i < 28; i++) h.push(name === "mean" ? sum(h.slice(origin - 28, origin)) / 28 : h[h.length - (name === "weekly" ? 7 : 28)]);
  return h.slice(origin);
}
function lineChart(args) {
  return `<div class="chart-wide">${chartSVG(args, 800)}</div><div class="chart-small">${chartSVG(args, 500)}</div>`;
}
function chartSVG({ actual, pred, lower, upper, comparison, dates, split, title, balance = false, arrivals = [] }, w) {
  const h = 320, left = 48, right = 17, top = 30, bottom = 36, plotW = w - left - right, plotH = h - top - bottom, n = dates.length;
  const all = [...actual || [], ...pred || [], ...upper || [], ...comparison || []].filter(Number.isFinite);
  let lo = balance ? Math.min(0, ...all) : 0, hi = Math.max(1, ...all);
  if (balance) {
    const pad = (hi - lo) * 0.08;
    hi += pad;
    lo -= pad;
  } else hi *= 1.1;
  const x = (i) => left + i * plotW / Math.max(1, n - 1), y = (v) => top + (hi - v) / (hi - lo) * plotH;
  const path = (arr) => arr.map((v, i) => Number.isFinite(v) ? `${i === 0 || !Number.isFinite(arr[i - 1]) ? "M" : "L"}${x(i).toFixed(2)},${y(v).toFixed(2)}` : "").join(" ");
  const grid = Array.from({ length: 5 }, (_, i) => {
    const v = lo + (hi - lo) * i / 4;
    return `<path class="grid" d="M${left},${y(v)}H${w - right}"/><text x="${left - 10}" y="${y(v) + 4}" text-anchor="end">${num(v)}</text>`;
  }).join("");
  const tickIndices = [0, Math.floor((n - 1) / 3), Math.floor(2 * (n - 1) / 3), n - 1];
  let band = "";
  if (upper && lower) {
    const ids = upper.map((v, i) => Number.isFinite(v) ? i : null).filter((v) => v !== null);
    if (ids.length) band = `<path class="band" d="M${ids.map((i) => `${x(i)},${y(upper[i])}`).join("L")}L${ids.slice().reverse().map((i) => `${x(i)},${y(lower[i])}`).join("L")}Z"/>`;
  }
  return `<svg class="chart" viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(title)}"><title>${esc(title)}</title><desc>Dates and exact values are available in the data table below the chart. ${balance ? "Negative balance means projected unfilled units carried as backlog." : "The orange line is the selected forecast. The shaded area is a validation-error envelope."}</desc>${grid}${band}${balance ? `<path class="axis" d="M${left},${y(0)}H${w - right}"/>` : ""}${split !== void 0 ? `<path class="split" d="M${x(split)},${top}V${h - bottom}"/><text x="${Math.min(w - 110, x(split) + 7)}" y="18">FORECAST →</text>` : ""}${arrivals.map((i) => `<path stroke="#d2e77a" stroke-dasharray="2 4" d="M${x(i)},${top}V${h - bottom}"/><text x="${Math.min(w - 130, x(i) + 7)}" y="18">ARRIVAL / DAY ${i + 1}</text>`).join("")}${actual ? `<path class="history" d="${path(actual)}"/>` : ""}${pred ? `<path class="prediction" d="${path(pred)}"/>` : ""}${comparison ? `<path class="comparison" d="${path(comparison)}"/>` : ""}${tickIndices.map((i) => `<text x="${x(i)}" y="${h - 10}" text-anchor="${i === 0 ? "start" : i === n - 1 ? "end" : "middle"}">${date(dates[i])}</text>`).join("")}</svg>`;
}
function forecastChart() {
  const s = current(), origin = state.period === "future" ? 1941 : 1913, start = origin - state.range, ds = data.dates.slice(start, origin + 28), padding = Array(state.range).fill(null), pred = [...padding, ...state.period === "future" ? s.forecast : data.predictions[r().selected].test[data.series.indexOf(s)]];
  const actual = state.period === "future" ? [...s.history.slice(start, origin), ...Array(28).fill(null)] : s.history.slice(start, origin + 28), lower = pred.map((v) => v === null ? null : Math.max(0, v - s.bandRadius)), upper = pred.map((v) => v === null ? null : v + s.bandRadius);
  const comparison = state.comparison === "none" ? null : [...padding, ...baseline(s, state.comparison, origin)];
  return lineChart({ actual, pred, lower, upper, comparison, dates: ds, split: state.range - 1, title: `${s.id}: daily units and 28-day ${state.period === "future" ? "planning" : "holdout"} forecast` });
}
function forecastTable() {
  const s = current(), isFuture = state.period === "future", origin = isFuture ? 1941 : 1913, pred = isFuture ? s.forecast : data.predictions[r().selected].test[data.series.indexOf(s)];
  return `<details><summary>Inspect the 28 daily values / accessible data table</summary><div class="table-wrap small-table"><table><caption class="sr-only">Daily ${isFuture ? "planning" : "held-out test"} predictions for ${s.id}</caption><thead><tr><th>DATE</th><th class="num">ACTUAL</th><th class="num">FORECAST</th><th class="num">LOWER ENVELOPE</th><th class="num">UPPER ENVELOPE</th>${state.comparison !== "none" ? `<th class="num">${esc(r().names[state.comparison]).toUpperCase()}</th>` : ""}</tr></thead><tbody>${pred.map((v, i) => `<tr><td>${data.dates[origin + i]}</td><td class="num">${isFuture ? "—" : num(s.history[origin + i])}</td><td class="num">${num(v, 2)}</td><td class="num">${num(Math.max(0, v - s.bandRadius), 2)}</td><td class="num">${num(v + s.bandRadius, 2)}</td>${state.comparison !== "none" ? `<td class="num">${num(baseline(s,state.comparison,origin)[i],2)}</td>` : ""}</tr>`).join("")}</tbody></table></div></details>`;
}
function forecast() {
  const s = current(), test = r().models[r().selected].test, summary = state.period === "test" ? data.predictions[r().selected].test[data.series.indexOf(s)] : s.forecast, total = sum(summary);
  return `${intro("OPERATIONS STUDY / DAILY SALES FORECASTING", "PLAN THE<br><span>NEXT 28.</span>", "Turn noisy daily sales into a practical stock conversation. Compare the signal, inspect the errors, then test a replenishment decision.", "PLANNING SNAPSHOT / 22 MAY 2016")}<div class="command-row"><div class="context"><strong>CA_1</strong> / 12 fixed series / 3 categories / ${r().names[r().selected]}</div><button id="export-forecast" class="small-btn">Export forecast ↗</button></div><div class="work-grid"><section class="chart-panel"><div class="chart-heading"><div><h2>Read the rhythm.</h2><p id="chart-period">${state.period === "future" ? "Planning horizon / 23 May – 19 Jun 2016" : "Held-out test / 25 Apr – 22 May 2016"}</p></div><span class="pill">DAILY UNITS / 28D</span></div><div class="chart-options"><label>VIEW <select id="period"><option value="future" ${state.period === "future" ? "selected" : ""}>Planning forecast</option><option value="test" ${state.period === "test" ? "selected" : ""}>Holdout vs actuals</option></select></label><label>HISTORY <select id="range">${[56, 84, 168].map((n) => `<option value="${n}" ${state.range === n ? "selected" : ""}>${n} days</option>`).join("")}</select></label><label>COMPARE <select id="comparison"><option value="none">None</option>${["weekly", "monthly", "mean"].map((k) => `<option value="${k}" ${state.comparison === k ? "selected" : ""}>${r().names[k]}</option>`).join("")}</select></label></div>${forecastChart()}<div class="legend"><span>Observed sales</span><span class="forecast-key">${r().names[r().selected]}</span><span class="band-key">90th-percentile error envelope</span>${state.comparison !== "none" ? `<span class="compare-key">${r().names[state.comparison]}</span>` : ""}</div><div class="chart-foot">Historical study, not a live forecast. Envelope uses 56 validation errors per series; future coverage is not guaranteed. Sales may be constrained by unobserved stockouts.</div></section><aside class="scope-panel"><label><span class="label">SELECT PRODUCT / STORE CA_1</span><select id="sku" aria-label="Selected product">${options()}</select></label><p>Anonymous M5 product identifier.<br>No product names or stock levels are supplied in the data.</p><div class="receipt"><span class="label">${state.period === "test" ? "HOLDOUT / PREDICTED TOTAL" : "NEXT 28 DAYS / POINT FORECAST"}</span><div class="receipt-total">${num(total)}<small>units</small></div><dl><div><dt>Daily average</dt><dd>${num(total / 28, 1)}</dd></div><div><dt>Last 28d / actual</dt><dd>${num(sum(s.history.slice(-28)))}</dd></div><div><dt>Zero-sales days*</dt><dd>${pct(s.zeroShare)}</dd></div><div><dt>Product test WAPE</dt><dd>${pct(s.test.wape)}</dd></div><div><dt>Category</dt><dd>${s.category}</dd></div></dl><div class="barcode" aria-hidden="true"></div></div></aside></div>${stats([["FINAL TEST / WAPE", pct(test.wape), "all 12 series"], ["FINAL TEST / RMSSE", num(test.rmsse, 3), "macro average"], ["ERROR ENVELOPE / COVERAGE", pct(r().coverage), "336 held-out daily values"]])}${forecastTable()}<section style="margin-top:30px"><div class="section-title"><h2>The stock list.</h2><label class="context">CATEGORY <select id="category" aria-label="Filter category"><option value="ALL">All categories</option>${["FOODS", "HOUSEHOLD", "HOBBIES"].map((k) => `<option ${state.category === k ? "selected" : ""}>${k}</option>`).join("")}</select></label></div><div class="table-wrap"><table><caption class="sr-only">Twelve fixed M5 product series, forecast totals and held-out test errors</caption><thead><tr><th>PRODUCT / CA_1</th><th>CATEGORY</th><th>LAST 14 DAYS</th><th class="num">LAST 28D / ACTUAL</th><th class="num">NEXT 28D / FORECAST</th><th class="num">TEST WAPE</th></tr></thead><tbody>${data.series.filter((x) => state.category === "ALL" || x.category === state.category).map((x) => `<tr class="${x.id === state.sku ? "selected" : ""}"><td><button class="sku-button" data-sku="${x.id}">${x.id} ↗</button></td><td><span class="category">${x.category}</span></td><td><span class="microbars" aria-hidden="true">${x.history.slice(-14).map((v) => `<i style="height:${Math.max(1, v / Math.max(1, ...x.history.slice(-14)) * 21)}px"></i>`).join("")}</span></td><td class="num">${num(sum(x.history.slice(-28)))}</td><td class="num">${num(sum(x.forecast))}</td><td class="num">${pct(x.test.wape)}</td></tr>`).join("")}</tbody></table></div><p class="row-note">* Zero-sales share uses the final 365 observed days. IDs were fixed before modelling; this small subset does not represent the full M5 competition.</p><a class="button orange" href="#planner" style="margin-top:20px">Open stock planner →</a></section>`;
}
function defaults() {
  const avg = current().recentMean;
  return { onHand: Math.ceil(avg * 6), onOrder: Math.ceil(avg * 3), backorders: 0, lead: 7, review: 7, buffer: 3, stress: 100 };
}
function fields() {
  return [["onHand", "On hand", "units", 0, 1e5], ["onOrder", "On order", "units", 0, 1e5], ["backorders", "Backlog", "units", 0, 1e5], ["lead", "Lead time", "1–14 days", 1, 14], ["review", "Review cycle", "1–7 days", 1, 7], ["buffer", "Safety buffer", "0–7 days", 0, 7], ["stress", "Demand scenario", "50–150% of selected forecast", 50, 150]].map(([id, label, unit, min, max]) => `<label class="${id === "stress" ? "full-input" : ""}" for="${id}">${label}<input id="${id}" name="${id}" type="number" step="1" min="${min}" max="${max}" value="${esc(state.draft?.[id] ?? state.input[id])}" required><small>${unit}</small></label>`).join("");
}
function inventoryResult() {
  const s = current(), p = plan(s.forecast, state.input, state.includeOrder), without = plan(s.forecast, state.input, false);
  return `<div class="decision"><div class="decision-main"><span class="label">SUGGESTED ORDER / SCENARIO</span><strong>${num(p.order)} <small>units</small></strong><p>Order up to ${p.protection} days of projected sales.<br>Scenario inputs are illustrative, not observed inventory.</p></div><div class="decision-math"><div>Target <strong>${num(p.target)}</strong></div><div>Position <strong>${num(p.position)}</strong></div><div>Order <strong>${num(p.order)}</strong></div></div></div><div class="warning ${p.firstShortage ? "" : "success"}" role="status">${p.beforeArrival ? `<strong>Timing gap:</strong> projected backlog starts before the day-${state.input.lead} delivery. A new standard-lead-time order cannot prevent that early shortage.` : p.firstShortage ? `The ${p.protection}-day target is exceeded later in this 28-day view. First projected negative balance: day ${p.firstShortage}. A later review/order is not simulated.` : "No negative end-of-day balance within this scenario. This is a forecast-based projection, not a service-level guarantee."}</div><section class="chart-panel"><div class="chart-heading"><div><h2>Follow the stock.</h2><p>End-of-day net units / backlog carried forward</p></div><span class="pill">28-DAY SCENARIO</span></div>${lineChart({ actual: without.rows.map((x) => x.balance), pred: p.rows.map((x) => x.balance), dates: data.dates.slice(1941), balance: true, arrivals: [state.input.lead - 1], title: `${s.id}: projected inventory balance with ${state.includeOrder ? "suggested order" : "existing pipeline only"}` })}<div class="legend"><span>Existing pipeline only</span><span class="forecast-key">${state.includeOrder ? "With suggested order" : "Suggested order excluded"}</span></div><label class="check-control"><input id="include-order" type="checkbox" ${state.includeOrder ? "checked" : ""}> Include suggested order at the same lead time</label><div class="stock-legend"><span>First negative balance: <strong>${p.firstShortage ? "day " + p.firstShortage : "none"}</strong></span><span>Day 28 balance: <strong>${num(p.endBalance, 1)} units</strong></span></div></section><details><summary>Inspect daily inventory movements / data table</summary><div class="table-wrap small-table"><table><caption class="sr-only">Scenario demand, arrivals and net inventory per day</caption><thead><tr><th>DATE</th><th class="num">FORECAST SALES</th><th class="num">ARRIVALS</th><th class="num">NET BALANCE</th></tr></thead><tbody>${p.rows.map((x, i) => `<tr><td>${data.dates[1941 + i]}</td><td class="num">${num(x.demand, 2)}</td><td class="num">${num(x.arrival)}</td><td class="num">${num(x.balance, 2)}</td></tr>`).join("")}</tbody></table></div></details><div class="command-row" style="margin-top:20px"><p class="footnote">Both existing and suggested orders arrive at the start of the lead-time day. No subsequent replenishment is simulated.</p><button class="small-btn" id="export-plan">Export plan ↗</button></div>`;
}
function planner() {
  state.input ??= defaults();
  return `${intro("DECISION LAB / REPLENISHMENT SCENARIOS", "MAKE ROOM.<br><span>STAY STOCKED.</span>", "Adjust inventory, delivery timing and a simple safety buffer. See the order calculation and every projected movement.", "ILLUSTRATIVE INPUTS / REAL SALES FORECAST")}<div class="stock-layout"><section class="control-deck"><h2>Set the conditions.</h2><p>These starting quantities are generated examples. Replace them to explore a scenario.</p><form id="planner-form"><label for="plan-sku" class="label">PRODUCT / CA_1</label><select id="plan-sku">${options()}</select><div class="input-grid">${fields()}</div><div id="form-error" role="alert"></div><p id="draft-note" class="draft-note" role="status"></p><button class="button dark" type="submit">Calculate order →</button></form><button id="reset-inputs" class="reset">Restore example inputs</button><p class="footnote">Buffer days add forecast volume. They do not imply a 95% service level. Supplier constraints, prices, costs and stock observations are unavailable.</p></section><section id="inventory-result" aria-label="Inventory scenario result">${inventoryResult()}</section></div>`;
}
function benchmark() {
  const models = Object.entries(r().models).sort((a, b) => a[1].validationWape - b[1].validationWape);
  return `${intro("MODEL BENCH / TIME-ORDERED EVALUATION", "EARN THE<br><span>FORECAST.</span>", "A pooled ML model competes with three simple baselines. Validation selects the winner; the final 28 days measure it.", "NO RANDOM SPLIT / NO TEST-BASED SELECTION")}<div class="model-cards">${models.map(([k, m], i) => `<article class="model-card ${k === r().selected ? "winner" : ""}"><div class="rank">0${i + 1} / ${k === r().selected ? "SELECTED ON VALIDATION" : "BASELINE"}</div><h2>${m.label}</h2><strong>${pct(m.validationWape)}</strong><p>ROLLING VALIDATION WAPE<br>2 ORIGINS × 28 DAYS × 12 SERIES</p></article>`).join("")}</div><div class="section-title"><h2>The untouched horizon.</h2><button class="small-btn" id="export-report">Export evaluation ↗</button></div><div class="table-wrap"><table><caption class="sr-only">Final test metrics for all candidates; model choice used validation only</caption><thead><tr><th>MODEL</th><th class="num">VAL WAPE</th><th class="num">TEST WAPE</th><th class="num">TEST MAE</th><th class="num">TEST RMSSE</th><th class="num">TEST BIAS</th></tr></thead><tbody>${models.map(([k, m]) => `<tr class="${k === r().selected ? "selected" : ""}"><td>${m.label}${k === r().selected ? " / selected" : ""}</td><td class="num">${pct(m.validationWape)}</td><td class="num">${pct(m.test.wape)}</td><td class="num">${num(m.test.mae, 2)}</td><td class="num">${num(m.test.rmsse, 3)}</td><td class="num">${pct(m.test.bias)}</td></tr>`).join("")}</tbody></table></div><p class="footnote">Test window: 25 Apr–22 May 2016. WAPE is pooled over 336 daily values. RMSSE is an unweighted mean across 12 series, not the official M5 weighted hierarchical score. Positive bias means overforecasting.</p><div class="timeline"><div><strong>TRAIN / EXPANDING HISTORY</strong>29 Jan 2011 onward<span>Lag features use only earlier values</span></div><div><strong>VALIDATE / 01</strong>29 Feb–27 Mar 2016<span>28-day recursive forecast</span></div><div><strong>VALIDATE / 02</strong>28 Mar–24 Apr 2016<span>Choose model + error envelope</span></div><div class="test"><strong>TEST / FROZEN CHOICE</strong>25 Apr–22 May 2016<span>Score once; no parameter tuning</span></div></div><div class="prose-grid"><article class="manual"><span class="label">01 / METRICS THAT MEAN SOMETHING</span><h2>Measure error, not accuracy.</h2><div class="metric-definition">WAPE = Σ|forecast − actual| / Σactual<br>MAE = average absolute error in daily units<br>Bias = Σ(forecast − actual) / Σactual</div><p>WAPE weights high-volume items more strongly. Per-product WAPE remains visible in the forecast stock list. Zero-total denominators return undefined instead of a misleading percentage.</p><p>RMSSE divides each series’ mean squared test error by the mean squared one-day difference in its training history, after leading zeros are trimmed, then takes a square root. The displayed score averages those series scores.</p></article><article class="manual"><span class="label">02 / UNCERTAINTY WITHOUT PROMISES</span><h2>A useful error envelope.</h2><p>Each product gets a radius from the 90th percentile of its 56 validation absolute errors. The lower edge is clipped to zero. On the 336 final-test daily values, observed coverage was <strong>${pct(r().coverage)}</strong>.</p><p>Two validation windows are limited. Time-series errors can shift and cluster. This empirical envelope is neither a calibrated probability interval nor a service-level guarantee. Pointwise bounds cannot be summed into a valid 28-day total interval.</p></article></div>`;
}
function method() {
  return `${intro("FIELD MANUAL / DATA & ASSUMPTIONS", "OPEN THE<br><span>CRATE.</span>", "The data, the modelling choices and the operational assumptions are part of the product. Here is what the lab can support.", "REPRODUCIBLE PYTHON / STATIC BROWSER APP")}<div class="prose-grid"><article class="manual"><span class="label">01 / PROVENANCE</span><h2>Real sales. Small scope.</h2><p>The <a href="https://zenodo.org/records/10203108" target="_blank" rel="noopener">M5 dataset on Zenodo</a> attributes the competition data to the University of Nicosia and points to the original Kaggle competition. It contains anonymous Walmart sales series.</p><p>This study streams a fixed list of 12 product IDs at store CA_1: four each from hobbies, household and foods. Every series has 1,941 daily observations, from 29 Jan 2011 to 22 May 2016. Selection preceded inspection of modelling scores. This is a portfolio-sized subset, not a representative sample or a full M5 submission.</p><p>Product names, current demand, actual inventory, lost sales and supplier costs are unavailable. The planning horizon is historical: 23 May–19 Jun 2016.</p></article><article class="manual"><span class="label">02 / MODEL DESIGN</span><h2>Keep the future out.</h2><p>Baselines repeat the last week, repeat the last 28 days or hold the trailing 28-day mean. The candidate ML model is pooled <strong>histogram gradient boosting with Poisson loss</strong>, fitted to the 12 series together.</p><p>Features: product ID; weekday/month; known calendar event and California SNAP indicator; time index; lags 1/7/14/28; shifted means 7/28/56; and trailing zero-sales share. Forecasts are recursive: later horizon features use earlier predictions, never later actual sales.</p><p>Two expanding-origin windows select the lowest pooled validation WAPE. Parameters are fixed: 140 iterations, learning rate 0.05, 15 leaves, minimum leaf size 30, L2 1, no random early-stopping split. The chosen model is refitted on all history for the planning forecast.</p></article><article class="manual"><span class="label">03 / INVENTORY POLICY</span><h2>Make the arithmetic inspectable.</h2><div class="metric-definition">Protection = lead + review + buffer days<br>Target = ceil(Σforecast over protection)<br>Position = on hand + on order − backlog<br>Order = max(0, target − position)</div><p>Illustrative on-hand and pipeline defaults use six and three days of the latest observed daily mean; they are labelled examples. Both existing and newly suggested orders arrive at the start of the lead-time day. Demand is subtracted afterward; negative balance is carried as backlog.</p><p>This is one decision, with no later review/order in the 28-day projection. A short protection period can run out later. The stress multiplier changes the scenario sales curve; it does not retrain the model or rescale evaluation metrics.</p></article><article class="manual"><span class="label">04 / WHAT TO IMPROVE NEXT</span><h2>Know the limits.</h2><p>Sales are not unconstrained demand when stockouts occur. Forecast errors are not causal evidence of stock improvements. No revenue uplift, optimized profit or achieved service level is claimed.</p><p>A stronger study would use more stores and origins, a separate external backtest, promotion and price features, inventory observations, asymmetric costs and stochastic lead times. A decision policy would then be evaluated against actual operational outcomes.</p><p>The source package includes a streaming downloader, deterministic training pipeline, data checksums, Python tests, browser planning tests, a case study and an interview guide. Code uses an MIT license; third-party data retains its own terms.</p></article></div>`;
}
function bindResult() {
  $("include-order")?.addEventListener("change", (e) => {
    state.includeOrder = e.target.checked;
    $("inventory-result").innerHTML = inventoryResult();
    bindResult();
  });
  $("export-plan")?.addEventListener("click", () => {
    const p = plan(current().forecast, state.input, state.includeOrder);
    const meta = [["STOCKROOM SCENARIO / historical planning"], ["horizon_start",r().futureStart], ["horizon_end",r().futureEnd], ["arrival_at","start of lead-time day"], ["policy","single order; negative balances carried as backlog"], ["item_id", state.sku], ["selected_model", r().selected], ...Object.entries(state.input), ["include_suggested_order", state.includeOrder], ["target", p.target], ["position", p.position], ["suggested_order", p.order], [], ["date", "projected_sales", "arrivals", "net_balance"]];
    download(`stockroom-${state.sku}-scenario.csv`, csv([...meta, ...p.rows.map((x, i) => [data.dates[1941 + i], x.demand.toFixed(5), x.arrival, x.balance.toFixed(5)])]));
  });
}
function selectSku(sku) {
  state.sku = sku;
  state.input = null;
  state.draft = null;
  state.dirty = false;
  render();
  $("status").textContent = "Selected " + sku;
}
function bind() {
  document.querySelectorAll("#planner-form input").forEach((input) => input.addEventListener("input", () => {
    state.draft = Object.fromEntries(["onHand", "onOrder", "backorders", "lead", "review", "buffer", "stress"].map(k => [k, $(k).value]));
    state.dirty = true;
    $("draft-note").textContent = "Inputs changed. Calculate to refresh results and export.";
    $("export-plan").disabled = true;
    $("include-order").disabled = true;
  }));
  $("sku")?.addEventListener("change", (e) => selectSku(e.target.value));
  $("plan-sku")?.addEventListener("change", (e) => selectSku(e.target.value));
  document.querySelectorAll("[data-sku]").forEach((b) => b.addEventListener("click", () => {
    selectSku(b.dataset.sku);
    $("main").scrollIntoView({ block: "start" });
  }));
  for (const key of ["range", "period", "comparison", "category"]) $(key)?.addEventListener("change", (e) => {
    state[key] = key === "range" ? Number(e.target.value) : e.target.value;
    render();
  });
  $("export-forecast")?.addEventListener("click", () => {
    const s = current(), origin = state.period === "future" ? 1941 : 1913, pred = state.period === "future" ? s.forecast : data.predictions[r().selected].test[data.series.indexOf(s)];
    download(`stockroom-${s.id}-${state.period}.csv`, csv([["item_id", "date", "forecast", "actual", "lower_envelope", "upper_envelope", "model", "comparison_model", "comparison_forecast"], ...pred.map((v, i) => [s.id, data.dates[origin + i], v, state.period === "test" ? s.history[origin + i] : "", Math.max(0, v - s.bandRadius), v + s.bandRadius, r().selected, state.comparison, state.comparison === "none" ? "" : baseline(s,state.comparison,origin)[i]])]));
  });
  $("export-report")?.addEventListener("click", () => download("stockroom-evaluation.json", JSON.stringify(r(), null, 2), "application/json"));
  $("reset-inputs")?.addEventListener("click", () => {
    state.input = defaults();
    state.draft = null;
    state.dirty = false;
    render();
    $("status").textContent = "Example inputs restored.";
  });
  $("planner-form")?.addEventListener("submit", (e) => {
    e.preventDefault();
    const input = Object.fromEntries(["onHand", "onOrder", "backorders", "lead", "review", "buffer", "stress"].map((k) => [k, $(k).value.trim() === "" ? NaN : Number($(k).value)])), errors = validateInputs(input);
    if (errors.length) {
      $("form-error").innerHTML = `<p class="warning error">${esc(errors.join(" "))}</p>`;
      return;
    }
    state.input = input;
    state.draft = null;
    state.dirty = false;
    $("form-error").innerHTML = "";
    $("draft-note").textContent = "";
    $("inventory-result").innerHTML = inventoryResult();
    bindResult();
    $("status").textContent = "Scenario calculated. Suggested order " + plan(current().forecast, state.input).order + " units.";
  });
  bindResult();
  if (state.dirty && $("draft-note")) {
    $("draft-note").textContent = "Inputs changed. Calculate to refresh results and export.";
    $("export-plan").disabled = true;
    $("include-order").disabled = true;
  }
}
function render() {
  const focused = document.activeElement?.id;
  $("content").innerHTML = ({ forecast, planner, benchmark, method }[state.page] || forecast)();
  document.querySelectorAll("[data-page]").forEach((a) => {
    const active = a.dataset.page === state.page;
    a.classList.toggle("active", active);
    if (active) a.setAttribute("aria-current", "page");
    else a.removeAttribute("aria-current");
  });
  document.title = { forecast: "Forecast", planner: "Stock planner", benchmark: "Model bench", method: "Field manual" }[state.page] + " / Stockroom";
  bind();
  if (focused) $(focused)?.focus({ preventScroll: true });
}
function route() {
  state.page = ["forecast", "planner", "benchmark", "method"].includes(location.hash.slice(1)) ? location.hash.slice(1) : "forecast";
  render();
}
try {
  const response = await fetch("./data/forecast.json");
  if (!response.ok) throw new Error("Data unavailable");
  data = await response.json();
  window.addEventListener("hashchange", () => {
    // A skip link is an in-page focus action, not a request for the default route.
    if (location.hash === "#main") {
      $("main").focus();
      return;
    }
    route();
    window.scrollTo({ top: 0, behavior: "instant" });
    $("main").focus({ preventScroll: true });
  });
  route();
} catch (error) {
  $("content").innerHTML = `<div class="empty" role="alert">The forecast data could not load. Reload this page or run the app through its local HTTP server.</div>`;
  console.error(error);
}
