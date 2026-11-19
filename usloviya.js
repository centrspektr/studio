/* Курс "Гитара и ИИ". (c) 2026 Александр Наумов. Все права защищены. Копирование и переделка без разрешения автора запрещены. KFPV-AN-2026 */
/* Окно "Условия использования курса". Открывается любой ссылкой с атрибутом data-usl:
   на входе (под кнопками) и в "Настройках" курса (строка автора из config.js, поле author). */
(function () {
  'use strict';
  const PUNKTY = [
    'Курс - авторская разработка. Разработчик: Александр Наумов, 2026.',
    'Разработчику принадлежат тексты, задания и вопросы, сценарий модулей, схемы аккордов и рисунки, тренажёры со звуком, пульт Студии и код.',
    'Можно: проходить курс, заниматься по коду педагога, делиться ссылкой.',
    'Нельзя без письменного разрешения: копировать, переделывать и выкладывать у себя, выдавать за своё и убирать имя разработчика, продавать курс или доступ.',
    'Хотите взять курс для школы или кружка - напишите разработчику, договоримся.',
    'Сторонние части остаются под своими лицензиями: шрифты Inter и JetBrains Mono (SIL OFL 1.1), onnxruntime-web (MIT), сэмплы барабанов E-GMD (Google Magenta, CC BY 4.0). Нейросеть разложения песни SCNet (обучена на MUSDB18-HQ) и нейросеть барабанов (обучена в том числе на MDB Drums, CC BY-NC-SA 4.0) - только для учебного и некоммерческого использования.',
    'История создания с датами правок хранится в репозитории разработчика.'
  ];
  const COPY = '© 2026 Александр Наумов. Все права защищены.';
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const st = document.createElement('style');
  st.textContent = `
#uslD{position:fixed;inset:0;z-index:10003;display:grid;place-items:center;padding:16px;background:rgba(4,5,14,.78);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px)}
#uslD .usl{width:100%;max-width:520px;max-height:90vh;overflow:auto;box-sizing:border-box;padding:22px;border-radius:18px;background:#0c0d1e;border:1px solid rgba(167,139,250,.45);color:#e6edf3;font-family:inherit;line-height:1.5;box-shadow:0 20px 60px rgba(0,0,0,.5)}
#uslD h3{font-size:18px;margin:0 0 12px}
#uslD ul{margin:0 0 14px;padding-left:20px}#uslD li{margin:0 0 8px;font-size:14px}
#uslD .usl-c{font-size:13px;color:#8b98a5;margin:0 0 16px}
#uslD button{cursor:pointer;font:inherit;font-weight:600;font-size:15px;min-height:44px;padding:8px 22px;border-radius:10px;border:0;background:linear-gradient(135deg,#ff4fd8,#7c5cff);color:#04121b}
#uslD button:focus-visible,[data-usl]:focus-visible{outline:3px solid #facc15;outline-offset:2px}
.kr-set>.kr-author,.kr-author{font-size:12px;color:#8b98a5;margin:14px 0 0}
[data-usl]{color:#a78bfa;cursor:pointer}`;
  document.head.appendChild(st);

  let back = null;
  function close() { const d = document.getElementById('uslD'); if (d) d.remove(); document.removeEventListener('keydown', key, true); if (back && back.focus) back.focus(); }
  function key(e) {
    if (e.key === 'Escape') { e.preventDefault(); close(); }
    else if (e.key === 'Tab') { e.preventDefault(); const b = document.querySelector('#uslD button'); if (b) b.focus(); }
  }
  function open() {
    if (document.getElementById('uslD')) return;
    back = document.activeElement;
    const d = document.createElement('div'); d.id = 'uslD';
    d.innerHTML = '<div class="usl" role="dialog" aria-modal="true" aria-labelledby="uslT"><h3 id="uslT">Условия использования курса</h3><ul>' +
      PUNKTY.map(p => '<li>' + esc(p) + '</li>').join('') + '</ul><p class="usl-c">' + esc(COPY) + '</p><button type="button">Понятно</button></div>';
    d.addEventListener('click', e => { if (e.target === d || e.target.tagName === 'BUTTON') close(); });
    document.body.appendChild(d);
    document.addEventListener('keydown', key, true);
    d.querySelector('button').focus();
  }
  document.addEventListener('click', e => {
    const a = e.target.closest && e.target.closest('[data-usl]'); if (!a) return;
    e.preventDefault(); open();
  });
  window.kursyUsloviya = open;
})();
