import * as store from './store.js';
import { generateHistory, simulateDelivery, SCENARIOS } from './sensor.js';
import { evaluateDelivery, litersPerCm, TOLERANCE } from './gate.js';
import { equalShares, validateShares, countRegistered, totalCost, buildSummary, STATUSES } from './split.js';

const view = document.getElementById('view');
const notice = document.getElementById('notice');
const START_LEVEL_CM = 20;
const HISTORY_SEED = 42;

let state = store.load();
let tab = 'entrega';
let flash = { entrega: '', reparto: '', ajustes: '' };

// ---------- helpers ----------
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const L = (n) => `${Math.round(n).toLocaleString('es-MX')} L`;
const $ = (n) => {
  const v = Math.round(n * 100) / 100;
  const dec = Number.isInteger(v) ? 0 : 2;
  return `$${v.toLocaleString('es-MX', { minimumFractionDigits: dec, maximumFractionDigits: dec })}`;
};
const cleanText = (s, max) => String(s ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max);
const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
function fmtDate(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}
const hhmm = (min) => `${String(Math.floor(min / 60) % 24).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

// Validated number from a form field: returns [value, error]
function num(form, name, min, max, label) {
  const raw = String(form.elements[name]?.value ?? '').trim().replace(',', '.');
  const v = Number(raw);
  if (raw === '' || !Number.isFinite(v)) return [null, `${label}: escribe un número.`];
  if (v < min || v > max) return [null, `${label}: debe estar entre ${min.toLocaleString('es-MX')} y ${max.toLocaleString('es-MX')}.`];
  return [v, null];
}

function persist() {
  store.save(state);
  updateNotice();
}

function updateNotice() {
  const msgs = [];
  if (!store.persistent) msgs.push('Tu navegador no deja guardar datos: todo se borrará al cerrar esta página.');
  if (state?.demo) msgs.push('Estás viendo DATOS DE EJEMPLO inventados.');
  notice.hidden = msgs.length === 0;
  notice.textContent = msgs.join(' ');
}

const current = () => state?.deliveries.find((d) => d.id === state.currentId) || null;

function ensureSplit(d) {
  const n = state.settings.households.length;
  if (!d.split) {
    d.split = {
      mode: 'equal',
      shares: equalShares(d.price, n),
      payments: Array.from({ length: n }, () => ({ status: 'pendiente', note: '' })),
    };
  } else if (d.split.payments.length !== n) {
    // Households were added or removed after this pipa: keep the payments
    // already logged (by position) instead of wiping them.
    const old = d.split.payments;
    d.split.payments = Array.from({ length: n }, (_, i) => old[i] || { status: 'pendiente', note: '' });
    d.split.mode = 'equal';
    d.split.shares = equalShares(d.price, n);
    flash.reparto = 'Cambió el número de hogares: el reparto volvió a partes iguales. Los pagos ya anotados se conservaron.';
  }
  return d.split;
}

function summaryFor(d) {
  const split = ensureSplit(d);
  const n = state.settings.households.length;
  return buildSummary({
    date: fmtDate(d.date), quoted: d.quoted, result: d.result, price: d.price, households: n,
    payments: split.payments, sharesEqual: split.mode === 'equal', perHousehold: d.price / n,
    includeLiters: Boolean(split.shareLiters), includeCount: Boolean(split.shareCount),
  });
}

// Update counters and the shared text in place, so nothing typed in the form is lost.
function refreshSplitInfo(d) {
  const split = ensureSplit(d);
  const n = state.settings.households.length;
  const count = document.getElementById('count');
  if (count) count.textContent = `${countRegistered(split.payments)} de ${n}`;
  const text = summaryFor(d);
  const pre = document.getElementById('summary');
  if (pre) pre.textContent = text;
  const wa = document.getElementById('wa');
  if (wa) wa.href = `https://wa.me/?text=${encodeURIComponent(text)}`;
}

