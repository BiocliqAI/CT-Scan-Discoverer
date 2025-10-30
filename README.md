<div align="center">
  <img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# CT Scan Discoverer

CT Scan Discoverer helps identify diagnostic centers across India that offer CT scanning services. Districts and pincodes originate from CSV files, while discovery runs through Google’s Gemini 2.5 Pro with Search and Maps grounding. The UI groups districts by state, tracks real-time scan status, and stores progress locally so you can resume or enrich results later.

## Table of Contents

- [Features](#features)
- [Architecture Overview](#architecture-overview)
- [Prerequisites](#prerequisites)
- [Getting Started](#getting-started)
- [Environment Configuration](#environment-configuration)
- [Using the App](#using-the-app)
  - [Discovering Centers](#discovering-centers)
  - [Adding Additional Data](#adding-additional-data)
  - [Monitoring Gemini Calls](#monitoring-gemini-calls)
  - [Resetting Stored Data](#resetting-stored-data)
- [Project Structure](#project-structure)
- [Development Notes](#development-notes)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)

## Features

- **CSV-driven dataset** — Load Indian districts, pincodes, and population figures from the bundled `Selected_centers.csv`.
- **State grouping UI** — Browse districts per state, expand tiles, and review scan progress and results.
- **Gemini-backed discovery** — Invoke Gemini 2.5 Pro with Google Search/Maps grounding to surface CT centers near a pincode.
- **Resumable runs** — Persist discovery state to `localStorage` so the latest status survives refreshes and new sessions.
- **Manual retries** — Retry failed pincodes individually; stop and resume running scans.
- **Telemetry logging** — Inspect each Gemini grounding and extraction call (prompt size, response size, latency, outcome).
- **Incremental data ingestion** — Upload additional CSV files and merge them into existing states without wiping current progress.

## Architecture Overview

- **React + TypeScript + Vite** for the SPA shell.
- **City grouping** stored in React state and synchronized to browser `localStorage` (`ctScanDiscovererData` key).
- **Gemini service** (`services/geminiService.ts`) orchestrates the two-step Gemini calls (grounding + extraction) and logs telemetry.
- **Domain types** live in `types.ts` to maintain type safety across components and services.
- **Tailwind-style utility classes** for quickly styling the interface.

## Prerequisites

- Node.js 18 or later.
- A Gemini API key with access to the Gemini 2.5 Pro model and Search/Maps grounding.
- (Optional) CSV files that follow the schema of `Selected_centers.csv` for additional data ingestion.

## Getting Started

```bash
# Install dependencies
npm install

# Run the dev server with hot reload
npm run dev
```

The Vite dev server prints a local URL (e.g., `http://localhost:5173`). Open it in your browser to start exploring.

To produce a production build:

```bash
npm run build
```

## Environment Configuration

1. Duplicate `.env.example` to `.env.local` (or create `.env.local` manually).
2. Set the environment variable expected by the app:

   ```env
   VITE_API_KEY=your_gemini_api_key
   ```

   When running locally through Vite, variables prefixed with `VITE_` are exposed to the browser. If you were supplied with an environment reference using `GEMINI_API_KEY`, rename it to `VITE_API_KEY`.

3. Restart the dev server after updating environment variables.

## Using the App

### Discovering Centers

1. Expand a state and pick a district tile.
2. Click **Discover Now** (or **Resume** / **Discover Again**) to start scanning pincodes. Two pincodes run concurrently to balance speed with API limits.
3. The progress bar, status messaging, and pincode badges update as Gemini returns results.
4. Inspect the “View Found Centers” drawer for detailed addresses, contacts, associated doctors, and reasoning. Download results as CSV if needed.

### Adding Additional Data

- Click **Add Additional Data**.
- Choose a CSV file following the same schema (`statename`, `district`, `pincode`, `population`, …).
- The app parses the file, merges districts into existing states (or creates new states), and adds previously unseen pincodes while preserving your current discovery status.

### Monitoring Gemini Calls

- Open your browser DevTools Console (`Cmd+Option+I` on macOS Chrome; `Ctrl+Shift+I` on Windows/Linux).
- Each Omni call prints a log like:

  ```
  [Gemini][grounding] SUCCESS for 600001 in 5423.4ms (prompt 412, response 2987)
  ```

- Programmatically inspect the buffered telemetry from the console:

  ```js
  getGeminiTelemetry();  // returns an array of telemetry objects
  clearGeminiTelemetry(); // resets the buffer
  ```

This makes it easy to spot slow or throttled requests when a discovery appears to stall.

### Resetting Stored Data

- Click **Reset & Reload Data** to purge `localStorage` and reload the default CSV data fresh from disk.
- Useful when you want to restart a discovery from scratch or test new datasets.

## Project Structure

```
.
├── App.tsx                # Root component, state orchestration, CSV ingestion
├── components/
│   ├── CityTile.tsx       # Per-city discovery UI and Gemini workflow
│   ├── StateGroup.tsx     # Groups and toggles state-level sections
│   └── StorageInfo.tsx    # Displays localStorage snapshot info
├── services/
│   └── geminiService.ts   # Gemini API integration + telemetry helpers
├── types.ts               # Shared interfaces/types for the app
├── Selected_centers.csv   # Default dataset
├── README.md              # This document
└── ...
```

## Development Notes

- City data persists to `localStorage`. Delete the `ctScanDiscovererData` key from DevTools or use the reset button to start clean.
- The `CityTile` component limits concurrency to two pincodes per city to stay within safe Gemini quota. Adjust `MAX_CONCURRENT_PINCODES` (mindful of rate limits) if your usage pattern allows.
- Duplicate detection is purely address-based (normalized). Modify `createAddressFingerprint` in `geminiService.ts` if you need a different dedupe strategy.
- Instrumentation is intentionally simple and client-side; adapt it to ship metrics to a backend or monitoring platform if desired.

## Troubleshooting

| Issue | Likely Cause | Suggested Fix |
|-------|--------------|---------------|
| Discovery stalls mid-run | Gemini Search/Maps call still pending or throttled | Watch DevTools logs; consider lowering concurrency, adding a timeout, or spacing runs |
| “Failed to load or parse city data” | Missing or malformed `Selected_centers.csv` | Confirm the CSV lives in `public/` (or served root) and headers match the expected schema |
| Empty telemetry | DevTools closed or environment variables not set | Reopen console and verify `VITE_API_KEY` is configured |
| Additional data ignored | CSV missing required columns | Double-check headers (`Statename`, `District`, `Pincode`, `Population`) and data types |

## Contributing

1. Fork or branch from `main`.
2. Install dependencies and run `npm run dev` while developing.
3. Add tests or instrumentation as needed.
4. Run `npm run build` before opening a PR to ensure the project compiles cleanly.

Suggestions, bug reports, and contributions are welcome—let’s keep improving CT Scan Discoverer together!
