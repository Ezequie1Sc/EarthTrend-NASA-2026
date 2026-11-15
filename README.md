# EarthTrend NASA

**Team Feynman · NASA Space Apps Challenge 2026**  
Challenge: **Be An Earth System Trend Detective!**

EarthTrend connects a 3D Earth explorer with reproducible temperature analysis. It helps students and curious citizens move from a geographic question to historical evidence, while distinguishing gridded reanalysis from point measurements and statistical trends from causal claims.

## Corrección actual del Explorer

Consulta [INFORME_EXPLORER_INMERSIVO.md](INFORME_EXPLORER_INMERSIVO.md): escena continua, paneles opcionales, cámara y A/B. Este informe sustituye la descripción anterior del Explorer en tres columnas.

## Rediseño visual — noviembre 2026

Consulta [INFORME_REDISENO.md](INFORME_REDISENO.md) para cambios e instalación y [docs/VERIFICATION.md](docs/VERIFICATION.md) para resultados y limitaciones de esta entrega.

## Problem and solution

Climate data are public but often difficult to locate, interpret and compare. A colorful daily map can also be mistaken for evidence of a long-term trend. EarthTrend separates those questions: use a daily global layer for geographic context, then explicitly request an annual NASA POWER series for a chosen location and period.

## Features implemented

- Three.js globe with orbit/zoom, desktop double-click and 650 ms touch hold. Movement greater than 8 px or another pointer cancels the hold.
- A/B location selection with cyan/orange markers; coordinates also remain editable manually. Selecting a point does not run historical analysis.
- NASA POWER T2M annual series, OLS trend, mean, minimum/maximum annual mean, R² and p-value.
- Responsive Chart.js axes and two-decimal tooltips, expand/fullscreen controls retained.
- Non-overlapping, equal-length period comparison (at least three complete years each), signed B − A and absolute differences in °C.
- Two-location comparison using the same variable, years and units, with two annual series and two fitted trends on one chart.
- CSV export of the displayed annual values, coordinates, variable, units and source; PNG composition includes title, years, units, coordinates and provenance.
- Scientific explanation and source limitations in the analysis results.
- Existing daily thermal archive, worker rasterization, date/source controls, retry states, caching and optional MERRA-2 import retained.

Implementation is not a claim of device certification: see [verification and remaining checks](docs/VERIFICATION.md).

## Architecture

The original Angular standalone feature structure and FastAPI separation are preserved. No database or authentication is added.

```text
frontend/src/app/
  core/models/             API contracts
  core/services/           ClimateApiService, TemperatureGridService, API_URL
  core/utils/              period statistics and CSV/download utilities
  features/earth-explorer/ globe, thermal controls, integrated explorer
  features/dashboard/     form, chart, trend cards, comparison component
backend/app/
  api/routes/              health, climate, analysis, thermal
  schemas/                 Pydantic response contracts
  services/                POWER retrieval, scipy regression, thermal ingestion/cache
backend/data/examples/     two real NOAA daily grids with provenance
backend/scripts/           optional MERRA-2 importer
```

Angular obtains one analysis response per location through `ClimateApiService`; that response supplies both the chart and statistics. Period comparisons reuse the displayed data, without fetching or fabricating new observations. The globe's thermal pipeline is independent of annual POWER analysis.

## Technologies

Angular 22, TypeScript, Tailwind CSS, Three.js, Chart.js, RxJS; Python, FastAPI, HTTPX, SciPy, NumPy and xarray. Existing lockfiles and dependency versions are retained. No new production dependency was needed.

## Scientific sources and methodology

| View | Source | Variable and temporal meaning | Native resolution |
| --- | --- | --- | --- |
| Historical analysis | NASA POWER / MERRA-2 | T2M: annual mean air temperature at 2 m, °C | approximately 0.5° latitude × 0.625° longitude |
| Default globe | NOAA PSL / NCEP–NCAR Reanalysis 1 | `air`: daily mean at 2 m, converted from K to °C | 192 × 94 Gaussian grid, 1.875° longitude, approximately 1.9° latitude |
| Optional globe | NASA MERRA-2 M2T1NXSLV | T2M daily mean of all 24 hourly fields | 576 × 361, 0.625° longitude × 0.5° latitude |

POWER's monthly endpoint includes an annual aggregate under `YYYY13`. EarthTrend uses that supplied aggregate; POWER documents annual averages as means of monthly values. It does not fill missing years or infer annual values from incomplete months. Missing, nonnumeric, nonfinite and fill values cause an actionable error; T2M units must be Celsius. Analysis accepts completed years from 1981, subject to actual archive availability.

For annual values `T` and years `y`, ordinary least squares fits `T = a + b*y`, with `b = Σ[(y−ȳ)(T−T̄)] / Σ[(y−ȳ)²]`. The reported decadal trend is `10*b`. Plot coefficients retain numerical precision; presentation rounds labels. R² describes the fitted fraction of variance. The two-sided p-value tests zero slope under OLS assumptions; annual autocorrelation is not corrected. Nonsignificance is labeled inconclusive, not climate stability. Constant series use slope 0, p 1 and displayed R² 0 by convention (variance-based R² is undefined).

