# CAT File Viewer

Version v2026.09.28

Copyright (c) 2026 Mark Kim. Licensed under [GPL-2.0](LICENSE).

A browser-based viewer for Consolidated Audit Trail (CAT) data files, built for compliance officers and operations teams at broker-dealers and trading firms.

Supports CAT Technical Specifications for Industry Members v4.1.0 r15 and v4.2.0 r2. Each record is validated against the version in effect on its event date: v4.2.0 from 12/7/2026 (the production date in the 8/27/2026 IM release plan), v4.1.0 r15 before that. The header shows which version(s) were applied, and **Tools → Spec** forces one version for every record. Error codes retired mid-version are dropped from their retirement date (2247 from 6/1/2026). The MX2OP and IEXOP exchange values are accepted on both versions, since they went into production before the v4.2.0 cutover.

**Disclaimer:** This application was developed with the assistance of AI. It should be used with caution and is not a substitute for professional review. Users are responsible for verifying the accuracy of any data presented.

## Usage

**Live version:** https://app.cbreak.org/catviewer/

Open `index.html` in any modern browser. No server, build step, or dependencies required.

1. Drag and drop a CAT data file (JSON, CSV, BZip2, ZIP, or GZIP) onto the page (or click to browse). Multiple files supported; hold Shift while dropping to append.
2. Browse, filter, sort, and inspect records
3. Export filtered results to CSV

## Supported Formats

- **JSON** — NDJSON (one JSON object per line) or JSON arrays, per the CAT Technical Specifications
- **CSV** — Positional field format (no header row) as defined in the CAT spec. All 99 event types (39 equity, 35 options, 25 multi-leg) are mapped to named fields per the spec, with each event type having its own distinct field schema.
- **BZip2** — `.json.bz2` / `.csv.bz2`, the compression CAT requires for submitted Data Files (spec §6.1), decoded in-browser with CRC checks; concatenated streams supported
- **ZIP** — ZIP archives containing JSON or CSV CAT files, optionally `.gz`/`.bz2` inside, with stored, deflate or bzip2 entries. Entries are found through the central directory, so archives from streaming zip tools (data descriptors) and ZIP64 archives load. An unreadable entry is reported and the rest of the archive still loads
- **GZIP** — Gzip-compressed JSON or CSV files (`.json.gz`, `.csv.gz`, etc.), decompressed in-browser
- **Exact values** — numbers with more than 15 significant digits (epoch-nanosecond timestamps, 20-digit errorROEIDs, 8-decimal prices) keep every digit instead of being rounded by the browser's JSON parser; prices and quantities display every decimal; timestamp columns sort and range-filter by exact instant, with Eastern Time strings and epoch numbers interleaved correctly
- **Unreadable lines are reported** — JSON lines that don't parse are listed (with line numbers) in a warning instead of being dropped silently; files too large for a browser to hold (about 512 MB of text) get an explanation rather than a generic error

## Features

