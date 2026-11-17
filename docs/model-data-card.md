# Model and data card

## Intended use

Educational portfolio work: historical daily-sales forecasting, transparent time-series evaluation and an illustrative inventory policy. Not a production purchasing recommendation.

## Data

M5 competition sales; public mirror: https://zenodo.org/records/10203108. Organizer attribution: University of Nicosia. Anonymous Walmart product/store identifiers. One store, CA_1; 12 predetermined IDs:

`HOBBIES_1_001/004/008/009`, `HOUSEHOLD_1_001/009/013/020`, `FOODS_3_090/120/150/200`.

Each has 1,941 daily observations (2011-01-29 through 2016-05-22), for 23,292 observations total. This is a convenience-sized fixed subset, not a random sample. No names, prices, inventory, supplier lead times or costs are used. Source and subset SHA-256 hashes are in `data/manifest.json` and the evaluation report. Data retains source terms; code licensing does not grant additional data rights.

## Splits

Origins count observed days, while Python indices are zero-based:

| Use | Train through | Forecast days |
|---|---|---|
| Validation 1 | 2016-02-28 / d1857 | 2016-02-29–2016-03-27 |
| Validation 2 | 2016-03-27 / d1885 | 2016-03-28–2016-04-24 |
| Final test | 2016-04-24 / d1913 | 2016-04-25–2016-05-22 |
| Planning refit | 2016-05-22 / d1941 | 2016-05-23–2016-06-19 |

Two validation origins choose the lowest pooled WAPE. A candidate's training window expands at each origin. Final test is not used for selection. The planning refit incorporates final-test observations because they are then available history, and makes no claim to score the next 28 days.

## Candidates and features

Weekly repeat; 28-day repeat; fixed trailing 28-day mean; pooled scikit-learn HistGradientBoostingRegressor, loss Poisson, 140 iterations, 15 leaves, learning rate 0.05, minimum leaf 30, L2 1, random_state 42, early_stopping False, product ID categorical.

Features are SKU, Monday-zero weekday, month, California SNAP, presence of calendar event 1, normalized time, lags 1/7/14/28, shifted means 7/28/56 and trailing zero fraction 28. Training starts after 56 observations. Every rolling/lag feature excludes its target. The horizon is recursive: predicted earlier horizon values feed subsequent features. Known future calendar indicators are allowed, future sales are not.

## Evaluation and envelope

Full scores: `reports/evaluation.json`. WAPE is pooled absolute error divided by pooled observed units. MAE is the daily absolute error mean. Relative bias is total signed error divided by observed units. Zero denominators return null. RMSSE scales each series' squared error by training one-day squared differences, trimming leading zeros; degenerate scales are excluded and the valid-series count is retained. Displayed RMSSE is a macro mean, not official weighted hierarchical M5 scoring.

For the selected model, each product's envelope radius is the empirical 90th percentile (higher quantile method) of 56 validation absolute errors. Lower predictions are clipped to zero. These are pointwise descriptive envelopes, not simultaneous total intervals or guaranteed conformal coverage. Final test coverage was 308/336 = 91.67%.

## Inventory simulation assumptions

Example stock defaults = ceiling of six days of last-28-day observed mean; on-order = ceiling of three days; backlog zero. Lead/review/buffer defaults 7/7/3 days. Inputs are whole numbers within explicit bounds. The total protection horizon never exceeds 28 days. A 50–150% forecast multiplier is a user stress scenario, not a new trained model.

Target = ceiling of forecast sales over protection. Inventory position = on hand + pipeline − backlog. Suggested order = max(0, target − position). Existing and suggested orders arrive once at the start of lead day. Sales are deducted and shortages carried as backlog. No later order is placed. A standard new order cannot prevent a shortage before arrival. A shorter protection horizon can have later shortages even when the initial target is met.

## Limitations

Only one store and two validation windows; highly uneven item volumes; unobserved stockouts/promotion/price effects; an old historical period; unknown real inventory; no cost or supply uncertainty. Performance may change sharply across items/windows. Statistical forecast uncertainty and operational safety stock are different concepts. No financial/operational benefit was measured.
