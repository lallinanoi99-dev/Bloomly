// Bloomly core: dates, storage, encryption, cycle and pregnancy maths, shared UI bits.
// Everything here runs in the browser. Nothing is sent anywhere.
'use strict';

(function () {
  const B = (window.Bloomly = window.Bloomly || {});

  /* ---------------- Dates (always local midnight) ---------------- */
  const DAY = 864e5;
  const pad = (n) => String(n).padStart(2, '0');
  const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const parse = (s) => {
    if (!s) return null;
    const [y, m, d] = String(s).split('-').map(Number);
    if (!y || !m || !d) return null;
    return new Date(y, m - 1, d);
  };
  const today = () => { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), n.getDate()); };
  const addDays = (d, n) => { const r = new Date(d); r.setDate(r.getDate() + n); return r; };
  const diff = (a, b) => Math.round((b - a) / DAY); // whole days from a to b
  const same = (a, b) => a && b && ymd(a) === ymd(b);
  const fmt = (d, opts) => d.toLocaleDateString('en-GB', opts || { day: 'numeric', month: 'short' });
  const utcDay = () => Math.floor(Date.now() / DAY);
  Object.assign(B, { DAY, ymd, parse, today, addDays, diff, same, fmt, utcDay, todayKey: () => ymd(today()) });

  /* ---------------- Small helpers ---------------- */
  B.esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  B.avg = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
  B.plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;

  let toastTimer;
  B.toast = (msg, ms = 2800) => {
    const el = document.getElementById('toast');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), ms);
  };

  // Falling petals for check-in celebrations
  B.petals = () => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const c = document.getElementById('petals');
    if (!c) return;
    const ctx = c.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    c.width = innerWidth * dpr; c.height = innerHeight * dpr;
    ctx.scale(dpr, dpr);
    const cols = ['#C2456B', '#F3B9C8', '#E4DDF7', '#D8F0E3', '#FBE3D0', '#E8879F'];
    const ps = Array.from({ length: 70 }, () => ({
      x: Math.random() * innerWidth, y: -20 - Math.random() * innerHeight * 0.6,
      r: 5 + Math.random() * 8, vx: (Math.random() - 0.5) * 1.6, vy: 1.6 + Math.random() * 2.4,
      a: Math.random() * 6.28, va: (Math.random() - 0.5) * 0.12, c: cols[(Math.random() * cols.length) | 0]
    }));
    let f = 0;
    (function tick() {
      ctx.clearRect(0, 0, innerWidth, innerHeight);
      ps.forEach((p) => {
        p.x += p.vx + Math.sin((f + p.r) / 18) * 0.6; p.y += p.vy; p.a += p.va;
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.a); ctx.fillStyle = p.c;
        ctx.beginPath(); ctx.ellipse(0, 0, p.r * 0.55, p.r, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
      });
      if (++f < 220) requestAnimationFrame(tick); else ctx.clearRect(0, 0, innerWidth, innerHeight);
    })();
  };

  /* ---------------- Storage (localStorage, always wrapped) ---------------- */
  const KEYS = { setup: 'bloomly.v2.setup', data: 'bloomly.v2.data' };
  B.KEYS = KEYS;
  B.store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } },
    del(k) { try { localStorage.removeItem(k); } catch (e) { /* ignore */ } },
    available() {
      try { const t = 'bloomly.test'; localStorage.setItem(t, '1'); localStorage.removeItem(t); return true; }
      catch (e) { return false; }
    }
  };

  /* ---------------- Data shape ---------------- */
  B.DEFAULT_HABITS = [
    { id: 'sleep', icon: '💤', name: 'Sleep 7h+' },
    { id: 'steps', icon: '🚶', name: '10k steps' },
    { id: 'vitamins', icon: '💊', name: 'Vitamins / folic acid' },
    { id: 'stretch', icon: '🧘', name: 'Stretch or yoga' },
    { id: 'mindful', icon: '🧠', name: 'Mindful minute' },
    { id: 'veg', icon: '🥗', name: 'Fruit & veg' }
  ];
  B.defaultData = () => ({
    v: 1,
    mode: 'cycle', // cycle | pregnancy | habits
    settings: {
      lastPeriod: null, periodLen: 5, cycleLen: 28, cycleUnsure: false,
      dueDate: null, pregLmp: null,
      waterGoal: 2000, glassMl: 250
    },
    habits: B.DEFAULT_HABITS.map((h) => ({ ...h })),
    logs: {}, // 'YYYY-MM-DD' → { flow, symptoms[], mood, discharge, sleep, notes, water, habits[], kicks }
    appointments: [] // { id, date, note }
  });
  B.normalise = (d) => {
    const base = B.defaultData();
    const out = { ...base, ...(d || {}) };
    out.settings = { ...base.settings, ...((d && d.settings) || {}) };
    if (!Array.isArray(out.habits) || !out.habits.length) out.habits = base.habits;
    if (!out.logs || typeof out.logs !== 'object') out.logs = {};
    if (!Array.isArray(out.appointments)) out.appointments = [];
    return out;
  };

  B.hasLogged = (log) => !!(log && (
    log.flow || (log.symptoms && log.symptoms.length) || log.mood || log.discharge ||
    log.sleep || log.notes || log.water > 0 || (log.habits && log.habits.length) || log.kicks > 0
  ));

  /* ---------------- Cycle maths (PRD section 3) ---------------- */
  const BLEED = ['started', 'light', 'medium', 'heavy', 'spotting'];
  const STARTS = ['started', 'light', 'medium', 'heavy']; // spotting alone doesn't start a period
  B.BLEED = BLEED;

  function periodStarts(data) {
    const logs = data.logs;
    const keys = Object.keys(logs).filter((k) => STARTS.includes(logs[k] && logs[k].flow)).sort();
    const starts = [];
    for (const k of keys) {
      const d = parse(k);
      const prevBleed = [1, 2].some((n) => BLEED.includes((logs[ymd(addDays(d, -n))] || {}).flow));
      if (logs[k].flow === 'started' || !prevBleed) {
        const last = starts[starts.length - 1];
        if (last && diff(last, d) < 12) continue; // same period
        starts.push(d);
      }
    }
    const seed = parse(data.settings.lastPeriod);
    if (seed && !starts.some((s) => Math.abs(diff(s, seed)) < 12)) {
      starts.push(seed);
      starts.sort((a, b) => a - b);
    }
    return starts;
  }

  function periodLengths(data, starts) {
    const t = today();
    const out = [];
    for (const s of starts) {
      let len = 0;
      let d = s;
      let ended = false;
      while (len < 14) {
        const f = (data.logs[ymd(d)] || {}).flow;
        if (f === 'ended') { ended = true; break; }
        if (!BLEED.includes(f)) break;
        len++; d = addDays(d, 1);
      }
      const finished = ended || diff(d, t) >= 1; // at least one day has passed after the run
      if (len >= 2 && finished) out.push(len);
    }
    return out;
  }

  B.cycle = function (data) {
    const st = data.settings;
    const t = today();
    const starts = periodStarts(data);
    const lens = [];
    for (let i = 1; i < starts.length; i++) {
      const L = diff(starts[i - 1], starts[i]);
      if (L >= 15 && L <= 60) lens.push(L);
    }
    const recent = lens.slice(-6);
    const enough = recent.length >= 2;
    const fallback = st.cycleUnsure ? 28 : (Number(st.cycleLen) || 28);
    const cycleLen = enough ? Math.round(B.avg(recent)) : fallback;
    const irregular = enough && Math.max(...recent) - Math.min(...recent) > 7;
    const pls = periodLengths(data, starts).slice(-6);
    const periodLen = pls.length ? Math.round(B.avg(pls)) : (Number(st.periodLen) || 5);
    const past = starts.filter((d) => d <= t);
    const last = past[past.length - 1] || null;
    const base = { starts, lens, recent, enough, cycleLen, periodLen, periodLens: pls, irregular };
    if (!last) return { ...base, hasData: false };

    const day = diff(last, t) + 1;
    const next = addDays(last, cycleLen);
    const daysUntil = diff(t, next);
    const ovulation = addDays(next, -14);
    const fertileStart = addDays(ovulation, -5);
    const fertileEnd = addDays(ovulation, 1);

    const todayFlow = (data.logs[ymd(t)] || {}).flow;
    let endedOn = null;
    for (let d = last; d <= t; d = addDays(d, 1)) if ((data.logs[ymd(d)] || {}).flow === 'ended') { endedOn = d; break; }
    let inPeriod = day <= periodLen && !(endedOn && t >= endedOn);
    if (BLEED.includes(todayFlow)) inPeriod = true;

    let phase;
    if (inPeriod) phase = 'Period';
    else if (daysUntil < 0) phase = 'Late';
    else if (same(t, ovulation)) phase = 'Ovulation';
    else if (t >= fertileStart && t <= fertileEnd) phase = 'Fertile';
    else if (t > fertileEnd) phase = 'Luteal';
    else phase = 'Follicular';

    return {
      ...base, hasData: true, last, day, next, daysUntil, ovulation, fertileStart, fertileEnd,
      phase, inPeriod, late: daysUntil < -5, endedOn
    };
  };

  // What each day of the current cycle is, for the ring.
  B.dayKind = (m, data, k) => {
    const d = addDays(m.last, k - 1);
    const f = (data.logs[ymd(d)] || {}).flow;
    if (BLEED.includes(f)) return 'period';
    if (k <= m.periodLen && !(m.endedOn && d >= m.endedOn)) return 'period';
    if (k > m.cycleLen) return 'late';
    if (same(d, m.ovulation)) return 'ovulation';
    if (d >= m.fertileStart && d <= m.fertileEnd) return 'fertile';
    if (d > m.fertileEnd) return 'luteal';
    return 'follicular';
  };

  // Calendar marks: logged period, predicted period, fertile window, ovulation.
  B.calendarMarks = (data, m) => {
    const marks = {};
    const add = (d, key) => { const k = ymd(d); (marks[k] = marks[k] || {})[key] = true; };
    for (const [k, log] of Object.entries(data.logs)) if (BLEED.includes(log.flow)) (marks[k] = marks[k] || {}).per = true;
    if (!m.hasData) return marks;
    const t = today();
    // A period entered in setup / Me (not logged day by day) still shows as period days.
    const seed = parse(data.settings.lastPeriod);
    if (seed && !Object.keys(data.logs).some((k) => B.BLEED.includes(data.logs[k].flow) && Math.abs(diff(seed, parse(k))) < 12)) {
      for (let i = 0; i < m.periodLen; i++) {
        const d = addDays(seed, i);
        if (d > t || (m.endedOn && d >= m.endedOn)) break;
        add(d, 'per');
      }
    }
    const window = (start) => {
      const ov = addDays(start, m.cycleLen - 14);
      for (let i = -5; i <= 1; i++) add(addDays(ov, i), 'fer');
      add(ov, 'ovu');
    };
    window(m.last);
    const anchor = m.daysUntil < 0 ? t : m.next;
    for (let c = 0; c < 6; c++) {
      const s = addDays(anchor, c * m.cycleLen);
      for (let i = 0; i < m.periodLen; i++) {
        const d = addDays(s, i);
        if (d >= t && !(data.logs[ymd(d)] || {}).flow) add(d, 'pred');
      }
      window(s);
    }
    return marks;
  };

  /* ---------------- Pregnancy ---------------- */
  B.preg = (data) => {
    const st = data.settings;
    let due = parse(st.dueDate);
    let lmp = parse(st.pregLmp);
    if (due) lmp = addDays(due, -280);
    else if (lmp) due = addDays(lmp, 280);
    else return null;
    const t = today();
    const days = diff(lmp, t);
    const week = Math.floor(days / 7);
    const day = ((days % 7) + 7) % 7;
    const tri = week <= 13 ? 1 : week <= 27 ? 2 : 3;
    return { lmp, due, days, week, day, tri, daysLeft: diff(t, due) };
  };

  /* ---------------- Cycle ring (SVG) ---------------- */
  const KIND_COLOR = { period: '#C2456B', follicular: '#EDE6DD', fertile: '#7CCAC3', ovulation: '#2F9C95', luteal: '#C9BCF0', late: '#F2B58A' };
  B.KIND_COLOR = KIND_COLOR;
  // kinds: array of kind names, one per day (index 0 = day 1). current: 1-based day or 0.
  B.ringSVG = (kinds, current, opts = {}) => {
    const S = 240, cx = 120, cy = 120, r = opts.r || 100, w = opts.w || 20;
    const n = kinds.length;
    const seg = (Math.PI * 2) / n;
    const gap = Math.min(0.02, seg * 0.18);
    const ang = (i) => -Math.PI / 2 + i * seg;
    const pt = (a) => `${(cx + r * Math.cos(a)).toFixed(2)} ${(cy + r * Math.sin(a)).toFixed(2)}`;
    let paths = '';
    let i = 0;
    while (i < n) {
      let j = i;
      while (j + 1 < n && kinds[j + 1] === kinds[i]) j++;
      const a0 = ang(i) + gap, a1 = ang(j + 1) - gap;
      const large = a1 - a0 > Math.PI ? 1 : 0;
      paths += `<path d="M${pt(a0)} A${r} ${r} 0 ${large} 1 ${pt(a1)}" stroke="${KIND_COLOR[kinds[i]]}" stroke-width="${w}" fill="none" stroke-linecap="butt"/>`;
      i = j + 1;
    }
    let marker = '';
    if (current > 0 && current <= n) {
      const a = ang(current - 0.5);
      const [x, y] = pt(a).split(' ');
      marker = `<circle cx="${x}" cy="${y}" r="${w / 2 + 4}" fill="#fff" stroke="#1E1B2E" stroke-width="2.5"/><circle cx="${x}" cy="${y}" r="3.5" fill="#1E1B2E"/>`;
    }
    return `<svg viewBox="0 0 ${S} ${S}" role="img" aria-label="${B.esc(opts.label || 'Cycle ring')}">${paths}${marker}</svg>`;
  };
})();
