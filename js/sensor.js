// SIMULATED level sensor for a shared cistern.
// Everything here is synthetic and labeled "SENSOR SIMULADO" in the UI (Blueprint condition 6).

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function gauss(rng) {
  let u = 0, v = 0;
  while (u === 0) u = rng();
  while (v === 0) v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

export const SCENARIOS = {
  completa: { factor: 1.0, noise: 1, label: 'Entrega completa' },
  corta: { factor: 0.85, noise: 1, label: 'Entrega corta (entra ~85%)' },
  ruidosa: { factor: 1.0, noise: 4, label: 'Sensor con mucho ruido' },
};

export const SENSOR_NOISE_CM = 0.3; // typical ultrasonic sensor noise
export const PUMP_L_PER_MIN = 250; // pipa pump flow

// True building consumption in liters per minute, by hour of day.
export function trueRate(hour, weekend, households) {
  const shift = weekend ? 2 : 0; // weekends: morning peak 2 h later
  let perHouseLh;
  if (hour >= 6 + shift && hour < 9 + shift) perHouseLh = 32;
  else if (hour >= 19 && hour < 22) perHouseLh = 24;
  else if (hour >= 5 && hour < 23) perHouseLh = 10;
  else perHouseLh = 3;
  return (perHouseLh * households) / 60;
}

// 15-minute level readings (cm) for `days` days. Day 0 is a Monday.
export function generateHistory({ days, lpcm, heightCm, households, seed, noiseMult = 1 }) {
  const rng = mulberry32(seed);
  const readings = [];
  let level = heightCm * 0.6;
  const step = 15;
  for (let i = 0; i < days * 96; i++) {
    const t = i * step;
    const day = Math.floor(t / 1440);
    const hour = Math.floor((t % 1440) / 60);
    const weekend = day % 7 >= 5;
    let refill = false;
    // Tandeo: network water arrives every third day, 05:00–06:00 (~2,000 L)
    if (day % 3 === 1 && hour === 5) {
      level = Math.min(heightCm, level + 500 / lpcm);
      refill = true;
    }
    // A previous pipa when the cistern runs low
    if (level * lpcm < 800) {
      level = Math.min(heightCm, level + 9000 / lpcm);
      refill = true;
    }
    const measured = Math.max(0, level + gauss(rng) * SENSOR_NOISE_CM * noiseMult);
    readings.push({ t, day, hour, weekend, level: measured, refill });
    const used = Math.max(0, trueRate(hour, weekend, households) * step * (1 + 0.25 * gauss(rng)));
    level = Math.max(0, level - used / lpcm);
  }
  return readings;
}

// Per-minute feed around one delivery, from 10 min before to 10 min after unloading.
export function simulateDelivery({ quoted, scenario, lpcm, heightCm, households, seed, startLevelCm, startMinute, weekend }) {
  const sc = SCENARIOS[scenario] || SCENARIOS.completa;
  const rng = mulberry32(seed + 9973);
  const delivered = quoted * sc.factor * (1 + 0.005 * gauss(rng));
  const duration = Math.max(5, Math.round(delivered / PUMP_L_PER_MIN));
  const feed = [];
  let level = startLevelCm;
  let overflow = false;
  for (let m = -10; m < duration + 10; m++) {
    const minuteOfDay = (((startMinute + m) % 1440) + 1440) % 1440;
    const hour = Math.floor(minuteOfDay / 60);
    const inflow = m >= 0 && m < duration ? delivered / duration : 0;
    const used = Math.max(0, trueRate(hour, weekend, households) * (1 + 0.25 * gauss(rng)));
    level = level + (inflow - used) / lpcm;
    if (level > heightCm) { level = heightCm; overflow = true; }
    if (level < 0) level = 0;
    feed.push({ m, minuteOfDay, level: Math.max(0, level + gauss(rng) * SENSOR_NOISE_CM * sc.noise) });
  }
  return { feed, duration, deliveredTrue: delivered, overflow, noiseMult: sc.noise };
}
