# Kayak GraphIQ: roadmap and feature status

Kayak GraphIQ (graphiq.kayaksa.com) analyses and visualises call detail records (CDRs) that were obtained lawfully. This page maps the requested features (about 600 names, grouped) to what exists today. **Built** means working and covered by tests (`npm test`, `tests/e2e/graphiq.mjs`). **Partly** means it works within the stated limits. **Planned** means it is not built; the app never presents it as working. The same list is shown on the app's About page (`apps/graphiq/public/assets/features.js` is the source).

Counts today: 81 built, 8 partly built, 17 planned.

## Phase 1 (this release)

Import, standardisation, cases with the legal gate and four-eyes approval, analytics, visualisation (including the Kayak exhibit chart library), search, reports, offline reference data and Kayak AI assist, as listed below.

### Kayak exhibit chart library (Built)

A reusable SVG module (`packages/graphiq-engine/src/charts.ts`, exhibits in `story.ts`) in Kayak's exhibit style: deep teal ground (#0E2F3C), slate panels (#3E5563), series teal #3FB0A9, blue #6E9FD3, olive #9AAE5C, mint #CFE8E3, one saffron (#EE9B1E) highlight, coral (#E2735F) for negatives, an upper-case "EXHIBIT n" eyebrow, an action title computed from the statistics (never written by hand or by AI), data labels on the marks, light gridlines, a "Source:" line and the note "Analytical output - requires human verification." Every chart has a light-theme version, hover and focus tooltips, click-to-drill (the mark carries a search filter), keyboard focus, and SVG and PNG export; charts are placed in PDF (as vector graphics) and HTML reports. A gallery page with synthetic data shows them all.

| # | Chart | Used for |
|---|---|---|
| 1 | Blade bars (angled ends, one saffron highlight) | Top contacts, top cells, top IMEIs |
| 2 | Columns with reference line and callout | Daily volume against the average, peak day called out |
| 3 | Combo bar and line | Records per day and average call length |
| 4 | Grouped bars | Incoming and outgoing per contact |
| 5 | Stacked and 100% stacked bars | Call types (voice, SMS, data, missed) by month |
| 6 | Diverging bars | In and out balance per contact |
| 7 | Waterfall / bridge | Contacts before and after a date: new, lost, net |
| 8 | Marimekko | Cell share by time band |
| 9 | Treemap | Share of records by contact |
| 10 | Funnel | Rows received, valid, after duplicates, in scope, flagged |
| 11 | Dumbbell | Per contact, before and after an event date |
| 12 | Slopegraph | Contact rank, period A against period B |
| 13 | Bullet charts and progress bars | Night, weekend and after-hours shares against thresholds; review progress |
| 14 | Waffle 10 x 10 | Share of activity at night |
| 15 | Bubble quadrant | Frequency against talk time per contact, bubble = active days, named quadrants |
| 16 | Heat-map grid and risk matrix | Hour by weekday; contact prioritisation (indicative, from computed signals) |
| 17 | Gantt with today line and milestones | Device usage periods per IMEI; subscriber activity spans |
| 18 | Milestone timeline | Case chronology (first record, peak day, handset change, possible meeting, silence) |
| 19 | Chevron process with % complete | Case workflow Import, Validate, Analyse, Review, Report |
| 20 | Cycle and chain wheel | Investigation cycle; chain of custody |
| 21 | Pyramid | Evidence strength layers |
| 22 | Harvey-ball matrix | Data coverage per target (CDR, SDR, IPDR, tower, IMEI) |
| 23 | Eight metric cards | Value, value with delta, sparkline, progress to target, against benchmark, mini bars with latest highlighted, alert with a red tag, dark card |
| 24 | Scorecard table | Per-target status dots and trend arrows |
| 25 | Financial-style table | Per-number summary, highlighted row, bracketed negatives, totals |
| 26 | Sankey, chord, line and donut | Call flow, who talks to whom, recent activity, record types |

The link chart (Cytoscape.js) and the map (Leaflet with OpenStreetMap) complete the visual set.

## Feature status by group

### Import and file formats

