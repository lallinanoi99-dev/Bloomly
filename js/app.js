// Bloomly tracker app. All health data stays in this browser and is never sent anywhere.
'use strict';

(function () {
  const B = window.Bloomly;
  const { store, KEYS, esc, ymd, parse, today, addDays, diff, fmt, plural } = B;
  const $ = (s, r = document) => r.querySelector(s);

  const REMIND_MS = 90 * 60 * 1000;
  const MAX_CUSTOM_HABITS = 3;

  /* ---------------- Vocabulary ---------------- */
  const FLOW = [['started', '🌸 Started'], ['light', 'Light'], ['medium', 'Medium'], ['heavy', 'Heavy'], ['spotting', 'Spotting'], ['ended', 'Ended']];
  const SYMPTOMS = [['cramps', 'Cramps'], ['headache', 'Headache'], ['bloating', 'Bloating'], ['tender', 'Tender breasts'], ['acne', 'Acne'], ['backpain', 'Back pain'], ['tired', 'Tired'], ['nausea', 'Nausea'], ['cravings', 'Cravings']];
  const MOODS = [['happy', '😊 Happy'], ['calm', '😌 Calm'], ['sensitive', '🥹 Sensitive'], ['anxious', '😟 Anxious'], ['irritable', '😤 Irritable'], ['sad', '😢 Sad']];
  const DISCHARGE = [['dry', 'Dry'], ['sticky', 'Sticky'], ['creamy', 'Creamy'], ['watery', 'Watery'], ['eggwhite', 'Egg white']];
  const LABEL = Object.fromEntries([...FLOW, ...SYMPTOMS, ...MOODS, ...DISCHARGE]);
  const PHASE_TEXT = { Period: 'Period', Follicular: 'Follicular', Fertile: 'Fertile window', Ovulation: 'Ovulation', Luteal: 'Luteal', Late: 'Period due' };

  const ICON = {
    today: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12 3.2c2 1.7 2 4 0 5.8-2-1.8-2-4.1 0-5.8zM12 15c2 1.8 2 4.1 0 5.8-2-1.7-2-4 0-5.8zM3.2 12c1.7-2 4-2 5.8 0-1.8 2-4.1 2-5.8 0zM15 12c1.8-2 4.1-2 5.8 0-1.7 2-4 2-5.8 0z"/></svg>',
    calendar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><rect x="3.5" y="5" width="17" height="15" rx="3"/><path d="M3.5 10h17M8 3v4M16 3v4"/><circle cx="12" cy="15" r="1.6" fill="currentColor" stroke="none"/></svg>',
    insights: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M5 20V12M10 20V6M15 20v-9M20 20V9"/></svg>',
    me: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><circle cx="12" cy="8.5" r="3.8"/><path d="M4.5 20c1.2-4 4-5.6 7.5-5.6s6.3 1.6 7.5 5.6"/></svg>'
  };

  /* ---------------- State ---------------- */
  const A = {
    open: false,
    ready: false, // data loaded and setup done
    data: null,
    view: 'today',
    cal: { y: 0, m: 0 },
    weeks: null,
    setup: { step: 1, goal: 'cycle', draft: {} },
    kick: null, // { start, count }
    lastWaterAt: Date.now(),
    checkin: { stage: null },
    draft: null,
    dialogs: [],
    storageOK: store.available()
  };

  const el = {};
  const todayLog = () => A.data.logs[B.todayKey()] || {};
  const logFor = (k) => (A.data.logs[k] = A.data.logs[k] || {});
  const cleanLog = (k) => { if (!B.hasLogged(A.data.logs[k])) delete A.data.logs[k]; };

  /* ---------------- Persistence (this browser only) ---------------- */
  function save() {
    if (!A.storageOK || !A.data) return;
    store.set(KEYS.data, JSON.stringify(A.data));
    store.set(KEYS.setup, 'done');
  }
  function loadSaved() {
    if (store.get(KEYS.setup) !== 'done') return null;
    try { return B.normalise(JSON.parse(store.get(KEYS.data) || 'null')); } catch (e) { return null; }
  }

  async function loadWeeks() {
    if (A.weeks) return;
    try {
      const r = await fetch('data/weeks.json');
      A.weeks = (await r.json()).weeks;
    } catch (e) { A.weeks = {}; }
  }

  /* ---------------- Open / close ---------------- */
  function open(hint) {
    el.overlay.classList.add('open');
    el.overlay.setAttribute('aria-hidden', 'false');
    document.body.classList.add('locked');
    A.open = true;
    loadWeeks().then(() => { if (A.ready && A.view === 'today') renderScreen(); });
    if (A.ready) return renderMain();
    const saved = loadSaved();
    if (saved) {
      A.data = saved;
      A.ready = true;
      return renderMain();
    }
    A.setup = { step: 1, goal: ['cycle', 'pregnancy', 'habits'].includes(hint) ? hint : 'cycle', draft: {} };
    renderSetup();
  }

  function close() {
    closeSheet(true);
    el.overlay.classList.remove('open');
    el.overlay.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('locked');
    A.open = false;
  }

  /* ---------------- Sheet + dialogs ---------------- */
  let sheetToken = 0;
  function openSheet(title, body, foot = '') {
    el.sheetTitle.textContent = title;
    el.sheetBody.innerHTML = body;
    el.sheetFoot.innerHTML = foot;
    el.sheetFoot.style.display = foot ? '' : 'none';
    el.sheetRoot.classList.add('open');
    const token = ++sheetToken;
    requestAnimationFrame(() => requestAnimationFrame(() => { if (token === sheetToken) el.sheetRoot.classList.add('show'); }));
    el.sheetBody.scrollTop = 0;
  }
  function closeSheet(instant) {
    sheetToken++;
    el.sheetRoot.classList.remove('show');
    A.draft = null;
    const token = sheetToken;
    if (instant) el.sheetRoot.classList.remove('open');
    else setTimeout(() => { if (token === sheetToken) el.sheetRoot.classList.remove('open'); }, 260);
  }
  // buttons: [{ label, kind: 'primary'|'secondary'|'danger', fn }]
  function dialog(title, html, buttons = [{ label: 'OK', kind: 'primary' }]) {
    A.dialogs = buttons;
    const foot = buttons.map((b, i) => {
      const cls = b.kind === 'danger' ? 'btn btn-danger' : b.kind === 'secondary' ? 'btn btn-secondary' : 'btn btn-primary';
      return `<button class="${cls}" data-action="dialog" data-i="${i}">${esc(b.label)}</button>`;
    }).join('');
    openSheet(title, `<div style="font-size:15px;line-height:1.55">${html}</div>`, foot);
  }

  /* =========================================================
     Setup (2 short, skippable screens)
     ========================================================= */
  function stepsBar(n) { return `<div class="flow-steps">${[1, 2].map((i) => `<i class="${i <= n ? 'on' : ''}"></i>`).join('')}</div>`; }
  function flowHead() {
    return `<div class="app-head"><span class="logo"><svg aria-hidden="true"><use href="#logo"/></svg>bloomly</span><button class="icon-btn" data-action="close-app" aria-label="Close">✕</button></div>`;
  }

  function renderSetup() {
    const s = A.setup;
    const d = s.draft;
    let body = '';
    if (s.step === 1) {
      const goal = (id, art, vb, title, sub) => `
        <button class="goal" data-action="setup-goal" data-goal="${id}" aria-pressed="${s.goal === id}">
          <svg viewBox="${vb}" aria-hidden="true"><use href="#${art}"/></svg><span><b>${title}</b><small>${sub}</small></span>
        </button>`;
      body = `${stepsBar(1)}
        <h2>What would you like <em>to track?</em></h2>
        <p class="sub">You can change this any time in Me.</p>
        ${goal('cycle', 'tulip', '0 0 120 100', 'Track my cycle', 'Period, symptoms, mood and predictions')}
        ${goal('pregnancy', 'seed', '0 0 120 100', "I'm pregnant", 'Week by week, due date, kick counter')}
        ${goal('habits', 'kaleido', '0 0 120 120', 'Just healthy habits', 'Water, sleep, steps, vitamins')}
        <button class="text-btn" style="margin-top:6px" data-action="import-start">Restore from a backup instead</button>
        <div class="flow-nav"><button class="btn btn-secondary" data-action="setup-skip">Skip</button><button class="btn btn-primary" data-action="setup-next">Next</button></div>`;
    } else {
      const max = B.todayKey();
      if (s.goal === 'cycle') {
        body = `${stepsBar(2)}
          <h2>Your <em>cycle</em></h2>
          <p class="sub">Rough answers are fine. Predictions improve as you log.</p>
          <label class="field"><span>First day of your last period</span><input class="input" type="date" id="su-last" max="${max}" value="${esc(d.lastPeriod || '')}"></label>
          <div class="field"><span>Usual period length</span>${stepper('su-plen', d.periodLen || 5, 2, 10, 'days')}</div>
          <div class="field"><span>Usual cycle length</span>${stepper('su-clen', d.cycleLen || 28, 20, 45, 'days')}</div>
          <label class="check"><input type="checkbox" id="su-unsure" ${d.cycleUnsure ? 'checked' : ''}> I'm not sure (use 28 days)</label>`;
      } else if (s.goal === 'pregnancy') {
        body = `${stepsBar(2)}
          <h2>Your <em>pregnancy</em></h2>
          <p class="sub">Add your due date, or the first day of your last period and we'll work it out.</p>
          <label class="field"><span>Due date</span><input class="input" type="date" id="su-due" value="${esc(d.dueDate || '')}"></label>
          <p class="small muted" style="margin:-4px 0 12px;text-align:center">or</p>
          <label class="field"><span>First day of last period</span><input class="input" type="date" id="su-lmp" max="${max}" value="${esc(d.pregLmp || '')}"></label>
          <div class="calc-note" id="su-calc">Due date = first day of last period + 280 days.</div>`;
      } else {
        body = `${stepsBar(2)}
          <h2>Your <em>daily goals</em></h2>
          <p class="sub">We'll start you with six gentle habits. You can add up to three of your own later.</p>
          <div class="field"><span>Daily water goal</span>${stepper('su-water', d.waterGoal || 2000, 500, 4000, 'ml', 250)}</div>
          <div class="card mint" style="margin-top:6px">${B.DEFAULT_HABITS.map((h) => `<div class="habit" style="cursor:default"><span class="ic">${h.icon}</span><span class="nm">${esc(h.name)}</span></div>`).join('')}</div>`;
      }
      body += `<p class="small muted" style="margin-top:14px">Everything you enter stays in this browser. Nothing is sent to a server or the blockchain.</p>
        <div class="flow-nav"><button class="btn btn-secondary" data-action="setup-back">Back</button><button class="btn btn-secondary" data-action="setup-skip">Skip</button><button class="btn btn-primary" data-action="setup-next">Start</button></div>`;
    }
    el.view.innerHTML = `${flowHead()}<div class="flow">${body}</div>`;
    if (s.step === 2 && s.goal === 'pregnancy') updateDueCalc();
  }

  function stepper(id, value, min, max, unit, step = 1) {
    return `<div class="stepper" data-stepper="${id}" data-min="${min}" data-max="${max}" data-step="${step}">
      <button type="button" data-action="step" data-dir="-1" aria-label="Less">−</button>
      <output id="${id}" data-value="${value}">${value.toLocaleString('en-GB')} ${unit}</output>
      <button type="button" data-action="step" data-dir="1" aria-label="More">+</button></div>`;
  }
  const stepperVal = (id) => Number(($('#' + id) || {}).dataset?.value);

  function readSetupStep2() {
    const s = A.setup;
    const d = s.draft;
    if (s.goal === 'cycle') {
      d.lastPeriod = $('#su-last').value || null;
      d.periodLen = stepperVal('su-plen');
      d.cycleLen = stepperVal('su-clen');
      d.cycleUnsure = $('#su-unsure').checked;
    } else if (s.goal === 'pregnancy') {
      d.dueDate = $('#su-due').value || null;
      d.pregLmp = $('#su-lmp').value || null;
    } else {
      d.waterGoal = stepperVal('su-water');
    }
  }

  function updateDueCalc() {
    const box = $('#su-calc');
    if (!box) return;
    const p = B.preg({ settings: { dueDate: $('#su-due').value, pregLmp: $('#su-lmp').value } });
    if (!p) { box.textContent = 'Due date = first day of last period + 280 days.'; return; }
    box.innerHTML = p.week >= 0
      ? `Due <b>${fmt(p.due, { day: 'numeric', month: 'long', year: 'numeric' })}</b> · you're in <b>week ${p.week}</b>.`
      : `Due <b>${fmt(p.due, { day: 'numeric', month: 'long', year: 'numeric' })}</b>.`;
  }

  function finishSetup() {
    const data = B.defaultData();
    const s = A.setup;
    const d = s.draft;
    data.mode = s.goal;
    if (d.lastPeriod) data.settings.lastPeriod = d.lastPeriod;
    if (d.periodLen) data.settings.periodLen = d.periodLen;
    if (d.cycleLen) data.settings.cycleLen = d.cycleLen;
    data.settings.cycleUnsure = !!d.cycleUnsure;
    if (d.dueDate) data.settings.dueDate = d.dueDate;
    if (d.pregLmp) data.settings.pregLmp = d.pregLmp;
    if (d.waterGoal) data.settings.waterGoal = d.waterGoal;
    A.data = data;
    A.ready = true;
    save();
    A.view = 'today';
    renderMain();
    B.toast('All set 🌸');
  }

  /* =========================================================
     Main app shell
     ========================================================= */
  function renderMain() {
    const tabs = [['today', 'Today'], ['calendar', 'Calendar'], ['insights', 'Insights'], ['me', 'Me']];
    // Phones: header, content, check-in, bottom tabs (stacked).
    // Tablet / desktop: a left sidebar (header, nav, check-in) and a wide main area.
    el.view.innerHTML = `
      <div class="app-layout">
        <aside class="app-side">
          <div class="app-head">
            <span class="logo"><svg aria-hidden="true"><use href="#logo"/></svg>bloomly</span>
            <div class="head-right">
              <button class="icon-btn" data-action="close-app" aria-label="Close app">✕</button>
            </div>
            <span id="head-wallet"></span>
          </div>
          <nav class="app-dock" aria-label="App"><div class="tabbar">
            ${tabs.map(([id, label]) => `<button data-action="tab" data-view="${id}" ${A.view === id ? 'aria-current="page"' : ''}>${ICON[id]}<span>${label}</span></button>`).join('')}
          </div></nav>
          <div id="dock-checkin"></div>
          <button class="btn btn-secondary btn-sm side-back" data-action="close-app">← Back to website</button>
        </aside>
        <section class="app-main">
          <div id="banners"></div>
          <div class="app-scroll" id="app-scroll"></div>
        </section>
      </div>`;
    el.scroll = $('#app-scroll');
    renderScreen(true);
  }

  function renderScreen(resetScroll) {
    if (!A.ready || !el.scroll || !document.body.contains(el.scroll)) return;
    const top = el.scroll.scrollTop;
    const html = { today: viewToday, calendar: viewCalendar, insights: viewInsights, me: viewMe }[A.view]();
    el.scroll.innerHTML = `<div class="screen screen-${A.view}">${html}</div>`;
    el.scroll.scrollTop = resetScroll ? 0 : top;
    document.querySelectorAll('.tabbar button').forEach((b) => {
      if (b.dataset.view === A.view) b.setAttribute('aria-current', 'page');
      else b.removeAttribute('aria-current');
    });
    renderHead();
    renderBanners();
    renderDock();
  }

  function renderHead() {
    const h = $('#head-wallet');
    if (!h) return;
    const c = B.chain;
    if (!c.address) { h.innerHTML = ''; return; }
    h.innerHTML = c.chainOk === false
      ? `<button class="pill warn" data-action="switch-net">Wrong network</button>`
      : `<span class="pill ok" title="${esc(c.address)}">● ${esc(c.short(c.address))}</span>`;
  }

  function renderBanners() {
    const b = $('#banners');
    if (!b) return;
    let html = '';
    if (!A.storageOK) html += `<div class="app-banner warn">Private mode: data won't be saved on this device.</div>`;
    if (B.chain.address && B.chain.chainOk === false) html += `<div class="app-banner warn"><span>Your wallet is on another network.</span><button data-action="switch-net">Switch to BOT Chain</button></div>`;
    if (A.view === 'today' && waterReminderDue()) html += `<div class="app-banner info"><span>💧 Time for a glass of water?</span><button data-action="water-add">+ ${A.data.settings.glassMl} ml</button><button data-action="dismiss-remind" aria-label="Dismiss">✕</button></div>`;
    b.innerHTML = html;
  }

  /* ---------------- Check-in dock ---------------- */
  function renderDock() {
    const d = $('#dock-checkin');
    if (!d) return;
    // On phones the check-in only shows on Today; in the desktop sidebar it's always there.
    d.classList.toggle('not-today', A.view !== 'today');
    const c = B.chain;
    const logged = B.hasLogged(todayLog());
    const streak = c.currentStreak();
    let btn, note = '';
    if (A.checkin.stage === 'wallet') {
      btn = `<button class="checkin busy" disabled>Confirm in your wallet…</button>`;
      note = 'Only an anonymous check-in is sent. Nothing you logged.';
    } else if (A.checkin.stage === 'pending') {
      btn = `<button class="checkin busy" disabled>Checking in on BOT Chain…</button>`;
      note = 'Waiting for the transaction to confirm.';
    } else if (c.checkedInToday()) {
      btn = `<button class="checkin done" disabled>Checked in ✓ — see you tomorrow</button>`;
      note = `🌸 ${plural(c.streak.current, 'day')} streak`;
    } else if (!logged) {
      btn = `<button class="checkin soft" data-action="log-open">Log something today to check in</button>`;
      note = 'Your check-in never includes what you log.';
    } else {
      btn = `<button class="checkin" data-action="checkin">Check in on BOT Chain <span class="flame">🌸 ${streak}</span></button>`;
      if (!c.hasWallet()) note = 'Needs MetaMask. Your tracking works without it.';
      else if (!c.address) note = 'Connect your wallet to keep a streak.';
      else if (c.isBroken()) note = 'New streak, fresh start 🌱';
      else note = 'Anonymous: it says "I took care of myself today".';
    }
    d.innerHTML = `<div class="checkin-wrap">${btn}<div class="checkin-note">${esc(note)}</div></div>`;
  }

  async function doCheckIn() {
    const c = B.chain;
    if (!B.hasLogged(todayLog())) return openLog(B.todayKey());
    if (!c.hasWallet()) return dialogInstall();
    if (!c.configured()) {
      return dialog('Check-ins are not live yet', '<p>The Bloomly contract address hasn\'t been added to this site yet. Everything else works as normal.</p>');
    }
    if (!window.ethers) return B.toast('Could not load the wallet library. Check your connection.');
    try {
      if (!c.address && !(await c.connect())) return;
    } catch (e) {
      return B.toast(c.errorKind(e) === 'rejected' ? 'Wallet connection cancelled' : 'Could not connect your wallet');
    }
    if (!c.chainOk) {
      try { await c.switchNetwork(); } catch (e) { /* handled below */ }
      if (!c.chainOk) return B.toast('Please switch to BOT Chain to check in');
    }
    if (c.checkedInToday()) { renderDock(); return B.toast('Already checked in today 🌸'); }
    const before = c.streak ? { ...c.streak } : null;
    A.checkin.stage = 'wallet';
    renderDock();
    try {
      const s = await c.checkIn((stage) => { A.checkin.stage = stage; renderDock(); });
      A.checkin.stage = null;
      renderDock();
      B.petals();
      const fresh = s && s.current === 1 && before && before.total > 0;
      if (s && [7, 30, 100].includes(s.current)) showMilestone(s.current);
      else B.toast(fresh ? 'New streak, fresh start 🌱' : `Day ${s ? s.current : 1} streak 🌸`, 4000);
    } catch (e) {
      A.checkin.stage = null;
      const kind = c.errorKind(e);
      if (kind === 'rejected') B.toast('Check-in cancelled. You can try again any time.');
      else if (kind === 'already') { await c.refresh(); B.toast('Already checked in today 🌸'); }
      else if (kind === 'funds') dialog('Not enough BOT for the fee', '<p>A check-in needs a tiny amount of BOT to pay the network fee. Add some to your wallet and try again.</p>');
      else { console.error(e); B.toast('Check-in failed. Please try again.'); }
      renderDock();
    }
  }

  function showMilestone(n) {
    const art = { 7: '🌷', 30: '🌻', 100: '💐' }[n];
    dialog(`${n}-day streak!`, `<div style="text-align:center"><div style="font-size:72px;line-height:1.2">${art}</div>
      <p style="margin-top:8px">You've checked in ${n} days in a row. That's a lovely habit of looking after yourself.</p>
      <p class="small muted" style="margin-top:8px">Badge earned: ${n} days</p></div>`, [{ label: 'Thank you', kind: 'primary' }]);
  }

  function dialogInstall() {
    dialog('Install MetaMask', `<p>The daily streak uses a free MetaMask wallet on BOT Chain. All tracking works without it.</p>
      <p style="margin-top:12px"><a class="link-arrow" href="https://metamask.io/download/" target="_blank" rel="noopener">Get MetaMask ↗</a></p>`);
  }

  /* =========================================================
     TODAY
     ========================================================= */
  function greeting() {
    const h = new Date().getHours();
    return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
  }

  function viewToday() {
    const mode = A.data.mode;
    let html = `<p class="label" style="color:var(--muted);margin:2px 2px 0">${esc(fmt(today(), { weekday: 'long', day: 'numeric', month: 'long' }))}</p>
      <h2 class="screen-title">${greeting()} <em>🌸</em></h2>`;
    // Two columns on wide screens; one stacked column on phones.
    let left, right;
    if (mode === 'pregnancy') {
      const p = B.preg(A.data);
      left = pregSection() + logCard();
      right = waterCard() + habitsCard() + (p && p.week <= 42 ? appointmentsCard() : '');
    } else if (mode === 'habits') {
      left = habitsCard() + logCard();
      right = waterCard();
    } else {
      left = cycleSection() + logCard();
      right = waterCard() + habitsCard();
    }
    html += `<div class="today-grid"><div class="col">${left}</div><div class="col">${right}</div></div>`;
    html += `<p class="tiny muted" style="text-align:center;margin:8px 10px 0">Estimates for information only. Not medical advice and not birth control.</p>`;
    return html;
  }

  function cycleSection() {
    const m = B.cycle(A.data);
    if (!m.hasData) {
      return `<div class="card rose ring-card">
        <svg viewBox="0 0 120 100" style="width:110px;margin:0 auto" aria-hidden="true"><use href="#tulip"/></svg>
        <div class="ring-headline">Let's start your cycle ring</div>
        <p class="ring-sub" style="margin-bottom:12px">Log the first day of your period, or add your last period date.</p>
        <div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap">
          <button class="btn btn-primary btn-sm" data-action="log-open">Log period</button>
          <button class="btn btn-secondary btn-sm" data-action="tab" data-view="me">Add last period</button>
        </div></div>`;
    }
    let html = '';
    if (m.late) {
      html += `<div class="alert"><h3>Your period may be late</h3>
        <p>It's ${plural(-m.daysUntil, 'day')} after the estimated start. Cycles shift for lots of reasons, like stress, travel or illness. If you're worried, talk to a doctor.</p>
        <div class="btns"><button class="btn btn-primary btn-sm" data-action="log-open">Log period</button>
        <button class="btn btn-secondary btn-sm" data-action="set-mode" data-mode="pregnancy">Switch to pregnancy mode</button></div></div>`;
    }
    const n = Math.max(m.cycleLen, m.day);
    const kinds = Array.from({ length: n }, (_, i) => B.dayKind(m, A.data, i + 1));
    let headline;
    const du = m.daysUntil;
    if (m.phase === 'Period') headline = `Period · day ${m.day}`;
    else if (du < 0) headline = `Period expected ${plural(-du, 'day')} ago`;
    else if (du === 0) headline = 'Period may start today';
    else if (m.phase === 'Ovulation') headline = `Ovulation day · period in ${plural(du, 'day')}`;
    else if (m.phase === 'Fertile') headline = `Fertile window · period in ${plural(du, 'day')}`;
    else headline = `Period in ${plural(du, 'day')}`;
    const sub = m.irregular ? 'Your cycles vary — predictions are less certain.'
      : !m.enough ? 'Predictions improve as you log more cycles.'
        : `Based on your last ${plural(m.recent.length, 'cycle')}.`;
    html += `<div class="card ring-card">
      <div class="ring">${B.ringSVG(kinds, m.day, { label: `Cycle day ${m.day} of ${m.cycleLen}` })}
        <div class="ring-center"><span class="k">Cycle day</span><b>${m.day}</b><span class="small muted">of ${m.cycleLen}</span>
        <span class="phase-pill phase-${m.phase}">${PHASE_TEXT[m.phase]}</span></div></div>
      <div class="ring-headline">${headline}<span class="est">Estimate</span></div>
      <div class="ring-sub">${sub}</div>
      <div class="legend"><span><i style="background:#C2456B"></i>Period</span><span><i style="background:#7CCAC3"></i>Fertile</span><span><i style="background:#2F9C95"></i>Ovulation</span><span><i style="background:#C9BCF0"></i>Luteal</span></div>
    </div>`;
    return html;
  }

  function pregSection() {
    const p = B.preg(A.data);
    if (!p) {
      return `<div class="card lav ring-card"><svg viewBox="0 0 120 100" style="width:110px;margin:0 auto" aria-hidden="true"><use href="#seed"/></svg>
        <div class="ring-headline">Add your due date</div><p class="ring-sub" style="margin-bottom:12px">Or the first day of your last period. We'll work out your week.</p>
        <button class="btn btn-primary btn-sm" data-action="tab" data-view="me">Add dates</button></div>`;
    }
    let html = '';
    if (p.week > 42) {
      return `<div class="card lav"><h3 style="font-family:var(--sans);font-size:22px;font-weight:500">Congratulations! 🎉</h3>
        <p style="margin-top:6px">Your due date has passed. Would you like to switch what you're tracking?</p>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px">
          <button class="btn btn-primary btn-sm" data-action="set-mode" data-mode="cycle">Track my cycle</button>
          <button class="btn btn-secondary btn-sm" data-action="set-mode" data-mode="habits">Habits only</button></div></div>` + appointmentsCard();
    }
    const tri = ['1st', '2nd', '3rd'][p.tri - 1];
    const wk = A.weeks ? A.weeks[String(Math.min(40, Math.max(4, p.week)))] : null;
    const due = fmt(p.due, { day: 'numeric', month: 'short', year: 'numeric' });
    const countdown = p.daysLeft > 0 ? `${plural(p.daysLeft, 'day')} to go` : p.daysLeft === 0 ? 'Due today' : `${plural(-p.daysLeft, 'day')} past your due date`;
    html += `<div class="card lav">
      <div class="preg-top"><div><span class="label" style="color:#5B4A99">${tri} trimester</span>
        <div class="preg-week">Week ${Math.max(0, p.week)} · Day ${p.day}</div>
        <div class="small muted">Due ${due} · ${countdown}</div></div>
        <div class="preg-fruit" aria-hidden="true">${p.week < 4 ? '🌱' : wk ? wk.emoji : '🌱'}</div></div>`;
    if (p.week < 4) {
      html += `<p style="margin-top:12px">Early days! Week-by-week notes start from week 4.</p>`;
    } else if (wk) {
      html += `<p style="margin-top:12px">Baby is about the size of a <b>${esc(wk.fruit)}</b> (${esc(wk.size)}).</p>
        <div class="preg-notes">
          <div class="preg-note"><span class="k">This week</span>${esc(wk.body)}</div>
          <div class="preg-note"><span class="k">A tip for you</span>${esc(wk.tip)}</div>
          <div class="preg-note"><span class="k">Ask your midwife or doctor</span>${esc(wk.ask)}</div>
        </div>`;
      if (p.week > 40) html += `<p class="small" style="margin-top:10px">You're past your due date. Your midwife or doctor will talk you through what happens next.</p>`;
    }
    html += `<p class="tiny muted" style="margin-top:10px">General information only. Contact your doctor or midwife about any concern.</p></div>`;
    if (p.tri === 3) html += kickCard();
    return html;
  }

  function kickCard() {
    const total = todayLog().kicks || 0;
    const k = A.kick;
    if (!k) {
      return `<div class="card"><div class="card-head"><h3>👶 Kick counter</h3><span class="tiny muted">Today: ${total}</span></div>
        <p class="small muted">Tap once for each movement and watch the timer.</p>
        <button class="btn btn-primary btn-block" style="margin-top:12px" data-action="kick-start">Start counting</button>
        <p class="tiny muted" style="margin-top:10px">Get to know your baby's usual pattern. If movements slow down or change, contact your midwife or doctor straight away.</p></div>`;
    }
    return `<div class="card"><div class="card-head"><h3>👶 Kick counter</h3><span class="tiny muted">Today: ${total}</span></div>
      <div class="kick-stats"><div><b>${k.count}</b><span class="tiny muted">this session</span></div><div><b id="kick-time">${kickTime()}</b><span class="tiny muted">time</span></div></div>
      <button class="kick-big" data-action="kick-tap">Tap for each movement</button>
      <button class="btn btn-secondary btn-block" style="margin-top:8px" data-action="kick-stop">Finish session</button></div>`;
  }
  function kickTime() {
    const s = Math.floor((Date.now() - A.kick.start) / 1000);
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  }
  setInterval(() => { const t = $('#kick-time'); if (t && A.kick) t.textContent = kickTime(); }, 1000);

  function appointmentsCard() {
    const t = B.todayKey();
    const list = [...A.data.appointments].sort((a, b) => a.date.localeCompare(b.date));
    const upcoming = list.filter((a) => a.date >= t);
    const past = list.length - upcoming.length;
    const rows = upcoming.map((a) => `<div class="appt"><span class="dt">${esc(fmt(parse(a.date), { day: 'numeric', month: 'short' }))}</span><span class="tx">${esc(a.note || 'Appointment')}</span>
      <button class="icon-btn" style="width:32px;height:32px" data-action="appt-del" data-id="${esc(a.id)}" aria-label="Remove appointment">✕</button></div>`).join('');
    return `<div class="card"><div class="card-head"><h3>📅 Appointments</h3><span class="tiny muted">${past ? `${past} past` : 'Stored on this device'}</span></div>
      ${rows || '<p class="small muted">No upcoming appointments yet.</p>'}
      <div class="row-form"><input class="input" type="date" id="appt-date" min="${t}" aria-label="Appointment date">
      <input class="input" type="text" id="appt-note" maxlength="80" placeholder="e.g. 20-week scan" aria-label="Appointment note">
      <button class="btn btn-primary" data-action="appt-add">Add</button></div></div>`;
  }

  function logSummaryChips(log) {
    const chips = [];
    if (log.flow) chips.push(LABEL[log.flow]);
    (log.symptoms || []).forEach((s) => chips.push(LABEL[s]));
    if (log.mood) chips.push(LABEL[log.mood]);
    if (log.discharge) chips.push(`Discharge: ${LABEL[log.discharge]}`);
    if (log.sleep) chips.push(`😴 ${log.sleep}h sleep`);
    if (log.notes) chips.push('📝 Note');
    return chips;
  }

  function logCard() {
    const log = todayLog();
    const chips = logSummaryChips(log);
    const color = A.data.mode === 'pregnancy' ? 'lav' : A.data.mode === 'habits' ? 'peach' : 'rose';
    return `<div class="card ${color}"><div class="card-head"><h3>📝 Log today</h3>${chips.length ? '<button class="text-btn" data-action="log-open">Edit</button>' : ''}</div>
      ${chips.length ? `<div class="chips">${chips.map((c) => `<span class="chip static">${esc(c)}</span>`).join('')}</div>`
        : `<p class="small" style="color:#4B4558">How are you feeling? A few taps is enough.</p><button class="btn btn-primary btn-block" style="margin-top:12px" data-action="log-open">Log today</button>`}
    </div>`;
  }

  function waterStreak() {
    const goal = A.data.settings.waterGoal;
    let d = today();
    if (!((A.data.logs[ymd(d)] || {}).water >= goal)) d = addDays(d, -1);
    let n = 0;
    while (((A.data.logs[ymd(d)] || {}).water || 0) >= goal && n < 3650) { n++; d = addDays(d, -1); }
    return n;
  }

  function waterCard() {
    const { waterGoal: goal, glassMl } = A.data.settings;
    const ml = todayLog().water || 0;
    const total = Math.max(1, Math.ceil(goal / glassMl));
    const count = Math.floor(ml / glassMl);
    const pct = Math.min(1, ml / goal);
    const msg = ml === 0 ? 'Start with one glass 💧' : ml >= goal ? 'Goal reached — lovely! 🎉' : `Nice! ${count}/${total} glasses`;
    const streak = waterStreak();
    return `<div class="card sky" id="water-card"><div class="card-head"><h3>💧 Water</h3><span class="tiny muted">Goal ${goal.toLocaleString('en-GB')} ml</span></div>
      <div class="water">
        <svg class="glass-svg" viewBox="0 0 92 120" role="img" aria-label="Glass ${Math.round(pct * 100)}% full">
          <defs><clipPath id="glass-clip"><path d="M14 8h64l-8 104H22z"/></clipPath></defs>
          <g clip-path="url(#glass-clip)"><rect width="92" height="120" fill="#EEF6FC"/>
            <rect class="glass-fill" x="0" y="8" width="92" height="104" fill="#79BCE2" style="transform:scaleY(${pct.toFixed(3)})"/></g>
          <path d="M14 8h64l-8 104H22z" fill="none" stroke="#1E1B2E" stroke-width="2.5" stroke-linejoin="round"/>
          <path d="M25 20l-4 62" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".8"/>
        </svg>
        <div><div class="water-num">${ml.toLocaleString('en-GB')} <span class="small muted">/ ${goal.toLocaleString('en-GB')} ml</span></div>
          <div class="water-msg" aria-live="polite">${msg}</div>
          <div class="glasses">${Array.from({ length: Math.min(total, 16) }, (_, i) => `<button class="g ${i < count ? 'on' : ''}" data-action="water-set" data-i="${i}" aria-label="Set to ${i + 1} glasses"></button>`).join('')}</div>
        </div>
      </div>
      <div class="water-actions"><button class="btn btn-secondary btn-sm" data-action="water-undo" ${ml ? '' : 'disabled'}>Undo</button>
        <button class="btn btn-water" data-action="water-add">+ ${glassMl} ml</button></div>
      ${streak > 1 ? `<p class="tiny" style="margin-top:10px;color:#1F5D7A">🔥 ${streak}-day water goal streak</p>` : ''}
    </div>`;
  }

  function habitsCard() {
    const done = todayLog().habits || [];
    const n = A.data.habits.filter((h) => done.includes(h.id)).length;
    const pct = A.data.habits.length ? Math.round((n / A.data.habits.length) * 100) : 0;
    return `<div class="card mint"><div class="card-head"><h3>✨ Habits</h3><span class="tiny muted">${n}/${A.data.habits.length} today</span></div>
      <div class="progress" style="margin-bottom:6px"><i style="width:${pct}%"></i></div>
      ${A.data.habits.map((h) => `<button class="habit" data-action="habit" data-id="${esc(h.id)}" aria-pressed="${done.includes(h.id)}">
        <span class="ic">${esc(h.icon)}</span><span class="nm">${esc(h.name)}</span><span class="tick">✓</span></button>`).join('')}
      <button class="text-btn" style="margin-top:6px" data-action="tab" data-view="me" data-scroll="habits">Edit habits</button></div>`;
  }

  function waterReminderDue() {
    if (!A.data) return false;
    const h = new Date().getHours();
    return (todayLog().water || 0) < A.data.settings.waterGoal && h >= 8 && h < 22 && Date.now() - A.lastWaterAt > REMIND_MS;
  }
  setInterval(() => { if (A.open && A.ready && A.view === 'today') renderBanners(); }, 60 * 1000);

  /* ---------------- Water / habit actions ---------------- */
  function setWater(ml) {
    const k = B.todayKey();
    const log = logFor(k);
    log.water = Math.max(0, Math.min(ml, 10000));
    cleanLog(k);
    A.lastWaterAt = Date.now();
    save();
    renderScreen();
  }

  function toggleHabit(id) {
    const k = B.todayKey();
    const log = logFor(k);
    const set = new Set(log.habits || []);
    set.has(id) ? set.delete(id) : set.add(id);
    log.habits = [...set];
    cleanLog(k);
    save();
    renderScreen();
  }

  /* =========================================================
     Log sheet (today or any past day)
     ========================================================= */
  function openLog(key) {
    const isToday = key === B.todayKey();
    const log = A.data.logs[key] || {};
    A.draft = {
      key,
      flow: log.flow || null,
      symptoms: [...(log.symptoms || [])],
      mood: log.mood || null,
      discharge: log.discharge || null,
      sleep: log.sleep || 0,
      notes: log.notes || ''
    };
    const group = (title, name, items, multi) => `<div class="chip-group"><span class="k">${title}</span><div class="chips" role="group" aria-label="${title}">
      ${items.map(([v, l]) => `<button type="button" class="chip" data-action="chip" data-group="${name}" data-val="${v}" data-multi="${multi ? 1 : 0}" aria-pressed="${multi ? A.draft[name].includes(v) : A.draft[name] === v}">${l}</button>`).join('')}</div></div>`;
    const extra = [];
    if (!isToday && log.water) extra.push(`💧 ${log.water.toLocaleString('en-GB')} ml water`);
    if (!isToday && log.habits && log.habits.length) extra.push(`✨ ${plural(log.habits.length, 'habit')} done`);
    if (log.kicks) extra.push(`👶 ${plural(log.kicks, 'kick')}`);
    const body = `
      ${extra.length ? `<div class="chips" style="margin-bottom:14px">${extra.map((e) => `<span class="chip static" style="background:var(--paper)">${e}</span>`).join('')}</div>` : ''}
      ${A.data.mode !== 'pregnancy' ? group('Period', 'flow', FLOW, false) : ''}
      ${group('Symptoms', 'symptoms', SYMPTOMS, true)}
      ${group('Mood', 'mood', MOODS, false)}
      ${group('Discharge', 'discharge', DISCHARGE, false)}
      <div class="chip-group"><span class="k">Sleep</span>
        <div class="stepper" data-sleep><button type="button" data-action="sleep" data-dir="-0.5" aria-label="Less sleep">−</button>
        <output id="sleep-out">${A.draft.sleep ? A.draft.sleep + ' h' : '—'}</output>
        <button type="button" data-action="sleep" data-dir="0.5" aria-label="More sleep">+</button></div></div>
      <label class="chip-group" style="display:block"><span class="k">Notes</span>
        <textarea class="input" id="log-notes" maxlength="200" placeholder="Anything you'd like to remember (stays on this device)">${esc(A.draft.notes)}</textarea></label>`;
    const foot = `<button class="btn btn-primary" data-action="log-save">Save</button>
      ${B.hasLogged(log) ? '<button class="btn btn-secondary" data-action="log-clear">Clear this day</button>' : ''}`;
    openSheet(isToday ? 'Log today' : fmt(parse(key), { weekday: 'long', day: 'numeric', month: 'long' }), body, foot);
  }

  function saveLog() {
    const d = A.draft;
    if (!d) return;
    const log = logFor(d.key);
    const notes = ($('#log-notes') || {}).value || '';
    const set = (k, v) => { if (v && (!Array.isArray(v) || v.length)) log[k] = v; else delete log[k]; };
    if (A.data.mode !== 'pregnancy') set('flow', d.flow);
    set('symptoms', d.symptoms);
    set('mood', d.mood);
    set('discharge', d.discharge);
    set('sleep', d.sleep || null);
    set('notes', notes.trim().slice(0, 200));
    cleanLog(d.key);
    save();
    closeSheet();
    renderScreen();
    B.toast('Saved 🌸');
  }

  /* =========================================================
     CALENDAR
     ========================================================= */
  function viewCalendar() {
    const { y, m } = A.cal;
    const first = new Date(y, m, 1);
    const lead = (first.getDay() + 6) % 7; // Monday first
    const days = new Date(y, m + 1, 0).getDate();
    const t = today();
    const mode = A.data.mode;
    const model = B.cycle(A.data);
    const marks = mode === 'cycle' ? B.calendarMarks(A.data, model) : {};
    const preg = mode === 'pregnancy' ? B.preg(A.data) : null;

    let cells = ['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d) => `<div class="dow" aria-hidden="true">${d}</div>`).join('');
    const total = Math.ceil((lead + days) / 7) * 7;
    for (let i = 0; i < total; i++) {
      const d = addDays(first, i - lead);
      if (preg && i % 7 === 0) {
        const wk = Math.floor(diff(preg.lmp, d) / 7);
        if (wk >= 0 && wk <= 42) cells += `<div class="wkbar">Week ${wk}${wk === 13 || wk === 27 ? ' · trimester ends' : ''}${diff(d, preg.due) >= 0 && diff(d, preg.due) < 7 ? ' · due date 🎉' : ''}</div>`;
      }
      const k = ymd(d);
      const mk = marks[k] || {};
      const log = A.data.logs[k];
      const cls = ['day'];
      if (d.getMonth() !== m) cls.push('out');
      if (mk.per || (mode !== 'cycle' && log && B.BLEED.includes(log.flow))) cls.push('per');
      else if (mk.pred) cls.push('pred');
      else if (mk.fer) cls.push('fer');
      if (mk.ovu) cls.push('ovu');
      if (B.same(d, t)) cls.push('today');
      if (B.hasLogged(log)) cls.push('has');
      const label = fmt(d, { weekday: 'long', day: 'numeric', month: 'long' }) +
        (mk.per ? ', period' : mk.pred ? ', predicted period' : '') + (mk.fer ? ', fertile window' : '') + (mk.ovu ? ', estimated ovulation' : '');
      cells += d <= t
        ? `<button class="${cls.join(' ')}" data-action="day" data-key="${k}" aria-label="${esc(label)}">${d.getDate()}</button>`
        : `<div class="${cls.join(' ')} future" aria-label="${esc(label)}">${d.getDate()}</div>`;
    }

    let info = '';
    if (mode === 'cycle' && model.hasData) {
      const nextP = model.daysUntil < 0 ? 'Any day now' : fmt(model.next, { weekday: 'short', day: 'numeric', month: 'short' });
      info = `<div class="card"><div class="card-head"><h3>Coming up</h3><span class="est">Estimates</span></div>
        <div class="row" style="padding:8px 0"><span>🌸 Next period</span><span class="muted">${nextP}</span></div>
        <div class="row" style="padding:8px 0"><span>🌿 Fertile window</span><span class="muted">${fmt(model.fertileStart)} – ${fmt(model.fertileEnd)}</span></div>
        <div class="row" style="padding:8px 0"><span>✿ Ovulation</span><span class="muted">${fmt(model.ovulation)}</span></div>
        ${model.irregular ? '<p class="small muted" style="margin-top:6px">Your cycles vary — predictions are less certain.</p>' : ''}</div>`;
    } else if (mode === 'pregnancy' && preg) {
      info = `<div class="card lav"><div class="card-head"><h3>Due date</h3></div><p>${fmt(preg.due, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p></div>`;
    }

    const legend = mode === 'cycle'
      ? `<div class="legend" style="justify-content:flex-start"><span><i style="background:var(--accent)"></i>Period</span><span><i style="border:1.5px dashed var(--accent)"></i>Predicted</span><span><i style="background:#CBE9E6"></i>Fertile</span><span style="color:var(--teal)">✿ Ovulation</span><span><i style="background:var(--ink);opacity:.45;width:5px;height:5px"></i>Logged</span></div>`
      : `<div class="legend" style="justify-content:flex-start"><span><i style="background:var(--ink);opacity:.45;width:5px;height:5px"></i>Logged</span>${mode === 'pregnancy' ? '<span><i style="background:var(--lavender)"></i>Pregnancy week</span>' : ''}</div>`;

    // Side panel: today's log and this month at a glance.
    const todayChips = logSummaryChips(todayLog());
    const monthKeys = Object.keys(A.data.logs).filter((k) => k.startsWith(`${y}-${String(m + 1).padStart(2, '0')}`));
    const side = `<div class="card"><div class="card-head"><h3>📝 Today</h3><button class="text-btn" data-action="log-open">${todayChips.length ? 'Edit' : 'Log'}</button></div>
        ${todayChips.length ? `<div class="chips">${todayChips.map((c) => `<span class="chip static" style="background:var(--paper)">${esc(c)}</span>`).join('')}</div>` : '<p class="small muted">Nothing logged yet today.</p>'}</div>
      <div class="card"><div class="card-head"><h3>${esc(first.toLocaleDateString('en-GB', { month: 'long' }))} at a glance</h3></div>
        <div class="row" style="padding:8px 0"><span>Days with a log</span><span class="muted">${monthKeys.filter((k) => B.hasLogged(A.data.logs[k])).length}</span></div>
        <div class="row" style="padding:8px 0"><span>Period days logged</span><span class="muted">${monthKeys.filter((k) => B.BLEED.includes(A.data.logs[k].flow)).length}</span></div>
        <div class="row" style="padding:8px 0"><span>Water goal reached</span><span class="muted">${monthKeys.filter((k) => (A.data.logs[k].water || 0) >= A.data.settings.waterGoal).length} days</span></div></div>`;

    return `<h2 class="screen-title">Calendar</h2>
      <div class="two-col"><div>
      <div class="card">
        <div class="cal-head"><button class="icon-btn" data-action="cal" data-dir="-1" aria-label="Previous month">‹</button>
          <h3>${first.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}</h3>
          <button class="icon-btn" data-action="cal" data-dir="1" aria-label="Next month">›</button></div>
        <div class="cal">${cells}</div>
        <div style="margin-top:12px">${legend}</div>
        ${(y !== t.getFullYear() || m !== t.getMonth()) ? '<button class="text-btn" style="margin-top:8px" data-action="cal-today">Back to today</button>' : ''}
      </div>
      <p class="small muted" style="margin:0 4px 12px">Tap a day to see or edit its log.</p>
      </div><div>${info}${side}</div></div>`;
  }

  /* =========================================================
     INSIGHTS (all computed in the browser)
     ========================================================= */
  function viewInsights() {
    const d = A.data;
    const m = B.cycle(d);
    const t = today();
    let html = `<h2 class="screen-title">Insights</h2><div class="ins-grid">`;

    if (d.mode !== 'habits' || m.lens.length) {
      const last6 = [];
      for (let i = 1; i < m.starts.length; i++) {
        const L = diff(m.starts[i - 1], m.starts[i]);
        if (L >= 15 && L <= 60) last6.push({ L, start: m.starts[i - 1] });
      }
      const bars = last6.slice(-6);
      const maxL = Math.max(35, ...bars.map((b) => b.L));
      html += `<div class="stat-grid">
        <div class="stat-tile"><span class="k">Avg. cycle</span><b>${m.cycleLen} <small>days${m.enough ? '' : ' · est.'}</small></b></div>
        <div class="stat-tile"><span class="k">Avg. period</span><b>${m.periodLen} <small>days${m.periodLens.length ? '' : ' · est.'}</small></b></div>
      </div>
      <div class="card"><div class="card-head"><h3>🌸 Last ${bars.length || 6} cycles</h3>${m.irregular ? '<span class="tiny muted">Varies</span>' : ''}</div>
        ${bars.length ? `<div class="bars">${bars.map((b) => `<div class="b"><em>${b.L}</em><i style="height:${Math.round((b.L / maxL) * 100)}%"></i><span>${fmt(b.start, { month: 'short' })}</span></div>`).join('')}</div>`
          : '<p class="empty">Log the start of two periods to see your cycle history.</p>'}
        ${m.irregular ? '<p class="small muted" style="margin-top:8px">Your cycles vary by more than 7 days, so predictions are less certain.</p>' : ''}
      </div>`;
    }

    // Most common symptoms + moods
    const sc = {}, mc = {};
    Object.values(d.logs).forEach((l) => { (l.symptoms || []).forEach((s) => (sc[s] = (sc[s] || 0) + 1)); if (l.mood) mc[l.mood] = (mc[l.mood] || 0) + 1; });
    const top = Object.entries(sc).sort((a, b) => b[1] - a[1]).slice(0, 5);
    const topMood = Object.entries(mc).sort((a, b) => b[1] - a[1])[0];
    html += `<div class="card"><div class="card-head"><h3>🩺 Most common symptoms</h3></div>
      ${top.length ? top.map(([s, n]) => `<div class="hbar"><span>${esc(LABEL[s])}</span><span class="tr"><i style="width:${Math.round((n / top[0][1]) * 100)}%"></i></span><b>${n}</b></div>`).join('')
        : '<p class="empty">Symptoms you log will show up here.</p>'}
      ${topMood ? `<p class="small muted" style="margin-top:8px">Most logged mood: ${esc(LABEL[topMood[0]])}</p>` : ''}</div>`;

    // Water this week
    const week = Array.from({ length: 7 }, (_, i) => addDays(t, i - 6));
    const water = week.map((day) => (d.logs[ymd(day)] || {}).water || 0);
    const goal = d.settings.waterGoal;
    const avgW = Math.round(B.avg(water));
    const maxW = Math.max(goal, ...water);
    html += `<div class="card sky"><div class="card-head"><h3>💧 Water this week</h3><span class="tiny muted">${water.filter((w) => w >= goal).length}/7 goal days</span></div>
      <div class="water-num">${avgW.toLocaleString('en-GB')} <span class="small muted">ml a day on average</span></div>
      <div class="bars">${water.map((w, i) => `<div class="b"><i style="height:${Math.max(3, Math.round((w / maxW) * 100))}%;background:${w >= goal ? '#2F7FAE' : '#79BCE2'}"></i><span>${fmt(week[i], { weekday: 'narrow' })}</span></div>`).join('')}</div></div>`;

    // Habits this week
    const habits = d.habits;
    const per = habits.map((h) => week.filter((day) => ((d.logs[ymd(day)] || {}).habits || []).includes(h.id)).length);
    const overall = habits.length ? Math.round((per.reduce((a, b) => a + b, 0) / (habits.length * 7)) * 100) : 0;
    html += `<div class="card mint"><div class="card-head"><h3>✨ Habits this week</h3><span class="tiny muted">last 7 days</span></div>
      <div class="water-num">${overall}% <span class="small muted">complete</span></div>
      <div style="margin-top:8px">${habits.map((h, i) => `<div class="hbar"><span>${esc(h.icon)} ${esc(h.name)}</span><span class="tr" style="background:rgba(255,255,255,.7)"><i style="width:${Math.round((per[i] / 7) * 100)}%"></i></span><b>${per[i]}/7</b></div>`).join('')}</div></div>`;

    // Streak from the contract
    const c = B.chain;
    const s = c.streak;
    const best = s ? s.best : 0;
    html += `<div class="card"><div class="card-head"><h3>🌸 Self-care streak</h3><span class="tiny muted">BOT Chain</span></div>
      ${!c.address ? `<p class="small muted">Connect a wallet to see your streak. It's optional.</p><button class="btn btn-secondary btn-sm" style="margin-top:10px" data-action="connect">Connect wallet</button>`
        : `<div class="stat-grid" style="grid-template-columns:repeat(3,1fr)">
            <div class="stat-tile"><span class="k">Current</span><b>${c.currentStreak()}</b></div>
            <div class="stat-tile"><span class="k">Best</span><b>${best}</b></div>
            <div class="stat-tile"><span class="k">Total</span><b>${s ? s.total : 0}</b></div></div>
           ${c.isBroken() ? '<p class="small muted" style="margin-bottom:10px">New streak, fresh start 🌱 Check in today to begin again.</p>' : ''}`}
      <div class="badges" style="margin-top:6px">
        ${[[7, '🌷'], [30, '🌻'], [100, '💐']].map(([n, e]) => `<div class="badge ${best >= n ? 'on' : ''}"><b>${e}</b>${n} days</div>`).join('')}
      </div></div></div>
      <p class="tiny muted" style="text-align:center;margin:4px 10px">All insights are worked out in your browser. Nothing is uploaded.</p>`;
    return html;
  }

  /* =========================================================
     ME (settings)
     ========================================================= */
  function viewMe() {
    const d = A.data;
    const st = d.settings;
    const c = B.chain;
    const max = B.todayKey();
    const custom = d.habits.filter((h) => h.custom);
    const modeBtn = (id, label) => `<button data-action="set-mode" data-mode="${id}" aria-pressed="${d.mode === id}">${label}</button>`;
    const glassOpts = [150, 200, 250, 300, 330, 400, 500].map((v) => `<option value="${v}" ${st.glassMl === v ? 'selected' : ''}>${v} ml</option>`).join('');

    let wallet;
    if (!c.hasWallet()) wallet = `<a class="row" href="https://metamask.io/download/" target="_blank" rel="noopener"><span class="l"><span>🦊</span>Install MetaMask</span><span class="r">↗</span></a>`;
    else if (!c.address) wallet = `<button class="row" data-action="connect"><span class="l"><span>🔗</span>Connect wallet</span><span class="r">→</span></button>`;
    else {
      wallet = `<div class="row"><span class="l"><span>🔗</span>Wallet</span><span class="r">${esc(c.short(c.address))}</span></div>`;
      wallet += c.chainOk === false
        ? `<button class="row" data-action="switch-net"><span class="l"><span>⚠️</span>Switch to ${esc(B.NET.name)}</span><span class="r">→</span></button>`
        : `<div class="row"><span class="l"><span>⛓️</span>Network</span><span class="r">${esc(B.NET.name)}</span></div>`;
    }
    if (c.configured()) wallet += `<a class="row" href="${c.explorerAddress(B.NET.contract)}" target="_blank" rel="noopener"><span class="l"><span>🔍</span>View contract on explorer</span><span class="r">↗</span></a>`;

    return `<h2 class="screen-title">Me</h2>
      <div class="two-col me-cols"><div>
      <p class="list-title">Tracking mode</p>
      <div class="mode-seg" role="group" aria-label="Tracking mode">${modeBtn('cycle', 'Cycle')}${modeBtn('pregnancy', 'Pregnancy')}${modeBtn('habits', 'Habits only')}</div>

      ${d.mode !== 'habits' ? `
      <p class="list-title">${d.mode === 'pregnancy' ? 'Pregnancy' : 'Cycle'}</p>
      <div class="list">
        ${d.mode === 'cycle' ? `
        <label class="row"><span class="l"><span>📅</span>Last period started</span><span class="r"><input class="input" type="date" max="${max}" value="${esc(st.lastPeriod || '')}" data-set="lastPeriod"></span></label>
        <label class="row"><span class="l"><span>🩸</span>Period length</span><span class="r"><input class="input" type="number" min="2" max="10" value="${st.periodLen}" data-set="periodLen" data-type="num" style="width:64px"> days</span></label>
        <label class="row"><span class="l"><span>🔁</span>Cycle length</span><span class="r"><input class="input" type="number" min="20" max="45" value="${st.cycleLen}" data-set="cycleLen" data-type="num" style="width:64px"> days</span></label>
        <label class="row"><span class="l"><span>🤷</span>Not sure of my cycle length</span><span class="r"><input type="checkbox" ${st.cycleUnsure ? 'checked' : ''} data-set="cycleUnsure" data-type="bool" style="width:20px;height:20px;accent-color:var(--accent)"></span></label>` : `
        <label class="row"><span class="l"><span>🎉</span>Due date</span><span class="r"><input class="input" type="date" value="${esc(st.dueDate || '')}" data-set="dueDate"></span></label>
        <label class="row"><span class="l"><span>📅</span>Or first day of last period</span><span class="r"><input class="input" type="date" max="${max}" value="${esc(st.pregLmp || '')}" data-set="pregLmp"></span></label>`}
      </div>
      ${d.mode === 'cycle' ? '<p class="tiny muted" style="margin:-10px 4px 18px">Once you\'ve logged two cycles, Bloomly uses your real average instead.</p>' : '<p class="tiny muted" style="margin:-10px 4px 18px">If you add a due date, it\'s used first. Due date = last period + 280 days.</p>'}` : ''}

      <p class="list-title">Water</p>
      <div class="list">
        <label class="row"><span class="l"><span>💧</span>Daily goal</span><span class="r"><input class="input" type="number" min="500" max="5000" step="250" value="${st.waterGoal}" data-set="waterGoal" data-type="num" style="width:84px"> ml</span></label>
        <label class="row"><span class="l"><span>🥛</span>Glass size</span><span class="r"><select class="input" data-set="glassMl" data-type="num">${glassOpts}</select></span></label>
      </div>

      <p class="list-title" id="me-habits">Habits</p>
      <div class="list">
        ${d.habits.map((h) => `<div class="row"><span class="l"><span>${esc(h.icon)}</span>${esc(h.name)}</span>${h.custom ? `<button class="icon-btn" style="width:34px;height:34px" data-action="habit-del" data-id="${esc(h.id)}" aria-label="Remove ${esc(h.name)}">✕</button>` : '<span class="r tiny">Default</span>'}</div>`).join('')}
        ${custom.length < MAX_CUSTOM_HABITS ? `<div class="row" style="flex-wrap:wrap">
          <input class="input" id="habit-icon" maxlength="4" placeholder="🌼" style="width:58px;text-align:center" aria-label="Habit emoji">
          <input class="input" id="habit-name" maxlength="30" placeholder="Add your own habit" style="flex:1;min-width:140px" aria-label="Habit name">
          <button class="btn btn-primary btn-sm" data-action="habit-add">Add</button></div>` : ''}
      </div>
      <p class="tiny muted" style="margin:-10px 4px 18px">You can add up to ${MAX_CUSTOM_HABITS} of your own (${custom.length}/${MAX_CUSTOM_HABITS}).</p>
      </div><div>

      <p class="list-title">Your data</p>
      <div class="list">
        <div class="row"><span class="l"><span>📱</span>Stored only in this browser</span><span class="r">No server</span></div>
        <button class="row" data-action="export"><span class="l"><span>📤</span>Export a backup</span><span class="r">.bloomly</span></button>
        <button class="row" data-action="import-start"><span class="l"><span>📥</span>Import a backup</span><span class="r">→</span></button>
        <button class="row danger" data-action="delete-all"><span class="l"><span>🗑️</span>Delete all my data</span><span class="r">→</span></button>
      </div>
      <p class="tiny muted" style="margin:-10px 4px 18px">Anyone who uses this browser can open Bloomly, so use your device's own lock screen.</p>

      <p class="list-title">Daily streak (optional)</p>
      <div class="list">${wallet}</div>

      <div class="card peach"><p class="small"><b>Medical disclaimer.</b> Bloomly gives estimates for information only. It is not medical advice and must not be used as birth control. Talk to a doctor or midwife about any health concern.</p></div>
      <button class="btn btn-secondary btn-block me-back" data-action="close-app">← Back to the website</button>
      </div></div>`;
  }

  /* ---------------- Settings changes ---------------- */
  function onSettingChange(input) {
    const key = input.dataset.set;
    const type = input.dataset.type;
    let v = type === 'bool' ? input.checked : input.value;
    if (type === 'num') {
      v = Number(v);
      const min = Number(input.min || 0), max = Number(input.max || 1e9);
      if (!Number.isFinite(v) || v < min || v > max) { B.toast(`Please enter a number between ${min} and ${max}`); return renderScreen(); }
    }
    if (type !== 'bool' && type !== 'num') v = v || null;
    if (key === 'lastPeriod' && v && v > B.todayKey()) { B.toast('That date is in the future'); return renderScreen(); }
    A.data.settings[key] = v;
    save();
    renderScreen();
    B.toast('Saved');
  }

  function setMode(mode) {
    if (A.data.mode === mode) return;
    A.data.mode = mode;
    save();
    renderScreen();
    B.toast({ cycle: 'Tracking your cycle', pregnancy: 'Pregnancy mode on 🌱', habits: 'Tracking habits only' }[mode]);
    if (mode === 'pregnancy' && !B.preg(A.data) && A.view !== 'me') { A.view = 'me'; renderScreen(true); }
  }

  /* ---------------- Backup export / import ---------------- */
  function exportBackup() {
    const file = { app: 'bloomly', v: 2, created: new Date().toISOString(), data: A.data };
    const url = URL.createObjectURL(new Blob([JSON.stringify(file)], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `bloomly-backup-${B.todayKey()}.bloomly`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    B.toast('Backup downloaded 📤 Keep it somewhere private.', 4000);
  }

  function importStart() { el.file.value = ''; el.file.click(); }

  async function importFile(f) {
    let file;
    try { file = JSON.parse(await f.text()); } catch (e) { file = null; }
    if (!file || file.app !== 'bloomly') {
      return dialog("That isn't a Bloomly backup", '<p>Please choose a <b>.bloomly</b> file exported from Bloomly. Nothing was changed.</p>');
    }
    if (!file.data) {
      return dialog("This backup can't be opened", '<p>It was made with an older version of Bloomly that used a passcode. Nothing was changed.</p>');
    }
    const data = B.normalise(file.data);
    const apply = () => {
      A.data = data;
      A.ready = true;
      A.view = 'today';
      save();
      renderMain();
      B.toast('Backup restored 🌸');
    };
    if (!A.ready) return apply();
    const when = new Date(file.created || Date.now()).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
    dialog('Replace your data?', `<p>This replaces everything on this device with the backup from <b>${esc(when)}</b>.</p>`,
      [{ label: 'Replace my data', kind: 'danger', fn: apply }, { label: 'Cancel', kind: 'secondary' }]);
  }

  function deleteAll() {
    dialog('Delete all your data?', `<p>This permanently removes every log and setting from this device. It can't be undone.</p>
      <p style="margin-top:10px">Your on-chain streak isn't affected, because it never contained any health data.</p>`,
      [{ label: 'Yes, delete everything', kind: 'danger', fn: wipe }, { label: 'Cancel', kind: 'secondary' }]);
  }
  function wipe() {
    Object.values(KEYS).forEach((k) => store.del(k));
    // Also clear storage left by the earlier passcode version.
    ['bloomly.v1.enc', 'bloomly.v1.plain', 'bloomly.v1.setup'].forEach((k) => store.del(k));
    Object.assign(A, { ready: false, data: null, kick: null, view: 'today' });
    close();
    B.toast('All your data was deleted from this device');
  }

  /* =========================================================
     Events
     ========================================================= */
  function onClick(e) {
    const t = e.target.closest('[data-action]');
    if (!t || !el.overlay.contains(t)) return;
    const fn = ACTIONS[t.dataset.action];
    if (fn) { e.preventDefault(); fn(t, e); }
  }

  const ACTIONS = {
    'close-app': () => close(),
    'close-sheet': () => closeSheet(),
    dialog: (t) => { const b = A.dialogs[Number(t.dataset.i)]; closeSheet(); if (b && b.fn) b.fn(); },

    // setup
    'setup-goal': (t) => { A.setup.goal = t.dataset.goal; renderSetup(); },
    'setup-next': () => {
      if (A.setup.step === 1) { A.setup.step = 2; return renderSetup(); }
      readSetupStep2();
      finishSetup();
    },
    'setup-back': () => { A.setup.step = 1; renderSetup(); },
    'setup-skip': () => { if (A.setup.step === 2) readSetupStep2(); finishSetup(); },
    step: (t) => {
      const wrap = t.closest('[data-stepper]');
      const out = wrap.querySelector('output');
      const stepN = Number(wrap.dataset.step), min = Number(wrap.dataset.min), max = Number(wrap.dataset.max);
      const v = Math.min(max, Math.max(min, Number(out.dataset.value) + Number(t.dataset.dir) * stepN));
      out.dataset.value = v;
      out.textContent = out.textContent.replace(/^[\d,]+/, v.toLocaleString('en-GB'));
    },

    // navigation
    tab: (t) => {
      A.view = t.dataset.view;
      if (A.view === 'calendar') { const n = today(); A.cal = { y: n.getFullYear(), m: n.getMonth() }; }
      renderScreen(true);
      if (t.dataset.scroll) { const s = $('#me-' + t.dataset.scroll); if (s) s.scrollIntoView({ block: 'start' }); }
    },
    cal: (t) => { const d = new Date(A.cal.y, A.cal.m + Number(t.dataset.dir), 1); A.cal = { y: d.getFullYear(), m: d.getMonth() }; renderScreen(); },
    'cal-today': () => { const n = today(); A.cal = { y: n.getFullYear(), m: n.getMonth() }; renderScreen(); },
    day: (t) => openLog(t.dataset.key),

    // logging
    'log-open': () => openLog(B.todayKey()),
    chip: (t) => {
      const g = t.dataset.group, v = t.dataset.val;
      if (t.dataset.multi === '1') {
        const arr = A.draft[g];
        const i = arr.indexOf(v);
        i >= 0 ? arr.splice(i, 1) : arr.push(v);
        t.setAttribute('aria-pressed', i < 0);
      } else {
        A.draft[g] = A.draft[g] === v ? null : v;
        t.parentElement.querySelectorAll('.chip').forEach((c) => c.setAttribute('aria-pressed', c.dataset.val === A.draft[g]));
      }
    },
    sleep: (t) => {
      A.draft.sleep = Math.min(14, Math.max(0, (A.draft.sleep || 0) + Number(t.dataset.dir)));
      $('#sleep-out').textContent = A.draft.sleep ? `${A.draft.sleep} h` : '—';
    },
    'log-save': () => saveLog(),
    'log-clear': () => {
      const k = A.draft.key;
      const log = A.data.logs[k] || {};
      ['flow', 'symptoms', 'mood', 'discharge', 'sleep', 'notes'].forEach((f) => delete log[f]);
      cleanLog(k); save(); closeSheet(); renderScreen(); B.toast('Cleared');
    },

    // water / habits
    'water-add': () => setWater((todayLog().water || 0) + A.data.settings.glassMl),
    'water-undo': () => setWater((todayLog().water || 0) - A.data.settings.glassMl),
    'water-set': (t) => {
      const i = Number(t.dataset.i);
      const g = A.data.settings.glassMl;
      const cur = Math.floor((todayLog().water || 0) / g);
      setWater((cur === i + 1 ? i : i + 1) * g);
    },
    'dismiss-remind': () => { A.lastWaterAt = Date.now(); renderBanners(); },
    habit: (t) => toggleHabit(t.dataset.id),
    'habit-add': () => {
      const name = ($('#habit-name').value || '').trim();
      const icon = ($('#habit-icon').value || '').trim() || '🌼';
      if (!name) return B.toast('Give your habit a name');
      if (A.data.habits.filter((h) => h.custom).length >= MAX_CUSTOM_HABITS) return B.toast(`You can add up to ${MAX_CUSTOM_HABITS} habits`);
      A.data.habits.push({ id: 'c' + Date.now().toString(36), icon: [...icon].slice(0, 2).join(''), name: name.slice(0, 30), custom: true });
      save(); renderScreen(); B.toast('Habit added ✨');
    },
    'habit-del': (t) => { A.data.habits = A.data.habits.filter((h) => h.id !== t.dataset.id); save(); renderScreen(); },

    // pregnancy
    'kick-start': () => { A.kick = { start: Date.now(), count: 0 }; renderScreen(); },
    'kick-tap': () => {
      A.kick.count++;
      const log = logFor(B.todayKey());
      log.kicks = (log.kicks || 0) + 1;
      save(); renderScreen();
      if (navigator.vibrate) navigator.vibrate(15);
    },
    'kick-stop': () => { const n = A.kick.count; const t = kickTime(); A.kick = null; renderScreen(); B.toast(`${plural(n, 'movement')} in ${t} 👶`); },
    'appt-add': () => {
      const date = $('#appt-date').value;
      const note = ($('#appt-note').value || '').trim().slice(0, 80);
      if (!date) return B.toast('Pick a date for the appointment');
      A.data.appointments.push({ id: 'a' + Date.now().toString(36), date, note });
      save(); renderScreen(); B.toast('Appointment added');
    },
    'appt-del': (t) => { A.data.appointments = A.data.appointments.filter((a) => a.id !== t.dataset.id); save(); renderScreen(); },

    // settings
    'set-mode': (t) => setMode(t.dataset.mode),
    export: () => exportBackup(),
    'import-start': () => importStart(),
    'delete-all': () => deleteAll(),

    // chain
    checkin: () => doCheckIn(),
    connect: async () => {
      if (!B.chain.hasWallet()) return dialogInstall();
      try { await B.chain.connect(); B.toast('Wallet connected'); } catch (e) { B.toast('Wallet connection cancelled'); }
    },
    'switch-net': async () => { try { await B.chain.switchNetwork(); } catch (e) { B.toast('Network switch cancelled'); } }
  };
  /* ---------------- Init ---------------- */
  function init() {
    el.overlay = $('#app');
    el.view = $('#app-view');
    el.sheetRoot = $('#sheet-root');
    el.sheetTitle = $('#sheet-title');
    el.sheetBody = $('#sheet-body');
    el.sheetFoot = $('#sheet-foot');
    const n = today();
    A.cal = { y: n.getFullYear(), m: n.getMonth() };

    el.file = document.createElement('input');
    el.file.type = 'file';
    el.file.accept = '.bloomly,application/json';
    el.file.hidden = true;
    el.file.addEventListener('change', () => { const f = el.file.files[0]; if (f) importFile(f); });
    document.body.appendChild(el.file);

    el.overlay.addEventListener('click', onClick);
    el.overlay.addEventListener('change', (e) => {
      const t = e.target;
      if (t.matches('[data-set]')) onSettingChange(t);
      if (t.id === 'su-due' || t.id === 'su-lmp') updateDueCalc();
    });
    el.overlay.addEventListener('input', (e) => { if (e.target.id === 'su-due' || e.target.id === 'su-lmp') updateDueCalc(); });
    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape' || !A.open) return;
      if (el.sheetRoot.classList.contains('open')) closeSheet();
      else close();
    });

    B.chain.on(() => {
      if (!A.open || !A.ready) return;
      renderHead(); renderBanners(); renderDock();
      if (A.view === 'insights' || A.view === 'me') renderScreen();
    });

    // Re-render at midnight so "today" rolls over cleanly.
    let lastDay = B.todayKey();
    setInterval(() => {
      const k = B.todayKey();
      if (k !== lastDay) { lastDay = k; A.kick = null; if (A.open && A.ready) renderScreen(); }
    }, 30 * 1000);
  }

  B.app = { open, close, init };
  document.addEventListener('DOMContentLoaded', init);
})();
