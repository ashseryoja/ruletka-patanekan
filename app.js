/* Խաղարկություն — speedometer roulette.
 * The winner is chosen ONCE per spin with crypto.getRandomValues (uniform over the numbers still in the pool);
 * the needle "revving" is only the show that leads to that number.
 * Settings and the winners list are kept in localStorage. URL: ?n=500&from=1 sets the range.
 */
(() => {
  "use strict";
  const $ = (s) => document.querySelector(s);
  const NS = "http://www.w3.org/2000/svg";
  const KEY = "ruletka-patanekan-v1";
  const MAXN = 100000;

  // ---------------------------------------------------------------- state
  const DEFAULTS = { from: 1, count: 500, noRepeat: true, exclude: "", dur: 8, sound: true, prize: "", history: [] };
  const clampInt = (v, a, b, d) => { const n = Math.round(Number(v)); return Number.isFinite(n) ? Math.min(b, Math.max(a, n)) : d; };
  const load = () => {
    try { const v = JSON.parse(localStorage.getItem(KEY) || "null"); return { ...DEFAULTS, ...(v || {}) }; } catch { return { ...DEFAULTS }; }
  };
  const S = load();
  if (!Array.isArray(S.history)) S.history = [];
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch { /* private mode: keep working without storage */ } };
  const qs = new URLSearchParams(location.search);
  if (qs.has("n")) S.count = clampInt(qs.get("n"), 1, MAXN, S.count);
  if (qs.has("from")) S.from = clampInt(qs.get("from"), 0, 99999, S.from);
  S.count = clampInt(S.count, 1, MAXN, 500);
  S.from = clampInt(S.from, 0, 99999, 1);
  S.dur = clampInt(S.dur, 4, 16, 8);

  const lo = () => S.from;
  const hi = () => S.from + S.count - 1;
  const span = () => hi() - lo();

  const parseExclude = (str) => {
    const set = new Set();
    const norm = String(str || "").replace(/\s*[-–—]\s*/g, "-");
    for (const part of norm.split(/[\s,;]+/)) {
      const m = part.match(/^(\d+)(?:-(\d+))?$/);
      if (!m) continue;
      let a = +m[1], b = m[2] !== undefined ? +m[2] : a;
      if (a > b) [a, b] = [b, a];
      if (b - a > 200000) continue;
      for (let i = a; i <= b; i++) set.add(i);
    }
    return set;
  };
  const pool = () => {
    const ex = parseExclude(S.exclude);
    const drawn = S.noRepeat ? new Set(S.history.map((h) => h.n)) : new Set();
    const out = [];
    for (let i = lo(); i <= hi(); i++) if (!ex.has(i) && !drawn.has(i)) out.push(i);
    return out;
  };
  // uniform integer in [0, n) without modulo bias
  const randInt = (n) => {
    const c = window.crypto;
    if (!c || !c.getRandomValues) return Math.floor(Math.random() * n);
    const lim = 0x100000000 - (0x100000000 % n), b = new Uint32Array(1);
    do c.getRandomValues(b); while (b[0] >= lim);
    return b[0] % n;
  };

  // ---------------------------------------------------------------- gauge geometry
  const C = 500, R = 380, W = 92, A0 = -120, A1 = 120;
  const rad = (a) => (a * Math.PI) / 180;
  const pt = (r, a) => [C + r * Math.sin(rad(a)), C - r * Math.cos(rad(a))];
  const f1 = (n) => n.toFixed(1);
  const arc = (r, a0, a1) => {
    const [x0, y0] = pt(r, a0), [x1, y1] = pt(r, a1);
    return `M ${f1(x0)} ${f1(y0)} A ${r} ${r} 0 ${Math.abs(a1 - a0) > 180 ? 1 : 0} 1 ${f1(x1)} ${f1(y1)}`;
  };
  const angOf = (v) => A0 + v * (A1 - A0);           // v = 0..1
  const valToFrac = (x) => (span() ? (x - lo()) / span() : 0);

  const niceStep = (s) => {
    if (s <= 12) return 1;
    const raw = s / 9, p = Math.pow(10, Math.floor(Math.log10(raw)));
    for (const m of [1, 2, 2.5, 5, 10]) if (m * p >= raw && Number.isInteger(m * p)) return m * p;
    return 10 * p;
  };

  const gS = $("#gStatic"), gD = $("#gDyn");
  let el = {};

  const buildStatic = () => {
    const s = span(), step = niceStep(s);
    const minor = step >= 10 ? step / 5 : step >= 2 ? (Number.isInteger(step / 2) ? step / 2 : 0) : 0;
    // labels: first and last number always, round values in between (not too close to the ends)
    const labels = [lo()];
    for (let v = Math.ceil((lo() + 1) / step) * step; v < hi(); v += step) if (v - lo() >= step * 0.4 && hi() - v >= step * 0.4) labels.push(v);
    if (hi() !== lo()) labels.push(hi());
    const digits = String(hi()).length;
    const lblSize = digits <= 3 ? 36 : digits === 4 ? 31 : 26;

    let ticks = "";
    if (minor && s / minor <= 160)
      for (let v = Math.ceil(lo() / minor) * minor; v <= hi(); v += minor) {
        const a = angOf(valToFrac(v)), [x0, y0] = pt(R + W / 2 + 8, a), [x1, y1] = pt(R + W / 2 + 24, a);
        ticks += `<line x1="${f1(x0)}" y1="${f1(y0)}" x2="${f1(x1)}" y2="${f1(y1)}" stroke="rgba(255,255,255,.62)" stroke-width="3" stroke-linecap="round"/>`;
      }
    let lbl = "";
    for (const v of labels) {
      const a = angOf(valToFrac(v)), [x0, y0] = pt(R + W / 2 + 8, a), [x1, y1] = pt(R + W / 2 + 42, a), [tx, ty] = pt(R - W / 2 - 44, a);
      ticks += `<line x1="${f1(x0)}" y1="${f1(y0)}" x2="${f1(x1)}" y2="${f1(y1)}" stroke="#fff" stroke-width="7" stroke-linecap="round"/>`;
      lbl += `<text class="lbl" x="${f1(tx)}" y="${f1(ty)}" font-size="${lblSize}" text-anchor="middle" dominant-baseline="central">${v}</text>`;
    }
    const red = arc(R + W / 2 + 26, angOf(0.85), A1);
    gS.innerHTML = `
      <defs>
        <radialGradient id="face" cx="50%" cy="46%" r="54%">
          <stop offset="0" stop-color="#262626" stop-opacity=".9"/>
          <stop offset=".72" stop-color="#151515" stop-opacity=".9"/>
          <stop offset="1" stop-color="#0b0b0b" stop-opacity=".95"/>
        </radialGradient>
        <pattern id="asph" patternUnits="userSpaceOnUse" width="1000" height="1000"><image href="assets/asphalt.webp" width="1000" height="1000" preserveAspectRatio="none"/></pattern>
        <linearGradient id="redz" gradientUnits="userSpaceOnUse" x1="${f1(pt(R, angOf(0.85))[0])}" y1="0" x2="${f1(pt(R, A1)[0] + 60)}" y2="0">
          <stop offset="0" stop-color="#ff8a1a" stop-opacity="0"/><stop offset="1" stop-color="#ff4d00"/>
        </linearGradient>
      </defs>
      <circle cx="${C}" cy="${C}" r="492" fill="url(#face)"/>
      <circle cx="${C}" cy="${C}" r="492" fill="none" stroke="#0a0a0a" stroke-width="12"/>
      <circle cx="${C}" cy="${C}" r="483" fill="none" stroke="rgba(255,255,255,.55)" stroke-width="4" stroke-dasharray="46 16"/>
      <path d="${arc(R, A0, A1)}" fill="none" stroke="#050505" stroke-width="${W + 16}" stroke-linecap="butt"/>
      <path d="${arc(R, A0, A1)}" fill="none" stroke="url(#asph)" stroke-width="${W}"/>
      <path d="${arc(R, A0, A1)}" fill="none" stroke="rgba(0,0,0,.28)" stroke-width="${W}"/>
      <path d="${arc(R + W / 2 - 9, A0, A1)}" fill="none" stroke="#ececec" stroke-width="5" stroke-dasharray="150 9 60 7"/>
      <path d="${arc(R - W / 2 + 9, A0, A1)}" fill="none" stroke="#ececec" stroke-width="5" stroke-dasharray="130 8 70 9"/>
      <path d="${red}" fill="none" stroke="url(#redz)" stroke-width="40" opacity=".75"/>
      ${ticks}${lbl}
      <circle cx="${C}" cy="${C}" r="205" fill="none" stroke="rgba(255,255,255,.1)" stroke-width="3"/>
      <text class="lbl" x="${C}" y="642" font-size="24" letter-spacing="7" text-anchor="middle" fill-opacity=".62">ՀԱՄԱՐ</text>
      <text class="lbl" x="${C}" y="872" font-size="24" letter-spacing="2" text-anchor="middle" fill-opacity=".5">${lo()} – ${hi()}</text>`;
  };

  const buildDyn = () => {
    const digits = String(hi()).length;
    const size = digits <= 3 ? 176 : digits === 4 ? 140 : digits === 5 ? 112 : 94;
    gD.innerHTML = `
      <defs>
        <linearGradient id="hot" gradientUnits="userSpaceOnUse" x1="140" y1="0" x2="860" y2="0">
          <stop offset="0" stop-color="#ffe066"/><stop offset=".5" stop-color="#ffb02e"/><stop offset="1" stop-color="#ff5a00"/>
        </linearGradient>
        <linearGradient id="ndl" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#fff6b0"/><stop offset=".35" stop-color="#ffc23a"/><stop offset="1" stop-color="#ff6a00"/>
        </linearGradient>
        <linearGradient id="rd" x1="0" y1="0" x2="0" y2="1">
          <stop offset=".1" stop-color="#ffe066"/><stop offset=".55" stop-color="#ffc23a"/><stop offset="1" stop-color="#ff6a00"/>
        </linearGradient>
        <filter id="glow" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="9" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
        <filter id="glowS" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
      </defs>
      <path id="lit" d="${arc(R, A0, A1)}" pathLength="1" fill="none" stroke="url(#hot)" stroke-width="${W - 30}" stroke-linecap="butt" opacity=".9" filter="url(#glow)" stroke-dasharray="0.0001 2"/>
      <path id="dash" d="${arc(R, A0, A1)}" fill="none" stroke="#f7d13c" stroke-width="9" stroke-dasharray="30 26"/>
      <g id="needle">
        <polygon points="${C},${C - 412} ${C + 17},${C} ${C + 9},${C + 78} ${C - 9},${C + 78} ${C - 17},${C}" fill="rgba(0,0,0,.45)" transform="translate(6 8)"/>
        <polygon points="${C},${C - 412} ${C + 17},${C} ${C + 9},${C + 78} ${C - 9},${C + 78} ${C - 17},${C}" fill="url(#ndl)" filter="url(#glowS)"/>
        <line x1="${C}" y1="${C - 395}" x2="${C}" y2="${C - 40}" stroke="rgba(255,255,255,.75)" stroke-width="3" stroke-linecap="round"/>
      </g>
      <circle cx="${C}" cy="${C}" r="64" fill="#141414" stroke="url(#hot)" stroke-width="11"/>
      <circle cx="${C}" cy="${C}" r="25" fill="#ff8a1a"/>
      <text id="readout" class="readout" x="${C}" y="760" font-size="${size}" text-anchor="middle" dominant-baseline="central" fill="url(#rd)" filter="url(#glowS)">${lo()}</text>`;
    el = { lit: gD.querySelector("#lit"), dash: gD.querySelector("#dash"), needle: gD.querySelector("#needle"), readout: gD.querySelector("#readout") };
    shown = null;
    drawNeedle(cur, 0);
  };

  // ---------------------------------------------------------------- needle state
  let cur = 0;            // needle position 0..1
  let shown = null;       // number on the readout
  let spinning = false;
  let dashOff = 0, lastT = performance.now(), lastV = 0, speed = 0;

  const numAt = (v) => Math.round(lo() + v * span());
  const drawNeedle = (v, wobble) => {
    el.needle.setAttribute("transform", `rotate(${(angOf(v) + wobble).toFixed(3)} ${C} ${C})`);
    el.lit.setAttribute("stroke-dasharray", `${Math.max(0.0001, v).toFixed(5)} 2`);
    const n = numAt(v);
    if (n !== shown) { shown = n; el.readout.textContent = n; if (spinning) tick(); }
  };

  // one animation loop: road dashes flow (faster with the needle), idle needle trembles like an idling engine
  const loop = (t) => {
    const dt = Math.min(0.05, (t - lastT) / 1000); lastT = t;
    if (spinning) {
      const v = path(Math.min(1, (t - spinT0) / spinDur));
      speed = Math.abs(v - lastV) / Math.max(dt, 1e-3); lastV = v; cur = v;
      drawNeedle(v, 0);
      engineSet(v, speed);
      if (t - spinT0 >= spinDur) finish();
    } else {
      speed *= 0.9;
      drawNeedle(cur, Math.sin(t / 70) * 0.18 + Math.sin(t / 23) * 0.08);
    }
    dashOff -= (18 + speed * 700) * dt;
    el.dash.setAttribute("stroke-dashoffset", dashOff.toFixed(1));
    requestAnimationFrame(loop);
  };

  // ---------------------------------------------------------------- spin path (cosmetic)
  const easeOutQuad = (u) => 1 - (1 - u) * (1 - u);
  const easeInOutSine = (u) => -(Math.cos(Math.PI * u) - 1) / 2;
  const glide = (u) => 1 - Math.pow(1 - u, 3) * (1 + 3 * u);   // starts and ends at rest, long cubic tail
  let path = () => 0, spinT0 = 0, spinDur = 8000, target = null;

  const buildPath = (v0, vt) => {
    const r = Math.random;
    const dist = 0.36 + r() * 0.18;
    const vs = Math.min(1, Math.max(0, vt >= 0.5 ? vt - dist : vt + dist));
    const keys = [
      [0, v0, easeOutQuad],
      [0.085, 0.95 + r() * 0.05, easeInOutSine],
      [0.18, 0.06 + r() * 0.2, easeInOutSine],
      [0.29, 0.76 + r() * 0.2, easeInOutSine],
      [0.42, vs, glide],
      [1, vt, null],
    ];
    return (t) => {
      let i = 0;
      while (i < keys.length - 2 && t >= keys[i + 1][0]) i++;
      const [ta, va, ease] = keys[i], [tb, vb] = keys[i + 1];
      const u = Math.min(1, Math.max(0, (t - ta) / (tb - ta)));
      return va + (vb - va) * ease(u);
    };
  };

  const spin = () => {
    if (spinning) return;
    if (!$("#win").hidden) { closeWin(); return; }
    const p = pool();
    if (!p.length) { toast("Բոլոր թվերն արդեն խաղարկված են"); return; }
    target = p[randInt(p.length)];
    const vt = valToFrac(target);
    path = buildPath(cur, vt);
    spinDur = S.dur * 1000;
    spinT0 = performance.now(); lastV = cur;
    spinning = true;
    document.body.classList.add("spinning");
    document.body.classList.remove("won");
    $("#spin").disabled = true;
    setPanelLock(true);
    engineStart();
  };

  const finish = () => {
    spinning = false;
    cur = valToFrac(target);
    shown = null; drawNeedle(cur, 0);
    engineStop();
    document.body.classList.remove("spinning");
    document.body.classList.add("won");
    S.history.push({ n: target, prize: S.prize || "", t: Date.now() });
    save();
    renderHistory(true);
    renderStats();
    setTimeout(() => showWin(target), 350);
  };

  // ---------------------------------------------------------------- winner
  const showWin = (n) => {
    $("#winNum").textContent = n;
    $("#winPrize").textContent = S.prize || "";
    $("#win").hidden = false;
    fanfare();
    confetti();
    $("#winNext").focus({ preventScroll: true });
  };
  const closeWin = () => {
    $("#win").hidden = true;
    $("#spin").disabled = false;
    setPanelLock(false);
    $("#spin").focus({ preventScroll: true });
  };

  // ---------------------------------------------------------------- history + stats
  const renderHistory = (fresh) => {
    const h = $("#history");
    const last = S.history.slice(-8).reverse();
    h.innerHTML = last.map((x, i) => `<div class="chip${fresh && i === 0 ? " new" : ""}"><i>#${S.history.length - i}</i>${x.n}</div>`).join("");
    $("#histFull").innerHTML = S.history.map((x, i) => `<span title="${x.prize ? x.prize.replace(/"/g, "&quot;") : ""}"><i>#${i + 1}</i>${x.n}</span>`).join("");
  };
  const renderStats = () => {
    const left = pool().length;
    $("#countVal").textContent = S.count; $("#stDrawn").textContent = S.history.length; $("#stLeft").textContent = left;
    $("#panelStats").innerHTML = `Թվերը՝ <b>${lo()}</b>–<b>${hi()}</b><br>Բացառված՝ <b>${countExcluded()}</b> · Խաղարկված՝ <b>${S.history.length}</b> · Մնաց՝ <b>${left}</b>`;
    const pz = $("#prize");
    pz.hidden = !S.prize; pz.textContent = S.prize;
  };
  const countExcluded = () => { let k = 0; for (const v of parseExclude(S.exclude)) if (v >= lo() && v <= hi()) k++; return k; };

  // ---------------------------------------------------------------- settings
  const inCount = $("#inCount"), inFrom = $("#inFrom"), inTo = $("#inTo"), inPrize = $("#inPrize"), inExclude = $("#inExclude"), inNoRepeat = $("#inNoRepeat"), inDur = $("#inDur"), inSound = $("#inSound");
  const fillInputs = () => {
    inCount.value = S.count; inFrom.value = S.from; inTo.value = hi(); inPrize.value = S.prize; inExclude.value = S.exclude;
    inNoRepeat.checked = S.noRepeat; inDur.value = S.dur; $("#durVal").textContent = S.dur; inSound.checked = S.sound;
  };
  const rangeChanged = () => {
    inTo.value = hi();
    const last = S.history[S.history.length - 1];
    cur = last && last.n >= lo() && last.n <= hi() ? valToFrac(last.n) : 0;
    buildStatic(); buildDyn(); renderStats(); save();
    // a number typed here wins over an old ?n= / ?from= in the address, also after a reload
    try { const u = new URL(location.href); if (u.searchParams.has("n") || u.searchParams.has("from")) { u.searchParams.delete("n"); u.searchParams.delete("from"); history.replaceState(null, "", u); } } catch { /* ignore */ }
  };
  // inline count editor on the main screen
  const countBtn = $("#countBtn"), countEdit = $("#countEdit");
  const openCount = () => {
    if (spinning || !$("#win").hidden) return;
    countEdit.value = S.count; countBtn.hidden = true; countEdit.hidden = false;
    countEdit.focus(); countEdit.select();
  };
  const closeCount = (apply) => {
    if (countEdit.hidden) return;
    if (apply) {
      const v = clampInt(countEdit.value, 1, MAXN, S.count);
      if (v !== S.count) { S.count = v; inCount.value = v; rangeChanged(); toast(`Մասնակիցներ՝ ${v}`); }
    }
    countEdit.hidden = true; countBtn.hidden = false;
  };
  countBtn.addEventListener("click", openCount);
  countEdit.addEventListener("keydown", (e) => {
    if (e.key === "Enter") { e.preventDefault(); e.stopPropagation(); closeCount(true); }
    else if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); closeCount(false); }
  });
  countEdit.addEventListener("blur", () => closeCount(true));
  const setPanelLock = (on) => { document.querySelectorAll("#panel input, #panel button:not(#panelClose), #countBtn").forEach((x) => (x.disabled = on)); };

  inCount.addEventListener("change", () => { S.count = clampInt(inCount.value, 1, MAXN, S.count); inCount.value = S.count; rangeChanged(); });
  inCount.addEventListener("input", () => { const v = Number(inCount.value); if (Number.isInteger(v) && v >= 1 && v <= MAXN) { S.count = v; rangeChanged(); } });
  document.querySelectorAll(".stepper button").forEach((b) => b.addEventListener("click", () => { S.count = clampInt(S.count + Number(b.dataset.step), 1, MAXN, S.count); inCount.value = S.count; rangeChanged(); }));
  inFrom.addEventListener("change", () => { S.from = clampInt(inFrom.value, 0, 99999, S.from); inFrom.value = S.from; rangeChanged(); });
  inPrize.addEventListener("input", () => { S.prize = inPrize.value.trim(); save(); renderStats(); });
  inExclude.addEventListener("input", () => { S.exclude = inExclude.value; save(); renderStats(); });
  inNoRepeat.addEventListener("change", () => { S.noRepeat = inNoRepeat.checked; save(); renderStats(); });
  inDur.addEventListener("input", () => { S.dur = clampInt(inDur.value, 4, 16, 8); $("#durVal").textContent = S.dur; save(); });
  inSound.addEventListener("change", () => { S.sound = inSound.checked; save(); });
  $("#btnUndo").addEventListener("click", () => {
    if (!S.history.length) return;
    const x = S.history.pop(); save(); renderHistory(false); renderStats(); toast(`Չեղարկվեց՝ ${x.n}`);
  });
  $("#btnClear").addEventListener("click", () => {
    if (!S.history.length) return;
    if (!confirm("Մաքրե՞լ հաղթողների ամբողջ պատմությունը")) return;
    S.history = []; save(); cur = 0; renderHistory(false); renderStats(); toast("Պատմությունը մաքրվեց");
  });

  const openPanel = () => { $("#panel").hidden = false; fillInputs(); renderStats(); };
  const closePanel = () => { $("#panel").hidden = true; };
  $("#btnSettings").addEventListener("click", () => ($("#panel").hidden ? openPanel() : closePanel()));
  $("#panelClose").addEventListener("click", closePanel);

  // ---------------------------------------------------------------- fullscreen, idle cursor, keys
  const fullscreen = () => {
    const d = document, e = d.documentElement;
    if (d.fullscreenElement || d.webkitFullscreenElement) (d.exitFullscreen || d.webkitExitFullscreen).call(d);
    else (e.requestFullscreen || e.webkitRequestFullscreen).call(e);
  };
  $("#btnFull").addEventListener("click", fullscreen);
  let idleT = 0;
  const wake = () => { document.body.classList.remove("idle"); clearTimeout(idleT); idleT = setTimeout(() => { if ($("#panel").hidden) document.body.classList.add("idle"); }, 2500); };
  ["mousemove", "mousedown", "touchstart"].forEach((ev) => window.addEventListener(ev, wake, { passive: true }));

  $("#spin").addEventListener("click", spin);
  $("#winNext").addEventListener("click", closeWin);
  $("#win").addEventListener("click", (e) => { if (e.target.id === "win") closeWin(); });
  window.addEventListener("keydown", (e) => {
    const typing = e.target.closest && e.target.closest("input, textarea");
    if (e.key === "Escape") { if (!$("#win").hidden) closeWin(); else closePanel(); return; }
    if (typing) return;
    if (e.key === " " || e.key === "Enter") { e.preventDefault(); if (!$("#win").hidden) closeWin(); else spin(); }
    else if (e.key === "f" || e.key === "F" || e.key === "ֆ") fullscreen();
    else if (e.key === "s" || e.key === "S" || e.key === "ս") ($("#panel").hidden ? openPanel() : closePanel());
    else if (e.key === "n" || e.key === "N" || e.key === "ն") { e.preventDefault(); openCount(); }
  });

  // ---------------------------------------------------------------- toast
  let toastT = 0;
  const toast = (msg) => { const t = $("#toast"); t.textContent = msg; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => (t.hidden = true), 2600); };

  // ---------------------------------------------------------------- sound (Web Audio, generated — no files)
  let ac = null, eng = null, clickBuf = null, lastClick = 0;
  const audio = () => {
    if (!S.sound) return null;
    if (!ac) { const A = window.AudioContext || window.webkitAudioContext; if (!A) return null; ac = new A(); }
    if (ac.state === "suspended") ac.resume();
    return ac;
  };
  const engineStart = () => {
    const a = audio(); if (!a) return;
    const out = a.createGain(); out.gain.value = 0; out.connect(a.destination);
    const lp = a.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 700; lp.Q.value = 5; lp.connect(out);
    const o1 = a.createOscillator(); o1.type = "sawtooth"; o1.frequency.value = 50; o1.connect(lp);
    const sub = a.createGain(); sub.gain.value = 0.6; sub.connect(lp);
    const o2 = a.createOscillator(); o2.type = "square"; o2.frequency.value = 25; o2.connect(sub);
    o1.start(); o2.start();
    out.gain.setTargetAtTime(0.05, a.currentTime, 0.06);
    eng = { out, lp, o1, o2 };
  };
  const engineSet = (v, sp) => {
    if (!eng || !ac) return;
    const f = 46 + v * 150 + Math.min(70, sp * 25), t = ac.currentTime;
    eng.o1.frequency.setTargetAtTime(f, t, 0.04);
    eng.o2.frequency.setTargetAtTime(f / 2, t, 0.04);
    eng.lp.frequency.setTargetAtTime(420 + v * 1600 + Math.min(900, sp * 300), t, 0.05);
  };
  const engineStop = () => {
    if (!eng || !ac) return;
    const e = eng; eng = null;
    e.out.gain.setTargetAtTime(0, ac.currentTime, 0.12);
    setTimeout(() => { try { e.o1.stop(); e.o2.stop(); e.out.disconnect(); } catch { /* already stopped */ } }, 900);
  };
  const tick = () => {
    const a = audio(); if (!a) return;
    const now = performance.now(); if (now - lastClick < 28) return; lastClick = now;
    if (!clickBuf) {
      clickBuf = a.createBuffer(1, Math.floor(a.sampleRate * 0.018), a.sampleRate);
      const d = clickBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 5);
    }
    const s = a.createBufferSource(); s.buffer = clickBuf;
    const hp = a.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 2200;
    const g = a.createGain(); g.gain.value = 0.32;
    s.connect(hp); hp.connect(g); g.connect(a.destination); s.start();
  };
  const fanfare = () => {
    const a = audio(); if (!a) return;
    const t0 = a.currentTime + 0.02;
    const note = (f, at, len, vol, type = "triangle") => {
      const o = a.createOscillator(), g = a.createGain(); o.type = type; o.frequency.value = f;
      g.gain.setValueAtTime(0, t0 + at); g.gain.linearRampToValueAtTime(vol, t0 + at + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t0 + at + len);
      o.connect(g); g.connect(a.destination); o.start(t0 + at); o.stop(t0 + at + len + 0.05);
    };
    [523.25, 659.25, 783.99].forEach((f, i) => note(f, i * 0.11, 0.35, 0.16));
    [1046.5, 1318.5, 1568].forEach((f) => note(f, 0.36, 1.4, 0.1));
    [523.25, 783.99].forEach((f) => note(f, 0.36, 1.6, 0.08, "sawtooth"));
  };

  // ---------------------------------------------------------------- confetti
  const cv = $("#confetti"), cx = cv.getContext("2d");
  let parts = [], confT = 0;
  const confetti = () => {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = innerWidth * dpr; cv.height = innerHeight * dpr; cx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const cols = ["#ffe066", "#ffc23a", "#ff8a1a", "#ff6a00", "#ffffff", "#f7d13c"];
    const W0 = innerWidth, H0 = innerHeight;
    for (let i = 0; i < 220; i++) {
      const burst = i < 110, a = Math.random() * Math.PI * 2, sp = 6 + Math.random() * 12;
      parts.push({
        x: burst ? W0 / 2 : Math.random() * W0, y: burst ? H0 * 0.45 : -20 - Math.random() * H0 * 0.4,
        vx: burst ? Math.cos(a) * sp : (Math.random() - 0.5) * 2, vy: burst ? Math.sin(a) * sp - 4 : 2 + Math.random() * 3,
        w: 6 + Math.random() * 10, h: 4 + Math.random() * 6, r: Math.random() * 6, vr: (Math.random() - 0.5) * 0.4,
        c: cols[i % cols.length], dash: Math.random() < 0.25, life: 0,
      });
    }
    if (!confT) confT = requestAnimationFrame(drawConfetti);
  };
  const drawConfetti = () => {
    cx.clearRect(0, 0, innerWidth, innerHeight);
    parts = parts.filter((p) => p.y < innerHeight + 40 && p.life < 420);
    for (const p of parts) {
      p.life++; p.vx *= 0.985; p.vy = p.vy * 0.985 + 0.22; p.x += p.vx; p.y += p.vy; p.r += p.vr;
      cx.save(); cx.translate(p.x, p.y); cx.rotate(p.r); cx.fillStyle = p.c;
      if (p.dash) cx.fillRect(-p.w, -2, p.w * 2, 4); else cx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h * Math.abs(Math.cos(p.life / 8)) + 1);
      cx.restore();
    }
    confT = parts.length ? requestAnimationFrame(drawConfetti) : 0;
    if (!parts.length) cx.clearRect(0, 0, innerWidth, innerHeight);
  };

  // ---------------------------------------------------------------- start
  const last = S.history[S.history.length - 1];
  cur = last && last.n >= lo() && last.n <= hi() ? valToFrac(last.n) : 0;
  fillInputs();
  buildStatic(); buildDyn();
  renderHistory(false); renderStats();
  wake();
  requestAnimationFrame(loop);
  // expose for quick checks in the console
  window.ruletka = { state: S, pool, spin };
})();
