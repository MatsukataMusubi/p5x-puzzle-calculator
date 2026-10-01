# -*- coding: utf-8 -*-
"""验证：棋盘(锁定格)上下翻转 vs 原始，卡片形状不变"""
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
print('cards extracted:', len(CARDS))

LEVELS = [
    {'date': '09-27', 'sn': 4, 'need': [100, 120, 100],
     'locked': [[0, 4], [1, 4], [3, 0], [4, 0]]},
    {'date': '10-02', 'sn': 9, 'need': [80, 170, 40],
     'locked': [[0, 2], [0, 3], [1, 1], [1, 4], [2, 0], [2, 3], [3, 1], [3, 4], [4, 2], [4, 3]]},
]

def flip_board(locked):
    """棋盘上下翻转：y -> 4-y（5×5）"""
    return [[x, 4 - y] for x, y in locked]

def solve(need, locked, cards, counts, max_n=12, budget_ms=20000, max_sols=50):
    lock_set = {(p[0], p[1]) for p in locked}
    lib = sorted([sn for sn in cards if counts[sn] > 0])
    if not lib: return []
    offs = {}
    for sn in lib:
        sh = cards[sn]['shape']
        x0, y0 = sh[0]
        offs[sn] = [[c[0] - x0, c[1] - y0] for c in sh]
    t0 = time.time()
    solutions = []
    seen = set()

    def try_place(combo):
        grid = [[0] * 5 for _ in range(5)]
        placed = []
        results = []

        def dfs(idx):
            if len(results) > 5000: return
            if idx == len(combo):
                results.append([e[:] for e in placed]); return
            sn = combo[idx]
            for gx in range(5):
                for gy in range(5):
                    cells = [[gx + o[0], gy + o[1]] for o in offs[sn]]
                    ok = True
                    for x, y in cells:
                        if x < 0 or x > 4 or y < 0 or y > 4 or (x, y) in lock_set or grid[y][x]:
                            ok = False; break
                    if not ok: continue
                    for x, y in cells: grid[y][x] = 1
                    placed.append([sn, cells])
                    dfs(idx + 1)
                    placed.pop()
                    for x, y in cells: grid[y][x] = 0
        dfs(0)
        return results

    def norm(placed):
        key = []
        for sn, cells in placed:
            for x, y in cells:
                key.append('%d,%d,%s' % (x, y, sn))
        key.sort()
        return '|'.join(key)

    def gen(start, remaining, attr, combo):
        if time.time() - t0 > budget_ms: return 'timeout'
        if len(solutions) >= max_sols: return
        if remaining == 0:
            if attr[0] >= need[0] and attr[1] >= need[1] and attr[2] >= need[2]:
                for pl in try_place(combo):
                    k = norm(pl)
                    if k in seen: continue
                    seen.add(k)
                    solutions.append({'combo': combo[:], 'total': attr[:]})
                    if len(solutions) >= max_sols: return
            return
        for i in range(3):
            mx = 0
            for j in range(start, len(lib)):
                snj = lib[j]
                cap = min(counts[snj], remaining)
                mx += cards[snj]['attr'][i] * cap
            if attr[i] + mx < need[i]: return
        for k in range(start, len(lib)):
            sn = lib[k]
            if combo.count(sn) >= min(counts[sn], 8): continue
            combo.append(sn)
            st = gen(k, remaining - 1, [attr[0] + cards[sn]['attr'][0], attr[1] + cards[sn]['attr'][1], attr[2] + cards[sn]['attr'][2]], combo)
            combo.pop()
            if st == 'timeout': return 'timeout'
            if len(solutions) >= max_sols: return
    for n in range(1, max_n + 1):
        if time.time() - t0 > budget_ms: break
        if gen(0, n, [0, 0, 0], []) == 'timeout': break
        if len(solutions) >= max_sols: break
    return solutions

counts = {sn: 1 for sn in CARDS}  # 每卡默认1张

print('\n=== 棋盘口径对比（卡片形状不变）===')
for mode in ['orig', 'flip_board']:
    print('\n--- %s ---' % ('原始 locked' if mode == 'orig' else '棋盘上下翻转 locked'))
    for lv in LEVELS:
        locked = lv['locked'] if mode == 'orig' else flip_board(lv['locked'])
        t0 = time.time()
        sols = solve(lv['need'], locked, CARDS, counts)
        dt = time.time() - t0
        print('  %s 关%d  locked=%s' % (lv['date'], lv['sn'], locked))
        print('     → %s（%d解, %.1fs）' % ('有解' if sols else '无解', len(sols), dt))
        if sols:
            print('     首解组合:', sols[0]['combo'], '合计', sols[0]['total'])
