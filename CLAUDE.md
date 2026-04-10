# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This repository is for work related to **CAT (Consolidated Audit Trail) reporting** for Industry Members, based on the FINRA CAT Technical Specifications v4.1.0 r15 (dated 3/6/2026).

## Reference Specification

The primary reference document is the [CAT Reporting Technical Specifications for Industry Members v4.1.0 r15](https://www.catnmsplan.com/sites/default/files/2026-03/03.06.26_CAT_Reporting_Technical_Specifications_for_Industry_Members_v4.1.0r15_CLEAN.pdf). This ~63,000-line PDF covers:
- **CAT Reporting Fundamentals**: Order IDs, timestamps, order handling instructions, Firm ROE IDs, FDIDs, equity/option symbols, data types, and linkage rules
- **Special Reporting Requirements**: ATS reporting, manual orders, allocation events, RFQ responses, representative orders, combined orders, multi-leg orders, and more
- **Event specifications**: Detailed schemas for order lifecycle events (New Order, Route, Trade, Cancel, etc.) for both equities and options
- **File submission**: JSON file formats, connectivity (SFTP/AWS S3), feedback and error correction processes
- **Industry Member identifiers (IMIDs)** and **Firm Designated IDs (FDIDs)** are central concepts

When working with this spec, use `pdftotext` to extract relevant sections rather than reading the entire document.

## CAT File Viewer (`index.html`)

A single-file web application for compliance officers to inspect CAT data files. No build step required — open `index.html` directly in a browser.

### Key features
- Drag-and-drop or file picker for JSON (NDJSON), CSV, ZIP, and GZIP format CAT files (multiple files supported; hold Shift to append)
- Auto-detects format from extension and content; validates files are CAT format before loading
- Sortable, paginated record table with multi-column sort (Shift+click), 3-state cycle (asc/desc/unsort), priority column ordering, and configurable page size (50/100/250/500/All)
- Column manager to show/hide/reorder columns, with search highlighting and layout persistence
- Sticky header that stays visible while scrolling
- Dynamic searchable filters with collapsible comboboxes, range support, and layout persistence
- Filters by event type (with detailed descriptions), action type (NEW/RPR/COR/DEL), side, error code, and free-text search; default filters include type, symbol, underlying, and optionID
- Color-coded event type badges (order/route/trade/cancel/modify/quote/allocation)
- Fixed, resizable record detail panel at bottom of viewport with animated slide-up/down transitions and translated/original view modes
- Translated display for timestamps (both string format and epoch nanoseconds → Eastern Time), dates, side codes, compound fields (legDetails, buyDetails, sellDetails)
- Clickable linkage fields (orderID, tradeID, parentOrderID, priorOrderID, routedOrderID, etc.) for navigating between related records; clicking clears other active filters
- Order chain view with hierarchy tree, depth controls (This order, + Children, + Branch) that toggle off when clicked again; + Children shows all descendants; Branch shows direct ancestor chain plus descendants, excluding siblings
- URL hash state with deep linking to selected records
- Tools dropdown menu (keyboard shortcut accessible) with layout export/import, drag-and-drop layout reordering, validation toggle, and performance panel toggle. Reset Layout followed by Save Layout clears saved layout so defaults are always used.
- Performance panel (Tools menu toggle): floating overlay showing timing stats (last/avg/count) for critical paths (parse, flatten, validate, filter, sort, column widths, timeline build/draw). Auto-refreshes every 500ms. Zero overhead when disabled.
- Virtual scrolling for large datasets with sub-pixel-accurate column width locking (samples longest values per column to prevent clipping)
- Timeline tab with canvas-based order event visualization:
  - Hierarchical swimlanes grouped by orderID with parent-child connector lines, collapse/expand
  - Prior order chain merging: orders linked via priorOrderID share a single swimlane with diamond transition markers and chain count badges; tooltip on hover shows old → new orderID
  - Color-coded event dots by category (order/route/trade/cancel/modify/quote/allocation)
  - Validation badges on event dots when validation is enabled: a small filled triangle with white "!" — red for records with errors, amber for warnings only — drawn at the top-left of the dot (mirroring the overlap count badge on the top-right). Same triangle shape is used in the Records tab row indicator for consistency. Worst severity wins (error > warn) for overlap-grouped events. Tooltip on hover includes error/warning counts.
  - Life-duration bars showing order time span
  - Adaptive time axis from nanosecond to decade granularity with clean interval alignment and minor gridlines
  - Date pills at midnight boundaries and timeline start (YYYY-MM-DD format)
  - Kinetic scrolling (mousedown drag with momentum), Ctrl/Cmd+wheel zoom, Shift+wheel horizontal scroll
  - Pinch-to-zoom and single-finger pan on touch devices
  - Fit-all button (bottom-right corner) to reset zoom/scroll; highlighted blue when zoomed/panned away from home level
  - Heatmap scrollbars showing color-coded event density with gaussian smoothing
  - Selection highlighting: selected event gets lane highlight, time crosshair, blue label, and white scrollbar position markers
  - Full-precision timestamps in tooltips matching the original eventTimestamp precision (ms/us/ns)
  - Event type descriptions in tooltips (same as detail panel)
  - Zoom/scroll state preserved across tab switches; resets only when filtered data changes
  - Cross-tab selection sync: selecting a record in Records smoothly scrolls the timeline to center that event; selecting an event in the timeline updates the Records tab page and scroll position. Smooth animated scrolling in both directions.
  - Detail panel integration: timeline resizes with detail panel open/close/resize, scroll position preserved when switching between Records and Timeline tabs
- Event Summary tab with counts broken down by action type
- Raw Data tab showing parsed JSON
- CSV export of filtered results
- Multi-level undo/redo for filter and column operations
- Deferred validation: validation runs asynchronously in chunks of 500 records after the UI renders, showing "Validating: X / Y" progress. Cancellable via generation counter when toggled off or new file loaded.
- Field-level validation against CAT schema spec (v4.1.0 r15), togglable via Tools menu (enabled by default), with cell highlighting, error tooltips, detail panel badges, validation summary stats, "Errors Only" filter toggle, error code filter, and per-error ignore/dismiss with managed ignored errors list. Deep validation of compound array fields (legDetails, buyDetails, sellDetails, aggregatedOrders, clientDetails, firmDetails), timeInForce name/value pairs (boolean vs non-boolean types), handlingInstructions attributes, and bidRelativePrice/askRelativePrice NVP attributes (10 boolean attrs each). Nested field errors highlighted at cell level in detail panel tables. CAT error codes from Table 177 (Data Ingestion Errors) displayed in tooltips and badges (e.g., [2026], [2143]). ~65 cross-field and format validations including: errorROEID/actionType (2026), firmROEID format and date match (2032/2033), eventTimestamp precision/component/future checks (2027/2139), leavesQty<=quantity (2040), cancelTimestamp/cancelFlag (2014), sideDetailsInd/buyDetails/sellDetails (2108/2115), buyDetails/sellDetails orderID/firmDesignatedID mutual exclusion (2114/2148), electronicDupFlag/manualFlag (2143/2144), senderIMID!=destination/receiverIMID (2189), IMID format (2019/2089), orderID self-reference checks (2190/2191), price/netPrice exclusivity (2226), CASH quantity (2247), side detail array limits (2273-2276), BFMMFlag+accountHolderType+side (2261/2262/2265-2268), capacity+firmDesignatedID (2258/2259), fulfillmentLinkType+firmDetails (2145), reportingExceptionCode+tapeTradeID+clearingFirm+counterparty (2169/2184/2185), legDetails symbol/optionID+openCloseIndicator (2213/2221), numberOfLegs match (2203), representativeInd/aggregatedOrders (2142/2269), representativeQuoteInd combinations (2237/2243/2244/2246), firmDesignatedID+accountHolderType (2245), PENDING on supplements (2270), record max length (2132), MLOS supplement firmDesignatedID/aggregatedOrders/routeRejectedFlag/legDetails combination (2271), MLQS supplement firmDesignatedID/quoteRejectedFlag/legDetails combination (2272), nbboSource=NA and NBBO field requirements (2048/2049/2051), destination Exchange ID validation (2019), exchOriginCode+destinationType bidirectional (2028), price+orderType=LMT (2067), RFQID+RFQFlag bidirectional (2187/2257), openCloseIndicator+optionID (2057), DVPCustodianID+allocationType (2179), settlementDate+tradeDate (2177), negative quantity checks, date/timestamp component validation, alphanumeric CATReporterIMID format, and expanded choice values for representativeInd (11 values), fulfillmentLinkType (10 values), reportingExceptionCode, and marketCenterID.

### CAT file format notes
- **JSON files**: NDJSON (one JSON object per line) or a JSON array. Each record has a `type` field (e.g., `MENO`, `MEOR`, `MEOT`) and `actionType` (`NEW`, `RPR`, `COR`, `DEL`).
- **CSV files**: Positional fields with no header row. Field position 4 (0-indexed 3) is always `type`. The viewer maps all 99 event types (39 equity ME, 35 options MO, 25 multi-leg ML) to named fields per the spec, with each type having its own distinct field schema.
- **ZIP/GZIP**: ZIP archives containing JSON or CSV files; GZIP-compressed files (`.json.gz`, `.csv.gz`). Both decompressed in-browser.
- Event type prefixes: `ME` = equity, `MO` = option, `ML` = multi-leg

### Sample data
- `1234_TEST_20250317_Sample_OrderEvents_000001.json` — 68 records covering MEAA, MECO, MEIM, MEIR, MENO, MEOA, MEOM, MEOR, MEOT, MLNO, MLOR, MOCO, MOOT events

### Versioning
Version is automatically set by a git pre-commit hook (`.git/hooks/pre-commit`). Format: `vYYYY.MM.DD`. Do not manually set version numbers in `index.html`.
