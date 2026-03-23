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
- Column manager to show/hide/reorder columns, with layout persistence
- Sticky header that stays visible while scrolling
- Dynamic searchable filters with collapsible comboboxes, range support, and layout persistence
- Filters by event type, action type (NEW/RPR/COR/DEL), side, and free-text search
- Color-coded event type badges (order/route/trade/cancel/modify/quote/allocation)
- Fixed, resizable record detail panel at bottom of viewport with animated slide-up/down transitions and translated/original view modes
- Translated display for timestamps (both string format and epoch nanoseconds → Eastern Time), dates, side codes, compound fields (legDetails, buyDetails, sellDetails)
- Clickable linkage fields (orderID, tradeID, parentOrderID, priorOrderID, etc.) for navigating between related records
- Order chain view with hierarchy tree
- URL hash state with deep linking to selected records
- Tools dropdown menu (keyboard shortcut accessible) with layout export/import, drag-and-drop layout reordering, and validation toggle
- Event Summary tab with counts broken down by action type
- Raw Data tab showing parsed JSON
- CSV export of filtered results
- Multi-level undo/redo for filter and column operations
- Field-level validation against CAT schema spec (v4.1.0 r15), togglable via Tools menu (enabled by default), with cell highlighting, error tooltips, detail panel badges, validation summary stats, and "Errors Only" filter toggle. Deep validation of compound array fields (legDetails, buyDetails, sellDetails, aggregatedOrders, clientDetails, firmDetails), timeInForce name/value pairs (boolean vs non-boolean types), and handlingInstructions attributes. Nested field errors highlighted at cell level in detail panel tables. CAT error codes from Table 177 (Data Ingestion Errors) displayed in tooltips and badges (e.g., [2026], [2143]). Cross-field validations include: errorROEID/actionType (2026), firmROEID format and date match (2032/2033), eventTimestamp precision vs manualFlag (2027), leavesQty<=quantity (2040), sideDetailsInd/buyDetails/sellDetails (2108/2115), electronicDupFlag/manualFlag (2143/2144), senderIMID!=destination/receiverIMID (2189), orderID self-reference checks (2190/2191), price/netPrice exclusivity (2226), CASH quantity (2247), side detail array limits (2273-2276), and more.

### CAT file format notes
- **JSON files**: NDJSON (one JSON object per line) or a JSON array. Each record has a `type` field (e.g., `MENO`, `MEOR`, `MEOT`) and `actionType` (`NEW`, `RPR`, `COR`, `DEL`).
- **CSV files**: Positional fields with no header row. Field position 4 (0-indexed 3) is always `type`. The viewer maps all 99 event types (39 equity ME, 35 options MO, 25 multi-leg ML) to named fields per the spec, with each type having its own distinct field schema.
- **ZIP/GZIP**: ZIP archives containing JSON or CSV files; GZIP-compressed files (`.json.gz`, `.csv.gz`). Both decompressed in-browser.
- Event type prefixes: `ME` = equity, `MO` = option, `ML` = multi-leg

### Sample data
- `1234_TEST_20250317_Sample_OrderEvents_000001.json` — 68 records covering MEAA, MECO, MEIM, MEIR, MENO, MEOA, MEOM, MEOR, MEOT, MLNO, MLOR, MOCO, MOOT events

### Versioning
Version is automatically set by a git pre-commit hook (`.git/hooks/pre-commit`). Format: `vYYYY.MM.DD`. Do not manually set version numbers in `index.html`.
