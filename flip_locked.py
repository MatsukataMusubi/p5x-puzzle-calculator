# -*- coding: utf-8 -*-
"""翻转 data.js 中 LEVELS 全部 locked：y -> 4-y"""
import re

p = r'C:\Users\guoha\.doubao\lark-chats\2026-09-28\new-chat-2\_p5x_web\data.js'
s = open(p, encoding='utf-8').read()

def flip(m):
    lst = m.group(1)
    items = re.findall(r'\[(\d+),\s*(\d+)\]', lst)
    out = ', '.join('[%d, %d]' % (int(x), 4 - int(y)) for x, y in items)
    return '"locked": [' + out + ']'

pat = re.compile(r'"locked":\s*(\[\s*\[\d+\s*,\s*\d+\](?:\s*,\s*\[\d+\s*,\s*\d+\])*\s*\])')
s2, n = pat.subn(flip, s)
print('flipped count:', n)
open(p, 'w', encoding='utf-8', newline='').write(s2)

# 打印验证（全部关卡 locked）
import json
i = s2.find('window.LEVELS')
k = s2.find(']', i)
# 简单字符串验证
for m in re.finditer(r'"sn":\s*(\d+),\s*"date":\s*"([\d-]+)",\s*"need":\s*(\[[\d,\s]+\]),\s*"locked":\s*(\[[\s\[\]\d,]*\])', s2):
    print(m.group(2), '关' + m.group(1), 'locked=' + m.group(4).replace(' ', ''))
