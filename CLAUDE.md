# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This repository is for work related to **CAT (Consolidated Audit Trail) reporting** for Industry Members, based on the FINRA CAT Technical Specifications v4.1.0 r15 (dated 3/6/2026).

## Reference Specification

The primary reference document is:
- `03.06.26_CAT_Reporting_Technical_Specifications_for_Industry_Members_v4.1.0r15_CLEAN.pdf`

This ~63,000-line PDF covers:
- **CAT Reporting Fundamentals**: Order IDs, timestamps, order handling instructions, Firm ROE IDs, FDIDs, equity/option symbols, data types, and linkage rules
- **Special Reporting Requirements**: ATS reporting, manual orders, allocation events, RFQ responses, representative orders, combined orders, multi-leg orders, and more
- **Event specifications**: Detailed schemas for order lifecycle events (New Order, Route, Trade, Cancel, etc.) for both equities and options
- **File submission**: JSON file formats, connectivity (SFTP/AWS S3), feedback and error correction processes
- **Industry Member identifiers (IMIDs)** and **Firm Designated IDs (FDIDs)** are central concepts

When working with this spec, use `pdftotext` to extract relevant sections rather than reading the entire document.

## CAT File Viewer (`index.html`)

A single-file web application for compliance officers to inspect CAT data files. No build step required — open `index.html` directly in a browser.

### Key features
- Drag-and-drop or file picker for JSON (NDJSON) and CSV format CAT files
- Auto-detects format from extension and content
- Sortable, paginated record table with priority column ordering
- Filters by event type, action type (NEW/RPR/COR/DEL), side, and free-text search
- Color-coded event type badges (order/route/trade/cancel/modify/quote/allocation)
- Record detail panel on row click showing all fields
- Event Summary tab with counts broken down by action type
- Raw Data tab showing parsed JSON
- CSV export of filtered results

### CAT file format notes
- **JSON files**: NDJSON (one JSON object per line) or a JSON array. Each record has a `type` field (e.g., `MENO`, `MEOR`, `MEOT`) and `actionType` (`NEW`, `RPR`, `COR`, `DEL`).
- **CSV files**: Positional fields with no header row. Field position 4 (0-indexed 3) is always `type`. The viewer maps all 99 event types (39 equity ME, 35 options MO, 25 multi-leg ML) to named fields per the spec, with each type having its own distinct field schema validated against `03.18.26-IM-4.1.0-r15.json`.
- Event type prefixes: `ME` = equity, `MO` = option, `ML` = multi-leg

### Sample data
- `sample_data.json` — 15 records covering MENO, MEOR, MEOT, MEOM, MECO, MENQ events
- `sample_data.csv` — 6 records (MENO, MEOR) in CSV positional format

### Versioning
Version is automatically set by a git pre-commit hook (`.git/hooks/pre-commit`). Format: `vYYYY.MM.DD` with a letter suffix (`a`, `b`, ...) for multiple commits on the same day. Do not manually set version numbers in `index.html`.
