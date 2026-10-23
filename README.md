# 💧 Pipa Clara

**Verify how much water really entered a shared cistern, and split the pipa's cost among neighbors, without the data ever leaving your phone.**

Week 11 · Business Bending · *When Scarcity Ends — And What We Lose Anyway* · Fátima Fortes Ortega

- **Live app: https://pipa-clara.vercel.app/** (mirror: https://fatimafortes.github.io/pipa-clara/)
- Tests: https://fatimafortes.github.io/pipa-clara/tests.html (or `node js/tests.js`)
- Packet: [`docs/PACKET.md`](docs/PACKET.md) · Build prompt: [`docs/IMPLEMENTATION_PROMPT.md`](docs/IMPLEMENTATION_PROMPT.md) · Decisions: [`docs/DECISIONS.md`](docs/DECISIONS.md)

## What it does
1. **Sensing (SIMULATED, labeled):** a cistern level sensor feed (14 days of history + per-minute readings during the unloading).
2. **ML (advisory, labeled):** ridge regression predicts the building's consumption by hour, evaluated against a simple-average baseline on a 2-day hold-out; the better one is used.
3. **Audit gate:** shows **quoted**, **observed** and **estimated** liters separately. Verdict is only *Consistente*, *Diferencia por revisar* (naming who reviews it) or *Datos insuficientes*. Never "fraud".
4. **Marketplace logic:** cost-split ledger (equal or agreed shares; cash or transfer; private notes). Logs money, never holds it.
5. **Approved sharing:** by default the WhatsApp message carries only the cost per household; liters and the payment count are opt-in; nothing is sent until the user checks "Ya leí el mensaje".

## Stack
Plain HTML/CSS/JS (ES modules), no build step, no backend, no API keys. Hosted on GitHub Pages. Data in the browser's `localStorage` only.

## Security floor
No secrets (none needed) · no personal data on any server (local-first, so no auth/RLS surface) · every input validated and escaped · demo data invented and labeled.

## Run locally
```bash
python3 -m http.server 8000   # then open http://localhost:8000
node js/tests.js              # unit tests
```
