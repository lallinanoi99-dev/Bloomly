// Bloomly landing page: navigation, stage tabs, product mockups, live stats.
'use strict';

(function () {
  const B = window.Bloomly;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  /* ---------------- Mockups (illustrative, not real data) ---------------- */
  function kindsFor(cycleLen, periodLen, ov) {
    return Array.from({ length: cycleLen }, (_, i) => {
      const k = i + 1;
      if (k <= periodLen) return 'period';
      if (k === ov) return 'ovulation';
      if (k >= ov - 5 && k <= ov + 1) return 'fertile';
      if (k > ov + 1) return 'luteal';
      return 'follicular';
    });
  }

  const tabs = (on) => `<div class="mini-tabs">${['Today', 'Calendar', 'Insights', 'Me'].map((t) => `<span class="${t === on ? 'on' : ''}"><b style="font-size:13px">${{ Today: '✿', Calendar: '▦', Insights: '▮▮', Me: '◯' }[t]}</b>${t}</span>`).join('')}</div>`;
  const shell = (on, body) => `<div class="mini" aria-hidden="true"><div class="mini-screen">
      <div class="mini-top"><span>9:41</span><span style="font-family:var(--sans);font-size:13px">bloomly</span><span>●●●</span></div>
      <div class="mini-body">${body}</div>${tabs(on)}</div></div>`;
  const water = (n, of) => `<div class="mini-card sky"><b>💧 Water</b> <span class="muted">${n}/${of} glasses</span><div class="mini-bar"><i style="width:${Math.round((n / of) * 100)}%"></i></div></div>`;
  const habits = (n) => `<div class="mini-card mint"><b>✨ Habits</b> <span class="muted">${n}/6 today</span>
      <div class="mini-chips"><span>💤 Sleep ✓</span><span>🚶 Steps ✓</span><span>💊 Vitamins ✓</span><span>🧘 Yoga</span></div></div>`;
  const cta = (txt = 'Check in on BOT Chain  🌸 12') => `<div class="mini-cta">${txt}</div>`;

  function ringBlock(day, phase, label, color) {
    return `<div class="mini-card" style="text-align:center;padding:12px">
      <div class="mini-ring" style="width:150px;margin:0 auto">${B.ringSVG(kindsFor(28, 5, 14), day, { label: 'Example cycle ring', w: 22 })}
        <div class="ctr"><span style="font-size:9px;color:var(--muted);font-family:var(--mono)">CYCLE DAY</span><b>${day}</b><span style="font-size:10px;font-weight:600;color:${color}">${phase}</span></div></div>
      <div style="font-family:var(--sans);font-size:15px;margin-top:6px">${label}</div>
      <div style="font-size:9px;color:var(--muted);font-family:var(--mono)">ESTIMATE</div></div>`;
  }

  function mockToday(stage) {
    if (stage === 'pregnancy') {
      return shell('Today', `<div class="mini-h">Good morning 🌸</div>
        <div class="mini-card lav"><div style="display:flex;justify-content:space-between"><div><span style="font-family:var(--mono);font-size:9px;color:#5B4A99">2ND TRIMESTER</span>
          <div class="mini-h">Week 14 · Day 3</div><div class="muted" style="font-size:10px">182 days to go</div></div><div style="font-size:34px">🍋</div></div>
          <div style="margin-top:6px">Baby is about the size of a <b>lemon</b>.</div>
          <div class="mini-card" style="margin-top:6px;padding:7px 9px;border:0"><span style="font-family:var(--mono);font-size:8px;color:#5B4A99">A TIP FOR YOU</span><br>Many people find their energy returns now.</div></div>
        <div class="mini-card"><b>📅 Appointments</b><div class="muted" style="margin-top:4px">12 Dec · 20-week scan</div></div>
        ${water(5, 8)}${cta()}`);
    }
    if (stage === 'wellness') {
      return shell('Today', `<div class="mini-h">Good afternoon 🌸</div>
        <div class="mini-card sky" style="display:flex;gap:12px;align-items:center">
          <svg viewBox="0 0 92 120" width="52"><defs><clipPath id="mg"><path d="M14 8h64l-8 104H22z"/></clipPath></defs><g clip-path="url(#mg)"><rect width="92" height="120" fill="#EEF6FC"/><rect y="40" width="92" height="80" fill="#79BCE2"/></g><path d="M14 8h64l-8 104H22z" fill="none" stroke="#1E1B2E" stroke-width="3"/></svg>
          <div><div class="mini-h">1,500 ml</div><div class="muted">Nice! 6/8 glasses</div></div></div>
        <div class="mini-card mint"><b>✨ Habits · 5/6</b>
          ${['💤 Sleep 7h+', '🚶 10k steps', '💊 Vitamins', '🧘 Stretch or yoga', '🧠 Mindful minute'].map((h) => `<div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid rgba(255,255,255,.7)"><span>${h}</span><span style="color:var(--teal)">✓</span></div>`).join('')}
          <div style="display:flex;justify-content:space-between;padding:4px 0"><span>🥗 Fruit & veg</span><span class="muted">○</span></div></div>
        ${cta('Check in on BOT Chain  🌸 23')}`);
    }
    const ttc = stage === 'ttc';
    return shell('Today', `<div class="mini-h">Good morning 🌸</div>
      ${ttc ? ringBlock(13, 'Fertile window', 'Ovulation in 1 day', '#1E6E68') : ringBlock(7, 'Follicular', 'Period in 21 days', '#6B6578')}
      <div class="mini-card rose"><b>📝 Today</b><div class="mini-chips">${ttc ? '<span>Egg white</span><span>😊 Happy</span><span>😴 8h sleep</span>' : '<span>Light</span><span>😌 Calm</span><span>Cramps</span>'}</div></div>
      ${water(6, 8)}${habits(4)}${cta()}`);
  }

  function mockCalendar(stage) {
    const now = new Date();
    const y = now.getFullYear(), m = now.getMonth();
    const first = new Date(y, m, 1);
    const lead = (first.getDay() + 6) % 7;
    const days = new Date(y, m + 1, 0).getDate();
    let cells = ['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d) => `<div class="dow">${d}</div>`).join('');
    const total = Math.ceil((lead + days) / 7) * 7;
    for (let i = 0; i < total; i++) {
      const d = i - lead + 1;
      if (stage === 'pregnancy' && i % 7 === 0) cells += `<div class="wk">Week ${12 + i / 7}</div>`;
      if (d < 1 || d > days) { cells += '<div></div>'; continue; }
      const c = ['d'];
      if (stage === 'cycle' || stage === 'ttc') {
        if (d >= 2 && d <= 6) c.push('per');
        else if (d >= 30) c.push('pred');
        else if (d >= 11 && d <= 17) c.push('fer');
        if (d === 16) c.push('ovu');
      }
      if (stage === 'wellness' && d < now.getDate() && d % 4 !== 0) c.push('fer');
      if (d === Math.min(now.getDate(), days)) c.push('today');
      cells += `<div class="${c.join(' ')}">${d}</div>`;
    }
    const legend = stage === 'pregnancy'
      ? '<span><i style="background:var(--lavender)"></i>Pregnancy week</span><span><i style="background:var(--ink)"></i>Today</span>'
      : stage === 'wellness'
        ? '<span><i style="background:#CBE9E6"></i>All habits done</span>'
        : '<span><i style="background:var(--accent)"></i>Period</span><span><i style="border:1.5px dashed var(--accent)"></i>Predicted</span><span><i style="background:#CBE9E6"></i>Fertile</span><span>✿ Ovulation</span>';
    const extra = stage === 'pregnancy'
      ? '<div class="mini-card lav"><b>Due date</b><div class="muted">Thursday 22 April</div></div>'
      : stage === 'wellness'
        ? '<div class="mini-card mint"><b>This week</b><div class="muted">Habits 82% · Water 5/7 goal days</div></div>'
        : `<div class="mini-card"><b>Coming up</b> <span style="font-family:var(--mono);font-size:8px;color:var(--muted)">ESTIMATES</span>
            <div style="display:flex;justify-content:space-between;margin-top:4px"><span>🌸 Next period</span><span class="muted">30th</span></div>
            <div style="display:flex;justify-content:space-between"><span>🌿 Fertile window</span><span class="muted">11th–17th</span></div></div>`;
    return shell('Calendar', `<div class="mini-h">${first.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}</div>
      <div class="mini-card"><div class="mini-cal">${cells}</div><div class="mini-legend" style="margin-top:8px">${legend}</div></div>${extra}`);
  }

  /* ---------------- Stages ---------------- */
  /* ---------------- Hero: desktop app mockups (illustrative) ---------------- */
  const DICON = {
    today: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="12" cy="12" r="3"/><path d="M12 3.2c2 1.7 2 4 0 5.8-2-1.8-2-4.1 0-5.8zM12 15c2 1.8 2 4.1 0 5.8-2-1.7-2-4 0-5.8zM3.2 12c1.7-2 4-2 5.8 0-1.8 2-4.1 2-5.8 0zM15 12c1.8-2 4.1-2 5.8 0-1.7 2-4 2-5.8 0z"/></svg>',
    calendar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><rect x="3.5" y="5" width="17" height="15" rx="3"/><path d="M3.5 10h17M8 3v4M16 3v4"/></svg>',
    insights: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M5 20V12M10 20V6M15 20v-9M20 20V9"/></svg>',
    me: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><circle cx="12" cy="8.5" r="3.8"/><path d="M4.5 20c1.2-4 4-5.6 7.5-5.6s6.3 1.6 7.5 5.6"/></svg>'
  };

  function deskShell(active, main) {
    const nav = [['today', 'Today'], ['calendar', 'Calendar'], ['insights', 'Insights'], ['me', 'Me']]
      .map(([id, l]) => `<div class="dnav ${id === active ? 'on' : ''}">${DICON[id]}${l}</div>`).join('');
    return `<div class="dapp"><aside class="dside"><span class="logo"><svg aria-hidden="true"><use href="#logo"/></svg>bloomly</span>${nav}
      <div class="dcheck">Check in on BOT Chain<small>🌸 12-day streak</small></div></aside><div class="dmain">${main}</div></div>`;
  }

  function deskToday() {
    const habits = [['💤 Sleep 7h+', 1], ['🚶 10k steps', 1], ['💊 Vitamins / folic acid', 1], ['🧘 Stretch or yoga', 0], ['🧠 Mindful minute', 1], ['🥗 Fruit & veg', 0]];
    return deskShell('today', `<span class="dlabel">Tuesday 27 October</span><h4>Good morning 🌸</h4>
      <div class="dgrid"><div>
        <div class="dcard" style="display:grid;grid-template-columns:170px 1fr;gap:18px;align-items:center">
          <div class="mini-ring" style="width:170px">${B.ringSVG(kindsFor(28, 5, 14), 7, { label: 'Example cycle ring', w: 22 })}
            <div class="ctr"><span class="dlabel">Cycle day</span><b style="font-size:40px">7</b><span style="font-size:11px;color:var(--muted)">Follicular</span></div></div>
          <div><div class="dbig">Period in 21 days</div><span class="est" style="margin:8px 0 0">Estimate</span>
            <p style="color:var(--muted);margin-top:10px">Fertile window from 11 Nov. Predictions improve as you log more cycles.</p></div>
        </div>
        <div class="dcard rose"><h5>📝 Log today <span>EDIT</span></h5><div class="mini-chips"><span>Light</span><span>😌 Calm</span><span>Cramps</span><span>😴 8h sleep</span></div></div>
        <div class="dcard"><h5>Coming up <span>ESTIMATES</span></h5>
          <div class="drow"><span>🌿 Fertile window</span><span style="color:var(--muted)">11 – 17 Nov</span></div>
          <div class="drow"><span>✿ Ovulation</span><span style="color:var(--muted)">16 Nov</span></div>
          <div class="drow"><span>🌸 Next period</span><span style="color:var(--muted)">30 Nov</span></div></div>
      </div><div>
        <div class="dcard sky"><h5>💧 Water <span>GOAL 2,000 ML</span></h5>
          <div style="display:flex;gap:16px;align-items:center">
            <svg viewBox="0 0 92 120" width="56"><defs><clipPath id="dglass"><path d="M14 8h64l-8 104H22z"/></clipPath></defs><g clip-path="url(#dglass)"><rect width="92" height="120" fill="#EEF6FC"/><rect y="34" width="92" height="86" fill="#79BCE2"/></g><path d="M14 8h64l-8 104H22z" fill="none" stroke="#1E1B2E" stroke-width="3"/></svg>
            <div><div class="dbig">1,500 <span style="font-size:13px;color:var(--muted)">/ 2,000 ml</span></div><div style="color:#1F5D7A">Nice! 6/8 glasses</div></div></div></div>
        <div class="dcard mint"><h5>✨ Habits <span>4/6 TODAY</span></h5>${habits.map(([h, on]) => `<div class="dhabit"><span>${h}</span><i class="${on ? 'on' : ''}">${on ? '✓' : ''}</i></div>`).join('')}</div>
      </div></div>`);
  }

  function deskCalendar() {
    const now = new Date();
    const y = now.getFullYear(), m = now.getMonth();
    const first = new Date(y, m, 1);
    const lead = (first.getDay() + 6) % 7;
    const days = new Date(y, m + 1, 0).getDate();
    const td = now.getDate();
    let cells = ['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d) => `<div class="dow">${d}</div>`).join('');
    for (let i = 0; i < Math.ceil((lead + days) / 7) * 7; i++) {
      const d = i - lead + 1;
      if (d < 1 || d > days) { cells += '<div></div>'; continue; }
      const c = ['d'];
      if (d >= 2 && d <= 6) c.push('per');
      else if (d >= days - 1) c.push('pred');
      else if (d >= 11 && d <= 17) c.push('fer');
      if (d === 16) c.push('ovu');
      if (d === td) c.push('today');
      if (d < td && d % 3 !== 0) c.push('has');
      cells += `<div class="${c.join(' ')}">${d}</div>`;
    }
    return deskShell('calendar', `<span class="dlabel">Your month</span><h4>Calendar</h4>
      <div class="dgrid" style="grid-template-columns:1.4fr 1fr"><div class="dcard" style="padding:16px 20px">
        <h5>${first.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })} <span>‹ ›</span></h5><div class="dcal">${cells}</div>
        <div class="mini-legend" style="margin-top:12px;font-size:11px"><span><i style="background:var(--accent)"></i>Period</span><span><i style="border:1.5px dashed var(--accent)"></i>Predicted</span><span><i style="background:#CBE9E6"></i>Fertile</span><span style="color:var(--teal)">✿ Ovulation</span></div>
      </div><div>
        <div class="dcard"><h5>Coming up <span>ESTIMATES</span></h5>
          <div class="drow"><span>🌸 Next period</span><span style="color:var(--muted)">${days - 1}th</span></div>
          <div class="drow"><span>🌿 Fertile window</span><span style="color:var(--muted)">11th – 17th</span></div>
          <div class="drow"><span>✿ Ovulation</span><span style="color:var(--muted)">16th</span></div></div>
        <div class="dcard rose"><h5>📝 Today <span>EDIT</span></h5><div class="mini-chips"><span>Light</span><span>😌 Calm</span><span>Cramps</span></div></div>
        <div class="dcard"><h5>This month</h5><div class="drow"><span>Days with a log</span><span style="color:var(--muted)">18</span></div><div class="drow"><span>Water goal reached</span><span style="color:var(--muted)">12 days</span></div></div>
      </div></div>`);
  }

  function deskInsights() {
    const cyc = [29, 27, 28, 30, 28, 27];
    const water = [1750, 2000, 1500, 2250, 2000, 1250, 1500];
    const tile = (k, v, u) => `<div class="dcard" style="margin:0"><span class="dlabel">${k}</span><div class="dbig" style="margin-top:4px">${v} <span style="font-size:13px;color:var(--muted)">${u}</span></div></div>`;
    return deskShell('insights', `<span class="dlabel">Worked out in your browser</span><h4>Insights</h4>
      <div class="dtiles">${tile('Avg. cycle', 28, 'days')}${tile('Avg. period', 5, 'days')}${tile('Water a day', '1,750', 'ml')}${tile('Habits this week', '78', '%')}</div>
      <div class="dgrid3">
        <div class="dcard"><h5>🌸 Last 6 cycles</h5><div class="dbars">${cyc.map((c) => `<div><span style="color:var(--ink);font-weight:600">${c}</span><b style="height:${(c - 18) * 7}px"></b></div>`).join('')}</div></div>
        <div class="dcard"><h5>🩺 Common symptoms</h5>${[['Cramps', 90], ['Tired', 70], ['Bloating', 45], ['Headache', 30]].map(([s, w]) => `<div class="dhbar"><span>${s}</span><span><b style="width:${w}%"></b></span></div>`).join('')}</div>
        <div class="dcard sky"><h5>💧 Water this week</h5><div class="dbars">${water.map((w, i) => `<div><b style="height:${w / 25}px;background:${w >= 2000 ? '#2F7FAE' : '#79BCE2'}"></b>${'MTWTFSS'[i]}</div>`).join('')}</div></div>
      </div>
      <div class="dgrid3" style="margin-top:14px">
        <div class="dcard mint"><h5>✨ Habits this week</h5>${[['💤 Sleep', 86], ['💊 Vitamins', 100], ['🧘 Yoga', 43]].map(([s, w]) => `<div class="dhbar"><span>${s}</span><span style="background:rgba(255,255,255,.7)"><b style="width:${w}%"></b></span></div>`).join('')}</div>
        <div class="dcard"><h5>🌸 Self-care streak <span>BOT CHAIN</span></h5>
          <div style="display:flex;gap:8px">${[['🌷', '7 days', 1], ['🌻', '30 days', 0], ['💐', '100 days', 0]].map(([e, l, on]) => `<div style="flex:1;text-align:center;border-radius:12px;padding:8px 4px;background:${on ? 'var(--rose)' : 'var(--paper)'};font-size:11px;color:${on ? 'var(--accent-dark)' : 'var(--muted)'}"><div style="font-size:22px;${on ? '' : 'filter:grayscale(1);opacity:.45'}">${e}</div>${l}</div>`).join('')}</div></div>
        <div class="dcard lav"><h5>😊 Mood</h5><div class="dbig">Mostly calm</div><p style="color:var(--muted);margin-top:6px">Logged on 18 of the last 28 days.</p></div>
      </div>`);
  }

  // One screen at a time, cross-fading automatically. Tabs jump to a screen.
  function initHeroDesk() {
    const stage = $('#hero-desk');
    if (!stage) return;
    stage.innerHTML = [deskToday(), deskCalendar(), deskInsights()].map((h, i) => `<div class="dslide ${i === 0 ? 'on' : ''}" aria-hidden="${i !== 0}">${h}</div>`).join('');
    const slides = $$('.dslide', stage);
    const tabs = $$('#hero-seg button');
    let idx = 0;
    let timer = null;
    const fit = () => {
      const s = stage.clientWidth / 1040;
      slides.forEach((sl) => (sl.style.transform = `scale(${s})`));
      stage.style.height = `${600 * s}px`;
    };
    const show = (i) => {
      idx = i;
      slides.forEach((sl, n) => { sl.classList.toggle('on', n === i); sl.setAttribute('aria-hidden', String(n !== i)); });
      tabs.forEach((t, n) => t.setAttribute('aria-pressed', String(n === i)));
      stage.setAttribute('aria-label', `Bloomly app preview: ${tabs[i].textContent} screen`);
    };
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const start = () => {
      if (reduced) return;
      clearInterval(timer);
      timer = setInterval(() => { if (!document.hidden) show((idx + 1) % slides.length); }, 4500);
    };
    tabs.forEach((t) => t.addEventListener('click', () => { show(Number(t.dataset.slide)); start(); }));
    const frame = stage.closest('.frame');
    frame.addEventListener('mouseenter', () => clearInterval(timer));
    frame.addEventListener('mouseleave', start);
    if ('ResizeObserver' in window) new ResizeObserver(fit).observe(stage);
    else addEventListener('resize', fit);
    fit();
    start();
  }

  const STAGES = {
    cycle: {
      title: 'Know where you are in your cycle.',
      text: 'A colourful ring shows your period, fertile window and luteal days. Log flow, symptoms and mood in a few taps.',
      points: ['Next period, ovulation and fertile window (clearly marked as estimates)', 'A gentle note if your period may be late', 'Calendar with logged and predicted days']
    },
    ttc: {
      title: 'See your fertile window clearly.',
      text: 'Your estimated fertile days show in soft teal, with a small flower on ovulation day. Log discharge and symptoms alongside.',
      points: ['Fertile window: 5 days before to 1 day after ovulation', 'Predictions improve as you log more cycles', 'Honest notes when your cycles vary']
    },
    pregnancy: {
      title: 'Week by week, gently.',
      text: "Your week, trimester and due-date countdown, with how big baby is and three calm notes for each week.",
      points: ['A tip and a question to ask your midwife or doctor each week', 'Kick counter with a timer in the third trimester', 'Appointment list, saved on your device']
    },
    wellness: {
      title: 'Small habits, every day.',
      text: 'A glass that fills as you drink, and daily habits for sleep, steps, vitamins and calm. Add up to three of your own.',
      points: ['Water goal and glass size you choose', 'Weekly habit completion in Insights', 'Keep an anonymous self-care streak on BOT Chain']
    }
  };
  const stageState = { stage: 'cycle', view: 'today' };

  function renderStage() {
    const s = STAGES[stageState.stage];
    $('#stage-copy').innerHTML = `<h3>${s.title}</h3><p>${s.text}</p><ul>${s.points.map((p) => `<li>${p}</li>`).join('')}</ul>
      <button class="btn btn-primary" style="margin-top:24px" data-open-app="${stageState.stage === 'pregnancy' ? 'pregnancy' : stageState.stage === 'wellness' ? 'habits' : 'cycle'}">Try it now</button>`;
    $('#stage-shot').innerHTML = stageState.view === 'today' ? mockToday(stageState.stage) : mockCalendar(stageState.stage);
    $$('.tab').forEach((t) => t.setAttribute('aria-selected', String(t.dataset.stage === stageState.stage)));
    $('#stage-panel').setAttribute('aria-labelledby', `tab-${stageState.stage}`);
    $$('.stage-frame .seg button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.view === stageState.view)));
  }

  /* ---------------- Wallet labels + stats ---------------- */
  function updateWalletLabels() {
    const c = B.chain;
    $$('[data-wallet-label]').forEach((b) => {
      b.textContent = c.address ? (c.chainOk === false ? 'Switch to BOT Chain' : `● ${c.short(c.address)}`) : 'Connect wallet';
    });
  }

  async function loadStats() {
    const note = $('#stat-note');
    if (!B.chain.configured()) {
      note.textContent = 'Live numbers appear here once the Bloomly contract is deployed on BOT Chain. No made-up figures.';
      return;
    }
    try {
      const s = await B.chain.stats();
      if (!s) return;
      $('#stat-members').textContent = s.members.toLocaleString('en-GB');
      $('#stat-checkins').textContent = s.total.toLocaleString('en-GB');
    } catch (e) {
      note.textContent = "Couldn't reach BOT Chain right now. Numbers will appear when it's reachable.";
    }
  }

  async function connectFromSite() {
    const c = B.chain;
    if (!c.hasWallet()) {
      B.toast('MetaMask not found. Opening the download page…');
      window.open('https://metamask.io/download/', '_blank', 'noopener');
      return;
    }
    try {
      if (c.address && c.chainOk === false) await c.switchNetwork();
      else if (!c.address) { await c.connect(); B.toast('Wallet connected 🌸'); }
      else B.toast(`Connected as ${c.short(c.address)}`);
    } catch (e) {
      B.toast(c.errorKind(e) === 'rejected' ? 'Wallet connection cancelled' : 'Could not connect your wallet');
    }
  }

  /* ---------------- Init ---------------- */
  document.addEventListener('DOMContentLoaded', () => {
    const NET = B.NET;
    const CFG = window.BLOOMLY_CONFIG;

    // Hero: desktop app preview, one screen at a time
    initHeroDesk();
    renderStage();

    // Explorer + contract links
    const explorerUrl = B.chain.configured() ? B.chain.explorerAddress(NET.contract) : NET.explorer;
    $$('[data-explorer-link]').forEach((a) => (a.href = explorerUrl));
    if (B.chain.configured()) {
      $('#contract-addr').innerHTML = `Contract: <a href="${explorerUrl}" target="_blank" rel="noopener">${NET.contract}</a>`;
    } else {
      $('#contract-addr').textContent = `Contract on ${NET.name}: not deployed yet`;
    }
    if (CFG.repoUrl) $('#repo-link').href = CFG.repoUrl;
    else $('#repo-link').closest('li').remove();

    // Navbar shadow on scroll
    const nav = $('#nav');
    const onScroll = () => nav.classList.toggle('scrolled', scrollY > 8);
    addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    // Features dropdown
    const dd = $('#features-dd');
    const ddBtn = dd.querySelector('.dd-btn');
    const setDd = (open) => { dd.classList.toggle('open', open); ddBtn.setAttribute('aria-expanded', String(open)); };
    ddBtn.addEventListener('click', (e) => { e.stopPropagation(); setDd(!dd.classList.contains('open')); });
    document.addEventListener('click', (e) => { if (!dd.contains(e.target)) setDd(false); });
    dd.addEventListener('keydown', (e) => { if (e.key === 'Escape') { setDd(false); ddBtn.focus(); } });
    dd.querySelector('.dd-menu').addEventListener('click', (e) => { if (e.target.closest('a')) setDd(false); });

    // Mobile menu
    const burger = $('#burger');
    const mnav = $('#mnav');
    const setMenu = (open) => { mnav.classList.toggle('open', open); burger.setAttribute('aria-expanded', String(open)); };
    burger.addEventListener('click', () => setMenu(!mnav.classList.contains('open')));
    mnav.addEventListener('click', (e) => { if (e.target.closest('a,button')) setMenu(false); });

    // Stage tabs + Today/Calendar toggle
    $$('.tab').forEach((t) => t.addEventListener('click', () => { stageState.stage = t.dataset.stage; renderStage(); }));
    $('.tabs').addEventListener('keydown', (e) => {
      if (!['ArrowLeft', 'ArrowRight'].includes(e.key)) return;
      const list = $$('.tab');
      const i = list.findIndex((t) => t.dataset.stage === stageState.stage);
      const n = list[(i + (e.key === 'ArrowRight' ? 1 : list.length - 1)) % list.length];
      stageState.stage = n.dataset.stage; renderStage(); n.focus();
    });
    $$('.stage-frame .seg button').forEach((b) => b.addEventListener('click', () => { stageState.view = b.dataset.view; renderStage(); }));
    $$('[data-stage-link]').forEach((a) => a.addEventListener('click', () => { stageState.stage = a.dataset.stageLink; renderStage(); }));

    // Global buttons
    document.addEventListener('click', (e) => {
      const openBtn = e.target.closest('[data-open-app]');
      if (openBtn && !e.target.closest('#app')) {
        e.preventDefault();
        setDd(false); setMenu(false);
        B.app.open(openBtn.dataset.openApp || undefined);
        return;
      }
      const wallet = e.target.closest('[data-action="connect-wallet"]');
      if (wallet) { e.preventDefault(); connectFromSite(); }
    });

    // Reveal on scroll
    const io = 'IntersectionObserver' in window ? new IntersectionObserver((entries) => {
      entries.forEach((en) => { if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); } });
    }, { threshold: 0.12 }) : null;
    $$('.reveal').forEach((r) => (io ? io.observe(r) : r.classList.add('in')));

    // Chain
    B.chain.on(updateWalletLabels);
    B.chain.init();
    loadStats();

    // Open the app straight away with #app (handy for the installed PWA)
    if (location.hash === '#app') B.app.open();
  });
})();
