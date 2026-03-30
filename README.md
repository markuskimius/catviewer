# CAT File Viewer

Version 0.1.1

Copyright (c) 2026 Mark Kim. Licensed under [GPL-2.0](LICENSE).

A browser-based viewer for Consolidated Audit Trail (CAT) data files, built for compliance officers and operations teams at broker-dealers and trading firms.

Supports CAT Technical Specifications for Industry Members v4.1.0 r15.

**Disclaimer:** This application was developed with the assistance of AI. It should be used with caution and is not a substitute for professional review. Users are responsible for verifying the accuracy of any data presented.

## Usage

Open `index.html` in any modern browser. No server, build step, or dependencies required.

1. Drag and drop a CAT data file (JSON, CSV, ZIP, or GZIP) onto the page (or click to browse). Multiple files supported; hold Shift while dropping to append.
2. Browse, filter, sort, and inspect records
3. Export filtered results to CSV

## Supported Formats

- **JSON** — NDJSON (one JSON object per line) or JSON arrays, per the CAT Technical Specifications
- **CSV** — Positional field format (no header row) as defined in the CAT spec. All 99 event types (39 equity, 35 options, 25 multi-leg) are mapped to named fields per the spec, with each event type having its own distinct field schema.
- **ZIP** — ZIP archives containing JSON or CSV CAT files (extracted in-browser using native APIs)
- **GZIP** — Gzip-compressed JSON or CSV files (`.json.gz`, `.csv.gz`, etc.), decompressed in-browser

## Features

- **Sortable, paginated records table** with multi-column sort (Shift+click), 3-state cycle (asc/desc/unsort), priority column ordering, and configurable page size (50/100/250/500/All)
- **Column manager** — show, hide, and reorder columns with search highlighting and layout persistence
- **Sticky header** — stays visible while scrolling through records
- **Color-coded event types** — orders, routes, trades, cancels, modifications, quotes, and allocations are visually distinguished
- **Dynamic filters** — searchable, collapsible comboboxes with range support for event type (with detailed descriptions), action type (NEW/RPR/COR/DEL), side (Buy/Sell/Short), error code, and free-text search across all fields; filter layout persists across sessions
- **Record detail panel** — fixed and resizable at the bottom of the viewport with animated slide-up/down transitions and translated/original view modes
- **Translated display** — human-readable timestamps (string format and epoch nanoseconds → Eastern Time), dates, side codes, and compound fields (legDetails, buyDetails, sellDetails)
- **Clickable linkage fields** — navigate between related records via orderID, tradeID, parentOrderID, priorOrderID, routedOrderID, etc.; clicking clears other active filters
- **Order chain view** — hierarchy tree showing parent/child order relationships with depth controls (This order, + Children, + Branch); buttons toggle off when clicked again; + Children shows all descendants; Branch shows direct ancestor chain plus descendants, excluding siblings
- **URL deep linking** — hash-based URL state with direct links to selected records
- **Multi-file support** — load multiple files (JSON, CSV, ZIP, GZIP) via drag-and-drop or file picker; hold Shift to append
- **File validation** — verifies files are CAT format before loading
- **Tools menu** — keyboard-accessible dropdown with layout export/import for sharing between users/machines, drag-and-drop layout reordering, and validation toggle
- **Virtual scrolling** — efficiently renders large datasets by only drawing visible rows; sub-pixel-accurate column width measurement ensures columns are never clipped
- **Timeline visualization** — canvas-based interactive timeline showing order events as color-coded dots in hierarchical swimlanes:
  - Parent-child order hierarchy with connector lines and collapse/expand controls
  - Prior order chain merging — orders linked via priorOrderID share a single swimlane with diamond markers at orderID transitions
  - Adaptive time axis from nanosecond to decade granularity with date pills at midnight boundaries
  - Kinetic scrolling with momentum, Ctrl/Cmd+wheel zoom, pinch-to-zoom on touch devices
  - Fit-all button to reset zoom and scroll
  - Heatmap scrollbars showing color-coded event density
  - Selection highlighting across lane, time crosshair, and scrollbar markers; integrates with the record detail panel
- **Event Summary tab** — counts by event type and action type
- **Raw Data tab** — parsed JSON view of loaded records
- **CSV export** — download filtered results
- **Schema validation** — field-level validation against the CAT spec (togglable via Tools menu, enabled by default) with cell highlighting, error tooltips, detail panel badges, validation summary stats, "Errors Only" filter, error code filter, and per-error ignore/dismiss with managed ignored errors list. Deep validation of compound array fields (legDetails, buyDetails, sellDetails, aggregatedOrders, clientDetails, firmDetails), timeInForce name/value pairs (boolean vs non-boolean types), handlingInstructions attributes, and bidRelativePrice/askRelativePrice NVP attributes. Errors in nested fields are highlighted at the cell level within detail panel tables. CAT error codes from Table 177 (Data Ingestion Errors) shown in tooltips and badges (e.g., [2026], [2143]). ~65 cross-field and format validations including firmROEID format/date match, eventTimestamp precision and component validation, trade side detail mutual exclusions, BFMMFlag combinations, fulfillmentLinkType/firmDetails rules, representativeInd/aggregatedOrders logic, IMID format checks, quantity non-negativity, record max length (2132), MLOS supplement field combinations (2271), MLQS supplement field combinations (2272), destination Exchange ID validation (2019), exchOriginCode/destinationType bidirectional (2028), price required for LMT orders (2067), RFQID/RFQFlag bidirectional (2187/2257), NBBO field requirements (2048/2049/2051), openCloseIndicator/optionID (2057), DVPCustodianID/allocationType (2179), and more.
- **Multi-level undo/redo** for filter and column operations

## Sample Data

- `1234_TEST_20250317_Sample_OrderEvents_000001.json` — 68 records covering MEAA, MECO, MEIM, MEIR, MENO, MEOA, MEOM, MEOR, MEOT, MLNO, MLOR, MOCO, and MOOT events

## Reference

Based on the [CAT Reporting Technical Specifications for Industry Members v4.1.0 r15](https://www.catnmsplan.com/sites/default/files/2026-03/03.06.26_CAT_Reporting_Technical_Specifications_for_Industry_Members_v4.1.0r15_CLEAN.pdf). See also: [CAT Reference Data](https://catnmsplan.com/reference-data).

## License

[GPL-2.0](LICENSE)