// ---------- chart ----------
function chartSVG(d) {
  const lpcm = d.lpcm;
  const pts = d.feed.map((lv, i) => ({ m: d.feedStart + i, l: lv * lpcm }));
  const W = 320, H = 170, pl = 44, pr = 10, pt = 10, pb = 26;
  const maxL = Math.max(...pts.map((p) => p.l)) * 1.08 || 1;
  const m0 = pts[0].m, m1 = pts[pts.length - 1].m;
  const x = (m) => pl + ((m - m0) / (m1 - m0)) * (W - pl - pr);
  const y = (l) => pt + (1 - l / maxL) * (H - pt - pb);
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${x(p.m).toFixed(1)},${y(p.l).toFixed(1)}`).join('');
  const area = `${line}L${x(m1).toFixed(1)},${y(0)}L${x(m0).toFixed(1)},${y(0)}Z`;
  const ticks = [0, maxL / 2, maxL].map((v) =>
    `<line class="grid" x1="${pl}" x2="${W - pr}" y1="${y(v)}" y2="${y(v)}"/><text x="${pl - 6}" y="${y(v) + 4}" text-anchor="end">${(Math.round(v / 500) * 500).toLocaleString('es-MX')}</text>`).join('');
  const start = d.startMinute, end = d.startMinute + d.duration;
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Nivel de la cisterna en litros durante la descarga">
    ${ticks}
    <path class="area" d="${area}"/><path class="lvl" d="${line}"/>
    <line class="mark" x1="${x(0)}" x2="${x(0)}" y1="${pt}" y2="${H - pb}"/>
    <line class="mark" x1="${x(d.duration)}" x2="${x(d.duration)}" y1="${pt}" y2="${H - pb}"/>
    <line class="axis" x1="${pl}" x2="${W - pr}" y1="${H - pb}" y2="${H - pb}"/>
    <text x="${x(0)}" y="${H - 8}" text-anchor="middle">${hhmm(start)}</text>
    <text x="${x(d.duration)}" y="${H - 8}" text-anchor="middle">${hhmm(end)}</text>
  </svg>`;
}

// ---------- views ----------
function renderWelcome() {
  view.innerHTML = `
    <section class="card">
      <h2>Bienvenida</h2>
      <p>Pipa Clara te ayuda a saber <b>cuánta agua entró de verdad</b> a la cisterna que comparten y a <b>repartir el costo</b> de la pipa entre vecinos, sin pleitos.</p>
      <p class="hint">No necesitas cuenta. Todo se guarda solo en este teléfono.</p>
      <button class="btn" data-action="fresh">Registrar mi pipa</button>
      <button class="btn secondary" data-action="demo">Solo ver un ejemplo</button>
      <p class="small">Los vecinos no necesitan instalar nada: a ellos solo les llega un mensaje de WhatsApp si tú decides mandarlo.</p>
    </section>`;
}

function pipaForm(d, s) {
  const last = state.deliveries[state.deliveries.length - 1];
  const quoted = last ? last.quoted : 10000;
  const price = last ? last.price : 1800;
  const time = last ? last.time : '08:00';
  return `
      <form id="f-pipa" novalidate>
        <div class="row2">
          <div><label for="date">Fecha</label><input id="date" name="date" type="date" value="${today()}" required></div>
          <div><label for="time">Hora en que llegó</label><input id="time" name="time" type="time" value="${esc(time)}" required></div>
        </div>
        <div class="row2">
          <div><label for="quoted">Litros que dijo el pipero</label><input id="quoted" name="quoted" type="number" inputmode="numeric" min="1000" max="40000" step="100" value="${quoted}"></div>
          <div><label for="price">Cuánto pagaste ($)</label><input id="price" name="price" type="number" inputmode="decimal" min="1" max="20000" step="1" value="${price}"></div>
        </div>
        <label for="scenario">Solo para la demostración <span class="badge sim">SIMULADO</span></label>
        <select id="scenario" name="scenario">${Object.entries(SCENARIOS).map(([k, v]) => `<option value="${k}">${esc(v.label)}</option>`).join('')}</select>
        <p class="small">Esta versión no tiene un sensor real conectado. Aquí eliges qué pasa en la simulación; con un sensor real, este campo desaparece.</p>
        <div class="err" id="err-pipa" role="alert">${esc(flash.entrega)}</div>
        <button class="btn" type="submit">Medir la descarga</button>
      </form>`;
}

