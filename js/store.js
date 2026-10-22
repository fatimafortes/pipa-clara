// Local-first storage: data lives only on this phone (Blueprint condition 1).
// If localStorage is blocked (private mode), the app keeps working in memory.
const KEY = 'pipaclara.v1';
let memory = null;
export let persistent = true;

export function load() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : memory;
  } catch (e) {
    persistent = false;
    return memory;
  }
}

export function save(state) {
  memory = state;
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch (e) {
    persistent = false;
  }
}

export function clearAll() {
  memory = null;
  try {
    localStorage.removeItem(KEY);
  } catch (e) {
    persistent = false;
  }
}

export function defaultSettings() {
  return {
    lengthM: 3.0,
    widthM: 2.5,
    heightM: 1.8,
    calibratedAt: null,
    coordinator: 'Lupita',
    households: ['Hogar 1', 'Hogar 2', 'Hogar 3', 'Hogar 4', 'Hogar 5'],
    historyDays: 14,
    equipmentCost: 300,
    deliveriesPerYear: 40,
    coordMinutes: 45,
    hourValue: 50,
  };
}

export function demoState() {
  const s = defaultSettings();
  s.calibratedAt = new Date().toISOString();
  return { settings: s, deliveries: [], currentId: null, demo: true };
}

export function emptyState() {
  return { settings: defaultSettings(), deliveries: [], currentId: null, demo: false };
}
