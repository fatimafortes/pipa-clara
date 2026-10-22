# DECISIONS — Pipa Clara

## Session 1 · Thu Oct 22, 2026

**Decisions**
1. **Local-first, no backend.** Blueprint Condition 1 says raw readings stay on the device. Keeping *everything* in `localStorage` honors it literally and means there is no personal data on any server, so the security floor's auth/RLS items have no surface to protect. Trade-off: no sync between neighbors' phones; sharing happens only via the approved WhatsApp summary.
2. **Simulated sensor, labeled everywhere.** No hardware this week. Three scenarios (complete, short ~85%, noisy) so the gate's three outcomes can be demonstrated honestly.
3. **ML on hourly windows, not 15-min readings.** First attempt at 15-min resolution was dominated by sensor differencing noise (≈2 L/min vs. a ≈2.7 L/min peak). Hourly blocks cut that noise ~4× and the model now beats the baseline (MAE 0.65 vs 0.81 L/min).
4. **Model vs. baseline decides itself.** If the ridge model doesn't beat the simple average on the hold-out, the app uses the average and says so on screen (Condition 6). With the noisy-sensor scenario the margin is small, and the UI shows it.
5. **Gate tolerance 2%** of the quoted volume on top of the statistical range, for hose, calibration and truck-meter differences. Adversary logic: a false "Revisar" damages the relationship with the pipero, so the gate errs toward not flagging.
6. **Never the word "fraude".** Tested automatically.
7. **No debtor list.** The UI and the shared summary only show "X de N aportaciones registradas".
8. **GitHub Pages** instead of Vercel: no env vars needed, free, one less account for the demo.

**Tomorrow's first move:** run the mechanical test pass on the live URL (blocked storage, XSS in names, changing households after a delivery, agreed shares), fix the first real bug, redeploy.
