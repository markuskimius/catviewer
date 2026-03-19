# CAT File Viewer

Version 0.1.1

Copyright (c) 2026 Mark Kim. Licensed under [GPL-2.0](LICENSE).

A browser-based viewer for Consolidated Audit Trail (CAT) data files, built for compliance officers and operations teams at broker-dealers and trading firms.

Supports CAT Technical Specifications for Industry Members v4.1.0 r15.

**Disclaimer:** This application was developed with the assistance of AI. It should be used with caution and is not a substitute for professional review. Users are responsible for verifying the accuracy of any data presented.

## Usage

Open `index.html` in any modern browser. No server, build step, or dependencies required.

1. Drag and drop a CAT data file onto the page (or click to browse)
2. Browse, filter, sort, and inspect records
3. Export filtered results to CSV

## Supported Formats

- **JSON** — NDJSON (one JSON object per line) or JSON arrays, per the CAT Technical Specifications
- **CSV** — Positional field format (no header row) as defined in the CAT spec. All 99 event types (39 equity, 35 options, 25 multi-leg) are mapped to named fields per the spec, with each event type having its own distinct field schema.

## Features

- **Sortable, paginated records table** with priority column ordering for the most important CAT fields
- **Color-coded event types** — orders, routes, trades, cancels, modifications, quotes, and allocations are visually distinguished
- **Filtering** — by event type, action type (NEW/RPR/COR/DEL), side (Buy/Sell/Short), and free-text search across all fields
- **Record detail panel** — click any row to inspect all fields
- **Event Summary tab** — counts by event type and action type
- **Raw Data tab** — parsed JSON view of loaded records
- **CSV export** — download filtered results

## Sample Data

- `sample_data.json` — 15 records covering MENO, MEOR, MEOT, MEOM, MECO, and MENQ events
- `sample_data.csv` — 6 records (MENO, MEOR) in positional CSV format

## Reference

Based on the [CAT Reporting Technical Specifications for Industry Members](https://www.catnmsplan.com/technical-specifications) v4.1.0 r15.

## License

[GPL-2.0](LICENSE)
