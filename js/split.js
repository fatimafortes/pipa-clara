// Cost-split ledger: logs money, never holds it (Blueprint condition 4).
// No debtor list: shared text only shows counts (condition 2, shadow clause).

export const STATUSES = { pendiente: 'Pendiente', efectivo: 'Pagó en efectivo', transferencia: 'Pagó por transferencia' };

// Equal shares in pesos with centavos; the remainder goes to the first households.
export function equalShares(total, n) {
  const cents = Math.round(total * 100);
  const base = Math.floor(cents / n);
  let rest = cents - base * n;
  return Array.from({ length: n }, () => {
    const c = base + (rest > 0 ? 1 : 0);
    if (rest > 0) rest--;
    return c / 100;
  });
}

export function validateShares(shares, total) {
  if (shares.some((s) => !Number.isFinite(s) || s < 0)) return 'Cada aportación debe ser un número de 0 o más.';
  const sum = shares.reduce((a, b) => a + b, 0);
  if (Math.abs(sum - total) > 0.009) {
    return `Las aportaciones suman $${sum.toLocaleString('es-MX')} y el total es $${total.toLocaleString('es-MX')}.`;
  }
  return null;
}

export const countRegistered = (payments) => payments.filter((p) => p.status !== 'pendiente').length;

// Total cost of the existing workflow vs. with the tool (condition 5).
export function totalCost({ price, households, equipmentCost, deliveriesPerYear, coordMinutes, hourValue }) {
  const equipment = deliveriesPerYear > 0 ? equipmentCost / deliveriesPerYear : 0;
  const coordinator = (coordMinutes / 60) * hourValue;
  const total = price + equipment + coordinator;
  return { equipment, coordinator, total, perHousehold: total / households };
}

const fmtL = (n) => `${Math.round(n).toLocaleString('es-MX')} L`;
const fmt$ = (n) => `$${(Math.round(n * 100) / 100).toLocaleString('es-MX')}`;

// The ONLY text that ever leaves the phone. No names, no raw readings.
// By default it carries only the cost. Liters and the payment count are opt-in
// (persona test: sharing them by default exposed the pipero and the neighbors).
export function buildSummary({ date, quoted, result, price, households, payments, sharesEqual, perHousehold, includeLiters = false, includeCount = false }) {
  const lines = [
    `💧 Ya llegó la pipa (${date})`,
    sharesEqual
      ? `Costó ${fmt$(price)} entre ${households} hogares: toca ${fmt$(perHousehold)} por hogar.`
      : `Costó ${fmt$(price)} entre ${households} hogares, con las aportaciones que acordamos.`,
  ];
  if (includeCount) lines.push(`Aportaciones anotadas: ${countRegistered(payments)} de ${households}.`);
  if (includeLiters && result.verdict.code !== 'insuficiente') {
    lines.push(
      `Litros: el pipero dijo ${fmtL(quoted)}; el sensor midió ${fmtL(result.observed)} (estimado ${fmtL(result.estimated)} ± ${fmtL(result.range)}).`,
      `(Medición orientativa con sensor simulado)`,
    );
  }
  lines.push('Gracias 🙏');
  return lines.join('\n');
}