function renderEntrega() {
  const s = state.settings;
  const lpcm = litersPerCm(s.lengthM, s.widthM);
  const d = current();
  const calib = s.calibratedAt
    ? `Cisterna de ${s.lengthM} × ${s.widthM} × ${s.heightM} m (${L(lpcm * s.heightM * 100)}). Medidas guardadas el ${esc(new Date(s.calibratedAt).toLocaleDateString('es-MX'))}.`
    : `Todavía no tienes las medidas de tu cisterna. Puedes registrar la pipa y repartir el costo ahora; los litros se calculan cuando la midas. <a href="#" data-action="go-ajustes">Poner medidas</a>`;

  let result = '';
  if (d) {
    const r = d.result;
    const measured = d.calibrated !== false && r.verdict.code !== 'insuficiente';
    const ml = r.ml.ok
      ? `<p class="small">La app aprendió cuánta agua usa el edificio a cada hora con ${r.ml.samples} horas de historial del sensor. Error en los últimos 2 días: modelo ${r.ml.maeModel.toFixed(2)} L/min vs. promedio simple ${r.ml.maeBase.toFixed(2)} L/min. Se usó ${r.ml.useModel ? 'el modelo, porque fue más preciso' : 'el promedio simple, porque esta vez el modelo no fue más preciso'}.</p>`
      : `<p class="small">No hay suficiente historial del sensor (mínimo 3 días) para estimar el consumo.</p>`;
    result = `
      <section class="card" aria-live="polite">
        <h2>Tu pipa del ${esc(fmtDate(d.date))}</h2>
        <ul class="nums">
          <li><span class="k">Pagaste</span><span class="v">${$(d.price)}</span></li>
          <li><span class="k">Litros que dijo el pipero</span><span class="v">${L(d.quoted)}</span></li>
          <li><span class="k">Litros que midió el sensor<small>Lo que subió el nivel de la cisterna</small></span><span class="v">${measured ? L(r.observed) : '—'}</span></li>
          <li><span class="k">Litros que entraron (estimado)<small>Lo medido + el agua que se usó en el edificio mientras se descargaba · cálculo orientativo de la app</small></span><span class="v">${measured ? `${L(r.estimated)}<small class="small"> ± ${L(r.range)}</small>` : '—'}</span></li>
        </ul>
      </section>
      <div class="verdict ${r.verdict.code}" role="status"><strong>${esc(r.verdict.title)}</strong>${esc(r.verdict.text)}</div>
      <button class="btn" data-action="go-reparto">Seguir: cobrar a los vecinos →</button>
      ${measured ? `<section class="card chart">
        <h2>Nivel de agua durante la descarga</h2>
        ${chartSVG(d)}
        <p class="small">Litros en la cisterna según el sensor (simulado). Las líneas punteadas marcan inicio y fin de la descarga (${d.duration} min). Simulación: ${esc(SCENARIOS[d.scenario].label)}.</p>
        <details><summary>¿Cómo se calculó? <span class="badge ml">Estimación ML (orientativa)</span></summary>
          <p class="small">Nivel antes: ${r.beforeCm.toFixed(1)} cm · después: ${r.afterCm.toFixed(1)} cm. Agua usada en el edificio durante la descarga (estimada): ${L(r.consumption)}. Margen permitido: ± ${L(r.range)} de medición + ${TOLERANCE * 100}% por manguera y medidas.</p>
          ${ml}
        </details>
      </section>` : ''}`;
  }

  const hist = state.deliveries.length > 1
    ? `<section class="card"><h2>Pipas anteriores (solo las ves tú)</h2><ul class="list">${state.deliveries.slice().reverse().map((x) => `
        <li><span>${esc(fmtDate(x.date))} · ${$(x.price)}</span>
        <span><span class="pill ${x.result.verdict.code}">${esc(x.result.verdict.code === 'revisar' ? 'Por revisar' : x.result.verdict.code === 'insuficiente' ? 'Sin medir' : 'Consistente')}</span>
        ${x.id === state.currentId ? '' : ` <a href="#" data-action="select" data-id="${esc(x.id)}">Ver</a>`}</span></li>`).join('')}</ul></section>`
    : '';

  view.innerHTML = `
    <section class="card"><h2>Tu cisterna</h2><p class="hint">${calib}</p></section>
    ${result}
    ${d
      ? `<section class="card"><details ${flash.entrega ? 'open' : ''}><summary>Registrar otra pipa</summary>${pipaForm(d, s)}</details></section>`
      : `<section class="card"><h2>Registrar la pipa</h2>${pipaForm(d, s)}</section>`}
    ${hist}`;
  flash.entrega = '';
}

