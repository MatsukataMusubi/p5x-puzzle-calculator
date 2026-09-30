// renderer.js — UI 逻辑（红/黄/蓝 体系 + 服务器北京时间按日期解锁 + i18n 中/英）
(function () {
  'use strict';

  var CARDS = window.CARDS;   // {sn: {name, attrText, attr, shape, img}}
  var LEVELS = window.LEVELS; // [{sn, date, need, locked}]
  var counts = {};

  // ===== i18n 词条 =====
  var I18N = {
    zh: {
      pageTitle: 'P5X 怪盗团团长的特训日程 · 拼图计算器',
      langLabel: 'EN',
      logoSub: '拼图计算器 · 每日 04:00 更新',
      subDesc: '关卡按游戏日程解锁：服务器北京时间每天凌晨 4:00 后，当天的拼图关卡才会出现在列表里。输入你实际拥有的卡片数量 → 选关卡 → 点「开始运算」，列出全部摆法（卡不能旋转/翻转；判定=红/黄/蓝 三项 ≥ 目标即完成，不必铺满；灰色 ✕=锁定格）。',
      secLevel: '选择关卡',
      secResult: '运算结果',
      secCards: '我的卡片（输入数量，0 表示没有）',
      btnCalc: '开始运算',
      loading: '正在加载数据（约 90KB，请稍候）…',
      loadFail: '数据文件加载失败或未完成，请刷新页面重试（Ctrl+F5）。',
      follow: '觉得有用点个关注 →',
      timeSource: '时间源',
      srcBeijing: '北京时间(服务器)',
      srcLocal: '本地时间（服务器不可达）',
      unlockedTo: '已解锁至',
      nextLv: '下一关 {d} 关{sn} 将于 {d2} 凌晨{hour}:00 解锁',
      allUnlocked: '全部关卡已解锁',
      lvBtn: '关{sn}',
      inputFirst: '请先输入至少一张卡的数量',
      computing: '运算中…（卡库 {n} 种）',
      done: '完成：{n} 个解（{s}s）',
      noSol: '该关卡在「这些卡数量」下没有可行摆法（换关卡或加卡数量再试）。',
      notCalc: '未计算',
      previewBadge: '棋盘预览 · 未计算',
      previewHint: '已选择 {d} 关{sn} —— 调整卡片数量后点「开始运算」才会列出摆法。',
      prev: '上一解',
      next: '下一解',
      target: '目标',
      reached: '达成',
      useCards: '用卡 {n} 张：',
      solOf: '解法 {i}/{n} · {k}张',
      cardLine: '{attr} · {cells}格 · 解锁 {date}',
      attrNames: ['红', '黄', '蓝']
    },
    en: {
      pageTitle: 'P5X Phantom Thief Chief\u2019s Training Routine \u00b7 Puzzle Calculator',
      langLabel: '中',
      logoSub: 'Puzzle Calculator \u00b7 Updates daily 04:00',
      subDesc: 'Levels unlock per game schedule: after 4:00 AM (server Beijing time) each day, that day\u2019s puzzle appears. Enter the quantities of cards you own \u2192 pick a level \u2192 press "Calculate" to list all placements (cards can\u2019t rotate/flip; win = Red/Yellow/Blue all \u2265 target; gray \u2715 = locked).',
      secLevel: 'Select Level',
      secResult: 'Result',
      secCards: 'My Cards (set quantity, 0 = none)',
      btnCalc: 'Calculate',
      loading: 'Loading data (~90KB, please wait)\u2026',
      loadFail: 'Data failed to load. Please refresh (Ctrl+F5).',
      follow: 'Follow if helpful \u2192',
      timeSource: 'Time source',
      srcBeijing: 'Beijing time (server)',
      srcLocal: 'Local time (server unreachable)',
      unlockedTo: 'Unlocked up to',
      nextLv: 'Next {d} LV.{sn} unlocks at {hour}:00 on {d2}',
      allUnlocked: 'All levels unlocked',
      lvBtn: 'LV.{sn}',
      inputFirst: 'Enter at least one card quantity first',
      computing: 'Calculating\u2026 ({n} card types)',
      done: 'Done: {n} solutions ({s}s)',
      noSol: 'No placement with these quantities (try another level or add more cards).',
      notCalc: 'Not calculated',
      previewBadge: 'Board preview \u00b7 not calculated',
      previewHint: 'Selected {d} LV.{sn} \u2014 adjust card quantities, then press "Calculate" to list placements.',
      prev: 'Prev',
      next: 'Next',
      target: 'Target',
      reached: 'Achieved',
      useCards: 'Cards used ({n}):',
      solOf: 'Sol. {i}/{n} \u00b7 {k}pcs',
      cardLine: '{attr} \u00b7 {cells} cells \u00b7 Unlocks {date}',
      attrNames: ['Red', 'Yellow', 'Blue']
    }
  };
  // 语言：URL ?lang= > localStorage > 中文
  var lm = /[?&]lang=(zh|en)/.exec(window.location.search);
  var lang = lm ? lm[1] : (window.localStorage.getItem('p5x_lang') === 'en' ? 'en' : 'zh');
  var dict = I18N[lang];
  function t(key, vars) {
    var s = dict[key] !== undefined ? dict[key] : I18N.zh[key];
    if (vars) {
      s = String(s).replace(/\{(\w+)\}/g, function (m, k) { return vars[k] !== undefined ? vars[k] : m; });
    }
    return s;
  }
  var CNAME = dict.attrNames;
  var CCOL = ['#E8342E', '#E8A13D', '#3A7BD5'];
  function formatAttr(attr) {
    var parts = [];
    for (var i = 0; i < 3; i++) {
      if (attr[i] > 0) parts.push(CNAME[i] + attr[i]);
    }
    return parts.join(' ');
  }

  // 数据未加载完时的兜底提示
  if (!CARDS || !LEVELS || !CARDS['400450'] || !LEVELS.length) {
    var eb = document.getElementById('result');
    if (eb) eb.innerHTML = '<div class="status">' + t('loadFail') + '</div>';
    return;
  }

  // ===== 按日期解锁：服务器北京时间每天凌晨 UNLOCK_HOUR 点后，当天关卡才出现 =====
  var UNLOCK_HOUR = 4;
  var timeOffset = 0;        // ms：服务器北京时间 - 本地钟
  var timeSource = t('srcBeijing');
  function beijingNow() { return new Date(Date.now() + timeOffset); }
  function visibleDateOf(d) {
    var now = new Date(d.getTime());
    if (now.getHours() < UNLOCK_HOUR) now.setDate(now.getDate() - 1);
    var m = ('0' + (now.getMonth() + 1)).slice(-2);
    var dd = ('0' + now.getDate()).slice(-2);
    return now.getFullYear() + '-' + m + '-' + dd;
  }
  function shortDate(full) { return full ? full.substring(5) : ''; }
  // 初始：先用本地时间占位（server 时间取到后会校正）
  var vDate = visibleDateOf(beijingNow());
  var visibleLevels = LEVELS.filter(function (l) { return l.date <= vDate; });
  var nextLevel = LEVELS.filter(function (l) { return l.date > vDate; })[0] || null;
  var curLv = visibleLevels.length ? visibleLevels[visibleLevels.length - 1].sn : 0;
  var sols = [];
  var solIdx = 0;

  // need 数组 -> 彩色 span
  function needText(need) {
    var parts = [];
    for (var i = 0; i < 3; i++) {
      if (need[i] > 0) parts.push('<span style="color:' + CCOL[i] + ';font-weight:600;">' + CNAME[i] + need[i] + '</span>');
    }
    return parts.join(' ');
  }

  // 卡背景色：按 attr 数值判断（与语言无关）
  function colorOf(sn) {
    var a = CARDS[String(sn)].attr;
    var hasR = a[0] > 0, hasY = a[1] > 0, hasB = a[2] > 0;
    if (hasR && hasY && hasB) return '#C9A7E8';
    if (hasR && hasY) return '#EAA7B2';
    if (hasY && hasB) return '#F4B393';
    if (hasR) return '#EAA7B2';
    if (hasY) return '#F4B393';
    return '#94D8C3';
  }

  // ===== 静态文本（panel 标题、说明、按钮等） =====
  document.title = t('pageTitle');
  var subEl = document.querySelector('.sub');
  if (subEl) subEl.textContent = t('subDesc');
  document.getElementById('logoSub').textContent = t('logoSub');
  document.getElementById('secLevel').textContent = t('secLevel');
  document.getElementById('secResult').textContent = t('secResult');
  document.getElementById('secCards').textContent = t('secCards');
  document.getElementById('calcBtn').textContent = t('btnCalc');
  document.getElementById('loadTip').innerHTML = t('loading');
  var followEl = document.getElementById('followText');
  if (followEl) followEl.textContent = t('follow');
  var langBtn = document.getElementById('langBtn');
  langBtn.textContent = t('langLabel');
  langBtn.onclick = function () {
    try { window.localStorage.setItem('p5x_lang', lang === 'zh' ? 'en' : 'zh'); } catch (e) {}
    window.location.reload();
  };

  var lvbtns = document.getElementById('lvbtns');
  var statusEl = document.getElementById('status');

  function statusText() {
    return t('timeSource') + ' ' + timeSource + ' · ' + t('unlockedTo') + ' ' + vDate
      + (nextLevel ? '；' + t('nextLv', { d: shortDate(nextLevel.date), sn: nextLevel.sn, d2: nextLevel.date, hour: UNLOCK_HOUR }) : '；' + t('allUnlocked'));
  }

  function rebuildLevels() {
    lvbtns.innerHTML = '';
    visibleLevels.forEach(function (lv) {
      var b = document.createElement('button');
      b.className = 'lvbtn';
      b.textContent = lv.date.substring(5) + ' ' + t('lvBtn', { sn: lv.sn });
      b.onclick = function () {
        curLv = lv.sn;
        renderLvBtns();
        sols = []; solIdx = 0;
        statusEl.textContent = t('previewHint', { d: shortDate(lv.date), sn: lv.sn });
        renderResult();
      };
      lvbtns.appendChild(b);
    });
    renderLvBtns();
    statusEl.textContent = statusText();
  }
  function renderLvBtns() {
    var bs = lvbtns.children;
    for (var i = 0; i < bs.length; i++) {
      var lv = visibleLevels[i];
      bs[i].className = 'lvbtn' + (lv.sn === curLv ? ' active' : '');
    }
  }
  rebuildLevels();

  // 卡片区
  var cardsBox = document.getElementById('cards');
  Object.keys(CARDS).forEach(function (sn) {
    var c = CARDS[sn];
    var div = document.createElement('div');
    div.className = 'card';
    div.innerHTML = '<img src="' + c.img + '" alt="">'
      + '<div class="cn">' + c.name + '</div>'
      + '<div class="at">' + t('cardLine', { attr: formatAttr(c.attr), cells: c.shape.length, date: shortDate(c.unlockDate) }) + '</div>';
    var qty = document.createElement('div');
    qty.className = 'qty';
    var minus = document.createElement('button'); minus.textContent = '\u2212';
    var input = document.createElement('input'); input.type = 'number'; input.min = 0; input.max = 9; input.value = 1;
    var plus = document.createElement('button'); plus.textContent = '+';
    function setVal(v) {
      v = Math.max(0, Math.min(9, Math.floor(v) || 0));
      input.value = v;
      counts[sn] = v;
    }
    counts[sn] = 1; // 默认数量 1
    minus.onclick = function () { setVal(parseInt(input.value || 0, 10) - 1); };
    plus.onclick = function () { setVal(parseInt(input.value || 0, 10) + 1); };
    input.onchange = function () { setVal(parseInt(input.value || 0, 10)); };
    qty.appendChild(minus); qty.appendChild(input); qty.appendChild(plus);
    div.appendChild(qty);
    cardsBox.appendChild(div);
  });

  // 运算
  var calcBtn = document.getElementById('calcBtn');
  calcBtn.onclick = function () {
    var lv = LEVELS.filter(function (l) { return l.sn === curLv; })[0];
    var used = {};
    Object.keys(counts).forEach(function (sn) { if (counts[sn] > 0) used[sn] = counts[sn]; });
    if (Object.keys(used).length === 0) {
      statusEl.textContent = t('inputFirst');
      return;
    }
    calcBtn.disabled = true;
    statusEl.textContent = t('computing', { n: Object.keys(used).length });
    setTimeout(function () {
      var t0 = Date.now();
      sols = window.solveLevel(lv.need, lv.locked, used, { maxSols: 50, maxN: 12, budgetMs: 20000 });
      var dt = ((Date.now() - t0) / 1000).toFixed(1);
      solIdx = 0;
      statusEl.textContent = t('done', { n: sols.length, s: dt });
      calcBtn.disabled = false;
      renderResult();
    }, 30);
  };

  // 网格渲染（s 为空 = 仅显示目标锁定布局，preview=true 时加徽章）
  function renderGrid(lv, s, preview) {
    var locked = {};
    lv.locked.forEach(function (p) { locked[p[0] + ',' + p[1]] = 1; });
    var grid = {};
    if (s) s.placed.forEach(function (e) { e[1].forEach(function (c) { grid[c[0] + ',' + c[1]] = e[0]; }); });
    var cells = '';
    for (var row = 0; row < 5; row++) {
      var y = row;
      for (var x = 0; x < 5; x++) {
        var k = x + ',' + y;
        if (locked[k]) cells += '<div class="gcell glock">\u2715</div>';
        else if (grid[k]) cells += '<div class="gcell gused" style="background:' + colorOf(grid[k]) + '">' + (grid[k] % 100) + '</div>';
        else cells += '<div class="gcell gempty"></div>';
      }
    }
    var title = lv.date + ' · ' + t('lvBtn', { sn: lv.sn }) + '（' + t('target') + ' ' + needText(lv.need);
    if (s) title += ' \u2192 ' + t('reached') + ' ' + needText(s.total);
    title += '）';
    if (preview) title = '<span style="background:#9EACEA;color:#fff;border-radius:6px;padding:1px 8px;font-size:11px;font-weight:600;margin-right:6px;">' + t('previewBadge') + '</span>' + title;
    return '<div class="gridrow"><div class="gridbox"><div class="gt">' + title + '</div>'
      + '<div class="grid5">' + cells + '</div></div></div>';
  }

  // 结果渲染
  function renderResult() {
    var box = document.getElementById('result');
    var lv = LEVELS.filter(function (l) { return l.sn === curLv; })[0];
    if (sols.length === 0) {
      box.innerHTML = '<div class="status" style="font-weight:600;color:#9EACEA;margin-bottom:8px;">'
        + t('previewHint', { d: shortDate(lv.date), sn: lv.sn }) + '</div>'
        + renderGrid(lv, null, true);
      return;
    }
    var s = sols[solIdx];
    var cnt = {};
    s.combo.forEach(function (c) { cnt[c] = (cnt[c] || 0) + 1; });
    var cardsHtml = '';
    Object.keys(cnt).forEach(function (sn) {
      cardsHtml += '<div class="usecard"><img src="' + CARDS[sn].img + '" alt=""><div class="info"><div class="n">' + CARDS[sn].name + '</div><div class="a">' + formatAttr(CARDS[sn].attr) + '</div></div><div class="cnt">\u00d7' + cnt[sn] + '</div></div>';
    });
    var nav = '<div class="solnav"><button id="prevBtn">\u25c0 ' + t('prev', {}) + '</button>'
      + '<select id="solSel"></select>'
      + '<button id="nextBtn">' + t('next', {}) + ' \u25b6</button></div>';
    box.innerHTML = nav
      + renderGrid(lv, s)
      + '<div class="usecards"><div class="gt">' + t('useCards', { n: s.combo.length }) + '</div>' + cardsHtml + '</div>';
    var sel = document.getElementById('solSel');
    for (var i = 0; i < sols.length; i++) {
      var o = document.createElement('option');
      o.value = i;
      o.textContent = t('solOf', { i: (i + 1), n: sols.length, k: sols[i].combo.length });
      if (i === solIdx) o.selected = true;
      sel.appendChild(o);
    }
    sel.onchange = function () { solIdx = parseInt(this.value, 10); renderResult(); };
    document.getElementById('prevBtn').onclick = function () { if (solIdx > 0) { solIdx--; renderResult(); } };
    document.getElementById('nextBtn').onclick = function () { if (solIdx < sols.length - 1) { solIdx++; renderResult(); } };
    document.getElementById('prevBtn').disabled = (solIdx === 0);
    document.getElementById('nextBtn').disabled = (solIdx >= sols.length - 1);
  }

  renderResult();

  // ===== 服务器北京时间：多源获取，取到后校正日期 =====
  function tryFetch(url, parser) {
    return fetch(url, { cache: 'no-store' }).then(function (r) {
      if (!r.ok) throw new Error('http ' + r.status);
      return r.json();
    }).then(parser);
  }
  var sources = [
    // 主源：GitHub API（CORS 白名单暴露 X-RateLimit-Reset，UTC epoch 秒）
    function () {
      return fetch('https://api.github.com/rate_limit', { cache: 'no-store' }).then(function (r) {
        if (!r.ok) throw new Error('http ' + r.status);
        var t = parseInt(r.headers.get('X-RateLimit-Reset'), 10);
        return t ? t * 1000 : 0;
      });
    },
    // 备用（国外网络可达时使用）
    function () { return tryFetch('https://worldtimeapi.org/api/timezone/Asia/Shanghai', function (j) { return Date.parse(j.datetime); }); },
    function () { return tryFetch('https://timeapi.io/api/time/current/zone?timeZone=Asia/Shanghai', function (j) { return Date.parse(String(j.currentUtcTime || j.currentUtcTimeUtc || '').trim() + 'Z'); }); }
  ];
  function applyServerTime() {
    var i = 0;
    function next() {
      if (i >= sources.length) {
        timeSource = t('srcLocal');
        statusEl.textContent = statusText();
        renderResult();
        return;
      }
      sources[i++]().then(function (t) {
        if (!t || isNaN(t)) return next();
        timeOffset = t - Date.now();
        timeSource = t('srcBeijing');
        var nd = visibleDateOf(beijingNow());
        if (nd !== vDate) {
          vDate = nd;
          visibleLevels = LEVELS.filter(function (l) { return l.date <= vDate; });
          nextLevel = LEVELS.filter(function (l) { return l.date > vDate; })[0] || null;
          curLv = visibleLevels.length ? visibleLevels[visibleLevels.length - 1].sn : 0;
          sols = []; solIdx = 0;
          rebuildLevels();
          renderResult();
        } else {
          statusEl.textContent = statusText();
          renderResult();
        }
      }, next);
    }
    next();
  }
  applyServerTime();

  // 每分钟检查一次，跨过凌晨 4 点自动刷新关卡列表
  setInterval(function () {
    var nd = visibleDateOf(beijingNow());
    if (nd !== vDate) {
      vDate = nd;
      visibleLevels = LEVELS.filter(function (l) { return l.date <= vDate; });
      nextLevel = LEVELS.filter(function (l) { return l.date > vDate; })[0] || null;
      curLv = visibleLevels.length ? visibleLevels[visibleLevels.length - 1].sn : 0;
      sols = []; solIdx = 0;
      rebuildLevels();
      renderResult();
    }
  }, 60000);
})();
