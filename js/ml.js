// ML: ridge regression that predicts the building's water consumption (L/min)
// from hour of day + weekend, trained on the (simulated) sensor history.
// Advisory only, and always compared against a simple baseline (Blueprint condition 6).

export function features(hour, weekend) {
  const f = new Array(26).fill(0);
  f[0] = 1; // intercept
  f[1 + hour] = 1;
  f[25] = weekend ? 1 : 0;
  return f;
}

// Hourly consumption samples. Hours with a refill or an almost empty cistern are skipped.
export function buildDataset(readings, lpcm) {
  const rows = [];
  for (let i = 0; i + 4 < readings.length; i += 4) {
    const block = readings.slice(i, i + 5);
    if (block.some((r) => r.refill)) continue;
    if (block[0].level < 3 || block[4].level < 3) continue;
    const rate = ((block[0].level - block[4].level) * lpcm) / 60;
    rows.push({ x: features(block[0].hour, block[0].weekend), y: rate, day: block[0].day });
  }
  return rows;
}

export function solve(A, b) {
  const n = b.length;
  const M = A.map((row, i) => [...row, b[i]]);
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    [M[c], M[p]] = [M[p], M[c]];
    const piv = M[c][c];
    if (Math.abs(piv) < 1e-12) continue;
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const f = M[r][c] / piv;
      for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k];
    }
  }
  return M.map((row, i) => (Math.abs(row[i]) < 1e-12 ? 0 : row[n] / row[i]));
}

export function fitRidge(rows, lambda = 1) {
  const d = rows[0].x.length;
  const A = Array.from({ length: d }, () => new Array(d).fill(0));
  const b = new Array(d).fill(0);
  for (const { x, y } of rows) {
    for (let i = 0; i < d; i++) {
      b[i] += x[i] * y;
      for (let j = 0; j < d; j++) A[i][j] += x[i] * x[j];
    }
  }
  for (let i = 0; i < d; i++) A[i][i] += lambda;
  return solve(A, b);
}

export const predictRow = (w, x) => x.reduce((s, xi, i) => s + xi * w[i], 0);
const mae = (pairs) => pairs.reduce((s, [p, y]) => s + Math.abs(p - y), 0) / pairs.length;

export const MIN_HISTORY_DAYS = 3;

// Trains, evaluates on the last 2 days vs. the baseline, then refits on everything.
export function trainModel(readings, lpcm, historyDays) {
  if (historyDays < MIN_HISTORY_DAYS) return { ok: false, reason: 'historial' };
  const rows = buildDataset(readings, lpcm);
  const cut = historyDays - 2;
  const train = rows.filter((r) => r.day < cut);
  const test = rows.filter((r) => r.day >= cut);
  if (train.length < 24 || test.length < 6) return { ok: false, reason: 'historial' };

  const w = fitRidge(train);
  const baseRate = train.reduce((s, r) => s + r.y, 0) / train.length;
  const maeModel = mae(test.map((r) => [predictRow(w, r.x), r.y]));
  const maeBase = mae(test.map((r) => [baseRate, r.y]));
  const useModel = maeModel < maeBase;

  const wAll = fitRidge(rows);
  const baseAll = rows.reduce((s, r) => s + r.y, 0) / rows.length;
  const resid = rows.map((r) => r.y - (useModel ? predictRow(wAll, r.x) : baseAll));
  const sigma = Math.sqrt(resid.reduce((s, e) => s + e * e, 0) / Math.max(1, resid.length - 1));

  return { ok: true, w: wAll, baseRate: baseAll, maeModel, maeBase, useModel, sigma, samples: rows.length };
}

export function rateAt(model, hour, weekend) {
  return model.useModel ? Math.max(0, predictRow(model.w, features(hour, weekend))) : model.baseRate;
}

// Liters consumed by the building between two minutes of the day, with standard deviation.
export function predictConsumption(model, startMinute, minutes, weekend) {
  let liters = 0;
  for (let m = 0; m < minutes; m++) {
    const mod = (((startMinute + m) % 1440) + 1440) % 1440;
    liters += rateAt(model, Math.floor(mod / 60), weekend);
  }
  const sd = model.sigma * 60 * Math.sqrt(minutes / 60);
  return { liters, sd };
}
