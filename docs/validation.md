# Validation record

## Automated checks

- Seven Python unittest checks pass, including retraining all four candidates under perturbed future sales to verify forecast invariance.
- Nine Node checks pass for inventory arithmetic, timing, scenario bounds, invalid inputs and CSV structure; every shipped product reconciles.
- Exact source/subset hashes, package versions, per-fold and candidate test scores are retained in `reports/evaluation.json`.

## Modelling run

Fixed IDs and fixed candidate parameters were chosen before inspecting validation or test metrics. Rolling validation selected Poisson boosting at pooled WAPE 0.5502007. The frozen choice scored final WAPE 0.3527117, MAE 3.6793292, macro RMSSE 0.7887380, relative bias 0.0608202. The validation-derived empirical error envelope covered 308 of 336 held-out daily values.

The final score is based on a small single-store subset and one test window. It is not an independent production estimate. Final-test observations are used in the later full-history planning refit but not the reported held-out score or original selection.

## Browser verification

Desktop and phone layout/interaction checks are recorded with screenshots in `reports/`. These are smoke checks of the shipped static app, not exhaustive cross-browser certification. Evaluation in the UI is precomputed; inventory scenarios execute in the browser. Automated tests separately verify the accounting and numerical outputs.

Observed checks: product selection, category filter, holdout and weekly-baseline overlays, matching summary receipt, scenario recalculation, order exclusion, pre-arrival shortage and stale-input export protection. At a 390 × 844 viewport, forecast/planner/model-bench pages had equal 375-pixel client and scroll widths (no page overflow); wide tables scroll within their own containers. Chart coordinates adapt for phone readability. Field-manual navigation also passed. The final browser console contained no warnings or errors.

## Final planner polish

Uncalculated input drafts now survive navigation between sections. A browser check changed on-hand units to 1,000, visited Model bench, returned to the planner and confirmed both the draft and disabled stale-result export remained; recalculation then correctly suggested zero units. Baseline overlays now have exact values in the accessible daily table and forecast CSV. Scenario CSVs retain horizon dates and arrival/backlog assumptions. Product-specific test WAPE is visible in the forecast receipt. At 390 pixels, both navigation and page had equal client/scroll widths of 375 pixels after tightening the navigation spacing. The nine Node accounting checks still pass; modelling outputs were not changed.
