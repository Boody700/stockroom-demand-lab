# Architecture

`scripts/download.py` → source calendar + fixed sales subset + manifest

`scripts/train.py` → leakage-aware features → rolling candidate forecasts → validation selection → frozen final test → full-history refit → browser JSON + reports

`dist/app.mjs` → forecast explorer / model bench / exact-value tables / CSV and JSON downloads

`dist/planner.mjs` → validated inventory inputs → transparent decision and daily balance calculation

The app is a static HTML/CSS/ES-module site. Forecast training happens offline in Python; changing controls does not train a model. The browser recalculates the operational scenario only. Data is loaded once from a relative JSON file. No service account, API key, database, analytics or remote inference is involved. Optional Google Fonts requests load the two typefaces; system fallbacks remain available.

`npm start` serves `dist` on loopback port 4176 with correct module MIME types, path confinement and no caching. Native Sites packaging publishes the same assets. `.openai/hosting.json` records hosting identity; credentials are never included in source archives.

## Reproduction contract

Pinned Python dependencies are in `requirements.txt`; actual library versions and data checksums are in `reports/evaluation.json`. Model hyperparameters, selected IDs, origins and policy appear in source and the model/data card. Downloading is separate from training so a saved subset can be audited and reused offline.

Full raw source CSVs, virtual environments and model binaries are unnecessary. The streaming download stops after finding all selected rows. Training exports rounded predictions (five decimals); report metrics retain full precision. Tiny float differences between rounded/browser metrics and the original Python metrics are expected.

## Checks

- Python: source checksums, dates/shapes, exact feature alignment, future-sales perturbation invariance (including fitting), validation-only selection, score reconciliation, degenerate denominators, envelope derivation.
- JavaScript: inventory accounting, arrival timing, pre-arrival shortages, scenario stress, existing pipeline retention, bounds/invalid values, CSV quoting and reconciliation on all shipped series.
- Browser: representative desktop/phone navigation, charts, product/filter controls, holdout/baseline overlays, scenario edits and order inclusion.

No dependency installation is needed to run the prebuilt app or Node checks. CI is included for future repository use.
