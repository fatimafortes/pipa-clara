import { generateHistory, simulateDelivery } from './sensor.js';
import { trainModel } from './ml.js';
import { evaluateDelivery, litersPerCm, decide } from './gate.js';
import { equalShares, validateShares, buildSummary, countRegistered } from './split.js';

export const results = [];
function test(name, fn) {
  try {
    const ok = fn();
    results.push({ name, ok: ok !== false });
  } catch (e) {
    results.push({ name, ok: false, err: e.message });
  }
}
const near = (a, b, tol = 1e-6) => Math.abs(a - b) <= tol;

const lpcm = litersPerCm(3, 2.5);
const heightCm = 180;
function run(scenario, days) {
  const history = generateHistory({ days, lpcm, heightCm, households: 5, seed: 42, noiseMult: scenario === 'ruidosa' ? 4 : 1 });
  const sim = simulateDelivery({ quoted: 10000, scenario, lpcm, heightCm, households: 5, seed: 42, startLevelCm: 20, startMinute: 480, weekend: false });
  return evaluateDelivery({ history, historyDays: days, sim, lpcm, quoted: 10000, startMinute: 480, weekend: false, calibrated: true, coordinator: 'Lupita' });
}

test('Calibración: 2.0 m × 1.5 m = 30 L por cm', () => near(litersPerCm(2, 1.5), 30));
test('Observado: de 20 cm a 340 cm con 30 L/cm = 9,600 L', () => near((340 - 20) * 30, 9600));
test('Sensor simulado es determinista con la misma semilla', () => {
  const a = generateHistory({ days: 3, lpcm, heightCm, households: 5, seed: 7 });
  const b = generateHistory({ days: 3, lpcm, heightCm, households: 5, seed: 7 });
  return JSON.stringify(a) === JSON.stringify(b);
});
test('Sensor: el nivel nunca es negativo ni pasa la altura (+ruido)', () =>
  generateHistory({ days: 14, lpcm, heightCm, households: 5, seed: 1 }).every((r) => r.level >= 0 && r.level <= heightCm + 3));
test('ML: el modelo tiene menor error que el promedio simple', () => {
  const h = generateHistory({ days: 14, lpcm, heightCm, households: 5, seed: 42 });
  const m = trainModel(h, lpcm, 14);
  return m.ok && m.maeModel < m.maeBase && m.useModel;
});
test('ML: con menos de 3 días no entrena', () => !trainModel(generateHistory({ days: 2, lpcm, heightCm, households: 5, seed: 42 }), lpcm, 2).ok);
test('Gate: entrega completa → Consistente', () => run('completa', 14).verdict.code === 'consistente');
test('Gate: entrega corta → Revisar', () => run('corta', 14).verdict.code === 'revisar');
test('Gate: 2 días de historial → Datos insuficientes', () => run('completa', 2).verdict.code === 'insuficiente');
test('Gate: sensor ruidoso → rango más amplio', () => run('ruidosa', 14).range > 2 * run('completa', 14).range);
test('Gate: sin calibración → Datos insuficientes', () =>
  decide({ quoted: 10000, estimated: 9000, range: 100, calibrated: false, modelOk: true, coordinator: 'X' }).code === 'insuficiente');
test('Gate: el veredicto de revisión nombra a la encargada', () => run('corta', 14).verdict.title === 'Revisar con Lupita');
test('Gate: nunca usa la palabra "fraude" ni "robo"', () =>
  ['completa', 'corta', 'ruidosa'].every((s) => !/fraude|robo/i.test(JSON.stringify(run(s, 14).verdict))));
test('Reparto: $1,800 entre 5 = $360 cada uno', () => equalShares(1800, 5).every((x) => x === 360));
test('Reparto: $100 entre 3 suma exactamente $100', () => near(equalShares(100, 3).reduce((a, b) => a + b, 0), 100, 0.001));
test('Reparto: partes acordadas que no suman el total → error', () => validateShares([500, 500, 500], 1800) !== null);
test('Reparto: partes acordadas que sí suman → sin error', () => validateShares([600, 600, 600], 1800) === null);
test('Reparto: cuenta solo las aportaciones registradas', () =>
  countRegistered([{ status: 'efectivo' }, { status: 'pendiente' }, { status: 'transferencia' }]) === 2);
test('Resumen: no incluye nombres de hogares ni lecturas del sensor', () => {
  const r = run('corta', 14);
  const text = buildSummary({
    date: '22 oct 2026', quoted: 10000, result: r, price: 1800, households: 5,
    payments: [{ status: 'efectivo' }, { status: 'pendiente' }, { status: 'pendiente' }, { status: 'pendiente' }, { status: 'pendiente' }],
    sharesEqual: true, perHousehold: 360,
  });
  return !/Hogar|Depto|cm\b/.test(text) && text.includes('1 de 5');
});

if (typeof document !== 'undefined') {
  const out = document.getElementById('out');
  out.innerHTML = results.map((r) => `<li class="${r.ok ? 'ok' : 'fail'}">${r.ok ? '✅' : '❌'} ${r.name}${r.err ? ` — ${r.err}` : ''}</li>`).join('');
  const passed = results.filter((r) => r.ok).length;
  document.getElementById('total').textContent = `${passed} de ${results.length} pruebas pasan`;
} else {
  for (const r of results) console.log(r.ok ? 'PASS' : 'FAIL', r.name, r.err || '');
}
