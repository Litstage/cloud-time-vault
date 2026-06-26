export type ObRule = {
  id: string;
  name: string;
  level: 1 | 2 | 3;
  weekday: number; // 0=Sun .. 6=Sat (JS getDay)
  start_time: string; // "HH:MM" or "HH:MM:SS"
  end_time: string;
  active: boolean;
};

export type ObSplit = {
  normalMs: number;
  ob1Ms: number;
  ob2Ms: number;
  ob3Ms: number;
};

function hmsToSec(t: string): number {
  const [h, m, s] = t.split(":").map((x) => Number(x || 0));
  return ((h * 60) + m) * 60 + (s || 0);
}

// Returns the OB level (0=normal, 1/2/3) for a given instant, picking the highest matching active rule.
function levelAt(date: Date, rules: ObRule[]): 0 | 1 | 2 | 3 {
  const wd = date.getDay();
  const sec = (date.getHours() * 60 + date.getMinutes()) * 60 + date.getSeconds();
  let best: 0 | 1 | 2 | 3 = 0;
  for (const r of rules) {
    if (!r.active) continue;
    if (r.weekday !== wd) continue;
    const s = hmsToSec(r.start_time);
    const e = hmsToSec(r.end_time);
    const inRange =
      s === e
        ? true // full 24h
        : s < e
          ? sec >= s && sec < e
          : sec >= s || sec < e; // wraps midnight (same weekday counted on the morning side too — see note below)
    if (inRange && r.level > best) best = r.level;
  }
  return best;
}

/**
 * Splits [start, end) into normal/OB1/OB2/OB3 by walking segments.
 * Cuts at each minute boundary where level might change. For correctness we
 * step minute by minute (cheap for typical entries < 24h).
 */
export function splitEntryByOb(startIso: string, endIso: string, rules: ObRule[]): ObSplit {
  const out: ObSplit = { normalMs: 0, ob1Ms: 0, ob2Ms: 0, ob3Ms: 0 };
  const startMs = new Date(startIso).getTime();
  const endMs = new Date(endIso).getTime();
  if (!(endMs > startMs)) return out;

  const MIN = 60_000;
  let cursor = startMs;
  while (cursor < endMs) {
    // Next minute boundary
    const nextMinute = Math.floor(cursor / MIN) * MIN + MIN;
    const next = Math.min(nextMinute, endMs);
    const seg = next - cursor;
    const lvl = levelAt(new Date(cursor), rules);
    if (lvl === 0) out.normalMs += seg;
    else if (lvl === 1) out.ob1Ms += seg;
    else if (lvl === 2) out.ob2Ms += seg;
    else out.ob3Ms += seg;
    cursor = next;
  }
  return out;
}

export function addSplit(a: ObSplit, b: ObSplit): ObSplit {
  return {
    normalMs: a.normalMs + b.normalMs,
    ob1Ms: a.ob1Ms + b.ob1Ms,
    ob2Ms: a.ob2Ms + b.ob2Ms,
    ob3Ms: a.ob3Ms + b.ob3Ms,
  };
}

export type Wage = {
  hourly_rate: number;
  ob1_pct: number;
  ob2_pct: number;
  ob3_pct: number;
};

export function computePay(s: ObSplit, w: Wage): number {
  const H = 3_600_000;
  const normalH = s.normalMs / H;
  const ob1H = s.ob1Ms / H;
  const ob2H = s.ob2Ms / H;
  const ob3H = s.ob3Ms / H;
  return (
    w.hourly_rate *
    (normalH + ob1H * (1 + w.ob1_pct / 100) + ob2H * (1 + w.ob2_pct / 100) + ob3H * (1 + w.ob3_pct / 100))
  );
}

export const WEEKDAY_LABELS_SV = ["Söndag", "Måndag", "Tisdag", "Onsdag", "Torsdag", "Fredag", "Lördag"];