| Feature | Status | Notes |
|---|---|---|
| Bulk upload of several files at once | Built |  |
| CSV and other delimited text (comma, tab, pipe, semicolon) | Built |  |
| TXT reports with aligned columns | Built |  |
| XLSX workbooks (read and written by GraphIQ's own code) | Built |  |
| Legacy XLS (Excel 97-2003) | Planned | Save as XLSX or CSV first; GraphIQ explains this when such a file is dropped. |
| JSON exports | Built |  |
| XML exports | Built |  |
| HTML tables from operator portals | Built |  |
| PDF tables (text-based PDFs, with pdf.js) | Partly | Works for PDFs with a text layer and simple tables; scanned PDFs need OCR, which is planned. |
| Automatic layout recognition with header synonyms (A/B party, calling/called, date, time, duration, call type, IMEI, IMSI, cell ID/CGI, LAC, latitude/longitude, roaming, operator) | Built |  |
| Airtel-, Jio-, Vi- and BSNL-style layouts and generic layouts | Built | Layout names are a guide; operators change formats, so the mapping is always shown for checking. |
| Title blocks, repeated header rows and files without a header row | Built |  |
| Custom column mapping saved as templates, applied automatically to matching files | Built |  |
| Tower master import (cell ID/CGI, latitude, longitude, address, azimuth) | Built |  |
| Tower dump files (records of many numbers at given cells) | Built |  |
| Encrypted case export and import (.gqcase) | Built |  |
| ZIP archives of many files | Planned |  |
| SDR / CAF subscriber details import | Planned |  |
| IPDR (IP detail records) analysis | Planned | Data sessions in CDRs are imported as DATA records. |
| Direct ingestion from operator portals or e-mail | Planned |  |

### Standardisation and data quality

| Feature | Status | Notes |
|---|---|---|
| MSISDN normalisation (+91, leading zeros, 0091, spreadsheet number formats, short codes, SMS sender IDs) | Built |  |
| International numbers and country codes | Built |  |
| Configurable date order and time zone; dates stored in UTC and shown in the case time zone | Built |  |
| Excel serial dates and times | Built |  |
| Durations in seconds, hh:mm:ss, mm:ss or words; duration from end time | Built |  |
| Call type normalisation (outgoing, incoming, SMS sent/received, missed, data, other) | Built |  |
| Calling/called files: target always placed as A party | Built |  |
| Duplicate detection within and across files and against records already in the case | Built |  |
| Invalid and missing value report with row numbers | Built |  |
| Validation summary before anything is stored | Built |  |
| IMEI check digit (Luhn) and restoration of a dropped check digit | Built |  |
| Merge of several files into one case | Built |  |
| Split by target or month | Partly | Available in the engine and through search filters and per-number reports; a one-click split export is planned. |
| Removing an import (undo a load) | Built |  |

### Cases, legal gate and governance

| Feature | Status | Notes |
|---|---|---|
| Case creation requires legal basis, reference number and date, issuing authority and approving supervisor | Built |  |
| Lawful-use notice (Telecommunications Act 2023, IT Act 2000, BNSS 2023, DPDP Act 2023) acknowledged on creation | Built |  |
| Four-eyes approval: import blocked until a different user with the Approver role approves | Built |  |
| Roles: Admin, Approver, Analyst, Viewer | Built |  |
| People see only the cases they are assigned to | Built |  |
| Single sign-on from Kayak Internal (password and two-factor) | Built |  |
| Accounts for agency users outside Kayak | Planned | On-premise deployments would connect their own identity provider. |
| Case notes; manual OSINT notes for material already lawfully held, with its source | Built |  |
| No data-broker look-ups or social-media scraping | Built | By design: there is no such feature. |
| Bookmarks and evidence tags on records and numbers | Built |  |
| Black and white watchlists per case | Built |  |
| Tamper-evident audit log (SHA-256 hash chain) of every view, search, import and export, with a Verify button | Built |  |
| Evidence files: SHA-256 checked in the browser and on the server, AES-256-GCM encryption with a key for each case, chain of custody, integrity check | Built |  |
| Evidence files above 40 MB | Planned | Needs chunked encryption; split large files for now. |
| Retention date per case, daily flagging of overdue cases | Built |  |
| Secure deletion of records, notes and evidence objects, keeping a tombstone and the audit record | Built |  |
| Crypto-shredding (destroying a case key) | Planned |  |
| Backup and restore of one case (encrypted export) | Built |  |
| Whole-database backup | Partly | Cloudflare D1 Time Travel restores the database to a point in time; a GraphIQ-level full backup is planned. |

### Analytics

| Feature | Status | Notes |
|---|---|---|
| Per-number summary: calls and SMS in and out, total, average, shortest and longest duration, unique contacts, most and least contacted, in/out ratio | Built |  |
| First and last record overall and of each day | Built |  |
| Hourly, daily, weekly and monthly patterns; day and night; weekend; business hours; peak hours | Built |  |
| Short calls, one-way contact, repeated calls in a short window | Built |  |
| Overlapping calls (possible conference or call waiting) | Built |  |
| Circular communication (A to B to C to A in a time window) | Built |  |
| New numbers in a period; silent periods | Built |  |
| Numbers common to several targets; common numbers across cases (search all cases) | Built |  |
| Target-to-target contact | Built |  |
| IMEI: one IMEI with many SIMs, one SIM in many handsets, device-change timeline, TAC | Built |  |
| TAC to handset make and model | Planned | Needs the licensed GSMA TAC database. |
| IMSI-MSISDN-IMEI mapping; network from IMSI (MCC/MNC) | Built |  |
| Tower analysis: most used cells, likely day and night location, first and last cell of the day, movements between cells | Built |  |
| Possible meeting points: two numbers at the same cell, or the same mast across operators with a tower master, within a time window | Built |  |
| Roaming and international (ISD) calls by country | Built |  |
| Watchlist hits | Built |  |
| Anomalies: daily volume z-score and rarely used night hours | Built |  |
| Tower dump analysis: numbers seen at several towers, files or time windows | Built |  |
| Contact prioritisation matrix from computed signals (indicative) | Built |  |
| Stay points, trips and home/work inference beyond most-used cells | Planned |  |
| SIM-swap detection by matching contact patterns of old and new numbers | Planned |  |

### Visualisation

| Feature | Status | Notes |
|---|---|---|
| Interactive link chart: filter, expand, search, degree, betweenness and closeness, Louvain communities, PNG export | Built |  |
| Kayak exhibit chart library: 33 chart types in Kayak's exhibit style with action titles computed from the data, tooltips, click-to-drill, keyboard focus, SVG and PNG export, light and dark themes | Built |  |
| Timeline of records by type | Built |  |
| Hour-by-weekday heat map | Built |  |
| Bar, line, donut, Sankey call flow and chord charts | Built |  |
| Map of cells and movement on OpenStreetMap (attribution shown) with a tower master or coordinates in the records | Built |  |
| KML export for Google Earth | Built |  |
| Cell coverage areas (sectors, Voronoi) | Planned |  |
| Animated movement playback | Planned |  |

### Search

| Feature | Status | Notes |
|---|---|---|
| Search within a case by number, date and time range, time of day, duration, call type, IMEI, IMSI, cell and weekday | Built |  |
| Bulk multi-number search | Built |  |
| Search across all cases you are assigned to | Built |  |
| Saved filters | Built |  |
| Drill-down from any chart mark to the records behind it | Built |  |
| Fuzzy and pattern search on numbers | Planned |  |

### Reports

| Feature | Status | Notes |
|---|---|---|
| One-click reports: summary, frequency, common numbers, IMEI, tower and location, timeline, meeting points | Built |  |
| Export to PDF (with charts), XLSX, CSV, JSON and HTML | Built |  |
| Every report states it is analytical output that needs human verification | Built |  |
| Search results to CSV and XLSX (up to 1,000 rows at a time) | Built |  |
| Word (DOCX) reports and a custom report builder | Planned |  |
| Section 63 (Bharatiya Sakshya Adhiniyam 2023) certificate template | Planned |  |

### Reference data (offline)

| Feature | Status | Notes |
|---|---|---|
| International (ISD) codes | Built |  |
| Major Indian STD codes | Partly | About 80 major cities. |
| Indian MCC/MNC codes | Partly | Indicative list; check against the current ITU-T E.212 list. |
| Indian mobile series to original operator and circle | Partly | A sample table; mobile number portability means the current operator may differ. Loading the full numbering plan is planned. |

### Kayak AI assist

| Feature | Status | Notes |
|---|---|---|
| Plain-English question to a search filter (shown for checking before it runs; rule-based reading when AI is unavailable) | Built |  |
| Draft case summary from computed statistics only, labelled AI-assisted, verify before use | Built |  |

### Platform

| Feature | Status | Notes |
|---|---|---|
| Analysis engine in pure TypeScript that runs in the Worker, in a browser Web Worker and in Node | Built |  |
| Large files parsed in the browser in a Web Worker and stored in batches | Built |  |
| Records in batches per case with a shard setting for one D1 database per large case | Partly | The shard switch exists; creating extra databases is a manual step today. |
| On-premise licensing for agencies | Partly | See the on-premise guide: the engine runs anywhere; a packaged server is planned. |
| Mobile app | Planned |  |

## Next phases (proposed order)

1. **Scale and packaging**: chunked evidence encryption for files above 40 MB; server-side aggregates for cases above about 500,000 records; automatic creation of a D1 database per very large case (the shard switch exists); a packaged on-premise server (see `docs/graphiq-on-premise.md`).
2. **More data types**: SDR/CAF subscriber details, IPDR sessions, ZIP archives, legacy XLS, OCR for scanned PDFs, the full DoT/TRAI numbering plan as reference data, licensed GSMA TAC look-up.
3. **Deeper analytics**: stay points and trips, home and work inference, SIM-swap detection, coverage sectors on the map, movement playback.
4. **Reporting**: Word reports, a report builder and a Section 63 (Bharatiya Sakshya Adhiniyam 2023) certificate template for the original records.
5. **Access for agencies**: accounts for agency users through their own identity provider; IP allow-lists; crypto-shredding of case keys.

Anything that would look people up in data brokers, scrape social media, or identify people is out of scope by design.
