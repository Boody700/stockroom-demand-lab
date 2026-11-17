# From a daily sales curve to an inventory conversation

## Problem

A planner needs a demand estimate and an inspectable decision rule. A forecast score alone does not show whether an order will arrive in time, how backlog is treated, or whether a safety buffer has a statistical interpretation.

Stockroom links those pieces in a small historical simulation. It is intentionally bounded: twelve anonymous product IDs, one store, three categories and a twenty-eight-day horizon. The product list was fixed before reading modelling scores.

## Approach

1. Stream a public M5 CSV and keep twelve CA_1 rows plus the calendar. Preserve checksums.
2. Build target-free lag/rolling features and known calendar indicators.
3. Compare weekly repeat, 28-day repeat, trailing 28-day mean and a fixed pooled Poisson boosting model.
4. Generate recursive forecasts at two expanding validation origins. Choose the lowest pooled WAPE.
5. Freeze that choice, score the final 28 days and derive no tuning decisions from those scores.
6. Refit on all observations for the following historical planning horizon. Translate forecasts into a transparent order-up-to rule.

The boosting model achieved validation WAPE 0.5502. Its final test WAPE was 0.3527, MAE 3.6793 units/day, macro RMSSE 0.7887 and relative bias +0.0608. The easier final period does not imply general improvement across time. High-volume foods dominate pooled WAPE; item-level errors stay visible.

## Product choices

The app adopts an industrial planning-desk identity: full-width signal chart, high-contrast orange product selector, receipt-style forecast summary, numerical top navigation and an explicit stock movement view. It differs from the other portfolio dashboards in both interaction and visual structure.

Charts include exact-value tables. Model comparisons, historical dates, errors and uncertainty limitations remain visible. The planner labels stock inputs as examples, shows how an order was calculated and flags shortages before delivery. Exports retain scenario assumptions.

## What was established

The pipeline can produce reproducible small-subset forecasts without random temporal leakage. A browser simulation can reconcile daily inventory movements under stated assumptions. Seven Python tests and nine JavaScript tests support those claims.

The study does not establish stock savings, a service level, a profit optimum or general M5 competitiveness. Real inventory and lost-sales data are missing. A follow-up should add multiple stores/origins, cost-sensitive policies and observed operational outcomes before claiming business impact.