Period means equally weight complete annual means. Both periods must have equal durations, at least three years and no overlap. Difference = B mean − A mean; absolute difference = its magnitude. No percentage is computed on Celsius. These short-period summaries are not 30-year climate normals. Location comparisons require identical year arrays.

The thermal scale is shared by the raster and legend (−20 to 40 °C, saturated endpoints). Missing cells stay transparent; bilinear display resampling does not add scientific detail. NOAA polar caps extend the nearest latitude row for display. Temperatures describe grid cells, not exact measurements at the marker. Reanalysis combines models and observations; no causal climate attribution or prediction is made.

Primary references checked during this audit:

- [POWER monthly/annual API](https://power.larc.nasa.gov/docs/services/api/temporal/monthly/)
- [POWER temporal processing](https://power.larc.nasa.gov/docs/methodology/data/processing/)
- [POWER meteorological sources](https://power.larc.nasa.gov/docs/methodology/data/sources_meteorology/)
- [NOAA NCEP–NCAR R1](https://psl.noaa.gov/data/gridded/data.ncep.reanalysis.html)
- [MERRA-2 product](https://doi.org/10.5067/VJAFPLI1CSIV)

NOAA R1 ends on 2026-03-17. The two bundled grids are 2024-06-15 and 2024-12-15; they are real archived data, not simulated fallback temperatures. Other dates require upstream access. MERRA-2 is unavailable until a valid daily file is imported.

## Run locally (PowerShell)

Use Node 24 and Python 3.12+ with a virtual environment. The audit used Python 3.12.

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
python -m uvicorn app.main:app --reload --port 8000
```

In a second terminal:

```powershell
cd frontend
npm ci
npm start
```

Open `http://localhost:4200`. Local hosts use `/api/v1` through the existing Angular proxy to port 8000; production uses the Render URL in `frontend/src/app/core/services/api-url.ts`. No `.env` file was changed.

Tests and production build:

```powershell
cd backend
python -m pytest -q
cd ../frontend
npm test -- --watch=false
npm run build
```

Optional MERRA-2: download a complete M2T1NXSLV daily NetCDF using your own Earthdata access, then run `python scripts/import_merra2.py <file.nc4> --date YYYY-MM-DD` from `backend`. The importer requires all 24 hourly means and does not handle credentials. See [thermal source notes](docs/thermal/DATA_SOURCES.md).

## API routes

- `GET /health`
- `GET /api/v1/climate/temperature?latitude=...&longitude=...&start_year=...&end_year=...`
- `GET /api/v1/analysis/trends` with the same parameters
- `GET /api/v1/thermal/sources`
- `GET /api/v1/thermal/grid?date=YYYY-MM-DD&provider=noaa`
- OpenAPI: `/docs`

## Deployment and delivery

See [Vercel and Render instructions](docs/DEPLOYMENT.md) and the [NASA submission checklist](docs/NASA_CHECKLIST.md). This audit did not deploy, push to GitHub or submit the project.

Project links supplied by the project (not updated by this audit):

- [Repository](https://github.com/Ezequie1Sc/EarthTrend-NASA)
- [Frontend](https://earth-trend-nasa.vercel.app/)
- [API](https://earthtrend-nasa-api.onrender.com/)
- [API documentation](https://earthtrend-nasa-api.onrender.com/docs)
- [Team Feynman](https://www.spaceappschallenge.org/2026/find-a-team/feynman/)
- [Challenge](https://www.spaceappschallenge.org/2026/challenges/earth-system-trend-detective/)

## Known limitations

Browser visual QA and physical Android testing remain outstanding. Chromium launch was blocked by this execution environment; PNG encoding/download and WebGL interaction are implemented but not end-to-end verified here. PNG composition, gesture logic, coordinate synchronization, comparisons and CSV content have targeted automated tests. See the verification report for exact results and distinctions.

The UI retains English as in the original project. Requests depend on NASA/NOAA uptime; there is no simulated history fallback. Render cold starts can increase latency. MERRA-2 imported data are optional, no causal attribution is implemented, and no autocorrelation-adjusted trend uncertainty is provided. Source updates can revise historical values.

## AI assistance disclosure

ChatGPT/Codex assisted with code inspection, implementation, tests and documentation for this revision. Climate values come from the named scientific sources; generative AI does not generate temperatures or scientific interpretations. Interpretations are deterministic templates driven by calculated statistics. The developer remains responsible for reviewing the work and completing device checks before submission.

Developer: Orlando Ezequiel Salazar Cruz ([Ezequie1Sc](https://github.com/Ezequie1Sc)). This is an independent participant project, not a NASA-endorsed product.
