# CAT File Viewer

Version 0.1.1

Copyright (c) 2026 Mark Kim. Licensed under [GPL-2.0](LICENSE).

A browser-based viewer for Consolidated Audit Trail (CAT) data files, built for compliance officers and operations teams at broker-dealers and trading firms.

Supports CAT Technical Specifications for Industry Members v4.1.0 r15.

**Disclaimer:** This application was developed with the assistance of AI. It should be used with caution and is not a substitute for professional review. Users are responsible for verifying the accuracy of any data presented.

## Usage

Open `index.html` in any modern browser. No server, build step, or dependencies required.

1. Drag and drop a CAT data file (JSON, CSV, or ZIP) onto the page (or click to browse). Multiple files supported; hold Shift while dropping to append.
2. Browse, filter, sort, and inspect records
3. Export filtered results to CSV

## Supported Formats

- **JSON** — NDJSON (one JSON object per line) or JSON arrays, per the CAT Technical Specifications
- **CSV** — Positional field format (no header row) as defined in the CAT spec. All 99 event types (39 equity, 35 options, 25 multi-leg) are mapped to named fields per the spec, with each event type having its own distinct field schema.
- **ZIP** — ZIP archives containing JSON or CSV CAT files (extracted in-browser using native APIs)

## Features

- **Sortable, paginated records table** with multi-column sort (Shift+click), 3-state cycle (asc/desc/unsort), priority column ordering, and configurable page size (50/100/250/500/All)
- **Column manager** — show, hide, and reorder columns with layout persistence
- **Sticky header** — stays visible while scrolling through records
- **Color-coded event types** — orders, routes, trades, cancels, modifications, quotes, and allocations are visually distinguished
- **Dynamic filters** — searchable, collapsible comboboxes with range support for event type, action type (NEW/RPR/COR/DEL), side (Buy/Sell/Short), and free-text search across all fields; filter layout persists across sessions
- **Record detail panel** — fixed and resizable at the bottom of the viewport with animated slide-up/down transitions and translated/original view modes
- **Translated display** — human-readable timestamps (string format and epoch nanoseconds → Eastern Time), dates, side codes, and compound fields (legDetails, buyDetails, sellDetails)
- **Clickable linkage fields** — navigate between related records via orderID, tradeID, parentOrderID, priorOrderID, etc.
- **Order chain view** — hierarchy tree showing parent/child order relationships
- **URL deep linking** — hash-based URL state with direct links to selected records
- **Multi-file support** — load multiple files (JSON, CSV, ZIP) via drag-and-drop or file picker; hold Shift to append
- **File validation** — verifies files are CAT format before loading
- **Tools menu** — keyboard-accessible dropdown with layout export/import for sharing between users/machines, drag-and-drop layout reordering, and validation toggle
- **Event Summary tab** — counts by event type and action type
- **Raw Data tab** — parsed JSON view of loaded records
- **CSV export** — download filtered results
- **Schema validation** — field-level validation against the CAT spec (togglable via Tools menu, enabled by default) with cell highlighting, error tooltips, detail panel badges, validation summary stats, and "Errors Only" filter. Deep validation of compound array fields (legDetails, buyDetails, sellDetails, aggregatedOrders, clientDetails, firmDetails), timeInForce name/value pairs (boolean vs non-boolean types), and handlingInstructions attributes. Errors in nested fields are highlighted at the cell level within detail panel tables.
- **Multi-level undo/redo** for filter and column operations

## Sample Data

- `1234_TEST_20250317_Sample_OrderEvents_000001.json` — 68 records covering MEAA, MECO, MEIM, MEIR, MENO, MEOA, MEOM, MEOR, MEOT, MLNO, MLOR, MOCO, and MOOT events

## Reference

Based on the [CAT Reporting Technical Specifications for Industry Members v4.1.0 r15](https://www.catnmsplan.com/sites/default/files/2026-03/03.06.26_CAT_Reporting_Technical_Specifications_for_Industry_Members_v4.1.0r15_CLEAN.pdf). See also: [CAT Reference Data](https://catnmsplan.com/reference-data).

## License

[GPL-2.0](LICENSE)
