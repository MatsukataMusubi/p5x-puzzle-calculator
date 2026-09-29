// renderer.js — UI 逻辑（红/黄/蓝 体系 + 服务器北京时间按日期解锁）
(function () {
  'use strict';

  var CARDS = window.CARDS;   // {sn: {name, attrText, attr, shape, img}}
  var LEVELS = window.LEVELS; // [{sn, date, need, locked}]
  var counts = {};

  // ===== 按日期解锁：服务器北京时间每天凌晨 UNLOCK_HOUR 点后，当天关卡才出现 =====
  var UNLOCK_HOUR = 4;
  var timeOffset = 0;        // ms：服务器北京时间 - 本地钟
  var timeSource = '北京时间';
  function beijingNow() { return new Date(Date.now() + timeOffset); }
  function visibleDateOf(d) {
    var now = new Date(d.getTime());
    if (now.getHours() < UNLOCK_HOUR) now.setDate(now.getDate() - 1);
    var m = ('0' + (now.getMonth() + 1)).slice(-2);
    var dd = ('0' + now.getDate()).slice(-2);
    return now.getFullYear() + '-' + m + '-' + dd;
  }
  // 初始：先用本地时间占位（server 时间取到后会校正）
  var vDate = visibleDateOf(beijingNow());
  var visibleLevels = LEVELS.filter(function (l) { return l.date <= vDate; });
  var nextLevel = LEVELS.filter(function (l) { return l.date > vDate; })[0] || null;
  var curLv = visibleLevels.length ? visibleLevels[visibleLevels.length - 1].sn : 0;
  var sols = [];
  var solIdx = 0;

  var CNAME = ['红', '黄', '蓝'];
  var CCOL = ['#E8342E', '#E8A13D', '#3A7BD5'];

  // need 数组 -> 彩色 span
  function needText(need) {
    var parts = [];
    for (var i = 0; i < 3; i++) {
      if (need[i] > 0) parts.push('<span style="color:' + CCOL[i] + ';font-weight:600;">' + CNAME[i] + need[i] + '</span>');
    }
    return parts.join(' ');
  }

  function colorOf(sn) {
    var a = CARDS[String(sn)].attrText;
    var hasR = a.indexOf('红') >= 0, hasY = a.indexOf('黄') >= 0, hasB = a.indexOf('蓝') >= 0;
    if (hasR && hasY && hasB) return '#C9A7E8';
    if (hasR && hasY) return '#EAA7B2';
    if (hasY && hasB) return '#F4B393';
    if (hasR) return '#EAA7B2';
    if (hasY) return '#F4B393';
    return '#94D8C3';
  }

  var lvbtns = document.getElementById('lvbtns');
  var statusEl = document.getElementById('status');

  function statusText() {
    return '时间源 ' + timeSource + ' · 已解锁至 ' + vDate
      + (nextLevel ? '；下一关 ' + nextLevel.date.substring(5) + ' 关' + nextLevel.sn + ' 将于 ' + nextLevel.date + ' 凌晨' + UNLOCK_HOUR + ':00 解锁' : '；全部关卡已解锁');
  }

  function rebuildLevels() {
    lvbtns.innerHTML = '';
    visibleLevels.forEach(function (lv) {
      var b = document.createElement('button');
      b.className = 'lvbtn';
      b.textContent = lv.date.substring(5) + ' 关' + lv.sn;
      b.onclick = function () {
        curLv = lv.sn;
        renderLvBtns();
        sols = []; solIdx = 0;
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
      + '<div class="at">' + c.attrText + ' · ' + c.shape.length + '格 · 解锁 ' + c.unlockDate.substring(5) + '</div>';
    var qty = document.createElement('div');
    qty.className = 'qty';
    var minus = document.createElement('button'); minus.textContent = '−';
    var input = document.createElement('input'); input.type = 'number'; input.min = 0; input.max = 9; input.value = 0;
    var plus = document.createElement('button'); plus.textContent = '+';
    function setVal(v) {
      v = Math.max(0, Math.min(9, Math.floor(v) || 0));
      input.value = v;
      counts[sn] = v;
    }
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
      statusEl.textContent = '请先输入至少一张卡的数量';
      return;
    }
    calcBtn.disabled = true;
    statusEl.textContent = '运算中…（卡库 ' + Object.keys(used).length + ' 种）';
    setTimeout(function () {
      var t0 = Date.now();
      sols = window.solveLevel(lv.need, lv.locked, used, { maxSols: 50, maxN: 12, budgetMs: 20000 });
      var dt = ((Date.now() - t0) / 1000).toFixed(1);
      solIdx = 0;
      statusEl.textContent = '完成：' + sols.length + ' 个解（' + dt + 's）';
      calcBtn.disabled = false;
      renderResult();
    }, 30);
  };

  // 网格渲染（s 为空 = 仅显示目标锁定布局）
  function renderGrid(lv, s) {
    var locked = {};
    lv.locked.forEach(function (p) { locked[p[0] + ',' + p[1]] = 1; });
    var grid = {};
    if (s) s.placed.forEach(function (e) { e[1].forEach(function (c) { grid[c[0] + ',' + c[1]] = e[0]; }); });
    var cells = '';
    for (var row = 0; row < 5; row++) {
      var y = row;
      for (var x = 0; x < 5; x++) {
        var k = x + ',' + y;
        if (locked[k]) cells += '<div class="gcell glock">✕</div>';
        else if (grid[k]) cells += '<div class="gcell gused" style="background:' + colorOf(grid[k]) + '">' + (grid[k] % 100) + '</div>';
        else cells += '<div class="gcell gempty"></div>';
      }
    }
    var title = lv.date + ' · 关卡' + lv.sn + '（目标 ' + needText(lv.need);
    if (s) title += ' → 达成 ' + needText(s.total);
    title += '）';
    return '<div class="gridrow"><div class="gridbox"><div class="gt">' + title + '</div>'
      + '<div class="grid5">' + cells + '</div></div></div>';
  }

  // 结果渲染
  function renderResult() {
    var box = document.getElementById('result');
    var lv = LEVELS.filter(function (l) { return l.sn === curLv; })[0];
    if (sols.length === 0) {
      box.innerHTML = '<div class="status">' + (statusEl.textContent || '未计算') + '</div>'
        + renderGrid(lv, null);
      return;
    }
    var s = sols[solIdx];
    var cnt = {};
    s.combo.forEach(function (c) { cnt[c] = (cnt[c] || 0) + 1; });
    var cardsHtml = '';
    Object.keys(cnt).forEach(function (sn) {
      cardsHtml += '<div class="usecard"><img src="' + CARDS[sn].img + '" alt=""><div class="info"><div class="n">' + CARDS[sn].name + '</div><div class="a">' + CARDS[sn].attrText + '</div></div><div class="cnt">×' + cnt[sn] + '</div></div>';
    });
    var nav = '<div class="solnav"><button id="prevBtn">◀ 上一解</button>'
      + '<select id="solSel"></select>'
      + '<button id="nextBtn">下一解 ▶</button></div>';
    box.innerHTML = nav
      + renderGrid(lv, s)
      + '<div class="usecards"><div class="gt">用卡 ' + s.combo.length + ' 张：</div>' + cardsHtml + '</div>';
    var sel = document.getElementById('solSel');
    for (var i = 0; i < sols.length; i++) {
      var o = document.createElement('option');
      o.value = i;
      o.textContent = '解法 ' + (i + 1) + '/' + sols.length + ' · ' + sols[i].combo.length + '张';
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
    function () { return tryFetch('https://api.bilibili.com/x/server/time', function (j) { var t = parseInt(j && j.data, 10); return t ? t * 1000 : 0; }); },
    function () { return tryFetch('https://worldtimeapi.org/api/timezone/Asia/Shanghai', function (j) { return Date.parse(j.datetime); }); },
    function () { return tryFetch('https://timeapi.io/api/time/current/zone?timeZone=Asia/Shanghai', function (j) { return Date.parse(String(j.currentUtcTime || j.currentUtcTimeUtc || '').trim() + 'Z'); }); },
    function () { return tryFetch('https://api.m.taobao.com/rest/api3.do?api=mtop.common.getTimestamp', function (j) { return parseInt(j.data && j.data.t, 10); }); }
  ];
  function applyServerTime() {
    var i = 0;
    function next() {
      if (i >= sources.length) {
        timeSource = '本地时间（服务器不可达）';
        statusEl.textContent = statusText();
        renderResult();
        return;
      }
      sources[i++]().then(function (t) {
        if (!t || isNaN(t)) return next();
        timeOffset = t - Date.now();
        timeSource = '北京时间(服务器)';
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
