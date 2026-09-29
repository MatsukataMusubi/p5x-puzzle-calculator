// solver.js — P5X 拼图求解器（JS 版，算法与 Python 版一致）
// 输入：need(3), locked(数组), counts(卡种->数量)
// 输出：[{combo, placed, total}] 去重后的全部摆法

(function (global) {
  'use strict';

  function solveLevel(need, locked, counts, opts) {
    opts = opts || {};
    var MAX_SOLS = opts.maxSols || 50;
    var MAX_N = opts.maxN || 12;
    var BUDGET_MS = opts.budgetMs || 20000;
    var PER_CARD_MAX = 8; // 单卡最多使用数（受 counts 限制）

    var lockSet = {};
    locked.forEach(function (p) { lockSet[p[0] + ',' + p[1]] = 1; });

    // 可用卡（数量>0）；统一用字符串键访问 counts
    var lib = Object.keys(counts).filter(function (sn) { return counts[sn] > 0; }).sort();
    if (lib.length === 0) return [];

    // 预计算偏移（lib 现在是字符串键）
    var offs = {};
    lib.forEach(function (sn) {
      var sh = global.CARDS[sn].shape;
      var x0 = sh[0][0], y0 = sh[0][1];
      offs[sn] = sh.map(function (c) { return [c[0] - x0, c[1] - y0]; });
    });
    var attrs = {};
    lib.forEach(function (sn) { attrs[sn] = global.CARDS[sn].attr; });

    var t0 = Date.now();
    var solutions = [];
    var seen = {};

    function tryPlaceAll(combo) {
      var grid = [];
      for (var i = 0; i < 5; i++) grid.push([0, 0, 0, 0, 0]);
      var placed = [];
      var results = [];

      function dfs(idx) {
        if (results.length > 5000) return;
        if (idx === combo.length) { results.push(placed.slice()); return; }
        var sn = combo[idx];
        for (var gx = 0; gx < 5; gx++) {
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
            placed.pop();
            for (ci = 0; ci < cells.length; ci++) grid[cells[ci][1]][cells[ci][0]] = 0;
          }
        }
      }
      dfs(0);
      return results;
    }

    function norm(placed) {
      var key = [];
      placed.forEach(function (e) {
        var sn = e[0];
        e[1].forEach(function (c) { key.push(c[0] + ',' + c[1] + ',' + sn); });
      });
      key.sort();
      return key.join('|');
    }

    function gen(start, remaining, attr, combo) {
      if (Date.now() - t0 > BUDGET_MS) return 'timeout';
      if (solutions.length >= MAX_SOLS) return;
      if (remaining === 0) {
        if (attr[0] >= need[0] && attr[1] >= need[1] && attr[2] >= need[2]) {
          var placements = tryPlaceAll(combo);
          for (var pi = 0; pi < placements.length; pi++) {
            var k = norm(placements[pi]);
            if (seen[k]) continue;
            seen[k] = 1;
            solutions.push({ combo: combo.slice(), placed: placements[pi], total: attr.slice() });
            if (solutions.length >= MAX_SOLS) return;
          }
        }
        return;
      }
      // 剪枝：剩余卡最大贡献
      for (var i = 0; i < 3; i++) {
        var mx = 0;
        for (var j = start; j < lib.length; j++) {
          var snj = lib[j];
          var cap = Math.min(counts[snj], remaining);
          mx += attrs[snj][i] * cap;
        }
        if (attr[i] + mx < need[i]) return;
      }
      for (var k2 = start; k2 < lib.length; k2++) {
        var sn = lib[k2];
        var c = 0;
        for (var ci2 = 0; ci2 < combo.length; ci2++) if (combo[ci2] === sn) c++;
        if (c >= Math.min(counts[sn], PER_CARD_MAX)) continue;
        combo.push(sn);
        var st = gen(k2, remaining - 1, [attr[0] + attrs[sn][0], attr[1] + attrs[sn][1], attr[2] + attrs[sn][2]], combo);
        combo.pop();
        if (st === 'timeout') return 'timeout';
        if (solutions.length >= MAX_SOLS) return;
      }
    }

    for (var n = 1; n <= MAX_N; n++) {
      if (Date.now() - t0 > BUDGET_MS) break;
      var st2 = gen(0, n, [0, 0, 0], []);
      if (st2 === 'timeout') break;
      if (solutions.length >= MAX_SOLS) break;
    }
    return solutions;
  }

  global.solveLevel = solveLevel;
})(window);
