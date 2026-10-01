# -*- coding: utf-8 -*-
"""全关卡：原始 vs 棋盘翻转，可解性对比；10/2 加卡量测试"""
import re, json, time

s = open(r'C:\Users\guoha\.doubao\lark-chats\2026-09-28\new-chat-2\_p5x_web\data.js', encoding='utf-8').read()
i = s.find('window.CARDS')
j = s.find('window.LEVELS', i)
seg = s[i:j]
cards_raw = re.findall(r'"(\d{6})":\s*\{([^{}]*?)\}', seg)
CARDS = {}
for sn, body in cards_raw:
    attr = re.search(r'"attr":\s*\[(\d+),\s*(\d+),\s*(\d+)\]', body)
    shape = re.search(r'"shape":\s*(\[\[[\d,\s\[\]]*\]\])', body)
    if attr and shape:
        CARDS[sn] = {'attr': [int(attr.group(1)), int(attr.group(2)), int(attr.group(3))],
                     'shape': json.loads(shape.group(1))}

k = s.find('window.LEVELS')
j2 = s.find('window.CARDS', k)
seg2 = s[k:j2]
kk = seg2.find('[')
depth = 0; end = -1
for idx in range(kk, len(seg2)):
    ch = seg2[idx]
    if ch == '[': depth += 1
    elif ch == ']':
        depth -= 1
        if depth == 0: end = idx + 1; break
LEVELS = json.loads(seg2[kk:end])

def flip_board(locked):
    return [[x, 4 - y] for x, y in locked]

def solve(need, locked, cards, counts, max_n=12, budget_ms=8000, max_sols=5):
    lock_set = {(p[0], p[1]) for p in locked}
    lib = sorted([sn for sn in cards if counts[sn] > 0])
    offs = {}
    for sn in lib:
        sh = cards[sn]['shape']; x0, y0 = sh[0]
        offs[sn] = [[c[0] - x0, c[1] - y0] for c in sh]
    t0 = time.time(); solutions = []; seen = set()

    def try_place(combo):
        grid = [[0]*5 for _ in range(5)]; placed = []; results = []
        def dfs(idx):
            if len(results) > 5000: return
            if idx == len(combo): results.append([e[:] for e in placed]); return
            sn = combo[idx]
            for gx in range(5):
                for gy in range(5):
                    cells = [[gx+o[0], gy+o[1]] for o in offs[sn]]
                    ok = True
                    for x, y in cells:
                        if x < 0 or x > 4 or y < 0 or y > 4 or (x, y) in lock_set or grid[y][x]: ok = False; break
                    if not ok: continue
                    for x, y in cells: grid[y][x] = 1
                    placed.append([sn, cells]); dfs(idx+1); placed.pop()
                    for x, y in cells: grid[y][x] = 0
        dfs(0); return results

    def norm(placed):
        key = []
        for sn, cells in placed:
            for x, y in cells: key.append('%d,%d,%s' % (x, y, sn))
        key.sort(); return '|'.join(key)

    def gen(start, remaining, attr, combo):
        if time.time() - t0 > budget_ms: return 'timeout'
        if len(solutions) >= max_sols: return
        if remaining == 0:
            if attr[0] >= need[0] and attr[1] >= need[1] and attr[2] >= need[2]:
                for pl in try_place(combo):
                    kk2 = norm(pl)
                    if kk2 in seen: continue
                    seen.add(kk2); solutions.append(combo[:])
                    if len(solutions) >= max_sols: return
            return
        for i in range(3):
            mx = 0
            for j in range(start, len(lib)):
                snj = lib[j]; cap = min(counts[snj], remaining)
                mx += cards[snj]['attr'][i] * cap
            if attr[i] + mx < need[i]: return
        for k2 in range(start, len(lib)):
            sn = lib[k2]
            if combo.count(sn) >= min(counts[sn], 8): continue
            combo.append(sn)
            st = gen(k2, remaining-1, [attr[0]+cards[sn]['attr'][0], attr[1]+cards[sn]['attr'][1], attr[2]+cards[sn]['attr'][2]], combo)
            combo.pop()
            if st == 'timeout': return 'timeout'
            if len(solutions) >= max_sols: return
    for n in range(1, max_n+1):
        if time.time() - t0 > budget_ms: break
        if gen(0, n, [0,0,0], []) == 'timeout': break
        if len(solutions) >= max_sols: break
    return solutions

counts1 = {sn: 1 for sn in CARDS}
counts3 = {sn: 3 for sn in CARDS}

print('%-7s %-8s %-8s %-10s %-10s' % ('日期', '原始', '翻转', '翻转+卡3', '说明'))
for lv in LEVELS:
    orig = solve(lv['need'], lv['locked'], CARDS, counts1)
    flip = solve(lv['need'], flip_board(lv['locked']), CARDS, counts1)
    flip3 = solve(lv['need'], flip_board(lv['locked']), CARDS, counts3)
    def sgn(x): return '有解' if x else '无解'
    note = ''
    if not orig and flip: note = '← 翻转后才有解！'
    elif orig and not flip: note = '← 翻转后反而无解？'
    elif not flip and not flip3: note = '← 翻转+卡3仍无解⚠'
    print('%-7s %-8s %-8s %-10s %s' % (lv['date'], sgn(orig), sgn(flip), sgn(flip3), note))
