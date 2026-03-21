# CAT File Viewer

Version 0.1.1

Copyright (c) 2026 Mark Kim. Licensed under [GPL-2.0](LICENSE).

A browser-based viewer for Consolidated Audit Trail (CAT) data files, built for compliance officers and operations teams at broker-dealers and trading firms.

Supports CAT Technical Specifications for Industry Members v4.1.0 r15.

**Disclaimer:** This application was developed with the assistance of AI. It should be used with caution and is not a substitute for professional review. Users are responsible for verifying the accuracy of any data presented.

## Usage

Open `index.html` in any modern browser. No server, build step, or dependencies required.

1. Drag and drop a CAT data file onto the page (or click to browse). Multiple files supported; hold Shift while dropping to append.
2. Browse, filter, sort, and inspect records
3. Export filtered results to CSV

## Supported Formats

- **JSON** — NDJSON (one JSON object per line) or JSON arrays, per the CAT Technical Specifications
- **CSV** — Positional field format (no header row) as defined in the CAT spec. All 99 event types (39 equity, 35 options, 25 multi-leg) are mapped to named fields per the spec, with each event type having its own distinct field schema.

## Features

- **Sortable, paginated records table** with priority column ordering and configurable page size (50/100/250/500/All)
- **Sticky header** — stays visible while scrolling through records
- **Color-coded event types** — orders, routes, trades, cancels, modifications, quotes, and allocations are visually distinguished
- **Filtering** — by event type, action type (NEW/RPR/COR/DEL), side (Buy/Sell/Short), and free-text search across all fields
- **Record detail panel** — fixed to the bottom of the viewport with animated slide-up/down transitions and translated/original view modes
- **Translated display** — human-readable timestamps (string format and epoch nanoseconds → Eastern Time), dates, side codes, and compound fields (legDetails, buyDetails, sellDetails)
- **Clickable linkage fields** — navigate between related records via orderID, tradeID, parentOrderID, priorOrderID, etc.
- **Order chain view** — hierarchy tree showing parent/child order relationships
- **Multi-file support** — load multiple files via drag-and-drop or file picker; hold Shift to append
- **Event Summary tab** — counts by event type and action type
- **Raw Data tab** — parsed JSON view of loaded records
- **CSV export** — download filtered results

## Sample Data

- `sample_data.json` — 15 records covering MENO, MEOR, MEOT, MEOM, MECO, and MENQ events
- `sample_data.csv` — 6 records (MENO, MEOR) in positional CSV format

## Reference

Based on the [CAT Reporting Technical Specifications for Industry Members v4.1.0 r15](https://www.catnmsplan.com/sites/default/files/2026-03/03.06.26_CAT_Reporting_Technical_Specifications_for_Industry_Members_v4.1.0r15_CLEAN.pdf). See also: [CAT Reference Data](https://catnmsplan.com/reference-data).

## License

[GPL-2.0](LICENSE)