- **Sortable, paginated records table** with multi-column sort (Shift+click), 3-state cycle (asc/desc/unsort), priority column ordering, and configurable page size (50/100/250/500/All)
- **Column manager** — show, hide, and reorder columns with search highlighting and layout persistence
- **Sticky header** — stays visible while scrolling through records
- **Color-coded event types** — orders, routes, trades, cancels, modifications, quotes, and allocations are visually distinguished
- **Dynamic filters** — searchable, collapsible comboboxes with range support for event type (with detailed descriptions), action type (NEW/RPR/COR/DEL), side (Buy/Sell/Short), error code, and free-text search across all fields; filter layout persists across sessions
- **Record detail panel** — fixed and resizable at the bottom of the viewport with animated slide-up/down transitions and translated/original view modes
- **Translated display** — human-readable timestamps (string format and epoch nanoseconds → Eastern Time), dates, side codes, and compound fields (legDetails, buyDetails, sellDetails, clientDetails, firmDetails)
- **Side-slot columns** — side-detail compound arrays are flattened into positional `side1.*` (buy/client side) and `side2.*` (sell/firm side) columns, so trades (buyDetails/sellDetails) and fulfillments (clientDetails/firmDetails) line up in the same columns. All subfields (orderID, side, quantity, firmDesignatedID, accountHolderType, originatingIMID, orderKeyDate, BFMMFlag) are shown by default, grouped per slot; the orderID cells carry a role chip (B/S/C/F for the source array) and clickable orderID linkage. The raw compound columns are hidden by default and available via the column manager. Slot columns support sorting, filtering, and CSV export like regular columns, and surface their source field's validation errors. Arrays with more than one element show a "+N" chip — open the record's detail panel for the full list
- **Name/Value Pair columns** — handlingInstructions, bidRelativePrice, and askRelativePrice show as a summary column in spec CSV notation (e.g. `ALG|DISQ=100|DLVT=MM1@MM2`), identical for JSON and CSV files. Each attribute also gets its own column (e.g. `handlingInstructions.ALG`), hidden by default and available via the column manager for sorting and filtering. Attribute columns are collected from every record, so no attribute is missed when records of the same event type carry different instructions. The detail panel's Original view shows the value as reported
- **Clickable linkage fields** — navigate between related records via orderID, tradeID, fulfillmentID/priorFulfillmentID, allocationID/priorAllocationID, quoteID/routedQuoteID/receivedQuoteID, RFQID, parentOrderID, priorOrderID, etc.; clicking clears other active filters. Orders are identified by their full CAT Order Key (orderKeyDate, CATReporterIMID, symbol/optionID, orderID), so an orderID reused on another day, for another symbol, or by another reporter is a separate order. When that happens the orders get qualified names such as `ORD1 (2025-03-18)` in order chains and timeline lanes; orderIDs used by only one order look exactly as before. routedOrderID (and priorRoutedOrderID) links to the other side of the route: the sender's route and the receiver's accepted order. Events without a top-level orderID (Order Trade and Order Fulfillment events like MEOT/MEOF) are linked to orders via the orderIDs inside their side details (buyDetails/sellDetails/clientDetails/firmDetails). Nested orderID linkage works for any compound array field on any event type (side details plus aggregatedOrders/askAggregatedOrders/bidAggregatedOrders), so orderID links, the orderID filter, free-text search, and order chain views all include these events — filtering by an order ID also shows the trades/fulfillments that reference it in their side details, and the orderID filter dropdown lists orderIDs that appear only inside compound arrays
- **Order chain view** — hierarchy tree showing parent/child order relationships with depth controls (This order, + Children, + Branch); buttons toggle off when clicked again; + Children shows all descendants; Branch shows direct ancestor chain plus descendants, excluding siblings; when events share a timestamp, order-origination events (MENO/MEOA/MECO/MEIR and options/multi-leg equivalents) list first, then their supplements (MENOS/MONOS/MLOS), then other events
- **URL deep linking** — hash-based URL state with direct links to selected records
- **Multi-file support** — load multiple files (JSON, CSV, BZip2, ZIP, GZIP) via drag-and-drop or file picker; hold Shift to append. Files load one at a time in the order given, and CSV and JSON files can be mixed (each record is validated against its own format)
- **File validation** — verifies files are CAT format before loading; files of Delete instructions (DEL records, which carry no event type) are accepted
- **Tools menu** — keyboard-accessible dropdown with layout export/import for sharing between users/machines, drag-and-drop layout reordering, validation toggle, and performance panel toggle
- **Virtual scrolling** — efficiently renders large datasets by only drawing visible rows; sub-pixel-accurate column width measurement ensures columns are never clipped
- **Timeline visualization** — canvas-based interactive timeline showing order events as color-coded dots in hierarchical swimlanes:
  - Parent-child order hierarchy with connector lines and collapse/expand controls
  - Prior order chain merging — orders linked via priorOrderID share a single swimlane with diamond markers at orderID transitions
  - Trade and fulfillment events (MEOT/MEOF and variants) appear on the lane(s) of the order(s) referenced in their side details — an event referencing both a buy and sell order shows on both lanes
  - Adaptive time axis from nanosecond to decade granularity with date pills at midnight boundaries
  - Kinetic scrolling with momentum, Ctrl/Cmd+wheel zoom, pinch-to-zoom on touch devices
  - Fit-all button to reset zoom and scroll; highlighted when zoomed/panned away from home
  - Heatmap scrollbars showing color-coded event density
  - Validation badges on event dots — red triangle with "!" for errors, amber for warnings — drawn at the top-left of each dot (matches the Records tab row indicator), with error/warning counts shown in the hover tooltip
  - Selection highlighting across lane, time crosshair, and scrollbar markers; integrates with the record detail panel
  - Cross-tab selection sync: selecting in Records scrolls the timeline to that event; selecting in the timeline updates the Records page and scroll position (smooth animated transitions)
- **Corrections** — COR and RPR records replace the record reported with the same firmROEID, and DEL instructions remove it. Replaced and deleted records are dimmed with a marker in the Records tab, and the detail panel links each record to the one that replaces, is replaced by, or deletes it. **Tools → Apply Corrections** hides them to show the audit trail as CAT will build it. The summary cards count corrections applied and any that match no loaded record
- **Cross-record checks** — once field validation finishes, the records in effect after corrections are checked against each other, using CAT's linkage error codes:
  - duplicate firmROEIDs (3002)
  - Order/Trade/Fulfillment/Quote/Allocation Keys assigned more than once (3004/3010/3012/3016/3020)
  - events referencing a key that no loaded event assigned (3501), and side details or aggregated orders referencing unknown orders (3502–3504); these are warnings, since the originating event may be in another file
  - events earlier than the event that assigned their key, beyond the 50 ms clock-drift allowance (1 second for manual events) (3601)
  - supplements whose eventTimestamp differs from their event at millisecond precision (3602)
  - firmDesignatedID 'PENDING' with no supplement supplying the real FDID (3711)
