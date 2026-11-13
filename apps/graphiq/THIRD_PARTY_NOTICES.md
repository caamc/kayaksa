# Kayak GraphIQ: third-party notices

Kayak GraphIQ's own code (the Worker in `apps/graphiq/src`, the browser app in `apps/graphiq/public/assets`, the analysis engine and exhibit chart library in `packages/graphiq-engine`, and the GraphIQ logo) is original work of Kayak Strategic Advisors Private Limited. No source code was copied from the open-source or commercial CDR tools used to benchmark features (cellyzer, SpatialDataCommons CDR-analysis-tools-std and -hadoop, CDR-Analysis by vivekvedant, Milan-CDR-Data-Analysis, c-trace-download, C5 CDR Analyzer, IBM i2); only their published feature lists were read.

GraphIQ uses the following libraries unmodified, under their own licences. The browser copies are served from GraphIQ's own origin (built by `scripts/build-graphiq.mjs` from `node_modules`), and their full licence texts are published at `/vendor/LICENSES.txt`.

| Library | Version | Licence | Copyright | Used for |
|---|---|---|---|---|
| Cytoscape.js | 3.35.0 | MIT | The Cytoscape Consortium | Interactive link chart |
| Leaflet | 1.9.4 | BSD-2-Clause | Volodymyr Agafonkin | Map |
| pdf.js (pdfjs-dist) | 6.5.438 | Apache-2.0 | Mozilla Foundation | Reading text from PDF files |
| jsPDF | 3.0.3 | MIT | James Hall, yWorks GmbH (and the bundled components listed in its licence) | PDF reports |
| svg2pdf.js | 2.6.0 | MIT | yWorks GmbH | Charts as vector graphics in PDF reports |
| Hono | 4.12.9 | MIT | Yusuke Wada | Worker routing (shared with the other Kayak apps) |
| esbuild | 0.28.2 | MIT | Evan Wallace | Bundling the engine for the browser (build time only) |
| Archivo and Source Serif 4 fonts | - | SIL Open Font License 1.1 | Their authors (see `packages/brand/fonts/OFL-*.txt`) | Kayak typography |

Map data and tiles: © OpenStreetMap contributors, available under the Open Database License (ODbL). The attribution is shown on every map. The public tile servers (tile.openstreetmap.org) are used under the OpenStreetMap Foundation's tile usage policy; heavy use or on-premise deployments should use their own tile server or a licensed provider.

SheetJS was considered for spreadsheets but is not used: its current releases are distributed outside the npm registry, which this build cannot reach, and the last npm release (0.18.5) has known security advisories. GraphIQ reads and writes XLSX with its own code (`packages/graphiq-engine/src/xlsx.ts`) using the platform's built-in compression streams.

Reference data in `packages/graphiq-engine/src/reference.ts` (country calling codes, major Indian STD codes, indicative Indian MCC/MNC codes and a sample of mobile number series) was compiled by Kayak from public numbering information; it is indicative and must be checked against current official lists.