function renderReparto() {
  const d = current();
  if (!d) {
    view.innerHTML = `<section class="card"><h2>Cobrar</h2><p>Primero registra una pipa en la pestaña <b>1 · Pipa</b>.</p><button class="btn" data-action="go-entrega">Registrar pipa</button></section>`;
    return;
  }
  const s = state.settings;
  const split = ensureSplit(d);
  const n = s.households.length;
  const registered = countRegistered(split.payments);
  const cost = totalCost({ price: d.price, households: n, equipmentCost: s.equipmentCost, deliveriesPerYear: s.deliveriesPerYear, coordMinutes: s.coordMinutes, hourValue: s.hourValue });
  const summary = summaryFor(d);

  const rows = s.households.map((name, i) => {
    const p = split.payments[i];
    const share = split.mode === 'equal'
      ? `<span>${$(split.shares[i])}</span>`
      : `<input aria-label="Aportación de ${esc(name)}" name="share-${i}" type="number" inputmode="decimal" min="0" max="20000" step="0.01" value="${split.shares[i]}" style="max-width:130px">`;
    return `<div class="hh">
      <div class="hh-top"><span>${esc(name)}</span>${share}</div>
      <label for="st-${i}" class="small">¿Ya te pagó?</label>
      <select id="st-${i}" data-action="status" data-i="${i}">
        ${Object.entries(STATUSES).map(([k, v]) => `<option value="${k}" ${p.status === k ? 'selected' : ''}>${v}</option>`).join('')}
      </select>
      <details ${p.note ? 'open' : ''}><summary>Nota solo para ti</summary>
        <textarea data-action="note" data-i="${i}" maxlength="120" rows="2" placeholder="Ej.: me dio $200 hoy y $160 el viernes">${esc(p.note)}</textarea>
      </details>
    </div>`;
  }).join('');

  view.innerHTML = `
    <section class="card">
      <h2>Cobrar la pipa del ${esc(fmtDate(d.date))}</h2>
      <p class="hint">Pagaste <b>${$(d.price)}</b>. Entre ${n} hogares toca <b>${$(d.price / n)}</b> a cada uno. Pipa Clara solo <b>anota</b>; el dinero nunca pasa por la app.</p>
      <p class="small">¿El precio está mal? Regístrala de nuevo en <a href="#" data-action="go-entrega">1 · Pipa</a>.</p>
      <div class="row2">
        <button class="btn ${split.mode === 'equal' ? '' : 'secondary'}" data-action="mode" data-mode="equal">Todos pagan igual</button>
        <button class="btn ${split.mode === 'custom' ? '' : 'secondary'}" data-action="mode" data-mode="custom">Cada quien distinto</button>
      </div>
      <form id="f-shares" novalidate>${rows}
        ${split.mode === 'custom' ? '<button class="btn secondary" type="submit">Guardar cantidades</button>' : ''}
        <div class="err" role="alert">${esc(flash.reparto)}</div>
      </form>
      <p class="small">Ya pagaron: <b id="count">${registered} de ${n}</b>. Esta lista solo la ves tú.</p>
    </section>

    <section class="card">
      <h2>Avisar al grupo</h2>
      <p class="hint">Esto es lo único que sale de tu teléfono. Nunca lleva nombres ni notas.</p>
      <pre class="summary" id="summary">${esc(summary)}</pre>
      <label class="check"><input type="checkbox" id="opt-count" ${split.shareCount ? 'checked' : ''}> Agregar cuántos ya pagaron (sin nombres)</label>
      <label class="check"><input type="checkbox" id="opt-liters" ${split.shareLiters ? 'checked' : ''} ${d.result.verdict.code === 'insuficiente' ? 'disabled' : ''}> Agregar los litros medidos</label>
      <hr style="border:0;border-top:1px solid var(--line);margin:14px 0 4px">
      <label class="check"><input type="checkbox" id="approve"> Ya leí el mensaje y quiero mandarlo</label>
      <a class="btn wa" id="wa" aria-disabled="true" href="https://wa.me/?text=${encodeURIComponent(summary)}" target="_blank" rel="noopener">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm5.2 14.1c-.2.6-1.3 1.2-1.8 1.2-.5.1-1 .2-3.3-.7-2.8-1.1-4.5-4-4.7-4.2-.1-.2-1.1-1.5-1.1-2.8s.7-2 1-2.3c.2-.3.5-.3.7-.3h.5c.2 0 .4 0 .6.5l.8 2c.1.2.1.4 0 .5l-.4.6-.4.4c-.1.1-.3.3-.1.6.2.3.8 1.3 1.7 2.1 1.2 1 2.1 1.3 2.4 1.5.3.1.5.1.6-.1l.9-1.1c.2-.3.4-.2.7-.1l1.9.9c.3.1.5.2.5.3.1.2.1.7-.1 1.4z"/></svg>
        Mandar por WhatsApp</a>
      <p class="small" id="wa-hint">Para activar el botón, marca "Ya leí el mensaje".</p>
      <button class="btn secondary" data-action="copy">Copiar el mensaje</button>
    </section>

    <section class="card">
      <details><summary>Ver costo real de esta pipa (solo para ti, no se cobra)</summary>
      <ul class="nums">
        <li><span class="k">Pipa</span><span class="v">${$(d.price)}</span></li>
        <li><span class="k">Sensor<small>${$(s.equipmentCost)} repartidos en ${s.deliveriesPerYear} pipas al año</small></span><span class="v">${$(cost.equipment)}</span></li>
        <li><span class="k">Tu tiempo<small>${s.coordMinutes} min; hoy nadie lo paga</small></span><span class="v">${$(cost.coordinator)}</span></li>
        <li><span class="k">Costo real por hogar</span><span class="v">${$(cost.perHousehold)}</span></li>
      </ul>
      <p class="small">Sirve para saber cuánto cuesta de verdad organizar la pipa. No cambia lo que cobras.</p>
      </details>
    </section>`;
  flash.reparto = '';
}

