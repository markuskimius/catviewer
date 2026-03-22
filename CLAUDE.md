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
- Drag-and-drop or file picker for JSON (NDJSON), CSV, and ZIP format CAT files (multiple files supported; hold Shift to append)
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
- Tools dropdown menu (keyboard shortcut accessible) with layout export/import and drag-and-drop layout reordering
- Event Summary tab with counts broken down by action type
- Raw Data tab showing parsed JSON
- CSV export of filtered results
- Field-level validation against CAT schema spec (v4.1.0 r15) with cell highlighting, error tooltips, detail panel badges, validation summary stats, and "Errors Only" filter toggle. Deep validation of compound array fields (legDetails, buyDetails, sellDetails, aggregatedOrders, clientDetails, firmDetails), timeInForce name/value pairs (boolean vs non-boolean types), and handlingInstructions attributes.

### CAT file format notes
- **JSON files**: NDJSON (one JSON object per line) or a JSON array. Each record has a `type` field (e.g., `MENO`, `MEOR`, `MEOT`) and `actionType` (`NEW`, `RPR`, `COR`, `DEL`).
- **CSV files**: Positional fields with no header row. Field position 4 (0-indexed 3) is always `type`. The viewer maps all 99 event types (39 equity ME, 35 options MO, 25 multi-leg ML) to named fields per the spec, with each type having its own distinct field schema.
- Event type prefixes: `ME` = equity, `MO` = option, `ML` = multi-leg

### Sample data
- `sample_data.json` — 15 records covering MENO, MEOR, MEOT, MEOM, MECO, MENQ events
- `sample_data.csv` — 6 records (MENO, MEOR) in CSV positional format

### Versioning
Version is automatically set by a git pre-commit hook (`.git/hooks/pre-commit`). Format: `vYYYY.MM.DD`. Do not manually set version numbers in `index.html`.
