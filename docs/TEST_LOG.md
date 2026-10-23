# TEST LOG — Pipa Clara

## Mechanical pass · Oct 22, 2026 (headless Chromium, 360 px wide)

| # | Test (from PACKET test plan) | Result |
|---|---|---|
| 1 | Calibration 2.0 × 1.5 m → 30 L/cm; invalid values rejected | ✅ (unit test + empty/negative inputs show messages) |
| 2 | Observed liters formula | ✅ |
| 3 | ML beats baseline on hold-out; UI says which was used | ✅ MAE 0.65 vs 0.81 L/min |
| 4 | Gate: <3 days → Datos insuficientes; complete → Consistente; short → Revisar | ✅ |
| 5 | Noisy sensor → wider range | ✅ ±229 L vs ±69 L |
| 6 | Split 1,800 / 5 = 360; agreed shares must add up | ✅ |
| 7 | Summary has no household names or raw readings | ✅ |
| 8 | `<img src=x onerror=alert(1)>` as a household name renders as text | ✅ |
| 9 | localStorage blocked → app works and shows a notice | ✅ |
| 10 | 360 px: no horizontal scroll | ✅ |
| 11 | Pipa larger than the cistern's free space is rejected | ✅ |
| — | **Agreed shares: type amounts, then change a payment status** | ❌ **BUG 1** |
| — | **Add a household after a pipa was registered** | ❌ **BUG 2** |

### BUG 1 — typed amounts erased
*Steps:* Reparto → "Partes acordadas" → type 900 / 450 / 450 → change Hogar 2 to "Pagó en efectivo" before saving.
*Expected:* typed amounts stay. *Actual:* amounts reset to 600 / 600 / 600.
*Cause:* changing a status re-rendered the whole screen from saved state.
*Fix:* status changes now update the counter and the summary in place (`refreshSplitInfo`), without re-rendering the form.

### BUG 2 — payments wiped when households change
*Steps:* log two payments → Ajustes → add a 4th household → back to Reparto.
*Expected:* logged payments kept. *Actual:* all payments back to "Pendiente" (silent data loss, and it would look like neighbors hadn't paid).
*Cause:* `ensureSplit` rebuilt the ledger from scratch whenever the household count changed.
*Fix:* payments are kept by position, new households start as pending, the split returns to equal shares and the user sees a notice explaining it.

*After the fix:* the mechanical script rerun passes all checks, and all 19 unit tests pass. → committed as `fix:` and redeployed (deploy 2).

## Persona pass · Oct 22, 2026
Synthetic user "Doña Lupita" walked 5 screens. Worst confusion: the WhatsApp summary broadcast the liters gap and "Revisar con Lupita" to the group. Fixed (cost-only message by default, opt-in details, neutral verdict, no pre-filled measurements) and redeployed (deploy 3). Full log in `PERSONA.md`. Unit tests after the fix: 20/20.