function renderAjustes() {
  const s = state.settings;
  const has = Boolean(s.calibratedAt);
  const lpcm = litersPerCm(s.lengthM, s.widthM);
  const v = (k) => (has ? s[k] : '');
  view.innerHTML = `
    <section class="card">
      <h2>Medidas de la cisterna</h2>
      <p class="hint">Mídela por dentro cuando tengas tiempo (no tiene que ser con la pipa afuera). Con esto la app sabe cuántos litros caben.</p>
      <form id="f-ajustes" novalidate>
        <div class="row2">
          <div><label for="lengthM">Largo (metros)</label><input id="lengthM" name="lengthM" type="number" inputmode="decimal" min="0.3" max="10" step="0.01" placeholder="ej. 3" value="${v('lengthM')}"></div>
          <div><label for="widthM">Ancho (metros)</label><input id="widthM" name="widthM" type="number" inputmode="decimal" min="0.3" max="10" step="0.01" placeholder="ej. 2.5" value="${v('widthM')}"></div>
        </div>
        <label for="heightM">Alto (metros)</label><input id="heightM" name="heightM" type="number" inputmode="decimal" min="0.5" max="5" step="0.01" placeholder="ej. 1.8" value="${v('heightM')}">
        <p class="small">${has ? `Le caben unos ${L(lpcm * s.heightM * 100)}. Medidas guardadas el ${esc(new Date(s.calibratedAt).toLocaleDateString('es-MX'))}.` : 'Todavía sin medidas.'}</p>

        <h3>¿Quién lleva las cuentas de la pipa?</h3>
        <label for="coordinator">Tu nombre o apodo</label>
        <input id="coordinator" name="coordinator" maxlength="40" value="${esc(s.coordinator)}">

        <h3>Hogares que comparten la cisterna</h3>
        <label for="households">Uno por línea (de 2 a 20)</label>
        <textarea id="households" name="households" rows="5">${esc(s.households.join('\n'))}</textarea>
        <p class="small">Puedes usar apodos o números de depto. Te sirven a ti para anotar quién ya pagó; no se mandan al grupo.</p>

        <details><summary>Opciones avanzadas</summary>
          <h3>Sensor <span class="badge sim">SIMULADO</span></h3>
          <label for="historyDays">Días de historial del sensor (0 a 14)</label>
          <input id="historyDays" name="historyDays" type="number" min="0" max="14" step="1" value="${s.historyDays}">
          <p class="small">Con menos de 3 días, la app no da resultado sobre los litros.</p>
          <h3>Costo real (solo para ti)</h3>
          <div class="row2">
            <div><label for="equipmentCost">Precio de un sensor ($)</label><input id="equipmentCost" name="equipmentCost" type="number" min="0" max="20000" value="${s.equipmentCost}"></div>
            <div><label for="deliveriesPerYear">Pipas al año</label><input id="deliveriesPerYear" name="deliveriesPerYear" type="number" min="1" max="365" value="${s.deliveriesPerYear}"></div>
          </div>
          <div class="row2">
            <div><label for="coordMinutes">Minutos que te toma cada pipa</label><input id="coordMinutes" name="coordMinutes" type="number" min="0" max="600" value="${s.coordMinutes}"></div>
            <div><label for="hourValue">Valor de una hora ($)</label><input id="hourValue" name="hourValue" type="number" min="0" max="2000" value="${s.hourValue}"></div>
          </div>
        </details>
        <div class="err" role="alert">${esc(flash.ajustes)}</div>
        <button class="btn" type="submit">Guardar</button>
      </form>
    </section>
    <section class="card">
      <h2>Tus datos</h2>
      <p class="hint">Todo se guarda solo en este teléfono. Nadie más (ni el pipero, ni la alcaldía, ni nosotros) puede verlo.</p>
      <button class="btn secondary" data-action="demo">Ver datos de ejemplo</button>
      <button class="btn danger" data-action="wipe" style="margin-top:36px">Borrar todos mis datos</button>
    </section>`;
  flash.ajustes = '';
}

