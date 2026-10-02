// solver.js — P5X 拼图求解器（基于 GitHub 原版逻辑，输出层加组合级去重）
// 输入：need(3), locked(数组), counts(卡种->数量)
// 输出：{sols:[{combo, placed, total}], total, timedOut}
// 口径：卡片不可旋转/翻转；同一卡组（不同摆法）只算 1 个解；帕累托可开关；纯集合优先排序

(function (global) {
  'use strict';

  function solveLevel(need, locked, counts, opts) {
    opts = opts || {};
    var MAX_SOLS = opts.maxSols || 50;       // 最终展示上限
    var COLLECT_MAX = 120;                   // 搜索期内收集上限（排序后再截断，保证纯集合优先）
    var MAX_N = opts.maxN || 12;
    var BUDGET_MS = opts.budgetMs || 20000;
    var PER_CARD_MAX = 8; // 单卡最多使用数（受 counts 限制）

    var lockSet = {};
    locked.forEach(function (p) { lockSet[p[0] + ',' + p[1]] = 1; });

    // 可用卡（数量>0）；统一用字符串键访问 counts
    var lib = Object.keys(counts).filter(function (sn) { return counts[sn] > 0; }).sort();
    if (lib.length === 0) return { sols: [], total: 0, timedOut: false };

    // 预计算偏移
    var offs = {};
    lib.forEach(function (sn) {
      var sh = global.CARDS[sn].shape;
      var x0 = sh[0][0], y0 = sh[0][1];
      offs[sn] = sh.map(function (c) { return [c[0] - x0, c[1] - y0]; });
    });
    var attrs = {};
    lib.forEach(function (sn) { attrs[sn] = global.CARDS[sn].attr; });
    var cellsOf = {};
    lib.forEach(function (sn) { cellsOf[sn] = global.CARDS[sn].shape.length; });

    var t0 = Date.now();
    var solutions = [];
    var comboSeen = {};   // 组合级去重：同一卡组只算 1 解
    var timedOut = false;

    // 预计算后缀属性上界（剪枝用，O(1) 查询）
    var suffixMax = [];
    for (var ti = lib.length - 1; ti >= 0; ti--) {
      suffixMax[ti] = [0, 0, 0];
      var cap = Math.min(counts[lib[ti]], PER_CARD_MAX);
      for (var kk = 0; kk < 3; kk++) {
        suffixMax[ti][kk] = (suffixMax[ti + 1] ? suffixMax[ti + 1][kk] : 0) + attrs[lib[ti]][kk] * cap;
      }
    }

    // 找到该卡组的第一种合法摆法（不放满棋盘，只求能放下）
    function tryPlace(combo) {
      var totalCells = 0;
      combo.forEach(function (sn) { totalCells += cellsOf[sn]; });
      var freeCells = 25 - locked.length;
      if (totalCells > freeCells) return null;
      var grid = [];
      for (var i = 0; i < 5; i++) grid.push([0, 0, 0, 0, 0]);
      var placed = [];
      var found = null;

      function dfs(idx) {
        if (found) return;
        if (idx === combo.length) { found = placed.slice(); return; }
        var sn = combo[idx];
        for (var gx = 0; gx < 5; gx++) {
          if (found) return;
          for (var gy = 0; gy < 5; gy++) {
            var cells = offs[sn].map(function (o) { return [gx + o[0], gy + o[1]]; });
            var ok = true;
            for (var ci = 0; ci < cells.length; ci++) {
              var x = cells[ci][0], y = cells[ci][1];
              if (x < 0 || x > 4 || y < 0 || y > 4) { ok = false; break; }
              if (lockSet[x + ',' + y] || grid[y][x]) { ok = false; break; }
            }
            if (!ok) continue;
            for (ci = 0; ci < cells.length; ci++) grid[cells[ci][1]][cells[ci][0]] = 1;
            placed.push([sn, cells]);
            dfs(idx + 1);
            if (found) return;
            placed.pop();
            for (ci = 0; ci < cells.length; ci++) grid[cells[ci][1]][cells[ci][0]] = 0;
          }
        }
      }
      dfs(0);
      return found;
    }

    function gen(start, remaining, attr, combo, curCells) {
      if (Date.now() - t0 > BUDGET_MS) return 'timeout';
      if (solutions.length >= COLLECT_MAX) return;
      if (remaining === 0) {
        if (attr[0] >= need[0] && attr[1] >= need[1] && attr[2] >= need[2]) {
          var ck = combo.join(',');
          if (comboSeen[ck]) return;          // 同一卡组只留 1 解
          var placed = tryPlace(combo);
          if (!placed) return;                 // 摆不下 → 该卡组无解
          comboSeen[ck] = 1;
          solutions.push({ combo: combo.slice(), placed: placed, total: attr.slice() });
        }
        return;
      }
      // 剪枝：剩余卡最大贡献（O(1) 后缀上界）
      for (var i = 0; i < 3; i++) {
        if (attr[i] + suffixMax[start][i] < need[i]) return;
      }
      for (var k2 = start; k2 < lib.length; k2++) {
        var sn = lib[k2];
        var c = 0;
        for (var ci2 = 0; ci2 < combo.length; ci2++) if (combo[ci2] === sn) c++;
        if (c >= Math.min(counts[sn], PER_CARD_MAX)) continue;
        // 格数剪枝：已选格数 + 本卡格数不得超过可用格数
        if (curCells + cellsOf[sn] > freeCells) continue;
        combo.push(sn);
        var st = gen(k2, remaining - 1, [attr[0] + attrs[sn][0], attr[1] + attrs[sn][1], attr[2] + attrs[sn][2]], combo, curCells + cellsOf[sn]);
        combo.pop();
        if (st === 'timeout') return 'timeout';
        if (solutions.length >= COLLECT_MAX) return;
      }
    }

    var freeCells = 25 - locked.length;
    for (var n = 1; n <= MAX_N; n++) {
      if (Date.now() - t0 > BUDGET_MS) { timedOut = true; break; }
      var st2 = gen(0, n, [0, 0, 0], [], 0);
      if (st2 === 'timeout') { timedOut = true; break; }
      if (solutions.length >= COLLECT_MAX) break;
    }

    // —— 输出层 filter ——
    // 1) 帕累托（可选）：删任一卡仍达标 → 剔除
    if (opts.pareto) {
      solutions = solutions.filter(function (s) {
        var keep = true;
        var seenSn = {};
        s.combo.forEach(function (sn) {
          if (seenSn[sn]) return;
          seenSn[sn] = 1;
          if (s.total[0] - attrs[sn][0] >= need[0] &&
              s.total[1] - attrs[sn][1] >= need[1] &&
              s.total[2] - attrs[sn][2] >= need[2]) keep = false;
        });
        return keep;
      });
    }

    // 2) 排序：纯集合（每种卡只用 1 张）优先 → 卡总数少 → 属性超得少
    function hasDup(combo) {
      var seen2 = {}, d = 0;
      combo.forEach(function (sn) { if (seen2[sn]) d = 1; seen2[sn] = 1; });
      return d;
    }
    solutions.sort(function (a, b) {
      var da = hasDup(a.combo), db = hasDup(b.combo);
      if (da !== db) return da - db;
      if (a.combo.length !== b.combo.length) return a.combo.length - b.combo.length;
      var sa = a.total[0] + a.total[1] + a.total[2];
      var sb = b.total[0] + b.total[1] + b.total[2];
      return sa - sb;
    });

    // 3) 截断到展示上限
    var total = solutions.length;
    if (solutions.length > MAX_SOLS) solutions = solutions.slice(0, MAX_SOLS);

    return { sols: solutions, total: total, timedOut: timedOut };
  }

  global.solveLevel = solveLevel;
})(window);
