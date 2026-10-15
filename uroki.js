/* Гитара · ИИ-студия: уроки, шпаргалка, редактор уроков (вход по PIN) и плавающие тюнер/метроном.
   Подключается после основного скрипта студии и берёт оттуда CH, OPEN, pluck, ac, AC, setBpm, mStart, mStop, tOnF, tOff.
   Уроки хранятся на общем сервере (лист "Уроки", файл lessons.gs); пока сервер пуст - показывается стандартный курс. */
(function () {
'use strict';
const API = 'https://script.google.com/macros/s/AKfycbwmh9Ksw7lm9pYZCy3ao-mvZ5ogKbFM7E66zJIAa5ZvorA6q7FLH8ZlFZvFK9RKHRM-/exec';
const CLUB = 'studio';
const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const store = {
  get(k, d) { try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } },
  set(k, v) { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
};
const say = t => (typeof toast === 'function' ? toast(t) : null);
const uid = () => 'l' + Date.now().toString(36) + Math.floor(Math.random() * 1296).toString(36);
const clone = o => JSON.parse(JSON.stringify(o));

/* ================= теория: ноты и аккорды ================= */
const NN = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'B', 'H'];       // B - си-бемоль, H - си
const RU = ['до', 'до-диез', 'ре', 'ре-диез', 'ми', 'фа', 'фа-диез', 'соль', 'соль-диез', 'ля', 'си-бемоль', 'си'];
const LET = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, H: 11, B: 10 };
const OM = [40, 45, 50, 55, 59, 64];                                                 // открытые струны 6..1 (MIDI)
const hz = m => 440 * Math.pow(2, (m - 69) / 12);
function parseRoot(s) {
  const m = /^([A-H])(#|b)?/.exec(s || ''); if (!m) return null;
  let pc = LET[m[1]];
  if (m[2] === '#') pc++; else if (m[2] === 'b' && m[1] !== 'B') pc--;
  return { pc: (pc + 12) % 12, len: m[0].length };
}
const Q = [
  { k: '', n: 'мажор', iv: [0, 4, 7], d: 'весёлый, светлый' },
  { k: 'm', n: 'минор', iv: [0, 3, 7], d: 'грустный, мягкий' },
  { k: '7', n: 'септаккорд', iv: [0, 4, 7, 10], d: 'напряжённый, тянет перейти дальше' },
  { k: 'm7', n: 'минорный септаккорд', iv: [0, 3, 7, 10], d: 'мягкий, немного джазовый' },
  { k: 'maj7', n: 'большой мажорный септаккорд', iv: [0, 4, 7, 11], d: 'мечтательный' },
  { k: 'sus2', n: 'sus2 (вместо терции - секунда)', iv: [0, 2, 7], d: 'воздушный, ни весёлый, ни грустный' },
  { k: 'sus4', n: 'sus4 (вместо терции - кварта)', iv: [0, 5, 7], d: 'подвешенный, ждёт возвращения в мажор' },
  { k: '6', n: 'мажор с секстой', iv: [0, 4, 7, 9], d: 'тёплый, ретро' },
  { k: 'dim', n: 'уменьшённый', iv: [0, 3, 6], d: 'тревожный' },
  { k: 'aug', n: 'увеличенный', iv: [0, 4, 8], d: 'загадочный' },
  { k: '5', n: 'пауэр-аккорд (только тоника и квинта)', iv: [0, 7], d: 'для рока и перегруза' }
];
function parseChord(name) {
  const r = parseRoot(name); if (!r) return null;
  const q = Q.find(x => x.k === name.slice(r.len)); if (!q) return null;
  return { root: r.pc, q };
}
const IVN = { 1: 'малая секунда', 2: 'большая секунда', 3: 'малая терция', 4: 'большая терция', 5: 'кварта', 6: 'тритон', 7: 'квинта' };
const IVL = { 0: '1', 1: 'b2', 2: '2', 3: '3', 4: '3', 5: '4', 6: '5', 7: '5', 8: '5', 9: '6', 10: '7', 11: '7' };

/* аккорды, которых нет в основной таблице студии (f - лады от 6-й струны, p - пальцы, b - лад барэ) */
const EXTRA = {
  'G7': { f: '320001', p: '320001' }, 'C7': { f: 'x32310', p: 'x32410' }, 'H7': { f: 'x21202', p: 'x21304' },
  'Am7': { f: 'x02010', p: 'x02010' }, 'Em7': { f: '022030', p: '012030' }, 'Dm7': { f: 'xx0211', p: 'xx0211' },
  'Cmaj7': { f: 'x32000', p: 'x32000' }, 'Fmaj7': { f: 'xx3210', p: 'xx3210' },
  'Asus2': { f: 'x02200', p: 'x01200' }, 'Asus4': { f: 'x02230', p: 'x01230' }, 'Dsus2': { f: 'xx0230', p: 'xx0130' }, 'Dsus4': { f: 'xx0233', p: 'xx0134' },
  'F#m': { f: '244222', p: '134111', b: 2 }, 'Gm': { f: '355333', p: '134111', b: 3 }, 'Fm': { f: '133111', p: '134111', b: 1 },
  'Cm': { f: 'x35543', p: 'x13421', b: 3 }, 'C#m': { f: 'x46654', p: 'x13421', b: 4 }, 'H': { f: 'x24442', p: 'x12341', b: 2 }, 'B': { f: 'x13331', p: 'x12341', b: 1 }
};
const LIB = Object.assign({}, EXTRA, typeof CH === 'object' ? CH : {});

/* поиск удобной аппликатуры для любого аккорда: перебираем позиции грифа, берём самую простую */
function findShape(root, iv) {
  const need = new Set(iv.map(x => (root + x) % 12)), fifth = (root + 7) % 12;
  let best = null, bestS = 1e9;
  const try1 = (f, s, minN) => {
    const snd = f.map((v, i) => v === 'x' ? null : OM[i] + v), lo = snd.findIndex(v => v != null);
    if (lo < 0 || snd[lo] % 12 !== root) return;
    const live = snd.filter(v => v != null); if (live.length < minN) return;
    const got = new Set(live.map(v => v % 12));
    for (const p of need) if (!got.has(p) && !(p === fifth && iv.length >= 4)) return;
    const fr = f.filter(v => v !== 'x' && v > 0); if (!fr.length && s > 0) return;
    const mn = fr.length ? Math.min(...fr) : 0, mx = fr.length ? Math.max(...fr) : 0;
    let fingers = fr.length, bar = false;
    const atMin = f.map((v, i) => v === mn ? i : -1).filter(i => i >= 0);
    if (atMin.length >= 2 && mn > 0) {
      const first = atMin[0]; const open = f.some((v, i) => i > first && v === 0);
      if (!open) { const alt = fr.length - atMin.length + 1; if (fingers > 4 || alt < fingers) { fingers = alt; bar = fr.length > 4 || atMin.length > 2; } }
    }
    if (fingers > 4) return;
    const mutes = f.filter(v => v === 'x').length, opens = f.filter(v => v === 0).length;
    const sc = s * 1.3 + fingers + (bar ? 1.5 : 0) + mutes * 1.1 + (mx - mn) * .5 - opens * .35 + (got.has(fifth) ? 0 : .8);
    if (sc < bestS) { bestS = sc; best = f.slice(); }
  };
  for (const minN of [4, 3, 2]) {
    for (let s = 0; s <= 9; s++) {
      const opts = OM.map(m => { const o = ['x']; if (need.has(m % 12)) o.push(0); for (let f = Math.max(1, s); f <= s + 3; f++) if (need.has((m + f) % 12)) o.push(f); return o; });
      const cur = [];
      (function rec(i) {
        if (i === 6) { try1(cur, s, minN); return; }
        for (const o of opts[i]) { if (o === 'x' && (i > 2 || (i > 0 && cur[i - 1] !== 'x'))) continue; cur[i] = o; rec(i + 1); }
      })(0);
    }
    if (best) break;
  }
  return best;
}
const SHC = {};
function shape(name) {
  if (SHC[name]) return SHC[name];
  let r = null;
  if (LIB[name]) { const c = LIB[name]; r = { f: c.f.split('').map(v => v === 'x' ? 'x' : +v), p: c.p.split(''), b: c.b }; }
  else {
    const pc = parseChord(name); if (!pc) return null;
    const f = findShape(pc.root, pc.q.iv); if (!f) return null;
    r = { f, lab: f.map((v, i) => v === 'x' ? '' : IVL[((OM[i] + v) % 12 - pc.root + 12) % 12]), auto: true };
  }
  return (SHC[name] = r);
}
const okChord = n => !!shape(n);
const bassIdx = sh => sh.f.findIndex(v => v !== 'x');

/* схема аккорда: от 6-й струны слева к 1-й справа */
function diag(sh, title) {
  if (!sh) return '<div class="chd-x">?</div>';
  const f = sh.f, nums = f.filter(v => v !== 'x' && v > 0), mx = nums.length ? Math.max(...nums) : 0, mn = nums.length ? Math.min(...nums) : 0;
  let base = 1; if (sh.b && mn > 1) base = sh.b; else if (mx > 4) base = mn;
  const rows = Math.max(4, mx - base + 1), W = 110, x0 = 18, dx = (W - 36) / 5, y0 = 26, dy = 22, H = y0 + dy * rows + 8;
  let s = `<svg viewBox="0 0 ${W} ${H}" class="chd" role="img" aria-label="${esc(title || '')}">`;
  s += base === 1 ? `<rect x="${x0 - 1}" y="${y0 - 4}" width="${dx * 5 + 2}" height="4" rx="1.5" fill="#f4eefe"/>` : `<text x="1" y="${y0 + dy * .7}" fill="#a99bc4" font-size="11" font-weight="700">${base}</text>`;
  for (let i = 0; i <= rows; i++) s += `<line x1="${x0}" x2="${x0 + dx * 5}" y1="${y0 + dy * i}" y2="${y0 + dy * i}" stroke="#4a3a6a" stroke-width="1.2"/>`;
  for (let i = 0; i < 6; i++) s += `<line x1="${x0 + dx * i}" x2="${x0 + dx * i}" y1="${y0}" y2="${y0 + dy * rows}" stroke="#8a7aa8" stroke-width="${1.6 - i * .15}"/>`;
  let bar = null;
  if (sh.p) {
    const ones = f.map((v, i) => ({ v, i, p: sh.p[i] })).filter(o => o.p === '1' && o.v !== 'x' && o.v > 0);
    if (ones.length > 1 && ones.every(o => o.v === ones[0].v)) {
      bar = { fr: ones[0].v, a: ones[0].i, b: ones[ones.length - 1].i }; const y = y0 + dy * (bar.fr - base + .5);
      s += `<rect x="${x0 + dx * bar.a - 8}" y="${y - 8}" width="${dx * (bar.b - bar.a) + 16}" height="16" rx="8" fill="#ff2d8a"/><text x="${x0 + dx * bar.a}" y="${y + 4}" fill="#fff" font-size="10.5" font-weight="800" text-anchor="middle">1</text>`;
    }
  }
  f.forEach((v, i) => {
    const x = x0 + dx * i;
    if (v === 'x') s += `<text x="${x}" y="${y0 - 8}" fill="#ef4444" font-size="13" font-weight="800" text-anchor="middle">×</text>`;
    else if (v === 0) s += `<circle cx="${x}" cy="${y0 - 12}" r="4.5" fill="none" stroke="${sh.lab && sh.lab[i] === '1' ? '#facc15' : '#22d3ee'}" stroke-width="1.8"/>`;
    else {
      if (bar && sh.p[i] === '1' && v === bar.fr) return;
      const y = y0 + dy * (v - base + .5), t = sh.p ? sh.p[i] : (sh.lab || [])[i], root = sh.lab && t === '1';
      s += `<circle cx="${x}" cy="${y}" r="8" fill="${root ? '#facc15' : '#ff2d8a'}"/><text x="${x}" y="${y + 4}" fill="${root ? '#1a1030' : '#fff'}" font-size="10.5" font-weight="800" text-anchor="middle">${esc(t || '')}</text>`;
    }
  });
  return s + '</svg>';
}

/* ================= звук ================= */
const A = () => ac();
function strumSh(sh, up, when, vol) {
  if (!sh) return; let idx = [0, 1, 2, 3, 4, 5]; if (up) idx.reverse(); let k = 0;
  idx.forEach(i => { const v = sh.f[i]; if (v === 'x') return; if (up && k > 3) return; pluck(OPEN[i] * Math.pow(2, v / 12), when + k * .022, vol); k++; });
}
function chop(when) {
  const a = A(), len = Math.floor(a.sampleRate * .05), b = a.createBuffer(1, len, a.sampleRate), d = b.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
  const s = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain();
  f.type = 'bandpass'; f.frequency.value = 1700; f.Q.value = .7; g.gain.value = .55; s.buffer = b; s.connect(f).connect(g).connect(a.destination); s.start(a.currentTime + Math.max(0, when));
}
function tick(T, first) {
  const a = A(), o = a.createOscillator(), g = a.createGain(); o.frequency.value = first ? 1500 : 1000;
  g.gain.setValueAtTime(.0001, T); g.gain.exponentialRampToValueAtTime(first ? .3 : .18, T + .002); g.gain.exponentialRampToValueAtTime(.0001, T + .05);
  o.connect(g).connect(a.destination); o.start(T); o.stop(T + .06);
}
function hitStrum(sh, sym, w) {
  if (sym === '↓') strumSh(sh, false, w, .26);
  else if (sym === '↑') strumSh(sh, true, w, .17);
  else if (sym === '✕') chop(w);
  else if (sym === 'Б') { const i = bassIdx(sh); if (i >= 0) pluck(OPEN[i] * Math.pow(2, sh.f[i] / 12), w, .4); }
}
function pickStrings(tok, sh) {
  const out = [];
  String(tok).split('+').forEach(p => {
    p = p.trim(); const b = bassIdx(sh);
    if (p === 'Б') out.push(b); else if (p === 'Б2') out.push(Math.min(5, b + 1));
    else if (/^[1-6]$/.test(p)) out.push(6 - +p);
  });
  return out.filter(i => i >= 0 && sh.f[i] !== 'x');
}

/* единый плеер: точное время через Web Audio, одна дорожка играет одновременно */
let P = null;
function pStop() { if (!P) return; clearInterval(P.iv); P.tm.forEach(clearTimeout); const o = P; P = null; if (o.end) o.end(); }
function pStart(o) {
  pStop(); const a = A(); if (typeof mRun !== 'undefined' && mRun) mStop();
  if (!o.ev.length) return;
  const st = { tm: [], iv: 0, end: o.end }; P = st;
  let list = o.pre ? o.preEv : o.ev, len = o.pre ? o.pre : o.len, spb = 60 / o.bpm(), cs = a.currentTime + .12, k = 0;
  st.iv = setInterval(() => {
    if (P !== st) return; const now = a.currentTime;
    for (let guard = 0; guard < 400; guard++) {
      if (k >= list.length) {
        cs += len * spb; k = 0;
        if (list === o.preEv) { list = o.ev; len = o.len; }
        else if (!o.loop) { clearInterval(st.iv); st.tm.push(setTimeout(() => { if (P === st) pStop(); }, Math.max(0, (cs - now) * 1000))); return; }
        spb = 60 / o.bpm(); continue;
      }
      const e = list[k], T = cs + e.b * spb; if (T > now + .15) break;
      if (T >= now - .05) {
        if (e.fn) e.fn(T);
        if (e.vis) st.tm.push(setTimeout(() => { if (P === st) e.vis(); }, Math.max(0, (T - now) * 1000)));
      }
      k++;
    }
    if (st.tm.length > 300) st.tm = st.tm.slice(-150);
  }, 25);
}
window.lesStop = pStop;

/* ================= ноты на нотном стане ================= */
const LIDX = { C: 0, D: 1, E: 2, F: 3, G: 4, A: 5, H: 6, B: 6 };
const RUS7 = ['до', 'ре', 'ми', 'фа', 'соль', 'ля', 'си'];
function parseMel(str) {
  const out = []; let bar = false;
  String(str || '').split(/\s+/).filter(Boolean).forEach(t => {
    if (t === '|') { bar = true; return; }
    const m = /^([A-H])(#|b)?([2-6])(?::(1|2|4|8))?$/.exec(t); if (!m) return;
    const r = parseRoot(m[1] + (m[2] || '')), oct = +m[3];
    let midi = (oct + 1) * 12 + r.pc; if (m[1] === 'C' && m[2] === 'b') midi += 12;
    const acc = m[2] === '#' ? '♯' : (m[2] === 'b' || m[1] === 'B') ? '♭' : '';
    out.push({ step: oct * 7 + LIDX[m[1]], midi, acc, d: +(m[4] || 4), ru: RUS7[LIDX[m[1]]] + (acc === '♯' ? '♯' : acc ? '♭' : ''), bar }); bar = false;
  });
  return out;
}
function guitarPos(m) {             // звучит на октаву ниже записи
  const s = m - 12; let best = null;
  for (let i = 5; i >= 0; i--) { const f = s - OM[i]; if (f >= 0 && f <= 12) { const sc = (f > 4 ? f * 2 : f) + (5 - i) * .3; if (!best || sc < best.sc) best = { str: 6 - i, f, sc }; } }
  return best;
}
function staff(notes) {
  const g = 10, yB = 70, L = 52, step = 38;
  let x = L, items = '', w = L + notes.length * step + notes.filter(n => n.bar).length * 10 + 24;
  const Y = st => yB - (st - 30) * g / 2;
  notes.forEach((n, i) => {
    if (n.bar) { items += `<line x1="${x - 8}" x2="${x - 8}" y1="${Y(38)}" y2="${Y(30)}" stroke="#a99bc4" stroke-width="1.2"/>`; x += 10; }
    const y = Y(n.step), hollow = n.d <= 2, up = n.step < 34, pos = guitarPos(n.midi);
    let led = ''; for (let s = 28; s >= n.step; s -= 2) led += `<line x1="${x - 11}" x2="${x + 11}" y1="${Y(s)}" y2="${Y(s)}" stroke="#cbbfe6" stroke-width="1.2"/>`;
    for (let s = 40; s <= n.step; s += 2) led += `<line x1="${x - 11}" x2="${x + 11}" y1="${Y(s)}" y2="${Y(s)}" stroke="#cbbfe6" stroke-width="1.2"/>`;
    items += `<g class="nt" data-i="${i}">${led}<rect x="${x - 16}" y="0" width="32" height="126" fill="transparent"/>`;
    if (n.acc) items += `<text x="${x - 15}" y="${y + 4}" fill="#f4eefe" font-size="14" text-anchor="middle">${n.acc}</text>`;
    items += `<ellipse cx="${x}" cy="${y}" rx="6.4" ry="4.6" transform="rotate(-20 ${x} ${y})" fill="${hollow ? 'none' : 'currentColor'}" stroke="currentColor" stroke-width="${hollow ? 1.8 : 1}"/>`;
    if (n.d > 1) { const sx = up ? x + 5.6 : x - 5.6, y2 = up ? y - 30 : y + 30; items += `<line x1="${sx}" x2="${sx}" y1="${y}" y2="${y2}" stroke="currentColor" stroke-width="1.5"/>`; if (n.d === 8) items += `<path d="M${sx} ${y2} q 8 ${up ? 8 : -8} 7 ${up ? 18 : -18}" fill="none" stroke="currentColor" stroke-width="1.6"/>`; }
    items += `<text x="${x}" y="104" fill="#f4eefe" font-size="11" font-weight="700" text-anchor="middle">${esc(n.ru)}</text>`;
    if (pos) items += `<text x="${x}" y="119" fill="#22d3ee" font-size="9.5" font-weight="700" text-anchor="middle">${pos.str}·${pos.f}</text>`;
    items += '</g>'; x += step;
  });
  let s = `<svg viewBox="0 0 ${w} 126" width="${w}" height="126" class="stf">`;
  for (let st = 30; st <= 38; st += 2) s += `<line x1="6" x2="${w - 6}" y1="${Y(st)}" y2="${Y(st)}" stroke="#7d6c9c" stroke-width="1"/>`;
  s += `<text x="10" y="${Y(30) + 10}" fill="#f4eefe" font-size="50" font-family="'Noto Music','Segoe UI Symbol','Bravura',serif">𝄞</text>`;
  s += `<line x1="${w - 6}" x2="${w - 6}" y1="${Y(38)}" y2="${Y(30)}" stroke="#a99bc4" stroke-width="2"/>`;
  return s + items + '</svg>';
}

/* ================= стандартный курс ================= */
const SH = ['↓', '·', '↓', '↑', '·', '↑', '↓', '↑'], V8 = ['↓', '↑', '↓', '↑', '↓', '↑', '↓', '↑'];
const DEF = [
  { id: 'l1', title: 'Знакомство и первый бой', desc: 'Как сидеть, как звучат струны и бой вниз под метроном.',
    learn: ['Сажусь с гитарой правильно: спина прямая, плечи свободные', 'Знаю номера струн: 1-я - самая тонкая, 6-я - самая толстая', 'Аккорд Em звучит чисто, без дребезга', 'Бой вниз ровно под метроном на 60'],
    blocks: [
      { t: 'text', text: '**Посадка.** Сядь на край стула, гитару положи выемкой корпуса на правую ногу. Гриф смотрит чуть вверх. Спина прямая, плечи расслаблены.\n**Струны** считают снизу вверх: 1-я - самая тонкая, 6-я - самая толстая. Открытые струны от 6-й к 1-й: ми, ля, ре, соль, си, ми.\n**Правая рука** бьёт по струнам над круглым отверстием (розеткой). Кисть свободная, как будто стряхиваешь воду с пальцев.' },
      { t: 'tip', text: 'Перед занятием настрой гитару: кнопка 🎯 внизу справа. Метроном - кнопка ⏱ рядом.' },
      { t: 'text', text: 'Первый аккорд - **Em** (ми минор). Нужно всего два пальца на 2-м ладу. Цифры в кружках - номера пальцев левой руки: 1 - указательный, 2 - средний, 3 - безымянный, 4 - мизинец.' },
      { t: 'chords', ch: ['Em'] },
      { t: 'strum', title: 'Бой вниз на Em', pat: ['↓', '↓', '↓', '↓'], beats: 4, ch: ['Em'], bars: 1, bpm: 60 }
    ] },
  { id: 'l2', title: 'Бой "шестёрка"', desc: 'Самый популярный бой и аккорд Am.',
    learn: ['Аккорд Am звучит чисто', 'Бой шестёрка медленно, на 60', 'Меняю Em и Am без остановки'],
    blocks: [
      { t: 'text', text: '**Шестёрка** - это шесть ударов: вниз, вниз-вверх, вверх-вниз-вверх. Рука всё время качается вверх-вниз ровно, как маятник, даже когда не задевает струны (точка · на схеме).\nСчитай вслух: "раз и два и три и четыре и". Удары вниз - на цифрах, вверх - на "и".' },
      { t: 'chords', ch: ['Am', 'Em'] },
      { t: 'strum', title: 'Шестёрка: Em и Am', pat: SH, beats: 4, ch: ['Em', 'Am'], bars: 2, bpm: 60 },
      { t: 'tip', text: 'Сначала играй вместе с сайтом. Потом выключи "гитару" и играй сам под щелчки. Получается ровно - прибавь темп на 5.' }
    ] },
  { id: 'l3', title: 'Перебор "четвёрка"', desc: 'Играем пальцами: бас и три струны.',
    learn: ['Нахожу бас у Am (5-я струна) и Em (6-я)', 'Перебор Б-3-2-1 на Am ровно', 'Перебор Б-3-2-1 со сменой Am и Em'],
    blocks: [
      { t: 'text', text: 'В переборе струны щиплют пальцами по одной. **Б** - бас: самая низкая струна аккорда. Её играет большой палец. 3-ю струну - указательный, 2-ю - средний, 1-ю - безымянный.\nНиже - **табулатура**: 6 линий - это струны (верхняя - 1-я, самая тонкая), цифры на линиях - лады. 0 - открытая струна.' },
      { t: 'pick', title: 'Четвёрка: Б-3-2-1', pat: 'Б 3 2 1', beats: 4, ch: ['Am', 'Em'], bars: 2, bpm: 70 },
      { t: 'tip', text: 'Большой палец играет только басы, остальные пальцы - каждый свою струну. Старайся не смотреть на правую руку - слушай.' }
    ] },
  { id: 'l4', title: 'Аккорды Am, Dm, E', desc: 'Три аккорда одной "семьи" и перебор "восьмёрка".',
    learn: ['Dm и E звучат чисто', 'Am-Dm-E-Am шестёркой, по 2 такта без остановки', 'Перебор Б-3-2-3-1-3-2-3', 'Тренажёр смены: 20 смен в минуту'],
    blocks: [
      { t: 'text', text: 'Эти три аккорда - одна "семья": песни в ля миноре часто держатся только на них. На схеме вертикальные линии - струны (слева 6-я), горизонтальные - лады.\n× над струной - её не играем, ○ - играем открытой.' },
      { t: 'chords', ch: ['Am', 'Dm', 'E'] },
      { t: 'strum', title: 'Шестёрка: Am-Dm-E-Am', pat: SH, beats: 4, ch: ['Am', 'Dm', 'E', 'Am'], bars: 2, bpm: 66 },
      { t: 'pick', title: 'Восьмёрка: Б-3-2-3-1-3-2-3', pat: 'Б 3 2 3 1 3 2 3', beats: 4, ch: ['Am', 'Dm', 'E', 'Am'], bars: 1, bpm: 60 },
      { t: 'tip', text: 'Быстрая смена: заранее смотри, куда пойдут пальцы, и переставляй их все вместе, а не по одному. Потренируйся во вкладке "Аккорды" - там тренажёр смены.' }
    ] },
  { id: 'l5', title: 'Ритм: считаем доли', desc: 'Четверти, восьмые, бой "восьмёрка" и вальс.',
    learn: ['Считаю вслух "раз-и-два-и" под метроном', 'Бой восьмёрка ровно на 70', 'Бас-бой на Am и E', 'Вальс на 3 доли'],
    blocks: [
      { t: 'text', text: 'Музыка делится на **такты**, в такте обычно 4 доли: "раз, два, три, четыре". Метроном щёлкает на каждую долю, первая - громче.\n**Четверть** - один звук на долю. **Восьмые** - два звука на долю: "раз-и". **Половинная** - один звук на две доли.' },
      { t: 'ref', to: 'rhythm' },
      { t: 'strum', title: 'Восьмёрка: Am и C', pat: V8, beats: 4, ch: ['Am', 'C'], bars: 2, bpm: 70 },
      { t: 'strum', title: 'Бас-бой: Б, вниз-вверх', pat: ['Б', '·', '↓', '↑', 'Б', '·', '↓', '↑'], beats: 4, ch: ['Am', 'E'], bars: 1, bpm: 70 },
      { t: 'strum', title: 'Вальс: Б, вниз, вниз', pat: ['Б', '↓', '↓'], beats: 3, ch: ['Am', 'E'], bars: 2, bpm: 96 }
    ] },
  { id: 'l6', title: 'Ноты на гитаре', desc: 'Немного нотной грамоты: 7 нот и первая мелодия.',
    learn: ['Знаю 7 нот: до ре ми фа соль ля си', 'Нахожу ноты на 1-й и 2-й струнах', 'Играю мелодию "Ода к радости"'],
    blocks: [
      { t: 'text', text: 'Нот всего 7: **до ре ми фа соль ля си**. Буквами: C D E F G A H. Дальше они повторяются выше или ниже - это **октава**.\nСоседние лады - это **полтона**. Между ми-фа и си-до - полтона, между остальными соседними нотами - целый тон (2 лада).' },
      { t: 'ref', to: 'fret' },
      { t: 'notes', title: '"Ода к радости" (Бетховен)', mel: 'E5 E5 F5 G5 | G5 F5 E5 D5 | C5 C5 D5 E5 | E5 D5 D5:2', bpm: 90 },
      { t: 'text', text: 'Под каждой нотой подписано её имя и где её играть: **1·3** - 1-я струна, 3-й лад. Ноты для гитары пишут в скрипичном ключе, а звучат они на октаву ниже записи.' }
    ] },
  { id: 'l7', title: 'Семьи аккордов и квинтовый круг', desc: 'Почему одни аккорды дружат, а другие нет.',
    learn: ['Играю C-Am-F-G (F упрощённый)', 'Играю G-Em-C-D', 'По кругу нахожу аккорды для любой тональности'],
    blocks: [
      { t: 'text', text: 'Аккорды, которые хорошо звучат вместе, - это "семья" (**тональность**). Найти семью помогает **квинтовый круг**: рядом по кругу стоят родственные аккорды, а внутри круга - их минорные "родственники". Нажми на любой аккорд в круге.' },
      { t: 'ref', to: 'circle' },
      { t: 'chords', ch: ['C', 'Am', 'F', 'G'] },
      { t: 'strum', title: 'Шестёрка: C-Am-F-G', pat: SH, beats: 4, ch: ['C', 'Am', 'F', 'G'], bars: 2, bpm: 70 },
      { t: 'strum', title: 'Восьмёрка: G-Em-C-D', pat: V8, beats: 4, ch: ['G', 'Em', 'C', 'D'], bars: 2, bpm: 70 }
    ] },
  { id: 'l8', title: 'Барэ', desc: 'Один палец прижимает все струны - и открываются все аккорды.',
    learn: ['Барэ на 2-м ладу звучит 10 секунд без дребезга', 'Hm звучит чисто', 'Смена Em-Hm-G-D шестёркой'],
    blocks: [
      { t: 'text', text: '**Барэ** - указательный палец лежит поперёк струн и работает как подвижный порожек. Форма аккорда та же, а лад меняет его название: сдвинул на лад выше - аккорд стал на полтона выше.' },
      { t: 'tip', text: 'Палец ставь ближе к ладовой пластине, чуть на ребро. Большой палец - сзади на середине грифа. Давит не сила пальцев, а вес руки.' },
      { t: 'chords', ch: ['Hm', 'F#m'] },
      { t: 'ref', to: 'barre' },
      { t: 'strum', title: 'Шестёрка: Em-Hm-G-D', pat: SH, beats: 4, ch: ['Em', 'Hm', 'G', 'D'], bars: 2, bpm: 66 }
    ] }
];

/* ================= состояние ================= */
let C = store.get('les_cache_' + CLUB, null) || clone(DEF);
let LP = store.get('studio_les', { d: {}, last: '' }); if (!LP.d) LP.d = {};
let VIEW = null;                     // id открытого урока или null - список
let SESS = null; try { SESS = JSON.parse(sessionStorage.getItem('spectr_sess') || 'null'); } catch (e) {}
let DRAFT = store.get('les_draft_' + CLUB, null), FROM_SERVER = false;
const canEdit = () => !!(SESS && SESS.user && (SESS.user.role === 'admin' || (SESS.user.clubs || []).some(c => c === CLUB || c === 'hub:spectr')));
const gk = t => { let h = 0; for (const ch of String(t)) h = (h * 31 + ch.charCodeAt(0)) | 0; return (h >>> 0).toString(36); };
const vis = () => C.filter(l => !l.hidden || canEdit());
function lstat(l) {
  const got = LP.d[l.id] || [], keys = (l.learn || []).map(gk), n = keys.filter(k => got.includes(k)).length;
  return { n, of: keys.length, done: keys.length > 0 && n === keys.length };
}
const saveLP = () => { store.set('studio_les', LP); if (window.SPK) SPK.sync(); };
(function () {                       // очки в рейтинг студии: 5 за пункт, 10 за урок целиком
  const base = window.SPK_PROGRESS;
  window.SPK_PROGRESS = () => {
    const r = base ? base() : { p: 0, b: 0, l: '' };
    let goals = 0, done = 0; C.forEach(l => { const s = lstat(l); goals += s.n; if (s.done) done++; });
    r.p += Math.min(goals * 5 + done * 10, 400); return r;
  };
})();

async function api(q) {
  let j; try { j = await (await fetch(API, { method: 'POST', body: JSON.stringify(Object.assign({}, q, q.op === 'login' ? {} : { token: SESS && SESS.token })) })).json(); }
  catch (e) { throw new Error('Нет связи с сервером'); }
  if (!j.ok) { if (j.auth) { SESS = null; try { sessionStorage.removeItem('spectr_sess'); } catch (e) {} } throw new Error(j.error || 'Ошибка сервера'); }
  return j;
}
function norm(list) {
  return (Array.isArray(list) ? list : []).filter(l => l && l.id && l.title).map(l => ({
    id: String(l.id), title: String(l.title), desc: String(l.desc || ''), tag: l.tag || '', hidden: !!l.hidden,
    learn: (Array.isArray(l.learn) ? l.learn : []).map(String).filter(Boolean), blocks: Array.isArray(l.blocks) ? l.blocks : []
  }));
}
async function load() {
  try {
    const j = await (await fetch(API, { method: 'POST', body: JSON.stringify({ op: 'lget', club: CLUB }) })).json();
    if (j && j.ok && Array.isArray(j.lessons)) {
      FROM_SERVER = true;
      const list = norm(j.lessons);
      C = list.length ? list : clone(DEF);
      store.set('les_cache_' + CLUB, list.length ? C : null);
      if (DRAFT && canEdit()) C = norm(DRAFT);
      render();
    }
  } catch (e) {}
}

/* ================= стили ================= */
const css = document.createElement('style');
css.textContent = `
.lhead{display:flex;gap:16px;align-items:flex-end;justify-content:space-between;flex-wrap:wrap;margin-bottom:14px}
.lsum{min-width:220px;flex:0 1 320px}.lsum small{color:var(--dim);font-weight:700;font-size:13px}
.lbar{height:10px;border-radius:99px;background:var(--bg2);border:1px solid var(--line);overflow:hidden;margin-top:6px}.lbar i{display:block;height:100%;width:0;background:linear-gradient(90deg,var(--pk),var(--yl));border-radius:99px;transition:width .8s cubic-bezier(.2,.8,.2,1)}
.lpin{display:grid;gap:8px;margin-bottom:14px}
.lpin button{display:flex;gap:10px;align-items:center;text-align:left;padding:12px 14px;border-radius:16px;border:1px solid rgba(250,204,21,.35);background:rgba(250,204,21,.07);color:var(--text);font:700 14.5px var(--fb);cursor:pointer}
.lpin button b{color:var(--yl)}
.llist{display:grid;gap:10px;counter-reset:l}
.lcard{position:relative;display:grid;grid-template-columns:54px 1fr auto;gap:14px;align-items:center;text-align:left;width:100%;padding:14px 16px;border-radius:20px;border:1px solid var(--line);background:color-mix(in srgb,var(--card) 88%,transparent);color:var(--text);cursor:pointer;font:inherit;transition:border-color .25s,translate .3s cubic-bezier(.3,1.5,.5,1),box-shadow .3s;animation:tin .5s backwards}
.lcard:hover{border-color:var(--pk);translate:0 -2px;box-shadow:0 14px 30px -14px rgba(255,45,138,.5)}
.lcard.hid{opacity:.55;border-style:dashed}
.ln{width:54px;height:54px;border-radius:16px;display:grid;place-items:center;font:800 22px var(--fh);background:var(--bg2);border:1px solid var(--line);color:var(--dim)}
.lcard.done .ln{background:linear-gradient(135deg,var(--ok),#14b8a6);color:#fff;border-color:transparent}
.lcard.part .ln{color:var(--yl);border-color:rgba(250,204,21,.5)}
.lcard b{display:block;font:700 16.5px var(--fh);line-height:1.25}.lcard small{display:block;color:var(--dim);font-size:13.5px;margin-top:2px}
.lcard .lp{height:5px;border-radius:9px;background:var(--bg2);margin-top:8px;overflow:hidden;max-width:260px}.lcard .lp i{display:block;height:100%;background:linear-gradient(90deg,var(--pk),var(--yl))}
.ltag{display:inline-block;margin-top:6px;font-size:12px;font-weight:800;padding:3px 9px;border-radius:99px;background:rgba(250,204,21,.12);color:var(--yl);border:1px solid rgba(250,204,21,.3)}
.lcnt{font-weight:800;font-size:13px;color:var(--dim);white-space:nowrap}
.lctl{display:flex;gap:6px;flex-wrap:wrap;margin:-4px 0 4px 68px}
.lctl button,.lbtn{height:34px;padding:0 11px;border-radius:10px;border:1px solid var(--line);background:var(--bg2);color:var(--text);font:700 13px var(--fb);cursor:pointer}
.lctl button:hover,.lbtn:hover{border-color:var(--pk)}
.lteach{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-top:18px;padding-top:14px;border-top:1px dashed var(--line)}
.lteach .lk{background:none;border:none;color:var(--dim);font:700 13px var(--fb);cursor:pointer;text-decoration:underline}
.lwarn{padding:12px 14px;border-radius:14px;background:rgba(239,68,68,.08);border:1px solid rgba(239,68,68,.35);font-size:14px;margin-bottom:12px;display:flex;gap:10px;align-items:center;flex-wrap:wrap}
.lv-top{display:flex;gap:8px;justify-content:space-between;align-items:center;flex-wrap:wrap;margin-bottom:12px}
.lv-h{display:flex;gap:16px;align-items:center;margin-bottom:16px}.lv-h .ln{width:64px;height:64px;font-size:26px;flex-shrink:0;background:linear-gradient(135deg,var(--pk),var(--vi));color:#fff;border:none}
.lv-h small{color:var(--dim);font-weight:800;font-size:12px;letter-spacing:1px;text-transform:uppercase}.lv-h h2{font:800 clamp(22px,4.4vw,32px)/1.12 var(--fh)}.lv-h p{color:var(--dim)}
.lgoal{margin-bottom:14px;border-color:rgba(250,204,21,.4)}.lgoal h3{font:700 17px var(--fh);margin-bottom:8px}
.lgoal label{display:flex;gap:10px;align-items:flex-start;padding:9px 6px;border-radius:12px;cursor:pointer;font-weight:600;transition:background .2s}
.lgoal label:hover{background:rgba(255,255,255,.04)}
.lgoal input{appearance:none;-webkit-appearance:none;flex-shrink:0;width:24px;height:24px;border-radius:8px;border:2px solid var(--line);background:var(--bg2);cursor:pointer;display:grid;place-items:center;transition:.2s;margin-top:-1px}
.lgoal input:checked{background:var(--ok);border-color:var(--ok)}.lgoal input:checked::after{content:"✓";color:#fff;font-weight:900;font-size:14px}
.lgoal label.on span{color:var(--dim);text-decoration:line-through;text-decoration-color:rgba(34,197,94,.7)}
.lblk{margin-bottom:14px}.lblk h3{font:700 17px var(--fh);margin-bottom:10px}
.ltxt p{margin:0 0 8px}.ltxt p:last-child{margin:0}.ltxt b{color:#fff}.ltxt ul{margin:0 0 8px 20px}
.ltip{padding:12px 14px;border-radius:16px;background:rgba(34,211,238,.07);border:1px solid rgba(34,211,238,.3);margin-bottom:14px;font-size:14.5px}
.lchs{display:flex;gap:10px;flex-wrap:wrap}
.lch{width:122px;padding:8px 6px 6px;border-radius:16px;border:1px solid var(--line);background:var(--bg2);color:var(--text);cursor:pointer;text-align:center;font:inherit;transition:border-color .2s,box-shadow .3s}
.lch:hover{border-color:var(--pk)}.lch b{font:800 18px var(--fh)}.lch small{display:block;color:var(--dim);font-size:11px;min-height:15px}
.lch.on{border-color:var(--pk);box-shadow:0 0 22px rgba(255,45,138,.45)}
.chd{width:100%;max-width:110px;height:auto;display:block;margin:2px auto 0}.chd-x{font:800 30px var(--fh);color:var(--dim);padding:20px 0}
.pl{display:grid;grid-template-columns:150px 1fr;gap:16px;align-items:center}@media(max-width:600px){.pl{grid-template-columns:1fr}}
.pl-now{text-align:center;padding:10px;border-radius:18px;background:linear-gradient(160deg,#1e0f36,#120a22);border:1px solid var(--line)}
.pl-now b{font:800 34px var(--fh);text-shadow:0 0 24px rgba(255,45,138,.6)}.pl-now .chd{max-width:120px}
@media(max-width:600px){.pl-now{display:grid;grid-template-columns:auto 96px;align-items:center;justify-content:center;gap:12px}}
.pl-chs{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px}
.pl-chs span{padding:6px 12px;border-radius:12px;background:var(--bg2);border:1px solid var(--line);font:800 15px var(--fh);transition:.15s}
.pl-chs span.on{background:linear-gradient(135deg,var(--pk),var(--vi));border-color:transparent;color:#fff;transform:translateY(-2px)}
.pl .strum{justify-content:flex-start;margin-top:0}
.strum i.b{font-size:18px;color:var(--yl)}.strum i.m{font-size:18px}
.pl-ctl{display:flex;gap:10px 14px;flex-wrap:wrap;align-items:center;margin-top:12px}
.pl-ctl label{display:flex;gap:6px;align-items:center;font-size:13px;color:var(--dim);font-weight:700}
.pl-ctl input[type=range]{accent-color:var(--pk);width:120px}
.pl-st{font-weight:800;font-size:13px;color:var(--yl);min-height:20px;margin-top:6px}
.tabw{overflow-x:auto;padding-bottom:4px}.tabw svg{display:block}
.stw{overflow-x:auto;color:#f4eefe;padding-bottom:4px}.stw svg{display:block}.stw .nt{cursor:pointer}.stw .nt.on{color:var(--pk)}
.lvid{display:flex;gap:12px;align-items:center;text-decoration:none;color:var(--text);padding:14px 16px;border-radius:18px;border:1px solid var(--line);background:var(--bg2);margin-bottom:14px;font-weight:700}
.lvid span{width:44px;height:44px;border-radius:50%;display:grid;place-items:center;background:linear-gradient(135deg,var(--pk),var(--vi));flex-shrink:0}
.lref{display:inline-flex;gap:8px;align-items:center;margin-bottom:14px}
.lnav{display:flex;gap:10px;justify-content:space-between;flex-wrap:wrap;margin-top:18px}
/* шпаргалка */
.rnav{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:16px;position:sticky;top:64px;z-index:5;padding:6px 0;background:linear-gradient(var(--bg) 70%,transparent)}
@media(max-width:860px){.rnav{position:static}}
.rsec{scroll-margin-top:140px;margin-bottom:18px}.rsec h3{font:700 20px var(--fh);margin-bottom:6px}.rsec>p.muted{margin-bottom:12px;font-size:14.5px}
.fbw{overflow-x:auto;padding-bottom:6px}.fbw svg{display:block}.fbw .fp{cursor:pointer}
.rout{margin-top:10px;font-weight:800;min-height:24px}
.dur{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px}
.dur .card{padding:12px;text-align:center}.dur svg{height:56px;display:block;margin:0 auto;color:#f4eefe}.dur b{display:block;font:700 15px var(--fh)}.dur small{color:var(--dim);display:block;margin-bottom:8px}
.legend{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:8px;margin-top:12px}
.legend div{display:flex;gap:10px;align-items:center;font-size:14px}.legend i{font-style:normal;width:36px;height:40px;flex-shrink:0;display:grid;place-items:center;border-radius:10px;background:var(--bg2);border:1px solid var(--line);font-size:20px;font-weight:800}
.semi{display:flex;gap:4px;overflow-x:auto;margin:8px 0}.semi span{min-width:42px;padding:8px 2px;text-align:center;border-radius:10px;background:var(--bg2);border:1px solid var(--line);font-weight:800;font-size:13px}
.semi span small{display:block;font-size:10px;color:var(--dim);font-weight:700}.semi span.r{background:var(--yl);color:#1a1030;border-color:transparent}.semi span.r small{color:#3b2a00}.semi span.t{background:linear-gradient(135deg,var(--pk),var(--vi));color:#fff;border-color:transparent}.semi span.t small{color:#ffe1f0}
.th2{display:grid;grid-template-columns:1fr 1fr;gap:12px}@media(max-width:700px){.th2{grid-template-columns:1fr}}
.cof{display:grid;grid-template-columns:minmax(0,340px) 1fr;gap:18px;align-items:start}@media(max-width:760px){.cof{grid-template-columns:1fr}}
.cof svg{width:100%;max-width:340px;display:block;margin:0 auto}.cof path{cursor:pointer;transition:fill .25s}.cof text{pointer-events:none;font-family:var(--fh)}
.fam{display:flex;gap:8px;flex-wrap:wrap;margin:10px 0}.fam button{min-width:64px;padding:8px 10px;border-radius:14px;border:1px solid var(--line);background:var(--bg2);color:var(--text);cursor:pointer;font:800 17px var(--fh)}
.fam button small{display:block;font:700 11px var(--fb);color:var(--dim)}.fam button.on{background:linear-gradient(135deg,var(--pk),var(--vi));border-color:transparent}
.bld{display:grid;grid-template-columns:150px 1fr;gap:18px;align-items:center;margin-top:12px}@media(max-width:600px){.bld{grid-template-columns:1fr}}
.bld .big2{text-align:center;padding:12px;border-radius:18px;background:linear-gradient(160deg,#1e0f36,#120a22);border:1px solid var(--line)}.bld .big2 b{font:800 36px var(--fh)}
.bld input,#bIn{width:150px;padding:9px 12px;border-radius:12px;border:1px solid var(--line);background:var(--bg2);color:var(--text);font:700 15px var(--fb)}
/* редактор */
#lm{position:fixed;inset:0;z-index:400;background:rgba(5,2,12,.72);display:none;align-items:flex-start;justify-content:center;overflow-y:auto;padding:24px 12px}
#lm.on{display:flex}#lm .mb{width:min(760px,100%);background:var(--card);border:1px solid var(--line);border-radius:22px;padding:18px;box-shadow:0 30px 80px rgba(0,0,0,.6);animation:tin .35s}
#lm h3{font:700 20px var(--fh);margin-bottom:10px}
#lm label.f{display:grid;gap:5px;font-size:13px;font-weight:800;color:var(--dim);margin-bottom:10px}
#lm input,#lm textarea,#lm select{width:100%;padding:10px 12px;border-radius:12px;border:1px solid var(--line);background:var(--bg2);color:var(--text);font:600 15px var(--fb)}
#lm textarea{min-height:90px;resize:vertical;line-height:1.45}
#lm .g3{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}@media(max-width:560px){#lm .g3{grid-template-columns:1fr 1fr}}
.eb{border:1px solid var(--line);border-radius:16px;padding:12px;margin-bottom:10px;background:rgba(255,255,255,.02)}
.eb-h{display:flex;gap:6px;align-items:center;margin-bottom:10px}.eb-h b{flex:1;font-size:14px}
.eb-h button{width:34px;height:34px;border-radius:10px;border:1px solid var(--line);background:var(--bg2);color:var(--text);cursor:pointer}
.ecells{display:flex;gap:6px;flex-wrap:wrap;margin:4px 0 10px}.ecells button{width:42px;height:48px;border-radius:12px;border:1px solid var(--line);background:var(--bg2);color:var(--text);font:800 20px var(--fb);cursor:pointer}
.eadd{display:flex;gap:6px;flex-wrap:wrap;margin:6px 0 14px}
.mbar{display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap;margin-top:12px;position:sticky;bottom:-18px;background:var(--card);padding:10px 0}
.ehint{font-size:12.5px;color:var(--dim);margin:-4px 0 10px}
/* плавающие тюнер и метроном */
#dock{position:fixed;right:14px;bottom:calc(14px + env(safe-area-inset-bottom));z-index:300;display:flex;flex-direction:column;align-items:flex-end;gap:10px;pointer-events:none}
#dock>*{pointer-events:auto}
.dkb{display:flex;gap:8px}
.dkb button{width:52px;height:52px;border-radius:50%;border:1px solid var(--line);background:rgba(22,13,39,.96);color:var(--text);font-size:22px;cursor:pointer;box-shadow:0 10px 26px -8px rgba(0,0,0,.7);transition:transform .2s}
.dkb button:active{transform:scale(.92)}.dkb button.run{border-color:var(--pk);box-shadow:0 0 0 3px rgba(255,45,138,.35),0 10px 26px -8px rgba(0,0,0,.7);animation:dkp 1.2s infinite}
@keyframes dkp{50%{box-shadow:0 0 0 7px rgba(255,45,138,.12),0 10px 26px -8px rgba(0,0,0,.7)}}
.dkp{width:min(300px,calc(100vw - 28px));background:rgba(22,13,39,.98);border:1px solid var(--line);border-radius:20px;padding:14px;box-shadow:0 20px 50px rgba(0,0,0,.6);animation:tin .3s}
.dkp h4{display:flex;justify-content:space-between;align-items:center;font:700 15px var(--fh);margin-bottom:8px}.dkp h4 button{background:none;border:none;color:var(--dim);font-size:18px;cursor:pointer}
.dkp .bn{font:800 46px var(--fh);text-align:center;line-height:1;background:linear-gradient(90deg,var(--pk),var(--yl));-webkit-background-clip:text;background-clip:text;color:transparent}
.dkp .row{margin-top:8px}.dkp .lamp{width:16px;height:16px}
.dkp .tn{font:800 46px var(--fh);text-align:center;line-height:1}.dkp .tn.ok{color:var(--ok)}
.dkp .cb{position:relative;height:12px;border-radius:9px;background:linear-gradient(90deg,#ef4444,#facc15 42%,#22c55e 50%,#facc15 58%,#ef4444);margin:10px 0 4px}
.dkp .cb i{position:absolute;top:-4px;bottom:-4px;width:4px;margin-left:-2px;left:50%;border-radius:3px;background:#fff;transition:left .15s}
.dkp .ct{text-align:center;font-size:12.5px;color:var(--dim);font-weight:700;min-height:18px}
.dkp .ss{display:grid;grid-template-columns:repeat(6,1fr);gap:4px;margin-top:8px}.dkp .ss button{height:36px;border-radius:10px;border:1px solid var(--line);background:var(--bg2);color:var(--text);font:800 13px var(--fh);cursor:pointer}
.dkp .ss button.hot{border-color:var(--ok);box-shadow:0 0 12px rgba(34,197,94,.5)}
@media(max-width:600px){.pl .strum{gap:5px}.pl .strum i{width:33px;height:44px;font-size:20px}.lcard{grid-template-columns:46px 1fr;gap:12px}.lcard .ln{width:46px;height:46px;font-size:19px}.lcnt{grid-column:2}.lctl{margin-left:0}}
`;
document.head.appendChild(css);

/* ================= текст с **жирным** и списками ================= */
function rich(t) {
  const lines = String(t || '').split('\n'); let out = '', ul = false;
  const fmt = s => esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
  lines.forEach(l => {
    if (/^\s*-\s+/.test(l)) { if (!ul) { out += '<ul>'; ul = true; } out += '<li>' + fmt(l.replace(/^\s*-\s+/, '')) + '</li>'; }
    else { if (ul) { out += '</ul>'; ul = false; } if (l.trim()) out += '<p>' + fmt(l) + '</p>'; }
  });
  return out + (ul ? '</ul>' : '');
}

/* ================= список уроков и урок ================= */
const T = $('#t-les');
const TAGS = { '': 'обычный', now: '📍 Проходим сейчас', hw: '📌 Выучить к занятию' };
function render() {
  if (!T) return; pStop();
  if (VIEW && !C.find(l => l.id === VIEW)) VIEW = null;
  VIEW ? renderLesson() : renderList();
}
function renderList() {
  const L = vis(); let goals = 0, got = 0; L.forEach(l => { const s = lstat(l); goals += s.of; got += s.n; });
  const pct = goals ? Math.round(got / goals * 100) : 0, ed = canEdit();
  const pins = L.filter(l => l.tag && !l.hidden);
  T.innerHTML = `
  ${ed && DRAFT ? `<div class="lwarn">⚠ Есть изменения, которые не сохранились на сервере. <button class="lbtn" id="lRetry">Отправить ещё раз</button></div>` : ''}
  <div class="lhead"><div><h2 class="sec">Уроки <em>гитары</em></h2><p class="sub" style="margin:0">Проходи по порядку. В каждом уроке - что нужно выучить. Отмечай ✓, когда получается.</p></div>
    <div class="lsum"><small>Выучено ${got} из ${goals} · ${pct}%</small><div class="lbar"><i id="lBarI"></i></div></div></div>
  ${pins.length ? `<div class="lpin">${pins.map(l => `<button data-id="${esc(l.id)}">${l.tag === 'now' ? '📍' : '📌'} <span><b>${l.tag === 'now' ? 'Сейчас проходим' : 'Выучить к занятию'}:</b> урок ${C.indexOf(l) + 1}, ${esc(l.title)}</span></button>`).join('')}</div>` : ''}
  <div class="llist">${L.map((l, i) => {
    const s = lstat(l), n = C.indexOf(l) + 1;
    return `<button class="lcard ${s.done ? 'done' : s.n ? 'part' : ''} ${l.hidden ? 'hid' : ''}" data-id="${esc(l.id)}" style="animation-delay:${i * 40}ms"><span class="ln">${s.done ? '✓' : n}</span>
      <span><b>${esc(l.title)}</b><small>${esc(l.desc)}</small>${l.tag ? `<span class="ltag">${TAGS[l.tag] || ''}</span>` : ''}${l.hidden ? '<span class="ltag">👁 черновик, ученики не видят</span>' : ''}
      ${s.of ? `<span class="lp"><i style="width:${Math.round(s.n / s.of * 100)}%"></i></span>` : ''}</span>
      <span class="lcnt">${s.of ? s.n + '/' + s.of : ''}</span></button>
      ${ed ? `<div class="lctl" data-id="${esc(l.id)}"><button data-a="edit">✎ Изменить</button><button data-a="up" aria-label="Выше">↑</button><button data-a="down" aria-label="Ниже">↓</button><button data-a="hide">${l.hidden ? '👁 Показать' : '🙈 Скрыть'}</button><button data-a="del">🗑</button></div>` : ''}`;
  }).join('')}</div>
  <div class="lteach">${ed ? `<button class="btn pri sm" id="lNew">+ Новый урок</button><button class="lbtn" id="lDef">↺ Стандартный курс</button><span class="muted" style="font-size:13px">Вы вошли как ${esc(SESS.user.name || 'педагог')}</span><button class="lk" id="lOut">Выйти</button>`
    : `<button class="lk" id="lIn">🔒 Вход для педагога</button>`}</div>`;
  requestAnimationFrame(() => { const b = $('#lBarI'); if (b) b.style.width = pct + '%'; });
  $$('#t-les .lcard,#t-les .lpin button').forEach(b => b.onclick = () => open(b.dataset.id));
  $$('#t-les .lctl button').forEach(b => b.onclick = () => ctl(b.parentNode.dataset.id, b.dataset.a));
  const on = (id, f) => { const e = $('#' + id); if (e) e.onclick = f; };
  on('lIn', login); on('lOut', () => { SESS = null; try { sessionStorage.removeItem('spectr_sess'); } catch (e) {} render(); });
  on('lNew', () => editLesson(null)); on('lRetry', () => saveAll());
  on('lDef', () => { if (confirm('Заменить все уроки стандартным курсом из 8 уроков? Ваши уроки будут удалены.')) { C = clone(DEF); saveAll(); } });
}
function open(id) {
  VIEW = id; LP.last = id; store.set('studio_les', LP); render();
  const t = $('#t-les'); if (t && t.getBoundingClientRect().top < 0) t.scrollIntoView({ behavior: 'smooth' });
}
function renderLesson() {
  const L = vis(), l = C.find(x => x.id === VIEW), i = L.indexOf(l), n = C.indexOf(l) + 1, s = lstat(l), got = LP.d[l.id] || [];
  const prev = L[i - 1], next = L[i + 1];
  T.innerHTML = `
  <div class="lv-top"><button class="btn sm" id="lBack">← Все уроки</button>${canEdit() ? '<button class="btn sm" id="lEd">✎ Изменить урок</button>' : ''}</div>
  <div class="lv-h"><span class="ln">${n}</span><div><small>Урок ${n} из ${C.length}${l.tag ? ' · ' + TAGS[l.tag] : ''}</small><h2>${esc(l.title)}</h2><p>${esc(l.desc)}</p></div></div>
  ${l.learn.length ? `<div class="card lgoal"><h3>🎯 Надо выучить <span class="muted" style="font:700 13px var(--fb)" id="lGc">${s.n} из ${s.of}</span></h3>
    ${l.learn.map(t => { const k = gk(t), on = got.includes(k); return `<label class="${on ? 'on' : ''}"><input type="checkbox" data-k="${k}" ${on ? 'checked' : ''}><span>${esc(t)}</span></label>`; }).join('')}</div>` : ''}
  ${l.blocks.map((b, bi) => blockHtml(b, bi)).join('')}
  <div class="lnav">${prev ? `<button class="btn" data-go="${esc(prev.id)}">← ${esc(prev.title)}</button>` : '<span></span>'}${next ? `<button class="btn pri" data-go="${esc(next.id)}">${esc(next.title)} →</button>` : ''}</div>`;
  $('#lBack').onclick = () => { VIEW = null; render(); };
  if ($('#lEd')) $('#lEd').onclick = () => editLesson(l.id);
  $$('#t-les [data-go]').forEach(b => b.onclick = () => open(b.dataset.go));
  $$('#t-les .lgoal input').forEach(cb => cb.onchange = () => {
    const a = LP.d[l.id] || (LP.d[l.id] = []), k = cb.dataset.k;
    if (cb.checked) { if (!a.includes(k)) a.push(k); } else a.splice(a.indexOf(k), 1);
    cb.parentNode.classList.toggle('on', cb.checked); saveLP();
    const st = lstat(l); $('#lGc').textContent = st.n + ' из ' + st.of;
    if (cb.checked && navigator.vibrate) navigator.vibrate(20);
    if (st.done && cb.checked) say('Урок выучен! +10 очков в рейтинг студии');
  });
  l.blocks.forEach((b, bi) => { const el = T.querySelector(`[data-b="${bi}"]`); if (el) bindBlock(el, b); });
}

/* ---------- блоки урока ---------- */
const BT = { text: '📝 Текст', tip: '💡 Совет', chords: '🎸 Аккорды', strum: '🥁 Бой', pick: '🖐 Перебор', notes: '🎼 Ноты', video: '🎬 Видео', ref: '📖 Шпаргалка' };
const REFS = { chart: 'Как читать схемы и табы', fret: 'Ноты на грифе', rhythm: 'Ритм и длительности', thirds: 'Терции: мажор и минор', circle: 'Квинтовый круг', builder: 'Конструктор аккордов', barre: 'Барэ' };
const chs = b => (Array.isArray(b.ch) ? b.ch : []).filter(okChord);
const SYM = { '↓': '', '↑': '', '·': 'x', '✕': 'm', 'Б': 'b' };
function blockHtml(b, bi) {
  const h = b.title ? `<h3>${esc(b.title)}</h3>` : '';
  switch (b.t) {
    case 'text': return `<div class="card lblk ltxt">${rich(b.text)}</div>`;
    case 'tip': return `<div class="ltip ltxt">${rich('💡 ' + (b.text || ''))}</div>`;
    case 'chords': return `<div class="card lblk" data-b="${bi}">${h}<div class="lchs">${(b.ch || []).map(c => { const sh = shape(c), pc = parseChord(c); return `<button class="lch" data-c="${esc(c)}"><b>${esc(c)}</b><small>${pc ? esc(RU[pc.root] + ' ' + (pc.q.k === '' ? 'мажор' : pc.q.k === 'm' ? 'минор' : pc.q.k)) : ''}</small>${diag(sh, c)}</button>`; }).join('')}</div><p class="muted" style="font-size:13px;margin-top:8px">Нажми на аккорд - он прозвучит.</p></div>`;
    case 'strum': case 'pick': {
      const cs = chs(b), first = cs[0];
      const pat = b.t === 'strum' ? `<div class="strum">${(b.pat || []).map(s => `<i class="${SYM[s] || ''}">${esc(s)}</i>`).join('')}</div>` : `<div class="tabw"></div>`;
      return `<div class="card lblk" data-b="${bi}">${h || `<h3>${b.t === 'strum' ? '🥁 Бой' : '🖐 Перебор'}</h3>`}
        <div class="pl"><div class="pl-now"><b>${esc(first || '?')}</b>${diag(first ? shape(first) : null, first)}</div>
        <div><div class="pl-chs">${cs.map((c, i) => `<span data-i="${i}">${esc(c)}</span>`).join('')}<span class="muted" style="background:none;border:none;font:700 12px var(--fb);align-self:center">по ${b.bars || 1} ${(b.bars || 1) === 1 ? 'такту' : 'такта'}, ${b.beats || 4}/4</span></div>${pat}
          <div class="pl-ctl"><button class="btn pri sm pl-go">▶ Играть вместе</button><label>Темп <input type="range" min="40" max="160" value="${+b.bpm || 70}" class="pl-bpm"> <b class="pl-bv">${+b.bpm || 70}</b></label>
          <label><input type="checkbox" class="pl-snd" checked> гитара</label><label><input type="checkbox" class="pl-clk" checked> щелчки</label></div>
          <div class="pl-st"></div></div></div></div>`;
    }
    case 'notes': return `<div class="card lblk" data-b="${bi}">${h}<div class="stw">${staff(parseMel(b.mel))}</div>
      <div class="pl-ctl"><button class="btn pri sm pl-go">▶ Сыграть</button><label>Темп <input type="range" min="40" max="160" value="${+b.bpm || 90}" class="pl-bpm"> <b class="pl-bv">${+b.bpm || 90}</b></label><span class="muted" style="font-size:13px">Нажми на ноту - она прозвучит.</span></div><div class="pl-st"></div></div>`;
    case 'video': { const ok = /^https:\/\/[^\s"'<>]+$/.test(b.url || ''); return ok ? `<a class="lvid" href="${esc(b.url)}" target="_blank" rel="noopener noreferrer"><span>▶</span>${esc(b.title || 'Смотреть видео')}</a>` : ''; }
    case 'ref': return REFS[b.to] ? `<button class="btn lref" data-ref="${esc(b.to)}">📖 Шпаргалка: ${esc(REFS[b.to])}</button>` : '';
  }
  return '';
}
function bindBlock(el, b) {
  if (b.t === 'chords') el.querySelectorAll('.lch').forEach(x => x.onclick = () => { strumSh(shape(x.dataset.c), false, 0, .3); x.classList.add('on'); setTimeout(() => x.classList.remove('on'), 600); });
  const go = el.querySelector('.pl-go'); if (!go) return;
  const rng = el.querySelector('.pl-bpm'), bv = el.querySelector('.pl-bv'), st = el.querySelector('.pl-st');
  rng.oninput = () => bv.textContent = rng.value;
  if (b.t === 'notes') return bindNotes(el, b, go, rng, st);
  const cs = chs(b); if (!cs.length) { st.textContent = 'Нет аккордов - добавьте их в редакторе'; go.disabled = true; return; }
  const snd = el.querySelector('.pl-snd'), clk = el.querySelector('.pl-clk'), beats = +b.beats || 4, bars = +b.bars || 1;
  const cells = () => el.querySelectorAll(b.t === 'strum' ? '.strum i' : '.tabw .tc'), chip = el.querySelectorAll('.pl-chs span[data-i]'), now = el.querySelector('.pl-now');
  const tokens = b.t === 'pick' ? String(b.pat || '').trim().split(/\s+/).filter(Boolean) : (b.pat || []);
  if (!tokens.length) { st.textContent = 'Нет рисунка - добавьте его в редакторе'; go.disabled = true; return; }
  let curC = -1;
  const setChord = ci => {
    if (ci === curC) return; curC = ci; const c = cs[ci];
    chip.forEach((x, i) => x.classList.toggle('on', i === ci));
    now.innerHTML = `<b>${esc(c)}</b>${diag(shape(c), c)}`;
    if (b.t === 'pick') el.querySelector('.tabw').innerHTML = tab(tokens, shape(c));
  };
  if (b.t === 'pick') el.querySelector('.tabw').innerHTML = tab(tokens, shape(cs[0]));
  const step = beats / tokens.length, ev = [], pre = [];
  cs.forEach((c, ci) => {
    const sh = shape(c);
    for (let r = 0; r < bars; r++) {
      const base = (ci * bars + r) * beats;
      tokens.forEach((s, si) => ev.push({
        b: base + si * step,
        fn: T => { if (!snd.checked) return; const w = T - AC.currentTime; if (b.t === 'strum') hitStrum(sh, s, w); else pickStrings(s, sh).forEach(i => pluck(OPEN[i] * Math.pow(2, sh.f[i] / 12), w, .34)); },
        vis: () => { setChord(ci); const cl = cells(); cl.forEach((x, k) => x.classList.toggle('on', k === si)); st.textContent = `Играем: ${c} · такт ${r + 1} из ${bars}`; }
      }));
      for (let bt = 0; bt < beats; bt++) ev.push({ b: base + bt, fn: T => { if (clk.checked) tick(T, bt === 0); } });
    }
  });
  ev.sort((x, y) => x.b - y.b);
  for (let i = 0; i < beats; i++) pre.push({ b: i, fn: T => tick(T, i === 0), vis: () => { st.textContent = 'Приготовься: ' + (beats - i); setChord(0); } });
  const reset = () => { go.textContent = '▶ Играть вместе'; st.textContent = ''; cells().forEach(x => x.classList.remove('on')); chip.forEach(x => x.classList.remove('on')); };
  go.onclick = () => {
    if (P && P.owner === el) { pStop(); return; }
    pStart({ ev, preEv: pre, pre: beats, len: cs.length * bars * beats, loop: true, bpm: () => +rng.value, end: reset });
    P.owner = el; go.textContent = '⏸ Стоп';
  };
}
function tab(tokens, sh) {
  const w = 40 + tokens.length * 40, y0 = 16, dy = 18, H = y0 + dy * 5 + 18, nm = ['e', 'H', 'G', 'D', 'A', 'E'];
  let s = `<svg viewBox="0 0 ${w} ${H}" width="${w}" height="${H}">`;
  for (let i = 0; i < 6; i++) s += `<text x="6" y="${y0 + dy * i + 4}" fill="#a99bc4" font-size="12" font-weight="700">${nm[i]}</text><line x1="22" x2="${w - 4}" y1="${y0 + dy * i}" y2="${y0 + dy * i}" stroke="#4a3a6a"/>`;
  tokens.forEach((t, k) => {
    const x = 40 + k * 40 + 6;
    s += `<g class="tc" data-k="${k}"><rect x="${x - 16}" y="2" width="32" height="${H - 4}" rx="8" fill="transparent"/>`;
    pickStrings(t, sh).forEach(i => { const y = y0 + dy * (5 - i); s += `<circle cx="${x}" cy="${y}" r="8.5" fill="#150c25" stroke="#ff2d8a" stroke-width="1.6"/><text x="${x}" y="${y + 4}" fill="#fff" font-size="11.5" font-weight="800" text-anchor="middle">${sh.f[i]}</text>`; });
    s += `<text x="${x}" y="${H - 1}" fill="#facc15" font-size="11" font-weight="800" text-anchor="middle">${esc(t)}</text></g>`;
  });
  return s + '</svg>';
}
// подсветка столбца таба - через тот же класс .on, что и у боя
const tabCss = document.createElement('style'); tabCss.textContent = '.tabw .tc.on rect{fill:rgba(255,45,138,.28)}'; document.head.appendChild(tabCss);
function bindNotes(el, b, go, rng, st) {
  const ns = parseMel(b.mel), g = el.querySelectorAll('.nt');
  const play1 = (n, w) => pluck(hz(n.midi - 12), w, .4);
  g.forEach((x, i) => x.onclick = () => { play1(ns[i], 0); x.classList.add('on'); setTimeout(() => x.classList.remove('on'), 300); });
  if (!ns.length) { go.disabled = true; return; }
  let t = 0; const ev = [];
  ns.forEach((n, i) => { const b0 = t; ev.push({ b: b0, fn: T => play1(n, T - AC.currentTime), vis: () => { g.forEach((x, k) => x.classList.toggle('on', k === i)); const sc = el.querySelector('.stw'), x = g[i]; if (sc && x) { const r = x.getBoundingClientRect(), R = sc.getBoundingClientRect(); if (r.right > R.right || r.left < R.left) sc.scrollLeft += r.left - R.left - 40; } } }); t += 4 / n.d; });
  const len = Math.ceil(t), pre = [0, 1, 2, 3].map(i => ({ b: i, fn: T => tick(T, i === 0), vis: () => st.textContent = 'Приготовься: ' + (4 - i) }));
  for (let bt = 0; bt < len; bt++) ev.push({ b: bt, fn: T => tick(T, bt % 4 === 0) });
  ev.sort((x, y) => x.b - y.b);
  const reset = () => { go.textContent = '▶ Сыграть'; st.textContent = ''; g.forEach(x => x.classList.remove('on')); };
  go.onclick = () => { if (P && P.owner === el) { pStop(); return; } pStart({ ev, preEv: pre, pre: 4, len, loop: false, bpm: () => +rng.value, end: reset }); P.owner = el; go.textContent = '⏸ Стоп'; st.textContent = ''; };
}
document.addEventListener('click', e => { const r = e.target.closest('[data-ref]'); if (r) goRef(r.dataset.ref); });

/* ================= шпаргалка ================= */
const R = $('#t-ref');
function goRef(id) { if (typeof show === 'function') show('ref'); setTimeout(() => { const s = $('#r-' + id); if (s) s.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 60); }
function renderRef() {
  if (!R) return;
  R.innerHTML = `<h2 class="sec">Шпаргалка <em>гитариста</em></h2><p class="sub">Самое нужное без сложных слов. Всё можно нажать и послушать.</p>
  <div class="rnav">${Object.entries(REFS).map(([k, v]) => `<button class="chip" data-r="${k}">${v}</button>`).join('')}</div>
  <div class="card rsec" id="r-chart"><h3>Как читать схемы и табы</h3>
    <div class="grid2"><div><p class="muted" style="margin-bottom:8px">Схема аккорда - это гриф, повёрнутый к тебе лицом:</p><ul style="margin-left:18px;font-size:14.5px">
      <li>вертикальные линии - струны, слева 6-я (толстая), справа 1-я;</li><li>горизонтальные - лады, сверху белая полоса - порожек;</li>
      <li>цифра в кружке - каким пальцем жать: 1 указательный, 2 средний, 3 безымянный, 4 мизинец;</li><li>○ - струна звучит открытой, × - её не играем;</li>
      <li>длинная полоса - барэ, цифра слева от схемы - номер лада.</li></ul></div>
      <div style="display:flex;gap:10px;justify-content:center;align-items:center"><div class="lch" style="cursor:default"><b>Am</b>${diag(shape('Am'), 'Am')}</div><div class="lch" style="cursor:default"><b>Hm</b>${diag(shape('Hm'), 'Hm')}</div></div></div>
    <p class="muted" style="margin-top:12px">Табулатура (таб) - 6 линий-струн, сверху 1-я. Цифра на линии - какой лад зажать, 0 - открытая струна. Читается слева направо.</p>
    <div class="tabw" style="margin-top:8px">${tab(['Б', '3', '2', '1', '2', '3'], shape('Am'))}</div></div>
  <div class="card rsec" id="r-fret"><h3>Ноты на грифе</h3><p class="muted">7 нот: до ре ми фа соль ля си (C D E F G A H). В русских песенниках си пишут H, а B - это си-бемоль. Нажми на лад - услышишь ноту.</p>
    <div class="cflt" id="fbM"></div><div class="fbw" id="fbW"></div><div class="rout" id="fbO"></div></div>
  <div class="card rsec" id="r-rhythm"><h3>Ритм и длительности</h3><p class="muted">Такт обычно из 4 долей. Нажми ▶ - услышишь щелчки метронома и ноты.</p><div class="dur" id="durW"></div>
    <div class="legend"><div><i>↓</i>удар вниз (от 6-й струны к 1-й)</div><div><i>↑</i>удар вверх, чаще по тонким струнам</div><div><i style="color:var(--dim)">·</i>пропуск: рука качается, но не задевает струны</div><div><i>✕</i>глушение: удар и сразу ладонь на струны</div><div><i style="color:var(--yl)">Б</i>бас: только самая низкая струна аккорда</div><div><i style="font-size:13px">3+2</i>в переборе: две струны одновременно</div></div></div>
  <div class="card rsec" id="r-thirds"><h3>Терции: почему мажор весёлый, а минор грустный</h3><p class="muted">Аккорд строится из терций - ступенек через одну ноту. <b>Большая терция</b> - 4 полутона (4 лада), <b>малая</b> - 3. Мажор = большая + малая, минор = малая + большая. Выбери ноту:</p>
    <div class="cflt" id="thR"></div><div class="th2" id="thW"></div></div>
  <div class="card rsec" id="r-circle"><h3>Квинтовый круг</h3><p class="muted">По кругу каждый следующий аккорд на квинту (7 полутонов) выше. Соседи по кругу и минорные аккорды внутри рядом с ними - одна семья. Нажми на аккорд.</p>
    <div class="cof"><div id="cofW"></div><div id="cofI"></div></div></div>
  <div class="card rsec" id="r-builder"><h3>Конструктор аккордов</h3><p class="muted">Выбери основную ноту (тонику) и вид - сайт соберёт аккорд, покажет ноты и найдёт, как его зажать. Жёлтый кружок - тоника, цифры - ступени: 3 - терция, 5 - квинта, 7 - септима.</p>
    <div class="cflt" id="bR"></div><div class="cflt" id="bQ"></div><div class="row" style="justify-content:flex-start"><input id="bIn" placeholder="или напиши: F#m7" autocomplete="off"><button class="btn sm" id="bGo">Собрать</button></div><div id="bOut"></div></div>
  <div class="card rsec" id="r-barre"><h3>Барэ: одна форма - 12 аккордов</h3><p class="muted">Выбери форму и двигай лад. Название меняется, а пальцы стоят так же. Барэ на 1-м ладу с формой E - это настоящий F.</p>
    <div class="cflt" id="brF"></div><div class="tr-set"><label>Лад <input type="range" id="brL" min="1" max="10" value="2"> <b id="brV">2</b></label></div><div class="bld" id="brO"></div></div>`;
  $$('#t-ref .rnav .chip').forEach(b => b.onclick = () => { const s = $('#r-' + b.dataset.r); if (s) s.scrollIntoView({ behavior: 'smooth' }); });
  initFret(); initDur(); initThirds(); initCof(); initBuilder(); initBarre();
}
/* гриф */
let fbMode = 'all', fbPick = -1;
function initFret() {
  const modes = { all: 'Все ноты', nat: 'Без диезов', hide: 'Скрыть' };
  const draw = () => {
    $('#fbM').innerHTML = Object.entries(modes).map(([k, v]) => `<button class="chip ${k === fbMode ? 'on' : ''}" data-m="${k}">${v}</button>`).join('') + ['C', 'D', 'E', 'F', 'G', 'A', 'H'].map(n => `<button class="chip ${fbPick === LET[n] ? 'on' : ''}" data-p="${LET[n]}">Где ${n}?</button>`).join('');
    $$('#fbM .chip').forEach(b => b.onclick = () => { if (b.dataset.m) { fbMode = b.dataset.m; fbPick = -1; } else fbPick = +b.dataset.p === fbPick ? -1 : +b.dataset.p; draw(); });
    const X0 = 34, FW = 50, Y0 = 18, DY = 24, W = X0 + 12 * FW + 10, H = Y0 + DY * 5 + 26;
    let s = `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}"><rect x="${X0}" y="${Y0 - 6}" width="${12 * FW}" height="${DY * 5 + 12}" rx="6" fill="#1c1130"/>`;
    [3, 5, 7, 9].forEach(f => s += `<circle cx="${X0 + (f - .5) * FW}" cy="${Y0 + DY * 2.5}" r="5" fill="#3a2a58"/>`);
    s += `<circle cx="${X0 + 11.5 * FW}" cy="${Y0 + DY * 1.5}" r="5" fill="#3a2a58"/><circle cx="${X0 + 11.5 * FW}" cy="${Y0 + DY * 3.5}" r="5" fill="#3a2a58"/>`;
    for (let f = 0; f <= 12; f++) s += `<line x1="${X0 + f * FW}" x2="${X0 + f * FW}" y1="${Y0 - 6}" y2="${Y0 + DY * 5 + 6}" stroke="${f ? '#6b5a8a' : '#f4eefe'}" stroke-width="${f ? 2 : 5}"/>` + (f ? `<text x="${X0 + (f - .5) * FW}" y="${H - 4}" fill="#a99bc4" font-size="11" font-weight="700" text-anchor="middle">${f}</text>` : '');
    for (let i = 0; i < 6; i++) s += `<line x1="${X0 - 26}" x2="${W - 6}" y1="${Y0 + DY * i}" y2="${Y0 + DY * i}" stroke="#b9a9d6" stroke-width="${.9 + i * .3}"/><text x="4" y="${Y0 + DY * i + 4}" fill="#a99bc4" font-size="10" font-weight="700">${i + 1}</text>`;
    for (let i = 0; i < 6; i++) for (let f = 0; f <= 12; f++) {
      const m = OM[5 - i] + f, pc = m % 12, nat = NN[pc].length === 1 && NN[pc] !== 'B', x = f ? X0 + (f - .5) * FW : X0 - 14, y = Y0 + DY * i;
      const showIt = fbPick >= 0 ? pc === fbPick : fbMode === 'all' || (fbMode === 'nat' && nat);
      s += `<g class="fp" data-m="${m}"><rect x="${x - FW / 2}" y="${y - DY / 2}" width="${FW}" height="${DY}" fill="transparent"/>${showIt ? `<circle cx="${x}" cy="${y}" r="10" fill="${pc === 0 ? '#facc15' : nat ? '#ff2d8a' : '#5b3f8c'}"/><text x="${x}" y="${y + 3.5}" fill="${pc === 0 ? '#1a1030' : '#fff'}" font-size="${nat ? 10 : 8.5}" font-weight="800" text-anchor="middle">${NN[pc]}</text>` : ''}</g>`;
    }
    $('#fbW').innerHTML = s + '</svg>';
    $$('#fbW .fp').forEach(g => g.onclick = () => { const m = +g.dataset.m; pluck(hz(m), 0, .45); $('#fbO').innerHTML = `<span style="color:var(--pk)">${NN[m % 12]}</span> - ${RU[m % 12]}`; });
  };
  draw();
}
/* длительности */
function noteSvg(d) {
  const x = 30, y = 44, hollow = d <= 2;
  let s = `<svg viewBox="0 0 60 64"><ellipse cx="${x}" cy="${y}" rx="9" ry="6.5" transform="rotate(-20 ${x} ${y})" fill="${hollow ? 'none' : 'currentColor'}" stroke="currentColor" stroke-width="2.2"/>`;
  if (d > 1) s += `<line x1="${x + 8}" x2="${x + 8}" y1="${y - 2}" y2="${y - 38}" stroke="currentColor" stroke-width="2"/>`;
  if (d === 8) s += `<path d="M${x + 8} ${y - 38} q 11 9 9 22" fill="none" stroke="currentColor" stroke-width="2.2"/>`;
  return s + '</svg>';
}
function initDur() {
  const D = [[1, 'Целая', 'одна нота на 4 доли'], [2, 'Половинная', 'на 2 доли'], [4, 'Четверть', 'на 1 долю'], [8, 'Восьмая', 'две на долю: "раз-и"']];
  $('#durW').innerHTML = D.map(d => `<div class="card">${noteSvg(d[0])}<b>${d[1]}</b><small>${d[2]}</small><button class="btn sm" data-d="${d[0]}">▶</button></div>`).join('');
  $$('#durW [data-d]').forEach(b => b.onclick = () => {
    const d = +b.dataset.d, ev = [];
    for (let i = 0; i < 4; i++) ev.push({ b: i, fn: T => tick(T, i === 0) });
    for (let i = 0; i < d; i++) ev.push({ b: i * 4 / d, fn: T => pluck(hz(57), T - AC.currentTime, .45), vis: () => { b.textContent = '♪'; } });
    ev.sort((x, y) => x.b - y.b);
    pStart({ ev, len: 4, loop: false, bpm: () => 80, end: () => b.textContent = '▶' });
  });
}
/* терции */
let thRoot = 9;
function initThirds() {
  const draw = () => {
    $('#thR').innerHTML = NN.map((n, i) => `<button class="chip ${i === thRoot ? 'on' : ''}" data-i="${i}">${n}</button>`).join('');
    $$('#thR .chip').forEach(b => b.onclick = () => { thRoot = +b.dataset.i; draw(); });
    $('#thW').innerHTML = [['', 'Мажор', 4], ['m', 'Минор', 3]].map(([k, nm, t1]) => {
      const name = NN[thRoot] + k, tones = [0, t1, 7];
      const strip = Array.from({ length: 8 }, (_, i) => `<span class="${i === 0 ? 'r' : tones.includes(i) ? 't' : ''}">${NN[(thRoot + i) % 12]}<small>${i}</small></span>`).join('');
      return `<div class="card"><div style="display:flex;gap:12px;align-items:center"><div class="lch" style="cursor:default;width:100px"><b>${esc(name)}</b>${diag(shape(name), name)}</div>
        <div><b style="font:800 18px var(--fh)">${nm}</b><p class="muted" style="font-size:13.5px">${t1 === 4 ? 'большая терция (4) + малая (3)' : 'малая терция (3) + большая (4)'}</p><p style="font-size:14px;font-weight:700">${tones.map(t => RU[(thRoot + t) % 12]).join(' - ')}</p>
        <div class="row" style="justify-content:flex-start;margin-top:6px"><button class="btn sm" data-p="${esc(name)}" data-a="1">▶ Аккорд</button><button class="btn sm" data-p="${esc(name)}" data-a="2">▶ По нотам</button></div></div></div>
        <div class="semi">${strip}</div></div>`;
    }).join('');
    $$('#thW [data-p]').forEach(b => b.onclick = () => { const pc = parseChord(b.dataset.p), base = 52 + (pc.root - 4 + 12) % 12; if (b.dataset.a === '1') strumSh(shape(b.dataset.p), false, 0, .3); else pc.q.iv.concat(12).forEach((t, i) => pluck(hz(base + t), i * .32, .4)); });
  };
  draw();
}
/* квинтовый круг */
const COF = [0, 7, 2, 9, 4, 11, 6, 1, 8, 3, 10, 5];
let cofSel = 0, cofMin = false;
function initCof() {
  const cx = 170, cy = 170, R1 = 162, R2 = 112, R3 = 68;
  const pt = (r, a) => [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  const sec = (ra, rb, a0, a1) => { const [x1, y1] = pt(rb, a0), [x2, y2] = pt(rb, a1), [x3, y3] = pt(ra, a1), [x4, y4] = pt(ra, a0); return `M${x1} ${y1}A${rb} ${rb} 0 0 1 ${x2} ${y2}L${x3} ${y3}A${ra} ${ra} 0 0 0 ${x4} ${y4}Z`; };
  const draw = () => {
    const fam = [(cofSel + 11) % 12, cofSel, (cofSel + 1) % 12];
    let s = `<svg viewBox="0 0 340 340">`;
    COF.forEach((pc, k) => {
      const a0 = (k * 30 - 105) * Math.PI / 180, a1 = (k * 30 - 75) * Math.PI / 180, am = (a0 + a1) / 2, inF = fam.includes(k);
      const selM = k === cofSel && !cofMin, selm = k === cofSel && cofMin, mn = NN[(pc + 9) % 12] + 'm';
      s += `<path d="${sec(R2, R1, a0 + .01, a1 - .01)}" data-k="${k}" fill="${selM ? '#ff2d8a' : inF ? '#5b3f8c' : '#1e1333'}" stroke="#2c1d47"/>`;
      s += `<path d="${sec(R3, R2 - 2, a0 + .012, a1 - .012)}" data-k="${k}" data-m="1" fill="${selm ? '#ff2d8a' : inF ? '#3f2b66' : '#160d27'}" stroke="#2c1d47"/>`;
      let [tx, ty] = pt((R1 + R2) / 2, am); s += `<text x="${tx}" y="${ty + 6}" fill="#fff" font-size="17" font-weight="800" text-anchor="middle">${NN[pc]}</text>`;
      [tx, ty] = pt((R2 + R3) / 2, am); s += `<text x="${tx}" y="${ty + 4}" fill="${inF ? '#fff' : '#a99bc4'}" font-size="11.5" font-weight="700" text-anchor="middle">${mn}</text>`;
    });
    s += `<circle cx="${cx}" cy="${cy}" r="${R3 - 4}" fill="#0f0820" stroke="#2c1d47"/><text x="${cx}" y="${cy - 4}" fill="#facc15" font-size="11" font-weight="800" text-anchor="middle">${cofMin ? 'минор' : 'мажор'}</text><text x="${cx}" y="${cy + 18}" fill="#fff" font-size="22" font-weight="800" text-anchor="middle">${cofMin ? NN[(COF[cofSel] + 9) % 12] + 'm' : NN[COF[cofSel]]}</text></svg>`;
    $('#cofW').innerHTML = s;
    $$('#cofW path').forEach(p => p.onclick = () => { cofSel = +p.dataset.k; cofMin = !!p.dataset.m; draw(); const c = cofMin ? NN[(COF[cofSel] + 9) % 12] + 'm' : NN[COF[cofSel]]; strumSh(shape(c), false, 0, .3); });
    const M = k => NN[COF[(k + 12) % 12]], m = k => NN[(COF[(k + 12) % 12] + 9) % 12] + 'm', k = cofSel;
    const famL = cofMin
      ? [['i', m(k), 'главный'], ['iv', m(k - 1), ''], ['v', m(k + 1), ''], ['V', NN[(COF[(k + 1) % 12] + 9) % 12], 'часто вместо v'], ['III', M(k), ''], ['VI', M(k - 1), ''], ['VII', M(k + 1), '']]
      : [['I', M(k), 'главный'], ['IV', M(k - 1), ''], ['V', M(k + 1), ''], ['vi', m(k), ''], ['ii', m(k - 1), ''], ['iii', m(k + 1), '']];
    const prog = cofMin ? [[famL[0][1], famL[1][1], famL[3][1], famL[0][1]], [famL[0][1], famL[5][1], famL[4][1], famL[6][1]]] : [[famL[0][1], famL[2][1], famL[3][1], famL[1][1]], [famL[0][1], famL[3][1], famL[1][1], famL[2][1]]];
    $('#cofI').innerHTML = `<b style="font:700 17px var(--fh)">Семья ${cofMin ? NN[(COF[k] + 9) % 12] + 'm (' + RU[(COF[k] + 9) % 12] + ' минор)' : NN[COF[k]] + ' (' + RU[COF[k]] + ' мажор)'}</b>
      <div class="fam">${famL.map(f => `<button data-c="${esc(f[1])}"><small>${f[0]}</small>${esc(f[1])}${f[2] ? `<small>${f[2]}</small>` : ''}</button>`).join('')}</div>
      <p class="muted" style="font-size:13.5px">Римские цифры - ступени: I - главный аккорд, IV и V - его соседи по кругу. Большие цифры - мажор, маленькие - минор.</p>
      <div class="row" style="justify-content:flex-start;margin-top:10px">${prog.map((p, i) => `<button class="btn sm" data-pr="${i}">▶ ${p.join(' - ')}</button>`).join('')}</div><div class="pl-st" id="cofS"></div>`;
    $$('#cofI .fam button').forEach(b => b.onclick = () => strumSh(shape(b.dataset.c), false, 0, .3));
    $$('#cofI [data-pr]').forEach(b => b.onclick = () => {
      const p = prog[+b.dataset.pr], ev = [];
      p.forEach((c, i) => { const sh = shape(c); [0, 1, 2, 3].forEach(bt => ev.push({ b: i * 4 + bt, fn: T => strumSh(sh, bt % 2 === 1, T - AC.currentTime, bt ? .2 : .28), vis: bt ? null : () => { $$('#cofI .fam button').forEach(x => x.classList.toggle('on', x.dataset.c === c)); $('#cofS').textContent = c; } })); });
      pStart({ ev, len: 16, loop: false, bpm: () => 100, end: () => { $$('#cofI .fam button').forEach(x => x.classList.remove('on')); const s = $('#cofS'); if (s) s.textContent = ''; } });
    });
  };
  draw();
}
/* конструктор */
let bRoot = 0, bQ = '';
function initBuilder() {
  const draw = () => {
    $('#bR').innerHTML = NN.map((n, i) => `<button class="chip ${i === bRoot ? 'on' : ''}" data-i="${i}">${n}</button>`).join('');
    $('#bQ').innerHTML = Q.map(q => `<button class="chip ${q.k === bQ ? 'on' : ''}" data-k="${q.k}">${q.k || 'мажор'}</button>`).join('');
    $$('#bR .chip').forEach(b => b.onclick = () => { bRoot = +b.dataset.i; draw(); });
    $$('#bQ .chip').forEach(b => b.onclick = () => { bQ = b.dataset.k; draw(); });
    out(NN[bRoot] + bQ);
  };
  const out = name => {
    const pc = parseChord(name);
    if (!pc) { $('#bOut').innerHTML = '<p class="rout" style="color:var(--bad)">Не понял аккорд. Примеры: Am, C7, F#m, Hsus4, Dmaj7.</p>'; return; }
    const sh = shape(name), notes = pc.q.iv.map(t => (pc.root + t) % 12), steps = pc.q.iv.slice(1).map((t, i) => t - pc.q.iv[i]);
    $('#bOut').innerHTML = `<div class="bld"><div class="big2"><b>${esc(name)}</b>${diag(sh, name)}</div><div>
      <p style="font:700 16px var(--fh)">${RU[pc.root]} ${esc(pc.q.n)}</p><p class="muted" style="font-size:14px">Звучит: ${esc(pc.q.d)}.</p>
      <p style="margin-top:8px;font-weight:700">Ноты: ${notes.map(n => `${NN[n]} <span class="muted">(${RU[n]})</span>`).join(' · ')}</p>
      <p class="muted" style="font-size:13.5px;margin-top:4px">Шаги: ${steps.map(s => `${s} ${s === 1 ? 'полутон' : s < 5 ? 'полутона' : 'полутонов'}${IVN[s] ? ' - ' + IVN[s] : ''}`).join(', ')}</p>
      ${sh && sh.auto ? '<p class="muted" style="font-size:12.5px;margin-top:4px">Аппликатура подобрана автоматически: пальцы ставь удобно, цифры в кружках - ступени аккорда.</p>' : ''}
      <div class="row" style="justify-content:flex-start;margin-top:10px"><button class="btn pri sm" id="bP1">▶ Аккорд</button><button class="btn sm" id="bP2">▶ По нотам</button></div></div></div>`;
    $('#bP1').onclick = () => strumSh(sh, false, 0, .3);
    $('#bP2').onclick = () => { const live = sh.f.map((v, i) => v === 'x' ? null : OPEN[i] * Math.pow(2, v / 12)).filter(Boolean); live.forEach((f, i) => pluck(f, i * .28, .4)); };
  };
  $('#bGo').onclick = () => { const v = $('#bIn').value.trim().replace(/\s+/g, ''); if (v) out(v); };
  $('#bIn').onkeydown = e => { if (e.key === 'Enter') $('#bGo').click(); };
  draw();
}
/* барэ */
const BF = { 'E-форма, мажор': { o: 4, m: '', f: [0, 2, 2, 1, 0, 0], p: '134211' }, 'E-форма, минор': { o: 4, m: 'm', f: [0, 2, 2, 0, 0, 0], p: '134111' }, 'A-форма, мажор': { o: 9, m: '', f: ['x', 0, 2, 2, 2, 0], p: 'x12341' }, 'A-форма, минор': { o: 9, m: 'm', f: ['x', 0, 2, 2, 1, 0], p: 'x13421' } };
let brK = 'E-форма, мажор';
function initBarre() {
  const draw = () => {
    $('#brF').innerHTML = Object.keys(BF).map(k => `<button class="chip ${k === brK ? 'on' : ''}" data-k="${k}">${k}</button>`).join('');
    $$('#brF .chip').forEach(b => b.onclick = () => { brK = b.dataset.k; draw(); });
    const n = +$('#brL').value, F = BF[brK], f = F.f.map(v => v === 'x' ? 'x' : v + n), sh = { f, p: F.p.split(''), b: n }, root = (F.o + n) % 12, name = NN[root] + F.m;
    $('#brV').textContent = n;
    $('#brO').innerHTML = `<div class="big2"><b>${esc(name)}</b>${diag(sh, name)}</div><div><p style="font:700 16px var(--fh)">${RU[root]} ${F.m ? 'минор' : 'мажор'}</p>
      <p class="muted" style="font-size:14px">Барэ на ${n}-м ладу. ${brK.startsWith('E') ? 'Тоника - на 6-й струне' : 'Тоника - на 5-й струне'}: какая нота под барэ, так и называется аккорд.</p>
      <button class="btn pri sm" id="brP" style="margin-top:10px">▶ Послушать</button></div>`;
    $('#brP').onclick = () => strumSh(sh, false, 0, .3);
  };
  $('#brL').oninput = draw; draw();
}

/* ================= редактор (по PIN) ================= */
let M = null;
function modal(html) { if (!M) { M = document.createElement('div'); M.id = 'lm'; document.body.appendChild(M); M.addEventListener('click', e => { if (e.target === M) closeM(); }); } M.innerHTML = `<div class="mb">${html}</div>`; M.classList.add('on'); document.body.style.overflow = 'hidden'; return M; }
function closeM() { if (M) M.classList.remove('on'); document.body.style.overflow = ''; }
addEventListener('keydown', e => { if (e.key === 'Escape' && M && M.classList.contains('on')) closeM(); });
function login() {
  modal(`<h3>Вход для педагога</h3><p class="muted" style="font-size:14px;margin-bottom:10px">PIN тот же, что на портале СПЕКТР. После входа появятся кнопки правки уроков.</p>
    <label class="f">PIN<input id="lPin" type="password" inputmode="numeric" maxlength="8" autocomplete="off"></label><div class="mbar"><button class="btn sm" id="lC">Отмена</button><button class="btn pri sm" id="lG">Войти</button></div>`);
  setTimeout(() => $('#lPin').focus(), 50);
  $('#lC').onclick = closeM; $('#lPin').onkeydown = e => { if (e.key === 'Enter') $('#lG').click(); };
  $('#lG').onclick = async () => {
    const b = $('#lG'); b.disabled = true; b.textContent = 'Проверяю…';
    try {
      const j = await api({ op: 'login', pin: $('#lPin').value.trim() });
      SESS = { token: j.token, user: j.user }; try { sessionStorage.setItem('spectr_sess', JSON.stringify(SESS)); } catch (e) {}
      closeM();
      if (!canEdit()) say('Этот PIN не даёт прав на уроки студии'); else { say('Режим педагога включён'); if (DRAFT) C = norm(DRAFT); }
      render();
    } catch (e) { say(e.message); b.disabled = false; b.textContent = 'Войти'; }
  };
}
async function saveAll() {
  const body = norm(C); store.set('les_draft_' + CLUB, body); DRAFT = body;
  try {
    const j = await api({ op: 'lsave', club: CLUB, lessons: body });
    C = norm(j.lessons && j.lessons.length ? j.lessons : body); DRAFT = null; store.set('les_draft_' + CLUB, null); store.set('les_cache_' + CLUB, C);
    say('Сохранено на сервере - ученики увидят изменения');
  } catch (e) {
    say('Не сохранилось: ' + e.message);
    if (!SESS) setTimeout(login, 400);
  }
  render();
}
function ctl(id, a) {
  const i = C.findIndex(l => l.id === id); if (i < 0) return; const l = C[i];
  if (a === 'edit') return editLesson(id);
  if (a === 'up' && i > 0) [C[i - 1], C[i]] = [C[i], C[i - 1]];
  else if (a === 'down' && i < C.length - 1) [C[i + 1], C[i]] = [C[i], C[i + 1]];
  else if (a === 'hide') l.hidden = !l.hidden;
  else if (a === 'del') { if (!confirm('Удалить урок "' + l.title + '"?')) return; C.splice(i, 1); }
  else return;
  saveAll();
}
const STR_P = { 'Вниз ×4': [['↓', '↓', '↓', '↓'], 4], 'Шестёрка': [SH, 4], 'Восьмёрка': [V8, 4], 'Четвёрка с глушением': [['↓', '✕', '↓', '✕'], 4], 'Бас-бой': [['Б', '·', '↓', '↑', 'Б', '·', '↓', '↑'], 4], 'Вальс': [['Б', '↓', '↓'], 3] };
const PICK_P = { 'Четвёрка': ['Б 3 2 1', 4], 'Восьмёрка': ['Б 3 2 3 1 3 2 3', 4], 'Шестёрка (3/4)': ['Б 3 2 1 2 3', 3], 'Вальс': ['Б 3+2+1 3+2+1', 3], 'Щипок': ['Б+1 3 2 3', 4], 'С переменным басом': ['Б 3 2 3 Б2 3 2 3', 4] };
const CYC = ['↓', '↑', '·', '✕', 'Б'];
function editLesson(id) {
  const src = id ? C.find(l => l.id === id) : null;
  const E = src ? clone(src) : { id: uid(), title: '', desc: '', tag: '', hidden: true, learn: [], blocks: [{ t: 'text', text: '' }] };
  const draw = () => {
    const box = modal(`<h3>${src ? 'Урок: ' + esc(src.title) : 'Новый урок'}</h3>
      <label class="f">Название<input data-f="title" value="${esc(E.title)}" maxlength="80"></label>
      <label class="f">Коротко, о чём урок<input data-f="desc" value="${esc(E.desc)}" maxlength="160"></label>
      <div class="g3"><label class="f">Отметка<select data-f="tag">${Object.entries(TAGS).map(([k, v]) => `<option value="${k}" ${E.tag === k ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
        <label class="f">Видимость<select data-f="hidden"><option value="" ${!E.hidden ? 'selected' : ''}>видят все</option><option value="1" ${E.hidden ? 'selected' : ''}>черновик</option></select></label></div>
      <label class="f">🎯 Надо выучить - каждый пункт с новой строки<textarea data-f="learn" placeholder="Например: Бой шестёрка на 70 без остановки">${esc(E.learn.join('\n'))}</textarea></label>
      <b style="display:block;margin:6px 0 8px">Блоки урока</b>
      ${E.blocks.map((b, i) => edBlock(b, i)).join('')}
      <div class="eadd">${Object.entries(BT).map(([k, v]) => `<button class="lbtn" data-add="${k}">+ ${v}</button>`).join('')}</div>
      <div class="mbar"><button class="btn sm" id="eC">Отмена</button><button class="btn pri sm" id="eS">💾 Сохранить урок</button></div>`);
    box.querySelectorAll('[data-f]').forEach(x => x.oninput = x.onchange = () => {
      const f = x.dataset.f; if (f === 'learn') E.learn = x.value.split('\n').map(s => s.trim()).filter(Boolean); else if (f === 'hidden') E.hidden = !!x.value; else E[f] = x.value;
    });
    box.querySelectorAll('[data-bk]').forEach(x => x.oninput = x.onchange = () => {
      const b = E.blocks[+x.dataset.bi], k = x.dataset.bk;
      if (k === 'ch') { b.ch = x.value.split(/[\s,]+/).map(s => s.trim()).filter(Boolean); const bad = b.ch.filter(c => !okChord(c)); const hint = x.parentNode.querySelector('.ehint'); if (hint) hint.textContent = bad.length ? 'Не знаю аккорд: ' + bad.join(', ') : 'Все аккорды найдены ✓'; }
      else if (['bpm', 'bars', 'beats'].includes(k)) b[k] = +x.value || 0; else b[k] = x.value;
    });
    box.querySelectorAll('[data-bm]').forEach(x => x.onclick = () => {
      const i = +x.dataset.bi, a = x.dataset.bm;
      if (a === 'up' && i > 0) [E.blocks[i - 1], E.blocks[i]] = [E.blocks[i], E.blocks[i - 1]];
      else if (a === 'down' && i < E.blocks.length - 1) [E.blocks[i + 1], E.blocks[i]] = [E.blocks[i], E.blocks[i + 1]];
      else if (a === 'del') { if (!confirm('Удалить блок?')) return; E.blocks.splice(i, 1); }
      redraw();
    });
    box.querySelectorAll('[data-cell]').forEach(x => x.onclick = () => { const b = E.blocks[+x.dataset.bi], k = +x.dataset.cell; b.pat[k] = CYC[(CYC.indexOf(b.pat[k]) + 1) % CYC.length]; x.textContent = b.pat[k]; });
    box.querySelectorAll('[data-len]').forEach(x => x.onchange = () => { const b = E.blocks[+x.dataset.bi], n = +x.value; b.pat = Array.from({ length: n }, (_, i) => b.pat[i] || '·'); redraw(); });
    box.querySelectorAll('[data-pre]').forEach(x => x.onclick = () => {
      const b = E.blocks[+x.dataset.bi], p = (b.t === 'strum' ? STR_P : PICK_P)[x.dataset.pre];
      b.pat = b.t === 'strum' ? p[0].slice() : p[0]; b.beats = p[1]; if (!b.title) b.title = x.dataset.pre; redraw();
    });
    box.querySelectorAll('[data-add]').forEach(x => x.onclick = () => {
      const t = x.dataset.add, nb = { t };
      if (t === 'text' || t === 'tip') nb.text = '';
      if (t === 'chords') nb.ch = ['Am', 'C'];
      if (t === 'strum') Object.assign(nb, { title: '', pat: SH.slice(), beats: 4, ch: ['Am', 'C'], bars: 2, bpm: 70 });
      if (t === 'pick') Object.assign(nb, { title: '', pat: 'Б 3 2 1', beats: 4, ch: ['Am', 'E'], bars: 1, bpm: 70 });
      if (t === 'notes') Object.assign(nb, { title: '', mel: 'C5 D5 E5 F5 | G5:2 G5:2', bpm: 90 });
      if (t === 'video') Object.assign(nb, { title: '', url: '' });
      if (t === 'ref') nb.to = 'circle';
      E.blocks.push(nb); redraw(true);
    });
    $('#eC').onclick = () => { if (confirm('Закрыть без сохранения?')) closeM(); };
    $('#eS').onclick = () => {
      if (!E.title.trim()) { say('Напишите название урока'); return; }
      const bad = E.blocks.find(b => b.t === 'video' && b.url && !/^https:\/\/[^\s"'<>]+$/.test(b.url)); if (bad) { say('Ссылка на видео должна начинаться с https://'); return; }
      const i = C.findIndex(l => l.id === E.id); if (i >= 0) C[i] = E; else C.push(E);
      closeM(); VIEW = src ? E.id : VIEW; saveAll();
    };
  };
  const redraw = toEnd => { const sc = M ? M.scrollTop : 0; draw(); if (M) M.scrollTop = toEnd ? M.scrollHeight : sc; };
  draw();
}
function edBlock(b, i) {
  const inp = (k, lab, v, extra) => `<label class="f">${lab}<input data-bi="${i}" data-bk="${k}" value="${esc(v == null ? '' : v)}" ${extra || ''}></label>`;
  const chIn = () => `<label class="f">Аккорды через пробел<input data-bi="${i}" data-bk="ch" value="${esc((b.ch || []).join(' '))}"><span class="ehint">${(b.ch || []).filter(c => !okChord(c)).length ? 'Не знаю аккорд: ' + esc((b.ch || []).filter(c => !okChord(c)).join(', ')) : 'Можно любые: Am, C7, F#m, Hsus4…'}</span></label>`;
  const sel = (k, lab, opts, v) => `<label class="f">${lab}<select data-bi="${i}" data-bk="${k}">${opts.map(o => `<option value="${o[0]}" ${String(v) === String(o[0]) ? 'selected' : ''}>${o[1]}</option>`).join('')}</select></label>`;
  let body = '';
  switch (b.t) {
    case 'text': case 'tip': body = `<label class="f">Текст. **слово** - жирным, строка с "- " - пункт списка<textarea data-bi="${i}" data-bk="text">${esc(b.text)}</textarea></label>`; break;
    case 'chords': body = chIn(); break;
    case 'strum': case 'pick':
      body = inp('title', 'Заголовок', b.title) + `<div class="ehint">Готовые: ${Object.keys(b.t === 'strum' ? STR_P : PICK_P).map(k => `<button class="lbtn" data-bi="${i}" data-pre="${esc(k)}">${esc(k)}</button>`).join(' ')}</div>`;
      if (b.t === 'strum') body += `<div class="ehint">Рисунок боя - нажимай на клетки: ↓ вниз, ↑ вверх, · пропуск, ✕ глушение, Б бас</div><div class="ecells">${(b.pat || []).map((s, k) => `<button data-bi="${i}" data-cell="${k}">${esc(s)}</button>`).join('')}</div>` + sel('len', 'Ударов в такте', [[3, 3], [4, 4], [6, 6], [8, 8]], (b.pat || []).length).replace('data-bk="len"', 'data-len="1"');
      else body += inp('pat', 'Рисунок перебора: Б - бас, Б2 - второй бас, 1-6 - струны, 3+2 - вместе', b.pat);
      body += chIn() + `<div class="g3">${sel('beats', 'Размер', [[4, '4/4'], [3, '3/4']], b.beats || 4)}${sel('bars', 'Тактов на аккорд', [[1, 1], [2, 2], [4, 4]], b.bars || 1)}${inp('bpm', 'Темп', b.bpm || 70, 'type="number" min="40" max="160"')}</div>`;
      break;
    case 'notes': body = inp('title', 'Заголовок', b.title) + `<label class="f">Мелодия: нота + октава (C5 D5 E5), :2 - половинная, :8 - восьмая, | - тактовая черта<textarea data-bi="${i}" data-bk="mel">${esc(b.mel)}</textarea></label>` + inp('bpm', 'Темп', b.bpm || 90, 'type="number" min="40" max="160"'); break;
    case 'video': body = inp('title', 'Подпись', b.title) + inp('url', 'Ссылка (YouTube, VK Видео, Rutube), начинается с https://', b.url, 'inputmode="url"'); break;
    case 'ref': body = sel('to', 'Раздел шпаргалки', Object.entries(REFS), b.to); break;
  }
  return `<div class="eb"><div class="eb-h"><b>${BT[b.t] || b.t}</b><button data-bi="${i}" data-bm="up" aria-label="Выше">↑</button><button data-bi="${i}" data-bm="down" aria-label="Ниже">↓</button><button data-bi="${i}" data-bm="del" aria-label="Удалить">✕</button></div>${body}</div>`;
}

/* ================= плавающие тюнер и метроном ================= */
const dock = document.createElement('div'); dock.id = 'dock';
dock.innerHTML = `<div class="dkp" id="dkM" hidden><h4>⏱ Метроном <button data-x="M" aria-label="Закрыть">✕</button></h4><div class="bn" id="dkBn">90</div>
  <div class="row"><button class="btn sm" data-dd="-5">-5</button><button class="btn sm" data-dd="-1">-1</button><button class="btn sm" data-dd="1">+1</button><button class="btn sm" data-dd="5">+5</button></div>
  <div class="row" id="dkL"></div><div class="row"><button class="btn pri sm" id="dkGo">▶ Старт</button></div></div>
  <div class="dkp" id="dkT" hidden><h4>🎯 Тюнер <button data-x="T" aria-label="Закрыть">✕</button></h4><div class="tn" id="dkN">-</div><div class="cb"><i id="dkC"></i></div><div class="ct" id="dkH">включи и дёрни струну</div>
  <div class="ss">${['E', 'A', 'D', 'G', 'H', 'E'].map((n, i) => `<button data-s="${i}">${n}<br><small>${6 - i}</small></button>`).join('')}</div><div class="row"><button class="btn pri sm" id="dkTo">🎙 Включить</button></div></div>
  <div class="dkb"><button id="dkTb" aria-label="Тюнер">🎯</button><button id="dkMb" aria-label="Метроном">⏱</button></div>`;
document.body.appendChild(dock);
const dkSync = () => {
  const mr = typeof mRun !== 'undefined' && mRun, tr = typeof tStream !== 'undefined' && !!tStream;
  $('#dkMb').classList.toggle('run', mr); $('#dkTb').classList.toggle('run', tr);
  $('#dkGo').textContent = mr ? '⏸ Стоп' : '▶ Старт'; $('#dkTo').textContent = tr ? '⏹ Выключить' : '🎙 Включить';
  if (typeof bpm !== 'undefined') $('#dkBn').textContent = bpm;
  if (!tr) window.DOCKT = false;
};
const dkLamps = () => { $('#dkL').innerHTML = Array.from({ length: typeof sig !== 'undefined' ? sig : 4 }, () => '<i class="lamp"></i>').join(''); };
$('#dkMb').onclick = () => { const p = $('#dkM'); p.hidden = !p.hidden; $('#dkT').hidden = true; dkLamps(); dkSync(); };
$('#dkTb').onclick = () => { const p = $('#dkT'); p.hidden = !p.hidden; $('#dkM').hidden = true; dkSync(); };
dock.querySelectorAll('[data-x]').forEach(b => b.onclick = () => { $('#dk' + b.dataset.x).hidden = true; });
dock.querySelectorAll('[data-dd]').forEach(b => b.onclick = () => { setBpm(bpm + +b.dataset.dd); dkSync(); });
$('#dkGo').onclick = () => { pStop(); if (mRun) mStop(); else { dkLamps(); mStart(); } dkSync(); };
$('#dkTo').onclick = async () => { if (tStream) { window.DOCKT = false; tOff(); } else { window.DOCKT = true; await tOnF(); } dkSync(); };
dock.querySelectorAll('[data-s]').forEach(b => b.onclick = () => pluck(OPEN[+b.dataset.s], 0, .5));
window.tunHook = (name, cents) => {
  if ($('#dkT').hidden) return;
  const n = $('#dkN'); n.textContent = name; n.classList.toggle('ok', Math.abs(cents) <= 5);
  $('#dkC').style.left = (50 + Math.max(-50, Math.min(50, cents))) + '%';
  $('#dkH').textContent = Math.abs(cents) <= 5 ? 'точно!' : cents < 0 ? 'ниже - подтяни струну' : 'выше - ослабь струну';
  $$('#strs button').forEach((b, i) => { const d = dock.querySelector(`[data-s="${i}"]`); if (d) d.classList.toggle('hot', b.classList.contains('hot')); });
};
setInterval(dkSync, 500);

/* ================= старт ================= */
render(); renderRef(); load();
})();