- **Event Summary tab** — counts by event type and action type
- **Raw Data tab** — parsed JSON view of loaded records
- **CSV export** — download filtered results (visible columns, RFC 4180 quoting with CRLF line endings). Compound arrays are written in CAT's CSV notation (`|` between elements, `@` between fields), name/value pairs as `DAY=20250317`, and numbers with every digit and no exponent notation. Cells a spreadsheet would treat as formulas (starting `=`, `+`, `-`, `@`) get a leading `'`, except plain numbers
- **Schema validation** — field-level validation against the CAT spec (togglable via Tools menu, enabled by default) with cell highlighting, error tooltips, detail panel badges, validation summary stats, "Errors Only" filter, error code filter, and per-error ignore/dismiss with managed ignored errors list. Deep validation of compound array fields (legDetails, buyDetails, sellDetails, aggregatedOrders, clientDetails, firmDetails), timeInForce name/value pairs (boolean vs non-boolean types), handlingInstructions attributes, and bidRelativePrice/askRelativePrice NVP attributes. Errors in nested fields are highlighted at the cell level within detail panel tables. CAT error codes from Table 177 (Data Ingestion Errors) shown in tooltips and badges (e.g., [2026], [2143]). ~65 cross-field and format validations including firmROEID format/date match, eventTimestamp precision and component validation, trade side detail mutual exclusions, BFMMFlag combinations, fulfillmentLinkType/firmDetails rules, representativeInd/aggregatedOrders logic, IMID format checks, quantity non-negativity, record max length (8190-byte lines, 2132), electronicTimestamp only on manual events (2144), absent JSON Booleans read as false, case-insensitive CSV Booleans, required fields checked on COR/RPR restatements, Delete instructions validated against Table 165, Eastern Time event dates for epoch timestamps (2033), nanosecond epoch timestamps, product-specific side/destinationType/senderType values (equity B/SL/SS/SX vs option B/S), representativeQuoteInd combinations (2237/2243/2244/2246), CSV compound array elements, MLOS supplement field combinations (2271), MLQS supplement field combinations (2272), destination Exchange ID validation (2019), exchOriginCode/destinationType bidirectional (2028), price required for LMT orders (2067), RFQID/RFQFlag bidirectional (2257), NBBO field requirements (2048/2049/2051), openCloseIndicator/optionID (2057), DVPCustodianID/allocationType (2179), and more.
- **Multi-level undo/redo** for filter and column operations

## Sample Data

- `1234_TEST_20250317_Sample_OrderEvents_000001.json` — 84 records covering MEAA, MECO, MEFA, MEIM, MEIR, MENO, MENOS, MEOA, MEOC, MEOF, MEOFS, MEOM, MEOR, MEOT, MLNO, MLOR, MOCO, MONO, MOOF, and MOOT events, including equity and options fulfillment scenarios, a trade with side details that demonstrate order linkage in timelines and order chains, and same-timestamp event groups (in scrambled file order) that demonstrate origination-first ordering in the order chain view, and handlingInstructions that vary between records of the same event type. Records follow the spec rules the validator checks (equity sells use SL, option sells use S, electronicTimestamp appears only on manual events)

## Testing

Run the test suite with Node.js (v18+, no dependencies):

```
node --test tests/
```

`tests/export.test.js` covers CSV export cell formatting.

`tests/linkage.test.js` covers Order Key identity (orderID reuse across days, symbols and times; epoch vs string key dates; parent/prior resolution), corrections (COR/RPR/DEL), and the cross-record checks.

`tests/ingestion.test.js` covers lossless JSON numbers, skipped-line reporting, bzip2 decoding and ZIP reading (fixtures in `tests/fixtures` were written by Python's `bz2` and `zipfile`), and exact sort/range comparisons.

`tests/spec-tables.test.js` checks the embedded spec tables against the official JSON schema files (`03.18.26-IM-4.1.0-r15.json` and `08.14.26-IM-4.2.0.json` in the repository root, from the [CAT IM specifications page](https://www.catnmsplan.com/specifications/im)); those tests are skipped if the files are missing.

When CAT publishes a new schema file, add it to the repository root and regenerate the spec deltas embedded in `index.html`:

```
node tools/gen-spec.js 03.18.26-IM-4.1.0-r15.json 08.14.26-IM-4.2.0.json [new-schema.json] --write
```

Then add the new version and its effective date to `CAT_SPEC_VERSIONS` in `index.html`.

Tests cover the order chain event ordering logic (origination events and their supplements sort ahead of other events sharing a timestamp, with ET string and epoch-nanosecond timestamps compared exactly), field-level validation against the spec (spec version chosen by event date, fields and event types removed in v4.2.0, retired error codes, Booleans, action types including DEL, timestamps, product-specific choice values, representativeQuoteInd, error codes, CSV compound fields), Name/Value Pair parsing and column discovery (handlingInstructions, bid/askRelativePrice), and sample data integrity, extracting the code under test directly from `index.html`.

## Reference

Based on the [CAT Reporting Technical Specifications for Industry Members v4.1.0 r15](https://www.catnmsplan.com/sites/default/files/2026-03/03.06.26_CAT_Reporting_Technical_Specifications_for_Industry_Members_v4.1.0r15_CLEAN.pdf). See also: [CAT Reference Data](https://catnmsplan.com/reference-data).

## License

[GPL-2.0](LICENSE)
