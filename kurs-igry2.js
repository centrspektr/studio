/* Гитара и ИИ: свои тренажёры и картинки курса. Подключаются к движку через VZ_KURS.games и VZ_KURS.pic.
   Звук гитары синтезируется прямо в браузере (без файлов): щипок струны, бой, щелчок метронома.
   Тренажёры (g в задании):
     strings - найди струну по номеру или ноте      tune  - тюнер: подтянуть, отпустить или готово
     beat    - стучи ровно под метроном             strum - бой: собери схему ↓ ↑ · Б по слуху
     pick    - перебор: нажимай струны по порядку   chord - узнай аккорд по схеме (и наоборот)
     ear     - мажор или минор на слух              fret  - какая нота на этом ладу
     staff   - какая нота на нотном стане           tab   - прочитай табулатуру
     count   - минута смен аккордов (честный счёт)  prompt - собери промпт для музыкальной нейросети
   Картинки (pic в карточке): 'ch:Am' - схема аккорда (нажми - прозвучит), 'pat:↓·↓↑·↑↓↑' - схема боя,
     'pk:Am:Б 3 2 1' - перебор, 'neck' - гриф с номерами струн, 'staff' - нотный стан, 'tune' - тюнер. */
(function () {
'use strict';
const K = window.VZ_KURS; if (!K) return;
const $ = (s, r) => (r || document).querySelector(s), $$ = (s, r) => [...(r || document).querySelectorAll(s)];
const H = () => K.H || { snd() {}, buzz() {}, whyBox() {}, toast() {}, E: s => s, shuf: a => a, pick: a => a[0] };
const E = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const shuf = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const pick = a => a[Math.floor(Math.random() * a.length)];
const RED = matchMedia('(prefers-reduced-motion: reduce)').matches;
const N3 = (lv, a) => a[(lv || 1) - 1];

/* ================= ЗВУК ================= */
let AC = null;
function ac() { AC = AC || new (window.AudioContext || window.webkitAudioContext)(); if (AC.state === 'suspended') AC.resume(); return AC; }
const hz = m => 440 * Math.pow(2, (m - 69) / 12);
const OPEN = [40, 45, 50, 55, 59, 64];          // струны 6..1 (индекс 0 = 6-я, толстая)
const BUF = {};
/* щипок струны: алгоритм Карплуса-Стронга (шум в "кольце" затухает и звучит как струна) */
function ksBuf(m) {
  if (BUF[m]) return BUF[m];
  const c = ac(), sr = c.sampleRate, n = Math.floor(sr * 2.2), b = c.createBuffer(1, n, sr), d = b.getChannelData(0);
  const p = Math.max(2, Math.round(sr / hz(m))), r = new Float32Array(p);
  for (let i = 0; i < p; i++) r[i] = Math.random() * 2 - 1;
  for (let i = 1; i < p; i++) r[i] = (r[i] + r[i - 1]) / 2;     // помягче, без "шипения"
  const dec = m < 50 ? .998 : .996;
  for (let i = 0, k = 0; i < n; i++) { const j = (k + 1) % p; d[i] = r[k]; r[k] = (r[k] + r[j]) * .5 * dec; k = j; }
  return (BUF[m] = b);
}
let OUT = null;
/* выход: "корпус" гитары - чуть больше низа (резонанс корпуса около 110 Гц) и мягкий верх */
function out() {
  if (OUT) return OUT;
  const c = ac(), g = c.createGain(), body = c.createBiquadFilter(), f = c.createBiquadFilter();
  body.type = 'peaking'; body.frequency.value = 110; body.Q.value = 1.2; body.gain.value = 4;
  f.type = 'lowpass'; f.frequency.value = 4200; g.gain.value = .5;
  g.connect(body); body.connect(f); f.connect(c.destination); return (OUT = g);
}
function pluck(m, t, vol, cents) {
  try {
    const c = ac(), s = c.createBufferSource(), g = c.createGain();
    s.buffer = ksBuf(m); if (cents) s.playbackRate.value = Math.pow(2, cents / 1200);
    g.gain.value = vol == null ? .5 : vol; s.connect(g); g.connect(out()); s.start(c.currentTime + (t || 0));
  } catch (e) {}
}
/* бой: вниз - от 6-й к 1-й, вверх - от 1-й к 6-й (только тонкие струны) */
function strum(ch, t, up, vol) {
  const sh = shape(ch); if (!sh) return;
  let idx = sh.f.map((f, i) => f >= 0 ? i : -1).filter(i => i >= 0);
  if (up) idx = idx.filter(i => i >= 2).reverse();
  idx.forEach((i, k) => pluck(OPEN[i] + sh.f[i], (t || 0) + k * .014, (vol || .32) * (up ? .8 : 1)));
}
function bass(ch, t) { const sh = shape(ch); if (sh) pluck(OPEN[sh.b] + sh.f[sh.b], t, .55); }
function click(t, acc) {
  try {
    const c = ac(), o = c.createOscillator(), g = c.createGain(), T = c.currentTime + (t || 0);
    o.type = 'square'; o.frequency.value = acc ? 1500 : 1000;
    g.gain.setValueAtTime(.0001, T); g.gain.exponentialRampToValueAtTime(.12, T + .002); g.gain.exponentialRampToValueAtTime(.0001, T + .05);
    o.connect(g); g.connect(c.destination); o.start(T); o.stop(T + .06);
  } catch (e) {}
}
function mute(t) { try { const c = ac(), n = Math.floor(c.sampleRate * .05), b = c.createBuffer(1, n, c.sampleRate), d = b.getChannelData(0); for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n); const s = c.createBufferSource(), g = c.createGain(); g.gain.value = .25; s.buffer = b; s.connect(g); g.connect(out()); s.start(c.currentTime + (t || 0)); } catch (e) {} }

/* ================= АККОРДЫ ================= */
/* f - лады струн 6..1 (-1 не звучит, 0 открытая); g - пальцы (1 указательный ... 4 мизинец); b - бас (индекс струны) */
const CH = {
  Em: { f: [0, 2, 2, 0, 0, 0], g: [0, 2, 3, 0, 0, 0], m: 1 },
  E: { f: [0, 2, 2, 1, 0, 0], g: [0, 2, 3, 1, 0, 0] },
  Am: { f: [-1, 0, 2, 2, 1, 0], g: [0, 0, 2, 3, 1, 0], m: 1 },
  A: { f: [-1, 0, 2, 2, 2, 0], g: [0, 0, 1, 2, 3, 0] },
  Dm: { f: [-1, -1, 0, 2, 3, 1], g: [0, 0, 0, 2, 3, 1], m: 1 },
  D: { f: [-1, -1, 0, 2, 3, 2], g: [0, 0, 0, 1, 3, 2] },
  C: { f: [-1, 3, 2, 0, 1, 0], g: [0, 3, 2, 0, 1, 0] },
  G: { f: [3, 2, 0, 0, 0, 3], g: [2, 1, 0, 0, 0, 3] },
  E7: { f: [0, 2, 0, 1, 0, 0], g: [0, 2, 0, 1, 0, 0] },
  A7: { f: [-1, 0, 2, 0, 2, 0], g: [0, 0, 2, 0, 3, 0] },
  Hm: { f: [-1, 2, 4, 4, 3, 2], g: [0, 1, 3, 4, 2, 1], m: 1, bar: 2 },
  F: { f: [1, 3, 3, 2, 1, 1], g: [1, 3, 4, 2, 1, 1], bar: 1 }
};
function shape(n) { const c = CH[n]; if (!c) return null; if (c.b == null) c.b = c.f.findIndex(x => x >= 0); return c; }
const isMinor = n => /m$/.test(n);

/* ================= КАРТИНКИ ================= */
function chordSvg(n, small, hide) {
  const c = shape(n); if (!c) return '';
  const X = i => 18 + i * 17, Y = f => 36 + f * 24, top = Math.max(...c.f) > 4 ? Math.min(...c.f.filter(f => f > 0)) - 1 : 0;
  let s = `<rect x="${X(0)}" y="${Y(0)}" width="${X(5) - X(0)}" height="${Y(4) - Y(0)}" class="gs-bd"/>`;
  for (let f = 1; f < 4; f++) s += `<path d="M${X(0)} ${Y(f)}H${X(5)}" class="gs-fr"/>`;
  for (let i = 0; i < 6; i++) s += `<path d="M${X(i)} ${Y(0)}V${Y(4)}" class="gs-st" style="stroke-width:${1.8 - i * .2}"/>`;
  s += top ? `<text x="${X(0) - 10}" y="${Y(1) - 7}" class="gs-n">${top + 1}</text>` : `<path d="M${X(0) - 1} ${Y(0)}H${X(5) + 1}" class="gs-nut"/>`;
  if (c.bar) { const x0 = X(c.f.indexOf(c.bar)); s += `<rect x="${x0 - 7}" y="${Y(c.bar - top) - 19}" width="${X(5) - x0 + 14}" height="14" rx="7" class="gs-dot"/><text x="${x0}" y="${Y(c.bar - top) - 8}" class="gs-fn">1</text>`; }
  c.f.forEach((f, i) => {
    if (f < 0) s += `<text x="${X(i)}" y="${Y(0) - 8}" class="gs-x">×</text>`;
    else if (f === 0) s += `<circle cx="${X(i)}" cy="${Y(0) - 12}" r="5" class="gs-o"/>`;
    else if (!(c.bar && f === c.bar && c.g[i] === 1)) s += `<circle cx="${X(i)}" cy="${Y(f - top) - 12}" r="8" class="gs-dot"/><text x="${X(i)}" y="${Y(f - top) - 8}" class="gs-fn">${c.g[i] || ''}</text>`;
  });
  return `<svg viewBox="0 0 120 ${small ? 136 : 142}" class="gs-ch${small ? ' sm' : ''}" data-play="ch:${E(n)}" role="img" aria-label="${hide ? 'Аккорд' : 'Аккорд ' + E(n)}">${hide ? '' : `<text x="60" y="12" class="gs-nm">${E(n)}</text>`}${s}</svg>`;
}
const PAT = { '↓': 'down', '↑': 'up', '·': 'rest', 'Б': 'bass', 'x': 'mute' };
function patHtml(p, cls) {
  const a = Array.isArray(p) ? p : [...p.replace(/\s/g, '')];
  return `<div class="gs-pat ${cls || ''}" data-play="pat:${E(a.join(''))}">${a.map((s, i) => `<span class="${PAT[s] || ''}"><b>${s === 'x' ? '✕' : E(s)}</b><small>${i % 2 ? 'и' : i / 2 + 1}</small></span>`).join('')}<em>▶</em></div>`;
}
/* гриф: сверху 1-я (тонкая) струна, как в табулатуре. mark: [{s: 1..6, f: лад, t: подпись, c: класс}] */
function neckSvg(o) {
  o = o || {}; const F = o.frets || 5, W = 330, x0 = 34, fw = (W - x0 - 8) / F, y = s => 14 + (s - 1) * 17;
  const fx = f => f === 0 ? x0 - 16 : x0 + (f - .5) * fw;
  let s = `<rect x="${x0}" y="6" width="${W - x0 - 8}" height="${y(6) - y(1) + 16}" rx="4" class="gn-wood"/>`;
  for (let f = 1; f <= F; f++) s += `<path d="M${x0 + f * fw} 6v${y(6) - y(1) + 16}" class="gn-fr"/>` + (o.nums !== false ? `<text x="${x0 + (f - .5) * fw}" y="${y(6) + 22}" class="gn-fn">${f}</text>` : '');
  [3, 5].filter(f => f <= F).forEach(f => s += `<circle cx="${x0 + (f - .5) * fw}" cy="${(y(3) + y(4)) / 2}" r="4" class="gn-inl"/>`);
  s += `<path d="M${x0} 4v${y(6) - y(1) + 20}" class="gn-nut"/>`;
  for (let k = 1; k <= 6; k++) s += `<g class="gn-s" data-s="${k}"${o.tap ? ` role="button" tabindex="0" aria-label="${k}-я струна"` : ''}><rect x="0" y="${y(k) - 8}" width="${W}" height="16" fill="transparent"/><path d="M${x0 - 2} ${y(k)}H${W - 8}" class="gn-str" style="stroke-width:${.9 + k * .38}"/>${o.lab !== false ? `<text x="10" y="${y(k) + 4}" class="gn-l">${o.lab === 'note' ? 'EBGDAE'[k - 1] : k}</text>` : ''}</g>`;
  (o.mark || []).forEach(m => s += `<g class="gn-m ${m.c || ''}"><circle cx="${fx(m.f)}" cy="${y(m.s)}" r="8.5"/>${m.t ? `<text x="${fx(m.f)}" y="${y(m.s) + 4}">${E(m.t)}</text>` : ''}</g>`);
  return `<svg viewBox="0 0 ${W} ${y(6) + 28}" class="gs-neck" role="${o.tap ? 'group' : 'img'}" aria-label="Гриф гитары: сверху 1-я струна, снизу 6-я">${s}</svg>`;
}
/* нотный стан: шаг 0 = ми первой октавы (нижняя линия), каждый шаг - линия или промежуток */
const LET = ['до', 'ре', 'ми', 'фа', 'соль', 'ля', 'си'], LAT = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
const stepName = st => LET[((2 + st) % 7 + 7) % 7];
function staffSvg(steps, o) {
  o = o || {}; const Y = st => 76 - st * 6, xs = steps.length > 1 ? steps.map((_, i) => 74 + i * (190 / steps.length)) : [150];
  let s = ''; for (let l = 0; l < 5; l++) s += `<path d="M10 ${Y(l * 2)}H290" class="gf-l"/>`;
  s += `<text x="14" y="${Y(2) + 14}" class="gf-cl">𝄞</text>`;
  steps.forEach((st, i) => {
    const x = xs[i];
    for (let l = -2; l >= st; l -= 2) s += `<path d="M${x - 14} ${Y(l)}h28" class="gf-l"/>`;
    for (let l = 10; l <= st; l += 2) s += `<path d="M${x - 14} ${Y(l)}h28" class="gf-l"/>`;
    s += `<ellipse cx="${x}" cy="${Y(st)}" rx="7.5" ry="5.6" transform="rotate(-18 ${x} ${Y(st)})" class="gf-n"/><path d="M${x + (st >= 4 ? -7 : 7)} ${Y(st)}v${st >= 4 ? 34 : -34}" class="gf-stem"/>`;
    if (o.names) s += `<text x="${x}" y="122" class="gf-t">${stepName(st)}</text>`;
  });
  return `<svg viewBox="0 0 300 ${o.names ? 130 : 112}" class="gs-staff">${s}</svg>`;
}
function tuneSvg(c) {
  const a = Math.max(-50, Math.min(50, c)) * 1.4;
  return `<svg viewBox="0 0 240 120" class="gs-tune"><path d="M30 104A90 90 0 0 1 210 104" class="gt-arc"/><path d="M106 18A90 90 0 0 1 134 18" class="gt-ok"/>
    <text x="34" y="118" class="gt-s">ниже</text><text x="206" y="118" class="gt-s">выше</text><g class="gt-nd" style="transform:rotate(${a}deg)"><path d="M120 104V22"/><circle cx="120" cy="104" r="6"/></g></svg>`;
}
K.pic = function (k) {
  if (!k) return '';
  if (k.indexOf('ch:') === 0) return `<div class="gs-chs">${k.slice(3).split(',').map(n => chordSvg(n.trim(), true)).join('')}</div>`;
  if (k.indexOf('pat:') === 0) return patHtml(k.slice(4));
  if (k.indexOf('pk:') === 0) { const [, ch, p] = k.split(':'), sh = shape(ch); return neckSvg({ frets: 4, mark: sh.f.map((f, i) => f > 0 ? { s: 6 - i, f, t: sh.g[i] } : null).filter(Boolean).concat([{ s: 6 - sh.b, f: Math.max(0, sh.f[sh.b]), t: 'Б', c: 'bs' }]) }) + `<div class="gs-pk" data-play="pk:${E(ch)}:${E(p)}">${E(p).split(' ').map(x => `<b>${x}</b>`).join('')}<em>▶</em></div>`; }
  if (k === 'neck') return neckSvg({ frets: 5, lab: true });
  if (k === 'neckn') return neckSvg({ frets: 5, lab: 'note' });
  if (k === 'staff') return staffSvg([0, 2, 4, 6, 8], { names: true });
  if (k === 'scale') return staffSvg([-2, -1, 0, 1, 2, 3, 4, 5], { names: true });
  if (k === 'tune') return tuneSvg(-22);
  return '';
};
/* нажатие на картинку - звучит: аккорд, бой, перебор */
document.addEventListener('click', e => {
  const el = e.target.closest && e.target.closest('[data-play]'); if (!el) return;
  const v = el.dataset.play, [kind, a, b] = v.split(':');
  if (kind === 'ch') { strum(a, 0, false, .4); flash(el); }
  else if (kind === 'pat') playPat([...a], 'Am', 72, el);
  else if (kind === 'pk') playPick(a, b.split(' '), 76, el);
});
function playPat(p, ch, bpm, el) {
  const d = 60 / bpm / 2;
  p.forEach((s, i) => {
    const t = i * d;
    if (s === '↓') strum(ch, t); else if (s === '↑') strum(ch, t, true); else if (s === 'Б') bass(ch, t); else if (s === 'x') mute(t);
    if (el) setTimeout(() => { $$('span', el).forEach((x, j) => x.classList.toggle('on', j === i)); }, t * 1000);
  });
  if (el) setTimeout(() => $$('span', el).forEach(x => x.classList.remove('on')), p.length * d * 1000 + 200);
  return p.length * d;
}
function playPick(ch, seq, bpm, el) {
  const sh = shape(ch), d = 60 / bpm / 2;
  seq.forEach((s, i) => {
    const idx = s === 'Б' ? sh.b : 6 - (+s); pluck(OPEN[idx] + Math.max(0, sh.f[idx]), i * d, .5);
    if (el) setTimeout(() => $$('b', el).forEach((x, j) => x.classList.toggle('on', j === i)), i * d * 1000);
  });
  if (el) setTimeout(() => $$('b', el).forEach(x => x.classList.remove('on')), seq.length * d * 1000 + 200);
}

/* струна дрожит после щипка, точки аккорда вспыхивают, когда он звучит */
function vib(g) { const p = g && g.querySelector('.gn-str'); if (!p || RED) return; p.classList.remove('vib'); void p.getBoundingClientRect(); p.classList.add('vib'); }
function flash(el) { if (!el || RED) return; el.classList.remove('pl'); void el.getBoundingClientRect(); el.classList.add('pl'); }
/* струны на грифе нажимаются и с клавиатуры: Tab - к струне, Enter или пробел - щипок */
document.addEventListener('keydown', e => {
  const g = e.target && e.target.closest && e.target.closest('.gn-s[role="button"]');
  if (!g || (e.key !== 'Enter' && e.key !== ' ')) return;
  e.preventDefault(); g.dispatchEvent(new MouseEvent('click', { bubbles: true }));
});
K.fxEmoji = ['🎸', '🎵', '⭐', '🎶'];

/* ================= ОБЩЕЕ ДЛЯ ТРЕНАЖЁРОВ ================= */
/* раунды "вопрос - варианты": R = [{q: html, opts: [..], ok: индекс, e: пояснение, play: fn}] */
function rounds(stg, st, R, done, o) {
  o = o || {}; let k = 0, ok = 0;
  function draw() {
    const r = R[k];
    stg.innerHTML = `<div class="kr-sec">${E(st.h)} · ${k + 1} из ${R.length}</div>${o.hint ? `<div class="kr-hint">Подсказка: ${E(o.hint)}</div>` : ''}
      <div class="gq">${r.q}</div>${r.play ? '<div style="text-align:center;margin:-2px 0 10px"><button class="kr-btn" data-pl>🔊 Послушать ещё</button></div>' : ''}
      <div class="kg-opts ${r.grid ? 'gq-grid' : ''}">${r.opts.map((t, j) => `<button class="kr-opt" data-j="${j}">${r.raw ? t : E(t)}</button>`).join('')}</div><div class="kq-r"></div>`;
    if (r.play) { $('[data-pl]', stg).onclick = () => r.play(); setTimeout(() => r.play(), 250); }
    if (r.after) r.after(stg);
    $$('.kr-opt', stg).forEach(b => b.onclick = ev => {
      ev.stopPropagation();
      const j = +b.dataset.j, good = j === r.ok;
      $$('.kr-opt', stg).forEach(z => { z.disabled = true; if (+z.dataset.j === r.ok) z.classList.add('y'); });
      const nxt = () => { k++; if (k < R.length) draw(); else { stg.innerHTML = `<div class="kr-end"><div class="big">${ok} из ${R.length}</div></div>`; done(ok / R.length); } };
      if (good) { ok++; H().snd('ok'); H().buzz(15); if (r.onOk) r.onOk(); setTimeout(nxt, 750); return; }
      b.classList.add('n'); H().snd('bad'); H().buzz(40);
      H().whyBox($('.kq-r', stg), false, r.e || 'Верный ответ подсвечен зелёным.', k === R.length - 1, nxt);
    });
  }
  draw();
}
const opts = (right, wrong, n) => { const o = shuf([right].concat(shuf([...new Set(wrong.filter(w => w !== right))]).slice(0, (n || 3) - 1))); return { opts: o, ok: o.indexOf(right) }; };
const NUMW = ['1-я', '2-я', '3-я', '4-я', '5-я', '6-я'], NUMA = ['1-ю', '2-ю', '3-ю', '4-ю', '5-ю', '6-ю'];
const SNAME = ['ми (E)', 'си (B)', 'соль (G)', 'ре (D)', 'ля (A)', 'ми (E)'];   // струны 1..6

/* ---------- strings: найди струну ---------- */
function gStrings(stg, st, hint, done, lv) {
  const N = N3(lv, [6, 8, 10]) - (hint ? 1 : 0);
  const kinds = lv === 1 ? ['num', 'num', 'thin'] : lv === 2 ? ['num', 'note', 'note', 'thin'] : ['note', 'note', 'name', 'ear'];
  const R = Array.from({ length: N }, () => { const s = 1 + Math.floor(Math.random() * 6); return { s, k: pick(kinds) }; });
  let k = 0, ok = 0;
  function draw() {
    const r = R[k]; let q;
    if (r.k === 'num') q = `Нажми на ${NUMA[r.s - 1]} струну`;
    else if (r.k === 'thin') { r.s = pick([1, 6]); q = r.s === 1 ? 'Нажми на самую тонкую струну' : 'Нажми на самую толстую струну'; }
    else if (r.k === 'note') q = `Нажми на струну, которая звучит как ${SNAME[r.s - 1]}${r.s === 1 || r.s === 6 ? (r.s === 1 ? ', тонкая' : ', толстая') : ''}`;
    else if (r.k === 'name') q = `Какая струна звучит как ${SNAME[r.s - 1].split(' ')[0]}${r.s === 1 ? ' (высокая)' : r.s === 6 ? ' (низкая)' : ''}? Нажми на неё`;
    else q = '🔊 Послушай струну и нажми на неё';
    stg.innerHTML = `<div class="kr-sec">${E(st.h)} · ${k + 1} из ${R.length}</div>${hint ? '<div class="kr-hint">Подсказка: сверху 1-я, тонкая. Снизу 6-я, толстая. Строй от 6-й: ми, ля, ре, соль, си, ми.</div>' : ''}
      <div class="kg-goal">🎯 ${E(q)}</div>${r.k === 'ear' ? '<div style="text-align:center;margin-bottom:8px"><button class="kr-btn" data-pl>🔊 Ещё раз</button></div>' : ''}
      <div class="gs-tap">${neckSvg({ frets: 4, lab: lv === 1 || hint ? true : false, nums: false, tap: 1 })}</div><p class="mut" style="text-align:center">Нажми прямо на струну</p><div class="kq-r"></div>`;
    if (r.k === 'ear') { const pl = () => pluck(OPEN[6 - r.s], 0, .6); $('[data-pl]', stg).onclick = pl; setTimeout(pl, 300); }
    let busy = false;
    $$('.gn-s', stg).forEach(g => g.onclick = () => {
      if (busy) return; busy = true; const s = +g.dataset.s, good = s === r.s;
      pluck(OPEN[6 - s], 0, .55); vib(g); g.classList.add(good ? 'y' : 'n'); if (!good) $(`.gn-s[data-s="${r.s}"]`, stg).classList.add('y');
      const nxt = () => { k++; if (k < R.length) draw(); else { stg.innerHTML = `<div class="kr-end"><div class="big">${ok} из ${R.length}</div></div>`; done(ok / R.length); } };
      if (good) { ok++; H().snd('ok'); setTimeout(nxt, 750); return; }
      H().snd('bad'); H().buzz(40);
      H().whyBox($('.kq-r', stg), false, `Это ${NUMW[s - 1]} струна (${SNAME[s - 1]}). Нужна была ${NUMW[r.s - 1]} - ${SNAME[r.s - 1]}. Сверху тонкая 1-я, снизу толстая 6-я.`, k === R.length - 1, nxt);
    });
  }
  draw();
}

/* ---------- tune: тюнер ---------- */
function gTune(stg, st, hint, done, lv) {
  const N = N3(lv, [6, 8, 8]);
  const R = Array.from({ length: N }, () => {
    const s = 1 + Math.floor(Math.random() * 6), z = Math.random() < (lv === 3 ? .15 : .2);
    const c = z ? pick([-2, 0, 2]) : (Math.random() < .5 ? -1 : 1) * (lv === 1 ? 22 + Math.random() * 25 : lv === 2 ? 7 + Math.random() * 18 : 18 + Math.random() * 20);
    return { s, c: Math.round(c) };
  });
  const L = ['⤴ Подтянуть колок', '⤵ Отпустить колок', '✓ Готово, строит'];
  rounds(stg, st, R.map(r => {
    const ok = Math.abs(r.c) <= 3 ? 2 : r.c < 0 ? 0 : 1, ear = lv === 3;
    return {
      q: `<p class="gq-t">Струна ${NUMW[r.s - 1]}, ${SNAME[r.s - 1]}${ear ? ': сначала нужная нота, потом твоя струна' : ''}</p>${ear ? '<div class="gq-ear">🎧 Слушай: звучит ниже или выше?</div>' : tuneSvg(r.c) + `<p class="mut" style="text-align:center">${r.c > 0 ? '+' : ''}${r.c} центов</p>`}`,
      opts: L, ok,
      play: () => { if (ear) { pluck(OPEN[6 - r.s], 0, .5); pluck(OPEN[6 - r.s], 1.1, .5, r.c); } else pluck(OPEN[6 - r.s], 0, .5, r.c); },
      e: ok === 2 ? 'Стрелка почти в центре (до 3 центов) - струна строит, крутить не надо.' : ok === 0 ? 'Звучит НИЖЕ нужного - струну надо натянуть сильнее: подтягиваем колок понемногу.' : 'Звучит ВЫШЕ нужного - струна перетянута: чуть отпускаем колок. Лучше отпустить ниже и подтянуть до ноты.'
    };
  }), done, { hint: hint ? 'стрелка слева (ниже) - подтягиваем, справа (выше) - отпускаем, в центре - готово.' : '' });
}

/* ---------- beat: стучи ровно под метроном ---------- */
function gBeat(stg, st, hint, done, lv) {
  const bpm = (st.bpm && st.bpm[lv]) || N3(lv, [60, 72, 84]) - (hint ? 8 : 0), beats = 8, tol = N3(lv, [.16, .13, .11]) + (hint ? .03 : 0);
  const silent = lv === 3 && !hint, what = st.what || 'Стучи по большой кнопке на каждый щелчок';
  stg.innerHTML = `<div class="kr-sec">${E(st.h)}</div><div class="kg-goal">🎯 ${E(what)}. Темп ${bpm}.</div>
    ${silent ? '<div class="kr-hint">Уровень 🔴: после 4 щелчков метроном замолчит - держи темп сам.</div>' : ''}${hint ? '<div class="kr-hint">Подсказка: темп помедленнее. Считай вслух "раз, два, три, четыре".</div>' : ''}
    <div class="gb"><div class="gb-dots">${Array.from({ length: beats }, () => '<i></i>').join('')}</div><button class="gb-pad" disabled>Тук</button><p class="mut gb-st">Сначала 4 щелчка - просто слушай, потом стучи.</p></div>
    <div class="kr-end"><div class="acts"><button class="kr-btn pri" data-go>▶ Начать</button></div></div>`;
  const pad = $('.gb-pad', stg), dots = $$('.gb-dots i', stg), msg = $('.gb-st', stg);
  $('[data-go]', stg).onclick = function () {
    this.closest('.kr-end').remove();
    const c = ac(), d = 60 / bpm, t0 = c.currentTime + .3, start = t0 + 4 * d, taps = [];
    for (let i = 0; i < 4 + beats; i++) if (i < 4 || !silent || i < 8) click(t0 + i * d - c.currentTime, i % 4 === 0);
    for (let i = 0; i < 4; i++) setTimeout(() => { msg.textContent = 'Слушай: ' + (i + 1); }, (t0 + i * d - c.currentTime) * 1000);
    setTimeout(() => { pad.disabled = false; msg.textContent = 'Стучи!'; }, (start - d / 2 - c.currentTime) * 1000);
    for (let i = 0; i < beats; i++) setTimeout(() => { if (!RED) { pad.classList.remove('pl'); void pad.offsetWidth; pad.classList.add('pl'); } }, (start + i * d - c.currentTime) * 1000);
    pad.onpointerdown = e => { e.preventDefault(); taps.push(c.currentTime); H().snd('tap'); pad.classList.add('hit'); setTimeout(() => pad.classList.remove('hit'), 90); };
    setTimeout(() => {
      if (!stg.isConnected) return;
      pad.disabled = true; pad.onpointerdown = null;
      let hit = 0; const used = new Set(), dev = [];
      for (let i = 0; i < beats; i++) {
        const tb = start + i * d; let best = -1, bd = 9;
        taps.forEach((t, j) => { if (!used.has(j) && Math.abs(t - tb) < bd) { bd = Math.abs(t - tb); best = j; } });
        const good = best >= 0 && bd <= tol; if (good) { used.add(best); hit++; dev.push(taps[best] - tb); }
        dots[i].className = good ? 'y' : 'n';
      }
      const extra = Math.max(0, taps.length - hit - 1), r = hit / (beats + extra);
      const avg = dev.length ? dev.reduce((a, b) => a + b, 0) / dev.length : 0;
      msg.textContent = `Попал в ${hit} из ${beats}${extra ? ', лишних ударов ' + extra : ''}. ` + (dev.length > 2 ? (avg < -.03 ? 'Ты чуть торопишься.' : avg > .03 ? 'Ты чуть опаздываешь.' : 'Ровно!') : '');
      done(Math.min(1, r));
    }, (start + beats * d + .35 - c.currentTime) * 1000);
  };
}

/* ---------- strum: бой по слуху ---------- */
const PATS = [
  [1, 'Четыре вниз', '↓·↓·↓·↓·'], [1, 'Шестёрка', '↓·↓↑·↑↓↑'], [1, 'Восьмёрка', '↓↑↓↑↓↑↓↑'], [2, 'Двойка', '↓·↓↑↓·↓↑'],
  [2, 'Бас-бой', 'Б·↓↑Б·↓↑'], [2, 'Вальс', 'Б·↓·↓·'], [3, 'Шестёрка с глушением', '↓·↓↑x↑↓↑'], [3, 'Галоп', '↓·↓↑↓↑↓·'], [3, 'Бас-вальс', 'Б·↓↑↓↑']
];
function gStrum(stg, st, hint, done, lv) {
  const pool = (st.pats ? PATS.filter(p => st.pats.includes(p[1])) : PATS).filter(p => p[0] <= lv);
  const R = shuf(pool).slice(0, N3(lv, [3, 4, 5])), mode = hint ? 'see' : N3(lv, ['see', 'choose', 'build']);
  let k = 0, sc = 0;
  function draw() {
    const P = R[k], a = [...P[2]], ch = pick(['Am', 'Em', 'C', 'G', 'Dm']);
    const head = `<div class="kr-sec">${E(st.h)} · ${k + 1} из ${R.length}</div>`;
    if (mode === 'choose') {
      const o = opts(P, shuf(PATS.filter(p => p[2].length === P[2].length)), 3);
      stg.innerHTML = head + `<div class="kg-goal">🎧 Послушай бой (аккорд ${ch}) и выбери его схему</div><div style="text-align:center;margin-bottom:10px"><button class="kr-btn" data-pl>🔊 Послушать</button></div>
        <div class="kg-opts">${o.opts.map((p, j) => `<button class="kr-opt gs-po" data-j="${j}">${patHtml(p[2], 'mini')}</button>`).join('')}</div><div class="kq-r"></div>`;
      const pl = () => playPat(a, ch, 66); $('[data-pl]', stg).onclick = pl; setTimeout(pl, 300);
      $$('.kr-opt', stg).forEach(b => b.onclick = e => {
        e.stopPropagation(); const good = +b.dataset.j === o.ok; $$('.kr-opt', stg).forEach(z => { z.disabled = true; if (+z.dataset.j === o.ok) z.classList.add('y'); });
        if (good) { sc++; H().snd('ok'); setTimeout(nx, 800); } else { b.classList.add('n'); H().snd('bad'); H().whyBox($('.kq-r', stg), false, `Это был бой "${P[1]}": ${P[2].split('').join(' ')}. Слушай, где удары вверх (↑ тише и короче) и где пауза (·).`, k === R.length - 1, nx); }
      });
      return;
    }
    const sym = ['↓', '↑', '·'].concat(a.includes('Б') ? ['Б'] : [], a.includes('x') ? ['x'] : []); let cur = [];
    stg.innerHTML = head + `<div class="kg-goal">${mode === 'see' ? `🎯 Бой "${E(P[1])}". Посмотри и послушай, потом нажми "Запомнил" и собери его по памяти.` : '🎧 Послушай бой и собери его схему: что звучит на каждую долю и "и".'}</div>
      <div class="gs-src">${mode === 'see' ? patHtml(a) : ''}</div><div style="text-align:center;margin:8px 0"><button class="kr-btn" data-pl>🔊 Послушать</button>${mode === 'see' ? ' <button class="kr-btn pri" data-hide>Запомнил</button>' : ''}</div>
      <div class="gs-build" ${mode === 'see' ? 'hidden' : ''}><div class="gs-pat gs-slots">${a.map((_, i) => `<span><b></b><small>${i % 2 ? 'и' : i / 2 + 1}</small></span>`).join('')}</div>
      <div class="kg-ctl" style="justify-content:center;margin-top:10px">${sym.map(s => `<button class="kr-btn gs-sym" data-s="${s}">${s === '·' ? '· пауза' : s === 'Б' ? 'Б бас' : s === 'x' ? '✕ глушение' : s === '↓' ? '↓ вниз' : '↑ вверх'}</button>`).join('')}<button class="kr-btn" data-bs>⌫</button></div></div><div class="kq-r"></div>`;
    const pl = () => playPat(a, ch, 66, $('.gs-src .gs-pat', stg)); $('[data-pl]', stg).onclick = pl; setTimeout(pl, 300);
    const hide = $('[data-hide]', stg); if (hide) hide.onclick = () => { $('.gs-src', stg).innerHTML = ''; hide.remove(); $('.gs-build', stg).hidden = false; };
    const slots = $$('.gs-slots span', stg);
    const show = () => slots.forEach((s, i) => { $('b', s).textContent = cur[i] === 'x' ? '✕' : cur[i] || ''; s.className = cur[i] ? PAT[cur[i]] : ''; });
    $('[data-bs]', stg).onclick = () => { cur.pop(); show(); };
    $$('.gs-sym', stg).forEach(b => b.onclick = () => {
      if (cur.length >= a.length) return; cur.push(b.dataset.s); show(); H().snd('tap');
      if (cur.length < a.length) return;
      const right = cur.filter((s, i) => s === a[i]).length; sc += right / a.length;
      slots.forEach((s, i) => s.classList.add(cur[i] === a[i] ? 'y' : 'n'));
      $$('.gs-sym,[data-bs]', stg).forEach(z => z.disabled = true);
      const good = right === a.length; H().snd(good ? 'win' : 'bad');
      H().whyBox($('.kq-r', stg), good, good ? `Бой "${P[1]}" собран без ошибок.` : `Верно ${right} из ${a.length}. Правильно: ${P[2].split('').join(' ')} ("${P[1]}"). Удары вниз - на цифрах, вверх - на "и".`, k === R.length - 1, nx);
    });
  }
  function nx() { k++; if (k < R.length) draw(); else { stg.innerHTML = `<div class="kr-end"><div class="big">${Math.round(sc / R.length * 100)}%</div><div class="mut">боёв собрано верно</div></div>`; done(sc / R.length); } }
  draw();
}

/* ---------- pick: перебор по струнам ---------- */
const PICKS = [[1, 'Б 3 2 1'], [2, 'Б 3 2 3'], [2, 'Б 3 2 1 2 3'], [3, 'Б 3 2 3 1 3 2 3'], [3, 'Б 2 3 1 2 3']];
function gPick(stg, st, hint, done, lv) {
  const chs = st.chords || N3(lv, [['Am', 'Em'], ['Am', 'Em', 'Dm', 'E', 'C'], ['Am', 'Em', 'Dm', 'E', 'C', 'G', 'D']]);
  const R = Array.from({ length: N3(lv, [3, 4, 5]) }, (_, i) => ({ ch: chs[i % chs.length], p: pick(PICKS.filter(x => x[0] <= lv))[1].split(' ') }));
  let k = 0, sc = 0;
  function draw() {
    const r = R[k], sh = shape(r.ch), seq = r.p.map(s => s === 'Б' ? 6 - sh.b : +s); let pos = 0, miss = 0;
    const showB = lv === 1 || hint;
    stg.innerHTML = `<div class="kr-sec">${E(st.h)} · ${k + 1} из ${R.length}</div><div class="kg-goal">🎯 Аккорд ${r.ch}, перебор ${r.p.join('-')}. Нажимай струны по порядку.</div>
      ${showB ? `<div class="kr-hint">Б - бас: у ${r.ch} это ${NUMW[5 - sh.b]} струна.</div>` : '<p class="mut" style="margin-bottom:6px">Где бас у этого аккорда - вспомни сам: самая низкая звучащая струна.</p>'}
      <div class="gs-pk gs-seq">${r.p.map(s => `<b>${s}</b>`).join('')}</div>
      <div class="gs-tap">${neckSvg({ frets: 4, lab: true, nums: false, tap: 1, mark: sh.f.map((f, i) => f > 0 ? { s: 6 - i, f, t: sh.g[i] } : null).filter(Boolean) })}</div><div class="kq-r"></div>`;
    const bs = $$('.gs-seq b', stg); bs[0].classList.add('cur');
    $$('.gn-s', stg).forEach(g => g.onclick = () => {
      if (pos >= seq.length) return;
      const s = +g.dataset.s, i = 6 - s; pluck(OPEN[i] + Math.max(0, sh.f[i]), 0, .55); vib(g);
      if (s !== seq[pos]) { miss++; H().buzz(30); g.classList.add('n'); setTimeout(() => g.classList.remove('n'), 400); return; }
      g.classList.add('y'); setTimeout(() => g.classList.remove('y'), 300); bs[pos].className = 'ok'; pos++; if (bs[pos]) bs[pos].classList.add('cur');
      if (pos < seq.length) return;
      const r1 = Math.max(0, 1 - miss / seq.length); sc += r1; H().snd(miss ? 'ok' : 'win');
      H().whyBox($('.kq-r', stg), !miss, (miss ? 'Ошибок: ' + miss + '. ' : 'Без ошибок! ') + `Бас у ${r.ch} - ${NUMW[5 - sh.b]} струна, дальше 3-я, 2-я, 1-я - пальцы i, m, a.`, k === R.length - 1, () => { k++; if (k < R.length) draw(); else { stg.innerHTML = `<div class="kr-end"><div class="big">${Math.round(sc / R.length * 100)}%</div><div class="mut">переборы без ошибок</div></div>`; done(sc / R.length); } });
    });
  }
  draw();
}

/* ---------- chord: узнай аккорд ---------- */
function gChord(stg, st, hint, done, lv) {
  const set = st.chords || N3(lv, [['Em', 'Am', 'Dm', 'E'], ['Em', 'Am', 'Dm', 'E', 'C', 'G', 'D', 'A'], ['Em', 'Am', 'Dm', 'E', 'C', 'G', 'D', 'A', 'E7', 'A7', 'Hm', 'F']]);
  const R = shuf(set.concat(shuf(set))).slice(0, N3(lv, [6, 8, 10]) - (hint ? 1 : 0)).map((n, i) => {
    const find = lv >= 2 && i % 2 === 1;
    if (!find) { const o = opts(n, set, lv === 1 ? 3 : 4); return { q: chordSvg(n, false, true) + '<p class="gq-t">Какой это аккорд?</p>', opts: o.opts, ok: o.ok, e: why(n), play: () => strum(n, 0, false, .4) }; }
    const o = opts(n, set, 3);
    return { q: `<p class="gq-t">Найди схему аккорда <b>${E(n)}</b></p>`, opts: o.opts.map(x => chordSvg(x, true, true)), raw: 1, grid: 1, ok: o.ok, e: why(n), onOk: () => strum(n, 0, false, .4) };
  });
  function why(n) { const c = shape(n); return `${n}: ` + c.f.map((f, i) => `${6 - i}-я ${f < 0 ? '×' : f === 0 ? 'открыта' : f + ' лад'}`).reverse().join(', ') + '.' + (isMinor(n) ? ' Буква m - минор.' : ''); }
  rounds(stg, st, R, done, { hint: hint ? 'смотри, на какой струне бас и сколько пальцев. Em и E отличаются одним пальцем на 3-й струне.' : '' });
}

/* ---------- ear: мажор или минор ---------- */
function gEar(stg, st, hint, done, lv) {
  const P = N3(lv, [['Am', 'A', 'Em', 'E', 'Dm', 'D'], ['Am', 'A', 'Em', 'E', 'Dm', 'D', 'C', 'G', 'Hm'], ['Am', 'A', 'Em', 'E', 'Dm', 'D', 'C', 'G', 'Hm', 'F', 'A7', 'E7']]);
  const R = shuf(P.concat(P)).slice(0, N3(lv, [6, 8, 10])).map(n => {
    const mn = isMinor(n), seven = /7$/.test(n);
    return { q: `<div class="gq-ear">🎧 Послушай аккорд</div>${lv === 1 ? chordSvg(n, true, true) : ''}`, opts: ['🌧 Минор - грустнее', '☀️ Мажор - светлее'], ok: mn ? 0 : 1,
      play: () => strum(n, 0, false, .4), e: `Это ${n} - ${mn ? 'минор (есть буква m), звучит грустнее, задумчивее' : seven ? 'мажорный септаккорд: светлый, но "просит" перейти дальше' : 'мажор, звучит светлее, бодрее'}. Сравни ещё раз: ${mn ? n.replace(/m$/, '') + ' - мажор' : n + 'm - минор'}.` };
  });
  rounds(stg, st, R, done, { hint: hint ? 'минор "хмурится", мажор "улыбается". Послушай два-три раза.' : '' });
}

/* ---------- fret: какая нота на ладу ---------- */
const CHR = ['до', 'до#', 'ре', 'ре#', 'ми', 'фа', 'фа#', 'соль', 'соль#', 'ля', 'ля#', 'си'];
function gFret(stg, st, hint, done, lv) {
  const maxF = N3(lv, [3, 5, 7]), strs = N3(lv, [[1, 2, 6], [1, 2, 3, 4, 5, 6], [1, 2, 3, 4, 5, 6]]);
  const R = [];
  while (R.length < N3(lv, [6, 8, 10])) {
    const s = pick(strs), f = Math.floor(Math.random() * (maxF + 1)), m = OPEN[6 - s] + f, n = CHR[m % 12];
    if (lv < 3 && n.includes('#')) continue;
    if (R.some(r => r.s === s && r.f === f)) continue;
    R.push({ s, f, n, m });
  }
  rounds(stg, st, R.map(r => {
    const pool = lv < 3 ? CHR.filter(x => !x.includes('#')) : CHR, o = opts(r.n, pool, 4);
    return { q: neckSvg({ frets: Math.max(4, maxF), lab: true, mark: [{ s: r.s, f: r.f, t: r.f ? '' : '0' }] }) + `<p class="gq-t">${NUMW[r.s - 1]} струна, ${r.f ? r.f + ' лад' : 'открытая'}. Какая нота?</p>`,
      opts: o.opts, ok: o.ok, play: () => pluck(r.m, 0, .55),
      e: `Открытая ${NUMW[r.s - 1]} - ${CHR[OPEN[6 - r.s] % 12]}. Каждый лад - шаг на полтона: ${Array.from({ length: r.f + 1 }, (_, i) => CHR[(OPEN[6 - r.s] + i) % 12]).join(' → ')}.${lv < 3 ? ' Запомни: между ми-фа и си-до шаг в полтона, остальные ноты через лад.' : ''}` };
  }), done, { hint: hint ? 'начни с открытой струны и шагай по ладам: ми, фа, (фа#), соль...' : '' });
}

/* ---------- staff: нота на нотном стане ---------- */
function gStaff(stg, st, hint, done, lv) {
  const rng = N3(lv, [[0, 2, 4, 6, 8], [-2, -1, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9], [-4, -3, -2, -1, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]]);
  const R = shuf(rng.concat(shuf(rng))).slice(0, N3(lv, [6, 8, 10]));
  rounds(stg, st, R.map(s => {
    const n = stepName(s), o = opts(n, LET, 4), on = s % 2 === 0;
    return { q: staffSvg([s]) + '<p class="gq-t">Какая это нота?</p>', opts: o.opts, ok: o.ok, play: () => pluck(64 + [0, 1, 3, 5, 7, 8, 10][((s % 7) + 7) % 7] + 12 * Math.floor(s / 7) - 12, 0, .5),
      e: `Это ${n} - нота ${on ? 'на линии' : 'между линиями'}. Линии снизу вверх: ми, соль, си, ре, фа. Между ними: фа, ля, до, ми.${s < 0 ? ' Ниже стана - добавочные линии: до первой октавы на первой добавочной.' : ''}` };
  }), done, { hint: hint ? 'линии снизу вверх - ми, соль, си, ре, фа ("Ми-Соль-Си-Ре-Фа").' : '' });
}

/* ---------- tab: прочитай табулатуру ---------- */
function tabSvg(s, f) {
  const y = k => 14 + (k - 1) * 14; let h = '';
  for (let k = 1; k <= 6; k++) h += `<text x="6" y="${y(k) + 4}" class="gt-l">${'eBGDAE'[k - 1]}</text><path d="M20 ${y(k)}H230" class="gf-l"/>`;
  h += `<rect x="112" y="${y(s) - 8}" width="18" height="16" rx="3" class="gt-bg"/><text x="121" y="${y(s) + 5}" class="gt-num">${f}</text>`;
  return `<svg viewBox="0 0 240 92" class="gs-tab">${h}</svg>`;
}
function gTab(stg, st, hint, done, lv) {
  const R = Array.from({ length: N3(lv, [6, 7, 8]) }, () => ({ s: 1 + Math.floor(Math.random() * 6), f: Math.floor(Math.random() * N3(lv, [4, 6, 8])) }));
  rounds(stg, st, R.map(r => {
    const right = `${NUMW[r.s - 1]} струна, ${r.f ? r.f + ' лад' : 'открытая'}`;
    const wrong = [`${NUMW[6 - r.s]} струна, ${r.f ? r.f + ' лад' : 'открытая'}`, `${NUMW[r.s - 1]} струна, ${r.f + 1} лад`, r.f ? `${NUMW[r.s - 1]} струна, открытая` : `${NUMW[r.s - 1]} струна, 1 лад`, `${NUMW[(r.s % 6)]} струна, ${r.f ? r.f + ' лад' : 'открытая'}`];
    const o = opts(right, wrong, lv === 1 ? 3 : 4);
    return { q: tabSvg(r.s, r.f) + '<p class="gq-t">Что играть?</p>', opts: o.opts, ok: o.ok, play: () => pluck(OPEN[6 - r.s] + r.f, 0, .55),
      e: `В табулатуре верхняя линия - 1-я (тонкая) струна, нижняя - 6-я. Число - номер лада, 0 - открытая. Здесь: ${right}.` };
  }), done, { hint: hint ? 'верхняя линия - тонкая 1-я струна (как будто смотришь на гитару сверху).' : '' });
}

/* ---------- count: минута смен аккордов ---------- */
function gCount(stg, st, hint, done, lv) {
  const goal = (st.goal && st.goal[lv]) || N3(lv, [10, 15, 20]) - (hint ? 3 : 0), sec = st.sec || 60, chs = st.chords || ['Em', 'Am'];
  stg.innerHTML = `<div class="kr-sec">${E(st.h)}</div><div class="kg-goal">🎯 ${E(st.what || 'Меняй аккорды на гитаре и нажимай кнопку после каждой смены')}. Цель: ${goal} за ${sec} секунд.</div>
    <div class="gs-chs">${chs.map(c => chordSvg(c, true)).join('<span class="gs-sw">⇄</span>')}</div>
    <p class="mut" style="margin:8px 0">Честный счёт: смена засчитывается, когда все пальцы стоят и аккорд звучит чисто. Гитары под рукой нет - пройди позже.</p>
    <div class="gb"><div class="gb-big">0</div><div class="gb-tm">${sec} с</div><button class="gb-pad" disabled>Сменил!</button></div>
    <div class="kr-end"><div class="acts"><button class="kr-btn pri" data-go>▶ Старт (3, 2, 1...)</button></div></div>`;
  const pad = $('.gb-pad', stg), big = $('.gb-big', stg), tm = $('.gb-tm', stg); let n = 0;
  $('[data-go]', stg).onclick = function () {
    this.closest('.kr-end').remove(); let c = 3; tm.textContent = c;
    const iv = setInterval(() => { if (!stg.isConnected) return clearInterval(iv); c--; if (c > 0) { tm.textContent = c; click(0, false); return; } clearInterval(iv); click(0, true); go(); }, 800);
  };
  function go() {
    pad.disabled = false; const t0 = Date.now(); let ch = 0;
    pad.onpointerdown = e => { e.preventDefault(); n++; big.textContent = n; H().snd('tap'); ch = 1 - ch; $$('.gs-chs svg', stg).forEach((s, i) => s.classList.toggle('on', i === ch)); };
    const iv = setInterval(() => {
      if (!stg.isConnected) return clearInterval(iv);
      const left = sec - Math.floor((Date.now() - t0) / 1000); tm.textContent = Math.max(0, left) + ' с';
      if (left > 0) return; clearInterval(iv); pad.disabled = true; pad.onpointerdown = null; H().snd(n >= goal ? 'win' : 'ok');
      tm.textContent = n >= goal ? '🎉 Цель взята!' : `Цель ${goal}. Ещё немного - пальцы привыкнут.`; done(Math.min(1, n / goal));
    }, 250);
  }
}

/* ---------- prompt: собери промпт для музыкальной нейросети ---------- */
const PC = [
  ['Стиль', [['acoustic folk', 'акустический фолк'], ['rock', 'рок'], ['lo-fi hip hop', 'лоу-фай хип-хоп'], ['electronic dance', 'электронная танцевальная'], ['pop', 'поп'], ['indie', 'инди']]],
  ['Настроение', [['calm', 'спокойное'], ['energetic', 'энергичное'], ['sad', 'грустное'], ['happy', 'радостное'], ['dreamy', 'мечтательное']]],
  ['Инструменты', [['acoustic guitar fingerpicking', 'гитара перебором'], ['strummed acoustic guitar', 'гитара боем'], ['electric guitar and drums', 'электрогитара и барабаны'], ['synths and drum machine', 'синтезаторы и драм-машина'], ['piano', 'пианино']]],
  ['Темп', [['slow tempo', 'медленный'], ['medium tempo', 'средний'], ['fast tempo', 'быстрый']]],
  ['Голос', [['instrumental, no vocals', 'без голоса'], ['female vocals', 'женский голос'], ['male vocals', 'мужской голос'], ['choir', 'хор']]],
  ['Чего не надо', [['no drums', 'без барабанов'], ['no autotune', 'без автотюна'], ['no long intro', 'без длинного вступления']]]
];
const PG = [
  [1, 'Спокойная фолк-песня у вечернего костра: гитара перебором, медленно', { 'Стиль': 'acoustic folk', 'Настроение': 'calm', 'Инструменты': 'acoustic guitar fingerpicking', 'Темп': 'slow tempo' }],
  [1, 'Энергичный рок для зарядки: электрогитара с барабанами, быстро', { 'Стиль': 'rock', 'Настроение': 'energetic', 'Инструменты': 'electric guitar and drums', 'Темп': 'fast tempo' }],
  [1, 'Грустная фолк-песня под гитару боем, медленно', { 'Стиль': 'acoustic folk', 'Настроение': 'sad', 'Инструменты': 'strummed acoustic guitar', 'Темп': 'slow tempo' }],
  [1, 'Радостная электронная музыка для дискотеки: синтезаторы и драм-машина, быстро', { 'Стиль': 'electronic dance', 'Настроение': 'happy', 'Инструменты': 'synths and drum machine', 'Темп': 'fast tempo' }],
  [2, 'Фон для учёбы без слов: лоу-фай, спокойно, пианино, средний темп', { 'Стиль': 'lo-fi hip hop', 'Настроение': 'calm', 'Инструменты': 'piano', 'Темп': 'medium tempo', 'Голос': 'instrumental, no vocals' }],
  [2, 'Мечтательная инди-песня с женским голосом под гитару перебором, медленно', { 'Стиль': 'indie', 'Настроение': 'dreamy', 'Инструменты': 'acoustic guitar fingerpicking', 'Темп': 'slow tempo', 'Голос': 'female vocals' }],
  [2, 'Весёлая поп-песня с мужским голосом и гитарой боем, средний темп', { 'Стиль': 'pop', 'Настроение': 'happy', 'Инструменты': 'strummed acoustic guitar', 'Темп': 'medium tempo', 'Голос': 'male vocals' }],
  [3, 'Спокойная колыбельная в стиле фолк: гитара перебором, медленно, без голоса и без барабанов', { 'Стиль': 'acoustic folk', 'Настроение': 'calm', 'Инструменты': 'acoustic guitar fingerpicking', 'Темп': 'slow tempo', 'Голос': 'instrumental, no vocals', 'Чего не надо': 'no drums' }],
  [3, 'Энергичный быстрый рок: электрогитара и барабаны, хор, сразу с главного, без длинного вступления', { 'Стиль': 'rock', 'Настроение': 'energetic', 'Инструменты': 'electric guitar and drums', 'Темп': 'fast tempo', 'Голос': 'choir', 'Чего не надо': 'no long intro' }],
  [3, 'Грустная поп-баллада: пианино, медленно, женский голос без автотюна', { 'Стиль': 'pop', 'Настроение': 'sad', 'Инструменты': 'piano', 'Темп': 'slow tempo', 'Голос': 'female vocals', 'Чего не надо': 'no autotune' }]
];
function gPrompt(stg, st, hint, done, lv) {
  const R = shuf(PG.filter(g => g[0] === lv)).concat(shuf(PG.filter(g => g[0] < lv))).slice(0, N3(lv, [2, 3, 3]));
  let k = 0, sc = 0;
  function draw() {
    const G = R[k], cats = PC.filter(c => c[0] in G[2]), sel = {};
    stg.innerHTML = `<div class="kr-sec">${E(st.h)} · ${k + 1} из ${R.length}</div><div class="kg-goal">🎯 Задумка: ${E(G[1])}</div>
      ${hint ? '<div class="kr-hint">Подсказка: под каждой английской фразой есть перевод. Выбирай по одной в каждой строке.</div>' : ''}
      ${cats.map(c => `<div class="gp-c"><b>${E(c[0])}</b><div>${shuf(c[1]).map(o => `<button class="gp-o" data-c="${E(c[0])}" data-v="${E(o[0])}">${E(o[0])}<small>${E(o[1])}</small></button>`).join('')}</div></div>`).join('')}
      <div class="gp-out"><small>Твой промпт:</small><span>...</span></div><div class="kr-end"><div class="acts"><button class="kr-btn pri" data-ok disabled>Готово</button></div></div><div class="kq-r"></div>`;
    const outEl = $('.gp-out span', stg), okB = $('[data-ok]', stg);
    $$('.gp-o', stg).forEach(b => b.onclick = () => {
      sel[b.dataset.c] = b.dataset.v; $$(`.gp-o[data-c="${b.dataset.c}"]`, stg).forEach(z => z.classList.toggle('sel', z === b)); H().snd('tap');
      outEl.textContent = cats.map(c => sel[c[0]]).filter(Boolean).join(', ') || '...'; okB.disabled = Object.keys(sel).length < cats.length;
    });
    okB.onclick = () => {
      okB.closest('.kr-end').remove(); $$('.gp-o', stg).forEach(z => z.disabled = true);
      const bad = cats.filter(c => sel[c[0]] !== G[2][c[0]]); sc += 1 - bad.length / cats.length;
      cats.forEach(c => { const b = $(`.gp-o[data-c="${c[0]}"][data-v="${G[2][c[0]]}"]`, stg); if (b) b.classList.add('y'); if (sel[c[0]] !== G[2][c[0]]) { const w = $(`.gp-o[data-c="${c[0]}"][data-v="${sel[c[0]]}"]`, stg); if (w) w.classList.add('n'); } });
      H().snd(bad.length ? 'bad' : 'win');
      H().whyBox($('.kq-r', stg), !bad.length, bad.length ? 'Не совпало с задумкой: ' + bad.map(c => `${c[0].toLowerCase()} - нужно "${G[2][c[0]]}" (${c[1].find(o => o[0] === G[2][c[0]])[1]})`).join('; ') + '. Точный промпт = результат ближе к задумке.' : 'Промпт точно описывает задумку: ' + cats.map(c => G[2][c[0]]).join(', ') + '.', k === R.length - 1, () => {
        k++; if (k < R.length) draw(); else { stg.innerHTML = `<div class="kr-end"><div class="big">${Math.round(sc / R.length * 100)}%</div><div class="mut">совпадение с задумкой</div></div>`; done(sc / R.length); }
      });
    };
  }
  draw();
}

K.games = { strings: gStrings, tune: gTune, beat: gBeat, strum: gStrum, pick: gPick, chord: gChord, ear: gEar, fret: gFret, staff: gStaff, tab: gTab, count: gCount, prompt: gPrompt };

/* ---------- стили тренажёров ---------- */
const css = document.createElement('style');
css.textContent = `
.gs-chs{display:flex;gap:10px;justify-content:center;align-items:center;flex-wrap:wrap;margin:4px 0}
.gs-ch{width:118px;height:auto;cursor:pointer;color:inherit}.gs-ch.sm{width:96px}.gs-ch.on{filter:drop-shadow(0 0 10px rgba(var(--krgb,0,212,255),.8))}
.gs-ch .gs-nm{font:800 14px system-ui;fill:currentColor;text-anchor:middle}.gs-bd{fill:rgba(127,127,160,.08);stroke:none}
.gs-fr{stroke:rgba(200,200,230,.45);stroke-width:1.2}.gs-st{stroke:rgba(230,230,250,.8)}.gs-nut{stroke:currentColor;stroke-width:5}
.gs-dot{fill:var(--ka,#00d4ff)}.gs-fn{font:800 11px system-ui;fill:#04121b;text-anchor:middle}.gs-o{fill:none;stroke:currentColor;stroke-width:1.6}
.gs-x{font:700 13px system-ui;fill:#f87171;text-anchor:middle}.gs-n{font:700 11px system-ui;fill:currentColor;text-anchor:middle}
.kg-opts.gq-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}.gq-grid .kr-opt{padding:6px;min-height:0}.gq-grid .gs-ch{width:100%}
.gq{margin:6px 0 10px}.gq svg{display:block;margin:0 auto;max-width:100%}.gq-t{text-align:center;font-weight:700;font-size:16px;margin:8px 0 2px!important}
.gq-ear{text-align:center;font-size:20px;font-weight:800;padding:14px}
.gs-pat{display:flex;gap:4px;justify-content:center;align-items:stretch;margin:8px auto;cursor:pointer;position:relative;flex-wrap:wrap}
.gs-pat span{display:grid;place-items:center;min-width:32px;padding:6px 2px 3px;border-radius:9px;background:rgba(127,127,160,.13);border:1px solid rgba(127,127,160,.25);transition:transform .12s,background .12s}
.gs-pat span b{font-size:20px;line-height:1.1;min-height:22px}.gs-pat span small{font-size:10px;opacity:.6}
.gs-pat span.down b,.gs-pat span.bass b{color:var(--ka,#00d4ff)}.gs-pat span.up b{color:var(--kb,#a78bfa)}.gs-pat span.rest b{opacity:.45}.gs-pat span.mute b{color:#f87171}
.gs-pat span.on{background:rgba(var(--krgb,0,212,255),.35);transform:translateY(-3px)}.gs-pat em{align-self:center;font-style:normal;font-size:13px;opacity:.6;margin-left:4px}
.gs-pat.mini span{min-width:24px;padding:3px 1px}.gs-pat.mini span b{font-size:15px}.gs-pat.mini em{display:none}.gs-po{padding:4px!important}
.gs-slots{cursor:default}.gs-slots span.y{border-color:#3fb950;background:rgba(63,185,80,.18)}.gs-slots span.n{border-color:#f85149;background:rgba(248,81,73,.18)}
.gs-neck{width:100%;max-width:440px;display:block;margin:6px auto}.gn-wood{fill:rgba(160,110,60,.22)}.gn-fr{stroke:rgba(220,220,240,.55);stroke-width:2}.gn-nut{stroke:rgba(240,240,255,.9);stroke-width:5}
.gn-inl{fill:rgba(240,240,255,.25)}.gn-str{stroke:rgba(230,225,210,.9);transition:stroke .15s}.gn-l{font:700 11px system-ui;fill:currentColor;opacity:.75}.gn-fn{font:600 10px system-ui;fill:currentColor;opacity:.55;text-anchor:middle}
.gs-tap .gn-s{cursor:pointer}.gn-s.y .gn-str{stroke:#3fb950;stroke-width:5!important}.gn-s.n .gn-str{stroke:#f85149;stroke-width:5!important}
.gn-m circle{fill:var(--ka,#00d4ff)}.gn-m text{font:800 10px system-ui;fill:#04121b;text-anchor:middle}.gn-m.bs circle{fill:#facc15}
.gs-pk{display:flex;gap:6px;justify-content:center;margin:8px 0;cursor:pointer}.gs-pk b{min-width:30px;padding:6px;border-radius:9px;text-align:center;background:rgba(127,127,160,.15);transition:.15s}
.gs-pk b.on,.gs-pk b.cur{background:rgba(var(--krgb,0,212,255),.35);transform:translateY(-2px)}.gs-pk b.ok{background:rgba(63,185,80,.3)}.gs-pk em{font-style:normal;opacity:.6;align-self:center}.gs-seq{cursor:default}
.gs-staff,.gs-tab,.gs-tune{width:100%;max-width:340px;display:block;margin:6px auto}.gf-l{stroke:rgba(230,230,250,.7);stroke-width:1.3}.gf-cl{font:52px serif;fill:currentColor}
.gf-n{fill:currentColor}.gf-stem{stroke:currentColor;stroke-width:1.6}.gf-t{font:700 11px system-ui;fill:currentColor;text-anchor:middle;opacity:.8}
.gt-l{font:700 10px monospace;fill:currentColor;opacity:.7}.gt-bg{fill:var(--bg,#0c0d1e);stroke:none}.gt-num{font:800 13px monospace;fill:var(--ka,#00d4ff);text-anchor:middle}
.gt-arc{fill:none;stroke:rgba(127,127,160,.4);stroke-width:10;stroke-linecap:round}.gt-ok{fill:none;stroke:#3fb950;stroke-width:10}.gt-s{font:600 11px system-ui;fill:currentColor;opacity:.7;text-anchor:middle}
.gt-nd{transform-origin:120px 104px;transition:transform .8s cubic-bezier(.3,1.4,.5,1)}.gt-nd path{stroke:#facc15;stroke-width:3;stroke-linecap:round}.gt-nd circle{fill:#facc15}
.gb{display:grid;justify-items:center;gap:10px;margin:12px 0}.gb-dots{display:flex;gap:6px}.gb-dots i{width:14px;height:14px;border-radius:50%;background:rgba(127,127,160,.3)}.gb-dots i.y{background:#3fb950}.gb-dots i.n{background:#f85149}
.gb-pad{width:150px;height:150px;border-radius:50%;border:2px solid rgba(var(--krgb,0,212,255),.6);background:radial-gradient(circle,rgba(var(--krgb,0,212,255),.35),rgba(var(--krgb,0,212,255),.08));color:inherit;font:800 22px system-ui;touch-action:manipulation;user-select:none;-webkit-user-select:none}
.gb-pad:disabled{opacity:.45}.gb-pad.pl{animation:gbP .25s ease-out}.gb-pad.hit{transform:scale(.94)}@keyframes gbP{from{box-shadow:0 0 0 0 rgba(var(--krgb,0,212,255),.7)}to{box-shadow:0 0 0 22px rgba(var(--krgb,0,212,255),0)}}
.gb-big{font:900 54px system-ui;line-height:1}.gb-tm{font-weight:700;opacity:.8}.gs-sw{font-size:22px;opacity:.6}
.gp-c{margin:10px 0}.gp-c>b{display:block;font-size:13px;opacity:.8;margin-bottom:6px}.gp-c>div{display:flex;flex-wrap:wrap;gap:6px}
.gp-o{display:grid;padding:8px 10px;border-radius:12px;border:1px solid rgba(127,127,160,.35);background:rgba(127,127,160,.1);color:inherit;font:600 14px system-ui;text-align:left;cursor:pointer}
.gp-o small{font-weight:500;opacity:.65;font-size:11.5px}.gp-o.sel{border-color:var(--ka,#00d4ff);background:rgba(var(--krgb,0,212,255),.18)}.gp-o.y{border-color:#3fb950;background:rgba(63,185,80,.2)}.gp-o.n{border-color:#f85149;background:rgba(248,81,73,.2)}
.gn-str.vib{transform-box:fill-box;transform-origin:center;animation:gnVib .55s linear}
body.kfx-game .gn-str.vib{animation-duration:.8s;filter:drop-shadow(0 0 4px var(--ka,#00d4ff))}
@keyframes gnVib{0%,100%{transform:none}10%{transform:translateY(-2px)}20%{transform:translateY(1.8px)}30%{transform:translateY(-1.4px)}40%{transform:translateY(1.1px)}55%{transform:translateY(-.7px)}70%{transform:translateY(.4px)}}
.gs-ch.pl .gs-dot{transform-box:fill-box;transform-origin:center;animation:gsFl .6s cubic-bezier(.2,1.6,.4,1)}
@keyframes gsFl{40%{transform:scale(1.35);filter:brightness(1.5)}}
.gs-tap .gn-s:focus{outline:none}.gs-tap .gn-s:focus-visible .gn-str{stroke:#facc15;stroke-width:4!important}
.gp-out{margin:12px 0;padding:10px 12px;border-radius:12px;background:rgba(0,0,0,.25);font:600 14px ui-monospace,monospace}.gp-out small{display:block;font:600 11px system-ui;opacity:.6}
`;
document.head.appendChild(css);
window.GITARA = { strum, pluck, bass, chordSvg, patHtml, neckSvg, staffSvg };
})();
