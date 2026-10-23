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

## Session 2 · Thu Oct 22, 2026 (evening)

**What happened:** deployed to GitHub Pages (deploy 1), fixed 2 mechanical bugs (deploy 2), then ran the persona test with a synthetic "Doña Lupita" (see `PERSONA.md`).

**Decisions**
1. **The shared message carries only the cost by default.** The persona showed that sending liters + "Revisar con Lupita" + "2 de 5" to the group exposes the pipero and the neighbors, the exact harm of the Shadow Clause. Liters and the payment count are now opt-in, and changing them forces a re-read before sending.
2. **The verdict never names a person in its title.** "Diferencia por revisar" plus "Quién lo revisa: {name}" still honors Condition 4 (a named person handles discrepancies) without reading as an accusation on her own phone.
3. **No pre-filled cistern measurements.** A plausible default is worse than an empty field: the user accepts it and every liter is computed from an invented cistern. Until real measurements exist, liters show "—" and the gate says *Datos insuficientes*; the cost split still works.
4. **Register first, settings later.** The main path is now "Registrar mi pipa"; measurements and advanced options are optional and collapsed.
5. Kept the "SENSOR SIMULADO" label despite the persona's distrust, because Condition 6 requires it.

**Tomorrow's first move:** record the demo video on the live URL (private window), export PERSONA and BUILDCHAT PDFs, and show the URL to one real encargada if the User teammate can arrange it.

**Addendum (Oct 22, night):** moved production hosting to **Vercel** (https://pipa-clara.vercel.app/), connected to `main`, so every push redeploys automatically. GitHub Pages stays as a mirror. Still no environment variables needed: the app has no secrets. Decision 8 from Session 1 is superseded.
