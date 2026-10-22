// Audit gate: quoted vs observed vs estimated liters.
// Never says "fraud": only CONSISTENTE, REVISAR (with a named person) or DATOS INSUFICIENTES.
import { trainModel, predictConsumption } from './ml.js';
import { SENSOR_NOISE_CM } from './sensor.js';

export const TOLERANCE = 0.02; // 2% for calibration, hose and meter differences

export const litersPerCm = (lengthM, widthM) => lengthM * widthM * 10;

const mean = (a) => a.reduce((s, v) => s + v, 0) / a.length;

export function observedLiters(feed, duration, lpcm) {
  const before = mean(feed.filter((p) => p.m >= -5 && p.m < 0).map((p) => p.level));
  const after = mean(feed.filter((p) => p.m >= duration && p.m < duration + 5).map((p) => p.level));
  return { beforeCm: before, afterCm: after, liters: (after - before) * lpcm };
}

export function decide({ quoted, estimated, range, calibrated, modelOk, coordinator }) {
  if (!calibrated || !modelOk) {
    return {
      code: 'insuficiente',
      title: 'Datos insuficientes',
      text: !calibrated
        ? 'Falta calibrar la cisterna. Sin calibración no emitimos ningún juicio.'
        : 'El sensor tiene menos de 3 días de historial. No emitimos ningún juicio todavía.',
    };
  }
  const tol = quoted * TOLERANCE;
  const upper = estimated + range + tol;
  if (quoted <= upper) {
    return {
      code: 'consistente',
      title: 'Consistente',
      text: 'Lo que entró a la cisterna coincide con lo cotizado, dentro del margen de medición.',
    };
  }
  const gap = Math.round((quoted - upper) / 10) * 10;
  return {
    code: 'revisar',
    title: `Revisar con ${coordinator}`,
    text: `Según el sensor, entraron al menos ${gap.toLocaleString('es-MX')} L menos de lo cotizado, ya contando el margen. Esto no prueba nada por sí solo: puede ser la manguera, la calibración o el agua que usaron los vecinos. ${coordinator} puede revisarlo con el pipero antes de la próxima entrega.`,
    gap,
  };
}

// Full pipeline for one delivery (pure function: easy to test).
export function evaluateDelivery({ history, historyDays, sim, lpcm, quoted, startMinute, weekend, calibrated, coordinator }) {
  const obs = observedLiters(sim.feed, sim.duration, lpcm);
  const model = trainModel(history, lpcm, historyDays);
  // Window between the centers of the "before" and "after" averaging windows
  const windowMinutes = sim.duration + 5;
  let consumption = { liters: 0, sd: 0 };
  if (model.ok) consumption = predictConsumption(model, startMinute - 3, windowMinutes, weekend);
  const obsSd = Math.SQRT2 * SENSOR_NOISE_CM * sim.noiseMult * lpcm / Math.sqrt(5);
  const estimated = obs.liters + consumption.liters;
  const range = 1.96 * Math.sqrt(consumption.sd ** 2 + obsSd ** 2);
  const verdict = decide({ quoted, estimated, range, calibrated, modelOk: model.ok, coordinator });
  return {
    beforeCm: obs.beforeCm,
    afterCm: obs.afterCm,
    observed: obs.liters,
    consumption: consumption.liters,
    estimated,
    range,
    verdict,
    ml: model.ok
      ? { ok: true, maeModel: model.maeModel, maeBase: model.maeBase, useModel: model.useModel, samples: model.samples }
      : { ok: false },
  };
}