function render() {
  updateNotice();
  document.querySelectorAll('.tabs button').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === tab)));
  if (!state) return renderWelcome();
  if (tab === 'entrega') renderEntrega();
  else if (tab === 'reparto') renderReparto();
  else renderAjustes();
}

function go(t) {
  tab = t;
  render();
  window.scrollTo(0, 0);
}

// ---------- actions ----------
function submitPipa(form) {
  const s = state.settings;
  const errs = [];
  const date = String(form.elements.date.value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) errs.push('Fecha: elige una fecha.');
  const time = String(form.elements.time.value);
  if (!/^\d{2}:\d{2}$/.test(time)) errs.push('Hora: elige una hora.');
  const [quoted, e1] = num(form, 'quoted', 1000, 40000, 'Litros');
  const [price, e2] = num(form, 'price', 1, 20000, 'Precio');
  if (e1) errs.push(e1);
  if (e2) errs.push(e2);
  const scenario = SCENARIOS[form.elements.scenario.value] ? form.elements.scenario.value : 'completa';
  const lpcm = litersPerCm(s.lengthM, s.widthM);
  const heightCm = s.heightM * 100;
  const room = (heightCm - START_LEVEL_CM) * lpcm;
  if (s.calibratedAt && quoted && quoted > room) errs.push(`No caben ${L(quoted)}: a tu cisterna le caben unos ${L(room)} más.`);
  if (errs.length) {
    flash.entrega = errs.join(' ');
    return render();
  }

  const [hh, mm] = time.split(':').map(Number);
  const startMinute = hh * 60 + mm;
  const dow = new Date(`${date}T12:00:00`).getDay();
  const weekend = dow === 0 || dow === 6;
  const households = s.households.length;
  const noiseMult = SCENARIOS[scenario].noise;
  const seed = HISTORY_SEED + state.deliveries.length;
  const history = generateHistory({ days: Math.max(0, s.historyDays), lpcm, heightCm, households, seed: HISTORY_SEED, noiseMult });
  const sim = simulateDelivery({ quoted, scenario, lpcm, heightCm, households, seed, startLevelCm: START_LEVEL_CM, startMinute, weekend });
  const result = evaluateDelivery({
    history, historyDays: s.historyDays, sim, lpcm, quoted, startMinute, weekend,
    calibrated: Boolean(s.calibratedAt), coordinator: s.coordinator,
  });

  const d = {
    id: `p${Date.now()}`, date, time, quoted, price, scenario, startMinute,
    duration: sim.duration, feedStart: sim.feed[0].m, feed: sim.feed.map((p) => Math.round(p.level * 10) / 10), lpcm,
    result, split: null, calibrated: Boolean(s.calibratedAt),
  };
  ensureSplit(d);
  state.deliveries.push(d);
  if (state.deliveries.length > 50) state.deliveries.shift();
  state.currentId = d.id;
  persist();
  render();
  document.querySelector('.verdict')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function submitAjustes(form) {
  const s = state.settings;
  const errs = [];
  const vals = {};
  for (const [k, min, max, label] of [
    ['lengthM', 0.3, 10, 'Largo'], ['widthM', 0.3, 10, 'Ancho'], ['heightM', 0.5, 5, 'Alto'],
    ['historyDays', 0, 14, 'Días de historial'], ['equipmentCost', 0, 20000, 'Costo del sensor'],
    ['deliveriesPerYear', 1, 365, 'Pipas al año'], ['coordMinutes', 0, 600, 'Minutos'], ['hourValue', 0, 2000, 'Valor de la hora'],
  ]) {
    const [v, e] = num(form, k, min, max, label);
    if (e) errs.push(e); else vals[k] = v;
  }
  if (vals.historyDays !== undefined) vals.historyDays = Math.round(vals.historyDays);
  const coordinator = cleanText(form.elements.coordinator.value, 40);
  if (!coordinator) errs.push('Escribe el nombre de quien lleva las cuentas.');
  const households = String(form.elements.households.value).split('\n').map((x) => cleanText(x, 40)).filter(Boolean);
  if (households.length < 2 || households.length > 20) errs.push('Escribe entre 2 y 20 hogares, uno por línea.');
  if (errs.length) {
    flash.ajustes = errs.join(' ');
    return render();
  }
  const dimsChanged = vals.lengthM !== s.lengthM || vals.widthM !== s.widthM || vals.heightM !== s.heightM;
  Object.assign(s, vals, { coordinator, households });
  if (dimsChanged || !s.calibratedAt) s.calibratedAt = new Date().toISOString();
  state.demo = false;
  persist();
  flash.ajustes = '';
  go('entrega');
}

function submitShares(form) {
  const d = current();
  const split = ensureSplit(d);
  const shares = split.shares.map((_, i) => Number(String(form.elements[`share-${i}`]?.value ?? '').replace(',', '.')));
  const err = validateShares(shares, d.price);
  if (err) {
    flash.reparto = err;
    return render();
  }
  split.shares = shares.map((x) => Math.round(x * 100) / 100);
  persist();
  render();
}

document.querySelector('.tabs').addEventListener('click', (e) => {
  const b = e.target.closest('button[data-tab]');
  if (b && state) go(b.dataset.tab);
});

view.addEventListener('submit', (e) => {
  e.preventDefault();
  if (e.target.id === 'f-pipa') submitPipa(e.target);
  if (e.target.id === 'f-ajustes') submitAjustes(e.target);
  if (e.target.id === 'f-shares') submitShares(e.target);
});

view.addEventListener('click', async (e) => {
  const el = e.target.closest('[data-action]');
  if (!el || el.tagName === 'SELECT' || el.tagName === 'TEXTAREA') return;
  const a = el.dataset.action;
  if (a !== 'copy' && el.tagName === 'A' && !el.classList.contains('wa')) e.preventDefault();
  if (a === 'demo') { state = store.demoState(); persist(); go('entrega'); }
  if (a === 'fresh') { state = store.emptyState(); persist(); go('entrega'); }
  if (a === 'go-ajustes') go('ajustes');
  if (a === 'go-reparto') go('reparto');
  if (a === 'go-entrega') go('entrega');
  if (a === 'select') { state.currentId = el.dataset.id; persist(); render(); window.scrollTo(0, 0); }
  if (a === 'mode') {
    const d = current();
    const split = ensureSplit(d);
    split.mode = el.dataset.mode === 'custom' ? 'custom' : 'equal';
    if (split.mode === 'equal') split.shares = equalShares(d.price, split.payments.length);
    persist();
    render();
  }
  if (a === 'wipe') {
    if (confirm('¿Borrar todos tus datos de este teléfono? No se puede deshacer.')) {
      store.clearAll();
      state = null;
      tab = 'entrega';
      render();
    }
  }
  if (a === 'copy') {
    const text = document.getElementById('summary')?.textContent || '';
    try {
      await navigator.clipboard.writeText(text);
      el.textContent = 'Copiado ✓';
    } catch {
      el.textContent = 'No se pudo copiar: selecciona el texto';
    }
  }
});

view.addEventListener('change', (e) => {
  const el = e.target;
  if (el.id === 'approve') {
    document.getElementById('wa').setAttribute('aria-disabled', String(!el.checked));
    const hint = document.getElementById('wa-hint');
    if (hint) hint.hidden = el.checked;
    return;
  }
  const d = current();
  if (!d) return;
  if (el.id === 'opt-count' || el.id === 'opt-liters') {
    const split = ensureSplit(d);
    if (el.id === 'opt-count') split.shareCount = el.checked;
    else split.shareLiters = el.checked;
    // A changed message must be read again before sending
    const approve = document.getElementById('approve');
    if (approve) approve.checked = false;
    document.getElementById('wa')?.setAttribute('aria-disabled', 'true');
    const hint = document.getElementById('wa-hint');
    if (hint) hint.hidden = false;
    persist();
    refreshSplitInfo(d);
    return;
  }
  const i = Number(el.dataset.i);
  const split = ensureSplit(d);
  if (!Number.isInteger(i) || !split.payments[i]) return;
  if (el.dataset.action === 'status' && STATUSES[el.value]) {
    split.payments[i].status = el.value;
    persist();
    refreshSplitInfo(d);
  }
  if (el.dataset.action === 'note') {
    split.payments[i].note = cleanText(el.value, 120);
    persist();
  }
});

render();
