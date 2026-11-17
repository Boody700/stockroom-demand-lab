# Be ready to explain Stockroom

## A short introduction

“I built a historical sales forecasting and inventory scenario lab. I used a fixed twelve-product M5 subset, compared three baselines with pooled Poisson boosting using rolling validation, held out the last 28 days, and connected the forecasts to a transparent replenishment simulation. The selected model achieved 35.3% held-out WAPE on this subset. That does not establish production performance or stock savings.”

## Questions to understand

**Why no random train/test split?** Adjacent daily observations share seasonality and lag information. A random split would not reproduce the actual task of predicting unseen future days. Expanding origins preserve time order.

**How do you prevent leakage while forecasting day 28?** Fit using observations strictly before the origin. At each horizon step, compute lags and trailing means from available history plus earlier predictions. Do not insert actual values from days 1–27 of the held-out horizon. There is a future-label perturbation test that retrains and checks this property.

**Why Poisson loss?** Daily sales are nonnegative and count-like. Poisson boosting uses a log link and avoids negative fitted outputs. This is a modelling choice, not proof of an exact Poisson data-generating process.

**Why pooled modelling?** A single model can share calendar and lag patterns across series while a categorical product identifier allows different levels. A larger study would compare local and pooled alternatives across more origins.

**Why WAPE and RMSSE?** WAPE expresses pooled volume-weighted error; high-volume foods dominate it. RMSSE normalizes each item by its own historical variation. The macro score here is not official M5 WRMSSE. Item-level WAPE is visible to expose heterogeneity.

**Is 35.3% WAPE 64.7% accuracy?** Avoid that conversion. WAPE is an error ratio, can exceed 100%, and behaves differently by volume/distribution. Report it as error.

**Are the shaded bounds a 90% service guarantee?** No. They are per-product validation-error envelopes. Time dependence and only 56 residuals per item limit interpretation. Coverage is measured on the test, and a pointwise envelope does not define a total-demand interval.

**Why can the suggested order still show a shortage?** Delivery cannot fix a shortage before it arrives. Also, the target covers lead + review + buffer, which can be shorter than 28 days. The simulator places one order, not a repeated policy.

**Where did stock quantities come from?** Illustrative defaults: six and three days of recent observed mean sales. M5 supplies sales, not inventory. User inputs are scenario assumptions.

**What would you add with a real retailer?** Stock availability/lost-sales data, prices/promotions, multiple stores, many more origins, supplier constraints, costs, variable lead times and a decision-policy backtest. Then quantify actual operational outcomes.

## Before showing the project

Run both test suites, change a product, overlay a baseline, inspect a bad per-product error, force a pre-arrival shortage and explain one CSV export. Read the feature function and inventory accounting yourself. Acknowledge AI implementation assistance and describe what you can independently reproduce and defend.
