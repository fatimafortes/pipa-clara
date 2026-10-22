# Implementation prompt — Pipa Clara (generated from PACKET.md)

You are my coding agent. Build **Pipa Clara**, a local-first static web app (HTML + CSS + vanilla JS ES modules, no build step, no backend, no API keys), hosted on GitHub Pages. UI language: **Spanish (Mexico)**, large readable text, mobile-first (360 px). Read `docs/PACKET.md` for the why; this prompt is the what.

## Hard constraints (Blueprint conditions — never break them)
- C1: all data in `localStorage` (wrapped in try/catch, in-memory fallback). Nothing leaves the phone except a WhatsApp text the user previews and approves.
- C2 (SHADOW): no scores, no rankings, no list of who owes. Shared summaries show counts only. Cash is a first-class payment method. Every household entry can be edited privately.
- C3: always show **quoted**, **observed**, **estimated** liters as three separate numbers; estimated has a ± range. Log calibration date. Never use the words "fraude", "robo" or similar.
- C4: discrepancy verdict names the coordinator ("Revisar con {name}"). No supplier directory. Money is logged, never processed.
- C5: settings capture equipment cost and coordinator minutes; show total cost per household.
- C6: badges "SENSOR SIMULADO" and "Estimación ML (orientativa)" on screen; ML compared with a baseline; no arrival forecast.
- Security floor: validate every input (type, min/max, length ≤ 40 for names); escape all text before rendering; demo data labeled "DATOS DE EJEMPLO".

## Features (each small and testable)

**F1 — Shell + storage.** `index.html`, `styles.css`, `js/app.js`, `js/store.js`. Tab nav: Entrega · Reparto · Ajustes. Header with badge. Footer "Tus datos viven en este teléfono".
*Accept:* loads with no console errors; works when localStorage throws (shows notice).

**F2 — Calibration (Ajustes).** Cistern length & width in meters (0.3–10), coordinator name, households (2–20, default names "Hogar 1…"), equipment cost, coordinator minutes. liters/cm = L×W×10. Store calibration date.
*Accept:* 2.0×1.5 → 30 L/cm; invalid values rejected with a message.

**F3 — Simulated sensor (`js/sensor.js`).** Seeded generator: 14 days of level readings every 15 min (consumption peaks 6–9 h and 19–22 h, weekend pattern, tandeo refills, noise), and a per-minute unloading feed for a delivery. Scenarios: *completa*, *corta* (pipero delivers ~85%), *ruidosa* (sensor noise ×4).
*Accept:* deterministic for a given seed; levels never below 0 or above cistern height.

**F4 — ML (`js/ml.js`).** Convert history to consumption rate (L/min) per interval, excluding refills. Features: 24 hour one-hot + weekend flag. Ridge regression (closed form, λ=1). Hold out last 2 days; report MAE of model vs baseline (overall mean rate). Predict consumption during the unloading window; range = 1.96 × residual σ × √(minutes) plus sensor noise term.
*Accept:* model MAE < baseline MAE on simulated data; UI states which is better.

**F5 — Delivery + audit gate (`js/gate.js`).** Form: date, quoted liters (1,000–40,000), price (1–20,000 MXN). Run unloading: show level before/after and an SVG line chart. Observed = Δcm × L/cm. Estimated = observed + predicted consumption ± range. Gate: history < 3 days or no calibration → **Datos insuficientes**; quoted ≤ estimated + range → **Consistente**; else → **Revisar con {coordinator}**, with neutral copy suggesting what to check (hose, meter of the truck, timing).
*Accept:* scenario completa → Consistente; corta → Revisar; history 2 days → Datos insuficientes.

**F6 — Cost split (Reparto).** Equal or custom shares (must sum to total, validated). Per household: status pendiente / efectivo / transferencia; private note; edit anytime. Includes equipment amortization and coordinator time as optional "costo total" line (C5).
*Accept:* 1,800 / 5 = 360; custom shares not summing → error.

**F7 — Approved summary to WhatsApp.** Preview text: date, quoted/observed/estimated, verdict, cost per household, "X de N aportaciones registradas". No names next to pending, no raw readings. Checkbox "Revisé el resumen" required before the share button (`https://wa.me/?text=`).
*Accept:* summary passes a test that it contains no household names and no reading series.

**F8 — Tests (`tests.html` + `js/tests.js`).** Pure-function tests for F2–F7 shown as pass/fail list.

**F9 — Privacy controls.** "Borrar todos mis datos" (confirm) and "Cargar datos de ejemplo".

## Commit plan (minimum 5 commits, 2 deploys)
1. `docs: packet, mockup and implementation prompt`
2. `feat: app shell, storage with fallback, calibration settings` → **deploy 1** (GitHub Pages on)
3. `feat: simulated sensor feed and ML consumption model with baseline`
4. `feat: delivery flow, chart and audit gate verdicts`
5. `feat: cost split ledger and approved WhatsApp summary`
6. `test: unit test page` 
7. `fix: <bug found in mechanical pass>` → **deploy 2**
8. `fix: <worst persona-test confusion>` → **deploy 3**

Each session ends with `docs/DECISIONS.md` updated (decisions + tomorrow's first move), commit, push.
